import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Bell,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Instagram,
  Mail,
  MessageCircle,
  Newspaper,
  Pin,
  Sparkles,
  Youtube,
} from 'lucide-react';
import { useSite } from '../context/SiteContext';
import { trackAnalyticsEvent, trackSponsorImpressionOnce } from '../lib/analytics';
import {
  formatDropDateTime,
  formatDropPrice,
  formatKRW,
  formatKST,
  getDropStatusInfo,
  getEventStatus,
  getInstagramDmUrl,
  isRetailRaffleCategory,
  isValidExternalUrl,
  stripMarkdown,
} from '../lib/utils';
import { HomeSectionId, Product, Sponsor } from '../types/nova';
import { HeroSlider } from '../components/HeroSlider';
import { ProductQuickViewModal } from '../components/ProductQuickViewModal';
import { getButtonRadiusClass, getSectionSpacingClass } from '../components/PublicLayout';
import { SafeImage } from '../components/SafeImage';
import { SeoManager } from '../components/SeoManager';
import { ShopProductCard } from '../components/ShopProductCard';
import { SponsorBanner } from '../components/SponsorBanner';
import { WorkWithNovaSection } from '../components/WorkWithNovaSection';

function getAdaptiveColsClass(count: number, maxCols: 2 | 3 | 4 = 3): string {
  if (count <= 1) return 'grid-cols-1';
  if (count === 2 || maxCols === 2) return 'grid-cols-1 md:grid-cols-2';
  if (count === 3 || maxCols === 3) return 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3';
  return 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4';
}

function getDisplayDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

function getDropStatusPillClasses(st: { isEnded: boolean; isUrgent: boolean; isActive: boolean }): string {
  if (st.isEnded) return 'text-[#667085] bg-[#F5F6F8] border-[#E5E7EB]';
  if (st.isUrgent) return 'text-[#9A5012] bg-[#FDF4EB] border-[#F0CFAF]';
  if (st.isActive) return 'text-[#0F6B4B] bg-[#ECF7F2] border-[#B6DFCE]';
  return 'text-[#465C77] bg-[#F1F5F9] border-[#CBD5E1]';
}

interface PartnerLogoTileProps {
  sponsor: Sponsor;
  showSummary: boolean;
  onClickTrack: () => void;
}

const PartnerLogoTile: React.FC<PartnerLogoTileProps> = ({
  sponsor,
  showSummary,
  onClickTrack,
}) => {
  const tileRef = useRef<HTMLAnchorElement | null>(null);

  useEffect(() => {
    const el = tileRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      trackSponsorImpressionOnce(sponsor.id, sponsor.name, 'home_partners', '/');
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          trackSponsorImpressionOnce(sponsor.id, sponsor.name, 'home_partners', '/');
          observer.disconnect();
        }
      },
      { threshold: 0.35 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [sponsor.id, sponsor.name]);

  return (
    <a
      ref={tileRef}
      href={sponsor.url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={onClickTrack}
      className="group border border-[#E5E7EB] rounded-lg p-5 sm:p-6 bg-[#FFFFFF] flex flex-col justify-between gap-4 nova-card-hover hover:border-[#465C77]/60"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3.5 min-w-0">
          {sponsor.logoUrl ? (
            <div className="w-12 h-12 rounded-md border border-[#E5E7EB] bg-[#F5F6F8] overflow-hidden shrink-0">
              <SafeImage
                src={sponsor.logoUrl}
                alt={sponsor.name}
                fallbackTitle={sponsor.name}
                className="w-full h-full object-cover"
              />
            </div>
          ) : (
            <div className="w-12 h-12 rounded-md border border-[#E5E7EB] bg-[#F5F6F8] flex items-center justify-center shrink-0">
              <span className="font-brand text-sm font-bold text-[#111827] tracking-wider">
                {sponsor.name.slice(0, 2).toUpperCase()}
              </span>
            </div>
          )}

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-brand text-sm sm:text-base font-bold tracking-[0.14em] text-[#111827] truncate">
                {sponsor.name}
              </h3>
              {sponsor.isSponsored && (
                <span className="px-1.5 py-0.5 text-[10px] font-semibold border border-[#CBD5E1] text-[#465C77] bg-[#F1F5F9] rounded-sm shrink-0">
                  {sponsor.badgeLabel || '협찬'}
                </span>
              )}
            </div>
            <p className="text-[11px] font-mono-tabular text-[#667085] truncate mt-0.5">
              {getDisplayDomain(sponsor.url)}
            </p>
          </div>
        </div>

        <ExternalLink
          size={15}
          className="text-[#667085] group-hover:text-[#465C77] group-hover:translate-x-0.5 transition-all shrink-0"
        />
      </div>

      {showSummary && sponsor.description && (
        <p className="text-xs sm:text-[13px] text-[#667085] line-clamp-2 pt-3 border-t border-[#E5E7EB] leading-relaxed">
          {sponsor.description}
        </p>
      )}
    </a>
  );
};

export const HomePage: React.FC = () => {
  const {
    config,
    products,
    posts,
    notices,
    events,
    sponsors,
    reviews,
    faqs,
    retailCampaigns,
    retailDrops,
    oripaItems,
    isPreviewDraft,
  } = useSite();

  const [openFaqId, setOpenFaqId] = useState<string | null>(null);
  const [expandedNoticeId, setExpandedNoticeId] = useState<string | null>(null);
  const [quickViewProduct, setQuickViewProduct] = useState<Product | null>(null);
  const [bannerIdx, setBannerIdx] = useState(0);

  useEffect(() => {
    trackAnalyticsEvent('page_view', '/');
  }, []);

  const previewSuffix = isPreviewDraft ? '?preview=draft' : '';
  const btnRadius = getButtonRadiusClass(config.theme.buttonShape);
  const sectionPad = getSectionSpacingClass(config.theme.sectionSpacing);
  const dmUrl = getInstagramDmUrl(config.brand.instagramUrl);

  const visibleActions = [...config.homeActions]
    .filter((a) => a.visible)
    .sort((a, b) => a.order - b.order);

  const visibleCommunity = [...config.communityLinks]
    .filter((c) => c.visible && isValidExternalUrl(c.url))
    .sort((a, b) => a.order - b.order);

  const orderedSections = [...config.homeSections]
    .filter((s) => s.visible)
    .sort((a, b) => a.order - b.order);

  const partnerGridSponsors = useMemo(
    () => sponsors.filter((s) => s.placement === 'home_partners'),
    [sponsors]
  );

  const newsInlineSponsors = useMemo(
    () => sponsors.filter((s) => s.placement === 'news_inline'),
    [sponsors]
  );

  // Explicit 'home_banner' sponsors — supports carousel when multiple active
  const homeBannerSponsors = useMemo(
    () => sponsors.filter((s) => s.placement === 'home_banner'),
    [sponsors]
  );

  useEffect(() => {
    if (bannerIdx >= homeBannerSponsors.length && homeBannerSponsors.length > 0) {
      setBannerIdx(0);
    }
  }, [bannerIdx, homeBannerSponsors.length]);

  const retailRafflePosts = useMemo(
    () => posts.filter((p) => isRetailRaffleCategory(p.category)),
    [posts]
  );

  const newsBriefingPosts = useMemo(
    () => posts.filter((p) => !isRetailRaffleCategory(p.category)),
    [posts]
  );

  const pinnedNotice = useMemo(
    () => notices.find((n) => n.isPinned) || notices[0],
    [notices]
  );

  const trackSponsorClick = (sp: Sponsor, sourcePlacement: string) => {
    trackAnalyticsEvent('sponsor_click', '/', {
      targetType: sourcePlacement,
      targetId: sp.id,
      targetLabel: sp.name,
    });
  };

  const renderSection = (sectionId: HomeSectionId, limit: number) => {
    switch (sectionId) {
      case 'news': {
        const displayNews = newsBriefingPosts.slice(0, limit || 4);
        const leadPost = displayNews[0];
        const secondaryPosts = displayNews.slice(1);
        return (
          <section
            key="news"
            id="tcg-news"
            className={`max-w-6xl mx-auto px-4 sm:px-6 ${sectionPad} border-t border-[#E5E7EB]`}
          >
            <div className="flex items-end justify-between gap-4 mb-7">
              <div>
                <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-[#111827]">
                  최신 TCG 뉴스
                </h2>
              </div>
              <Link
                to={`/news${previewSuffix}`}
                className="text-xs sm:text-sm font-medium text-[#667085] hover:text-[#111827] inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
              >
                <span>전체 뉴스 보기</span>
                <ArrowRight size={15} />
              </Link>
            </div>

            {displayNews.length === 0 ? (
              <div className="border border-[#E5E7EB] rounded-lg p-8 bg-[#FFFFFF] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 text-xs text-[#667085]">
                    <Newspaper size={14} aria-hidden="true" />
                    <span>TCG 뉴스 아카이브</span>
                  </div>
                  <p className="text-sm font-medium text-[#111827]">
                    국내외 포켓몬카드 신규 소식과 에디토리얼 기사가 곧 업데이트됩니다.
                  </p>
                </div>
                <Link
                  to={`/news${previewSuffix}`}
                  className="text-xs font-semibold text-[#465C77] hover:text-[#111827] inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
                >
                  <span>아카이브로 이동</span>
                  <ArrowRight size={14} />
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                {leadPost && (
                  <Link
                    to={`/news/${leadPost.slug}${previewSuffix}`}
                    className={`group block ${
                      secondaryPosts.length > 0 ? 'lg:col-span-7' : 'lg:col-span-12'
                    } border border-[#E5E7EB] rounded-lg overflow-hidden bg-[#FFFFFF] nova-card-hover hover:border-[#D1D5DB]`}
                  >
                    {(leadPost.coverImage || leadPost.galleryImages?.[0]?.url) && (
                      <div className="aspect-[16/10] w-full bg-[#F5F6F8] overflow-hidden border-b border-[#E5E7EB]">
                        <SafeImage
                          src={leadPost.coverImage || leadPost.galleryImages?.[0]?.url}
                          alt={leadPost.title}
                          fallbackTitle={leadPost.title}
                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.025]"
                        />
                      </div>
                    )}
                    <div className="p-6 sm:p-7 space-y-3">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-[#667085]">
                        <span className="font-semibold text-[#465C77]">
                          {leadPost.tcgCategory || leadPost.category}
                        </span>
                        {leadPost.sourceName && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span>{leadPost.sourceName}</span>
                          </>
                        )}
                        {leadPost.isPinned && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="text-[#111827] font-medium">대표 기사</span>
                          </>
                        )}
                        <span aria-hidden="true">·</span>
                        <span className="font-mono-tabular">{formatKST(leadPost.createdAt, false)}</span>
                      </div>
                      <h3 className="text-xl sm:text-2xl font-semibold text-[#111827] leading-snug text-balance group-hover:text-[#465C77] transition-colors">
                        {leadPost.title}
                      </h3>
                      {(leadPost.summary || leadPost.content) && (
                        <p className="text-sm text-[#667085] leading-relaxed line-clamp-3">
                          {stripMarkdown(leadPost.summary || leadPost.content)}
                        </p>
                      )}
                      <div className="pt-3 border-t border-[#E5E7EB] flex items-center justify-between text-xs font-medium text-[#111827]">
                        <span>기사 전문 읽기</span>
                        <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                      </div>
                    </div>
                  </Link>
                )}

                {secondaryPosts.length > 0 && (
                  <div className="lg:col-span-5 divide-y divide-[#E5E7EB] border-y border-[#E5E7EB] bg-[#FFFFFF]">
                    {secondaryPosts.map((post) => {
                      const thumb = post.coverImage || post.galleryImages?.[0]?.url;
                      return (
                        <Link
                          key={post.id}
                          to={`/news/${post.slug}${previewSuffix}`}
                          className="group flex items-start gap-4 py-4 px-2 sm:px-3 hover:bg-[#F5F6F8] transition-colors"
                        >
                          <div className="flex-1 min-w-0 space-y-1.5">
                            <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-[#667085]">
                              <span className="font-semibold text-[#465C77]">
                                {post.tcgCategory || post.category}
                              </span>
                              {post.sourceName && (
                                <>
                                  <span aria-hidden="true">·</span>
                                  <span className="truncate">{post.sourceName}</span>
                                </>
                              )}
                              <span aria-hidden="true">·</span>
                              <span className="font-mono-tabular">
                                {formatKST(post.createdAt, false)}
                              </span>
                            </div>
                            <h3 className="text-sm sm:text-base font-semibold text-[#111827] leading-snug line-clamp-2 group-hover:text-[#465C77] transition-colors">
                              {post.title}
                            </h3>
                            {(post.summary || post.content) && (
                              <p className="text-xs text-[#667085] line-clamp-2 leading-relaxed">
                                {stripMarkdown(post.summary || post.content)}
                              </p>
                            )}
                          </div>
                          {thumb && (
                            <div className="w-20 h-20 rounded border border-[#E5E7EB] bg-[#F5F6F8] overflow-hidden shrink-0">
                              <SafeImage
                                src={thumb}
                                alt={post.title}
                                fallbackTitle={post.title}
                                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                              />
                            </div>
                          )}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {newsInlineSponsors.length > 0 && (
              <div className="mt-7 space-y-3">
                {newsInlineSponsors.map((sp) => (
                  <SponsorBanner
                    key={sp.id}
                    sponsor={sp}
                    placement="news_inline"
                    path="/"
                    variant="inline_ad"
                    buttonRadiusClass={btnRadius}
                    previewSuffix={previewSuffix}
                  />
                ))}
              </div>
            )}
          </section>
        );
      }

      case 'featured_products': {
        const displayLimit = Math.min(4, Math.max(1, limit || 4));
        const allDisplay = products.filter((product) => product.status === '판매중').slice(0, displayLimit);

        return (
          <section
            key="featured_products"
            className={`max-w-6xl mx-auto px-4 sm:px-6 ${sectionPad} border-t border-[#E5E7EB] space-y-4 sm:space-y-5`}
          >
            <div className="flex items-end justify-between gap-4">
              <div>
                <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-[#111827]">
                  판매 중인 상품
                </h2>
              </div>
              <Link
                to={`/shop${previewSuffix}`}
                className="text-xs sm:text-sm font-medium text-[#667085] hover:text-[#111827] inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
              >
                <span>전체 상품 보기</span>
                <ArrowRight size={15} />
              </Link>
            </div>

            {allDisplay.length === 0 ? (
              <div className="border border-[#E5E7EB] rounded-lg p-8 text-center space-y-2 bg-[#FFFFFF]">
                <p className="text-sm font-medium text-[#111827]">새로운 컬렉션 입고 준비 중입니다</p>
                <p className="text-xs text-[#667085]">
                  찾으시는 특정 등급 카드나 박스가 있다면 Instagram DM으로 문의해 주세요.
                </p>
              </div>
            ) : (
              <div className="nova-product-grid">
                {allDisplay.map((product) => (
                  <ShopProductCard key={product.id} product={product}
                    previewSuffix={previewSuffix} onQuickView={setQuickViewProduct} />
                ))}
              </div>
            )}
          </section>
        );
      }

      case 'retail_raffle': {
        const dropsUrl = `/drops${previewSuffix}`;
        const activeDrops = retailDrops.filter((d) => {
          const st = getDropStatusInfo(d);
          return !(d.archiveEnded && st.isEnded);
        });
        const sortedDrops = [...activeDrops].sort((a, b) => {
          const sa = getDropStatusInfo(a);
          const sb = getDropStatusInfo(b);
          if (sa.isEnded !== sb.isEnded) return sa.isEnded ? 1 : -1;
          if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
          if (a.isRecommended !== b.isRecommended) return a.isRecommended ? -1 : 1;
          return (a.order ?? 0) - (b.order ?? 0);
        });

        const maxCount = Math.min(6, Math.max(limit || 4, 4));
        const displayDrops = sortedDrops.slice(0, maxCount);
        const featuredCampaign =
          retailCampaigns.find((c) => c.id === displayDrops[0]?.campaignId) ||
          retailCampaigns[0];
        const featuredCampDropCount = featuredCampaign
          ? retailDrops.filter((d) => d.campaignId === featuredCampaign.id).length
          : 0;
        const displayRetail = retailRafflePosts.slice(0, limit || 4);

        return (
          <section
            key="retail_raffle"
            id="retail-raffle"
            className={`max-w-6xl mx-auto px-4 sm:px-6 ${sectionPad} border-t border-[#E5E7EB]`}
          >
            <div className="flex items-end justify-between gap-4 mb-7">
              <div>
                <p className="font-mono-tabular text-[11px] tracking-[0.2em] uppercase text-[#465C77] font-semibold mb-1.5">
                  OFFICIAL DROPS &amp; RAFFLES
                </p>
                <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-[#111827]">
                  정가 구매 · 추첨 정보
                </h2>
              </div>
              <Link
                to={dropsUrl}
                className="text-xs sm:text-sm font-medium text-[#667085] hover:text-[#111827] inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
              >
                <span>전체 정가·추첨 보기</span>
                <ArrowRight size={15} />
              </Link>
            </div>

            {displayDrops.length > 0 ? (
              <div className="space-y-5">
                {featuredCampaign && (
                  <div className="border border-[#E5E7EB] rounded-lg p-5 sm:p-6 bg-[#F5F6F8] flex flex-col md:flex-row md:items-center justify-between gap-5">
                    <div className="space-y-1.5 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-[#667085]">
                        <span className="font-mono-tabular text-[#465C77] font-semibold tracking-wider">
                          CAMPAIGN
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="text-[#111827] font-medium">
                          {featuredCampaign.retailer}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>{featuredCampaign.saleType}</span>
                        {featuredCampDropCount > 0 && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="font-mono-tabular text-[#111827]">
                              대상 {featuredCampDropCount}종
                            </span>
                          </>
                        )}
                      </div>
                      <h3 className="text-base sm:text-lg font-semibold text-[#111827] truncate">
                        {featuredCampaign.title}
                      </h3>
                      <p className="text-xs font-mono-tabular text-[#667085]">
                        마감:{' '}
                        <span className="text-[#111827] font-medium">
                          {formatDropDateTime(
                            featuredCampaign.endAt,
                            featuredCampaign.timezoneLabel
                          )}
                        </span>
                        {featuredCampaign.purchaseWindowText
                          ? ` · 당첨 구매: ${featuredCampaign.purchaseWindowText}`
                          : ''}
                      </p>
                    </div>
                    <Link
                      to={dropsUrl}
                      className={`min-h-[42px] px-4 py-2 text-xs font-semibold bg-[#111827] text-[#FFFFFF] hover:bg-[#465C77] inline-flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 transition-colors ${btnRadius}`}
                    >
                      <span>캠페인 조건 · {featuredCampDropCount || displayDrops.length}종 보기</span>
                      <ArrowRight size={14} />
                    </Link>
                  </div>
                )}

                <div className="divide-y divide-[#E5E7EB] border border-[#E5E7EB] rounded-lg bg-[#FFFFFF] overflow-hidden">
                  {displayDrops.map((drop) => {
                    const st = getDropStatusInfo(drop);
                    const hasUrl = isValidExternalUrl(drop.officialUrl);
                    return (
                      <div
                        key={drop.id}
                        className="p-4 sm:px-6 sm:py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-[#F5F6F8] transition-colors"
                      >
                        <div className="flex items-center gap-4 min-w-0 flex-1">
                          <div className="w-14 h-14 rounded-md border border-[#E5E7EB] bg-[#F5F6F8] overflow-hidden shrink-0 flex items-center justify-center">
                            {drop.imageUrl ? (
                              <SafeImage
                                src={drop.imageUrl}
                                alt={drop.title}
                                fallbackTitle={drop.tcg}
                                className="w-full h-full object-contain p-1"
                              />
                            ) : (
                              <span className="font-brand text-[10px] font-bold tracking-wider text-[#667085]">
                                {drop.country}
                              </span>
                            )}
                          </div>

                          <div className="min-w-0 space-y-1">
                            <div className="flex flex-wrap items-center gap-2 text-xs text-[#667085]">
                              <span
                                className={`px-2 py-0.5 text-[11px] font-semibold border rounded-sm ${getDropStatusPillClasses(
                                  st
                                )}`}
                              >
                                {st.label}
                              </span>
                              <span className="font-medium text-[#111827]">{drop.tcg}</span>
                              <span aria-hidden="true">·</span>
                              <span>{drop.country}</span>
                              <span aria-hidden="true">·</span>
                              <span className="truncate">{drop.retailer}</span>
                            </div>
                            <h3 className="text-sm sm:text-base font-semibold text-[#111827] truncate">
                              {drop.title}
                            </h3>
                          </div>
                        </div>

                        <div className="flex items-center justify-between sm:justify-end gap-5 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-[#E5E7EB]">
                          <div className="sm:text-right">
                            <p className="font-mono-tabular text-sm sm:text-base font-semibold text-[#111827]">
                              {formatDropPrice(drop.price, drop.currency)}
                            </p>
                            {Boolean(drop.endAt) && (
                              <p className="text-[11px] font-mono-tabular text-[#667085]">
                                마감 {formatDropDateTime(drop.endAt, drop.timezoneLabel)}
                              </p>
                            )}
                          </div>

                          {hasUrl ? (
                            <a
                              href={drop.officialUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={() =>
                                trackAnalyticsEvent('action_click', '/', {
                                  targetType: 'home_drop_official',
                                  targetId: drop.id,
                                  targetLabel: drop.title,
                                })
                              }
                              className={`min-h-[38px] px-3.5 py-1.5 text-xs font-medium border border-[#E5E7EB] bg-[#F5F6F8] text-[#111827] hover:border-[#111827] inline-flex items-center gap-1.5 whitespace-nowrap transition-colors ${btnRadius}`}
                            >
                              <span>공식처</span>
                              <ExternalLink size={12} />
                            </a>
                          ) : (
                            <Link
                              to={dropsUrl}
                              className={`min-h-[38px] px-3.5 py-1.5 text-xs font-medium border border-[#E5E7EB] text-[#667085] inline-flex items-center whitespace-nowrap ${btnRadius}`}
                            >
                              상세
                            </Link>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : displayRetail.length === 0 ? (
              <div className="border border-[#E5E7EB] rounded-lg p-6 sm:p-8 bg-[#FFFFFF] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 text-xs text-[#465C77] font-medium">
                    <Bell size={14} aria-hidden="true" />
                    <span>공식 발매 · 사전예약 · 추첨 브리핑</span>
                  </div>
                  <p className="text-sm sm:text-base font-medium text-[#111827]">
                    신규 확장팩 정가 판매처와 공식 추첨 일정이 등록되면 이곳에 표시됩니다.
                  </p>
                </div>
                <Link
                  to={dropsUrl}
                  className={`min-h-[40px] px-4 py-2 text-xs font-semibold bg-[#111827] text-[#FFFFFF] inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 ${btnRadius}`}
                >
                  <span>정가·추첨 허브</span>
                  <ArrowRight size={14} />
                </Link>
              </div>
            ) : (
              <div className={`grid ${getAdaptiveColsClass(displayRetail.length, 4)} gap-5`}>
                {displayRetail.map((post) => (
                  <Link
                    key={post.id}
                    to={`/news/${post.slug}${previewSuffix}`}
                    className="group border border-[#E5E7EB] rounded-lg overflow-hidden bg-[#FFFFFF] flex flex-col hover:border-[#D1D5DB] transition-colors"
                  >
                    {post.coverImage && (
                      <div className="aspect-[16/10] w-full overflow-hidden bg-[#F5F6F8]">
                        <SafeImage
                          src={post.coverImage}
                          alt={post.title}
                          fallbackTitle={post.title}
                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                        />
                      </div>
                    )}
                    <div className="p-5 flex-1 flex flex-col justify-between gap-3">
                      <div className="space-y-1.5">
                        <span className="text-xs text-[#465C77] font-medium">{post.category}</span>
                        <h3 className="text-base font-semibold text-[#111827] leading-snug line-clamp-2">
                          {post.title}
                        </h3>
                      </div>
                      <div className="flex items-center justify-between pt-2 border-t border-[#E5E7EB] text-xs text-[#667085]">
                        <span className="font-mono-tabular">{formatKST(post.createdAt, false)}</span>
                        <span className="text-[#111827] font-medium">자세히 →</span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>
        );
      }

      case 'oripa_live': {
        if (oripaItems.length === 0) return null;
        const featured = oripaItems[0];
        const total = Math.max(1, featured.totalSlots || 50);
        let soldOrDisabled = 0;
        for (let i = 1; i <= total; i++) {
          const st = featured.slotStatuses?.[String(i)];
          if (st === 'sold' || st === 'disabled' || st === 'reserved') soldOrDisabled += 1;
        }
        const availableCount = Math.max(0, total - soldOrDisabled);
        const pct = Math.round((availableCount / total) * 100);
        const hasLiveUrl = isValidExternalUrl(featured.youtubeLiveUrl || '');
        const hasChannelUrl = isValidExternalUrl(featured.youtubeChannelUrl || '');

        return (
          <section
            key="oripa_live"
            id="oripa-live"
            className={`max-w-6xl mx-auto px-4 sm:px-6 ${sectionPad} border-t border-[#E5E7EB]`}
          >
            <div className="border border-[#E5E7EB] rounded-xl overflow-hidden bg-[#F5F6F8] grid grid-cols-1 lg:grid-cols-12 items-stretch">
              <div className="lg:col-span-5 aspect-[4/3] lg:aspect-auto bg-[#FFFFFF] border-b lg:border-b-0 lg:border-r border-[#E5E7EB] overflow-hidden">
                <SafeImage
                  src={featured.imageUrl}
                  alt={featured.title}
                  fallbackTitle="NOVA ORIPA"
                  className="w-full h-full object-cover"
                />
              </div>

              <div className="lg:col-span-7 p-6 sm:p-8 flex flex-col justify-between gap-6">
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-[#667085]">
                    <span className="inline-flex items-center gap-1 font-mono-tabular font-semibold text-[#465C77] uppercase tracking-wider">
                      <Sparkles size={13} />
                      ORIPA · LIVE OPENING
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="font-medium text-[#111827]">
                      {featured.purchasingDisabled ? '출시 준비 중 (사전 체험)' : '진행 중'}
                    </span>
                  </div>

                  <h2 className="text-xl sm:text-2xl font-semibold text-[#111827] leading-snug text-balance">
                    {featured.title}
                  </h2>

                  {featured.subtitle && (
                    <p className="text-sm text-[#667085] leading-relaxed">{featured.subtitle}</p>
                  )}

                  <div className="pt-2 space-y-2">
                    <div className="flex items-center justify-between text-xs font-mono-tabular">
                      <span className="text-[#667085]">
                        1구 <strong className="text-[#111827]">{formatKRW(featured.pricePerSlot)}</strong> · 총 {total}구
                      </span>
                      <span className="text-[#111827] font-semibold">
                        잔여 {availableCount} / {total} ({pct}%)
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-[#E5E7EB] overflow-hidden">
                      <div
                        className="h-full bg-[#465C77] transition-all duration-300"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-[#E5E7EB]">
                  <Link
                    to={`/oripa/${featured.id}${previewSuffix}`}
                    className={`min-h-[42px] px-5 py-2 text-xs font-semibold bg-[#111827] text-[#FFFFFF] hover:bg-[#465C77] inline-flex items-center gap-2 transition-colors ${btnRadius}`}
                  >
                    <span>번호판 미리보기 · 상세 안내</span>
                    <ArrowRight size={14} />
                  </Link>

                  {(hasLiveUrl || hasChannelUrl) && (
                    <a
                      href={(hasLiveUrl ? featured.youtubeLiveUrl : featured.youtubeChannelUrl) || ''}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`min-h-[42px] px-4 py-2 text-xs font-medium border border-[#E5E7EB] bg-[#FFFFFF] text-[#111827] hover:border-[#111827] inline-flex items-center gap-1.5 transition-colors ${btnRadius}`}
                    >
                      <Youtube size={14} />
                      <span>YouTube 채널</span>
                      <ExternalLink size={12} />
                    </a>
                  )}
                </div>
              </div>
            </div>
          </section>
        );
      }

      case 'actions': {
        if (visibleActions.length === 0) return null;
        const displayActions = visibleActions.slice(0, limit || 4);
        return (
          <section
            key="actions"
            className={`max-w-6xl mx-auto px-4 sm:px-6 ${sectionPad} border-t border-[#E5E7EB]`}
          >
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-7">
              <div>
                <p className="font-mono-tabular text-[11px] tracking-[0.2em] uppercase text-[#465C77] font-semibold mb-1.5">
                  STORE &amp; BUYBACK
                </p>
                <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-[#111827]">
                  카드 구매 · 비공개 매입
                </h2>
              </div>
              <p className="text-xs sm:text-sm text-[#667085] max-w-md">
                외부 뉴스·협찬과 분리된 NOVA 자체 검수 컬렉션 판매 및 1:1 매입 서비스입니다.
              </p>
            </div>
            <div className={`grid ${getAdaptiveColsClass(displayActions.length, 2)} gap-5`}>
              {displayActions.map((action, idx) => {
                const isInternal = action.url.startsWith('/');
                const targetUrl = isInternal ? `${action.url}${previewSuffix}` : action.url;
                const isPrimary = idx === 0;
                const content = (
                  <div
                    className={`group h-full border rounded-lg p-6 sm:p-8 flex flex-col justify-between gap-6 nova-card-hover ${
                      isPrimary
                        ? 'bg-[#FFFFFF] border-[#E5E7EB] hover:border-[#111827]'
                        : 'bg-[#F5F6F8] border-[#E5E7EB] hover:border-[#465C77]'
                    }`}
                  >
                    <div className="space-y-2">
                      <p className="font-mono-tabular text-xs tracking-[0.16em] text-[#667085]">
                        0{idx + 1} · {isPrimary ? 'STORE CATALOG' : 'PRIVATE BUYBACK'}
                      </p>
                      <h3 className="text-xl sm:text-2xl font-semibold tracking-tight text-[#111827]">
                        {action.title}
                      </h3>
                      <p className="text-sm leading-relaxed text-[#667085]">{action.subtitle}</p>
                    </div>
                    <div className="flex items-center justify-between pt-4 border-t border-[#E5E7EB]">
                      <span className="text-sm font-semibold text-[#111827] group-hover:text-[#465C77] transition-colors">
                        {action.ctaLabel}
                      </span>
                      <ArrowRight
                        size={16}
                        className="text-[#667085] group-hover:text-[#465C77] transition-transform group-hover:translate-x-1"
                      />
                    </div>
                  </div>
                );

                return isInternal ? (
                  <Link
                    key={action.id}
                    to={targetUrl}
                    onClick={() =>
                      trackAnalyticsEvent('action_click', '/', {
                        targetType: 'home_action',
                        targetId: action.id,
                        targetLabel: action.title,
                      })
                    }
                  >
                    {content}
                  </Link>
                ) : (
                  <a
                    key={action.id}
                    href={targetUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() =>
                      trackAnalyticsEvent('action_click', '/', {
                        targetType: 'home_action',
                        targetId: action.id,
                        targetLabel: action.title,
                      })
                    }
                  >
                    {content}
                  </a>
                );
              })}
            </div>
          </section>
        );
      }

      case 'sponsors': {
        const displayPartners = partnerGridSponsors.slice(0, limit || 8);
        if (displayPartners.length === 0) return null;

        return (
          <section
            key="sponsors"
            id="sponsors"
            className={`max-w-6xl mx-auto px-4 sm:px-6 ${sectionPad} border-t border-[#E5E7EB]`}
          >
            <h2 className="sr-only">파트너 캠페인</h2>
            <SponsorBanner sponsor={displayPartners[0]} placement="home_partners" path="/"
              variant="home_campaign" buttonRadiusClass={btnRadius} previewSuffix={previewSuffix} />
            {displayPartners.length > 1 && (
              <div className={`mt-4 grid ${getAdaptiveColsClass(displayPartners.length - 1, 4)} gap-5`}>
                {displayPartners.slice(1).map((sp) => (
                  <PartnerLogoTile key={sp.id} sponsor={sp} showSummary
                    onClickTrack={() => trackSponsorClick(sp, 'home_partners')} />
                ))}
              </div>
            )}
          </section>
        );
      }

      case 'events': {
        if (events.length === 0) return null;
        const displayEvents = events.slice(0, limit || 3);
        return (
          <section
            key="events"
            className={`max-w-6xl mx-auto px-4 sm:px-6 ${sectionPad} border-t border-[#E5E7EB]`}
          >
            <div className="flex items-end justify-between gap-4 mb-6">
              <div>
                <p className="font-mono-tabular text-[11px] tracking-[0.2em] uppercase text-[#667085] font-semibold mb-1.5">
                  LIVE &amp; SCHEDULE (KST)
                </p>
                <h2 className="text-xl sm:text-2xl font-semibold text-[#111827]">라이브 &amp; 이벤트</h2>
              </div>
              <Link
                to={`/events${previewSuffix}`}
                className="text-xs sm:text-sm font-medium text-[#667085] hover:text-[#111827] inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
              >
                <span>전체 일정</span>
                <ArrowRight size={15} />
              </Link>
            </div>
            <div className={`grid ${getAdaptiveColsClass(displayEvents.length, 3)} gap-5`}>
              {displayEvents.map((ev) => {
                const status = getEventStatus(ev.startAt, ev.endAt);
                return (
                  <div
                    key={ev.id}
                    className="border border-[#E5E7EB] rounded-lg p-5 sm:p-6 bg-[#FFFFFF] flex flex-col justify-between gap-4"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-xs text-[#667085]">
                        <span className={status === '진행 중' ? 'text-[#0F6B4B] font-semibold' : 'text-[#465C77] font-medium'}>
                          {status}
                        </span>
                        {ev.locationOrPlatform && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span>{ev.locationOrPlatform}</span>
                          </>
                        )}
                      </div>
                      <h3 className="text-base font-semibold text-[#111827]">{ev.title}</h3>
                      {ev.description && (
                        <p className="text-sm text-[#667085] leading-relaxed">{ev.description}</p>
                      )}
                    </div>
                    <div className="pt-3 border-t border-[#E5E7EB] flex items-center justify-between gap-3 text-xs">
                      <span className="font-mono-tabular text-[#667085]">
                        {formatKST(ev.startAt)} KST
                      </span>
                      {ev.externalUrl && isValidExternalUrl(ev.externalUrl) && (
                        <a
                          href={ev.externalUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[#111827] hover:text-[#465C77] font-medium inline-flex items-center gap-1 whitespace-nowrap"
                        >
                          <span>자세히</span>
                          <ExternalLink size={13} />
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        );
      }

      case 'community': {
        if (visibleCommunity.length === 0) return null;
        const displayCommunity = visibleCommunity.slice(0, limit || 6);
        return (
          <section
            key="community"
            className={`max-w-6xl mx-auto px-4 sm:px-6 ${sectionPad} border-t border-[#E5E7EB]`}
          >
            <div className="mb-6">
              <p className="font-mono-tabular text-[11px] tracking-[0.2em] uppercase text-[#667085] font-semibold mb-1.5">
                NOVA COMMUNITY
              </p>
              <h2 className="text-xl sm:text-2xl font-semibold text-[#111827]">NOVA 커뮤니티</h2>
            </div>

            {displayCommunity.length === 1 ? (
              <a
                href={displayCommunity[0].url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() =>
                  trackAnalyticsEvent('action_click', '/', {
                    targetType: 'community_link',
                    targetId: displayCommunity[0].id,
                    targetLabel: displayCommunity[0].name,
                  })
                }
                className="group border border-[#E5E7EB] rounded-lg p-6 sm:p-7 bg-[#FFFFFF] flex flex-col sm:flex-row sm:items-center justify-between gap-5 nova-card-hover hover:border-[#D1D5DB]"
              >
                <div className="space-y-1.5 min-w-0">
                  <span className="font-mono-tabular text-[11px] uppercase tracking-wider text-[#465C77] font-semibold block">
                    {displayCommunity[0].platform}
                  </span>
                  <h3 className="text-base sm:text-lg font-semibold text-[#111827]">
                    {displayCommunity[0].name}
                  </h3>
                  <p className="text-sm text-[#667085] leading-relaxed">
                    {displayCommunity[0].description}
                  </p>
                </div>
                <span
                  className={`min-h-[42px] px-4 py-2 text-xs font-semibold border border-[#E5E7EB] bg-[#F5F6F8] text-[#111827] group-hover:bg-[#111827] group-hover:text-[#FFFFFF] transition-colors inline-flex items-center gap-2 whitespace-nowrap shrink-0 ${btnRadius}`}
                >
                  <span>채널 바로가기</span>
                  <ExternalLink size={14} />
                </span>
              </a>
            ) : (
              <div className={`grid ${getAdaptiveColsClass(displayCommunity.length, 3)} gap-5`}>
                {displayCommunity.map((ch) => (
                  <a
                    key={ch.id}
                    href={ch.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() =>
                      trackAnalyticsEvent('action_click', '/', {
                        targetType: 'community_link',
                        targetId: ch.id,
                        targetLabel: ch.name,
                      })
                    }
                    className="group border border-[#E5E7EB] rounded-lg p-5 sm:p-6 bg-[#FFFFFF] flex flex-col justify-between gap-4 nova-card-hover hover:border-[#D1D5DB]"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-mono-tabular text-[11px] uppercase tracking-wider text-[#465C77] font-semibold">
                          {ch.platform}
                        </span>
                        <ExternalLink size={14} className="text-[#667085] group-hover:text-[#111827]" />
                      </div>
                      <h3 className="text-base font-semibold text-[#111827]">{ch.name}</h3>
                      <p className="text-sm text-[#667085] leading-relaxed">{ch.description}</p>
                    </div>
                  </a>
                ))}
              </div>
            )}
          </section>
        );
      }

      case 'reviews': {
        if (reviews.length === 0) return null;
        const displayReviews = reviews.slice(0, limit || 3);
        return (
          <section
            key="reviews"
            className={`max-w-6xl mx-auto px-4 sm:px-6 ${sectionPad} border-t border-[#E5E7EB]`}
          >
            <div className="mb-6">
              <p className="font-mono-tabular text-[11px] tracking-[0.2em] uppercase text-[#667085] font-semibold mb-1.5">
                COLLECTOR TRUST
              </p>
              <h2 className="text-xl sm:text-2xl font-semibold text-[#111827]">컬렉터 후기</h2>
            </div>
            <div className={`grid ${getAdaptiveColsClass(displayReviews.length, 3)} gap-5`}>
              {displayReviews.map((rev) => (
                <div
                  key={rev.id}
                  className="border border-[#E5E7EB] rounded-lg p-6 bg-[#FFFFFF] flex flex-col justify-between gap-4"
                >
                  <div className="space-y-2">
                    <span className="font-editorial text-3xl leading-none text-[#465C77]/50 block" aria-hidden="true">
                      “
                    </span>
                    <p className="text-sm text-[#111827] leading-relaxed">{rev.content}</p>
                  </div>
                  <div className="flex items-center justify-between text-xs text-[#667085] pt-3 border-t border-[#E5E7EB]">
                    <span>
                      {rev.authorName}
                      {rev.context ? ` · ${rev.context}` : ''}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        );
      }

      case 'faq': {
        if (faqs.length === 0) return null;
        return (
          <section
            key="faq"
            className={`max-w-6xl mx-auto px-4 sm:px-6 ${sectionPad} border-t border-[#E5E7EB]`}
          >
            <div className="mb-6">
              <p className="font-mono-tabular text-[11px] tracking-[0.2em] uppercase text-[#667085] font-semibold mb-1.5">
                FAQ
              </p>
              <h2 className="text-xl sm:text-2xl font-semibold text-[#111827]">자주 묻는 질문</h2>
            </div>
            <div className="divide-y divide-[#E5E7EB] border-y border-[#E5E7EB]">
              {faqs.slice(0, limit || 10).map((faq) => {
                const isOpen = openFaqId === faq.id;
                return (
                  <div key={faq.id}>
                    <button
                      type="button"
                      onClick={() => setOpenFaqId(isOpen ? null : faq.id)}
                      aria-expanded={isOpen}
                      className="w-full min-h-[52px] py-3.5 flex items-center justify-between gap-4 text-left"
                    >
                      <span className="text-sm sm:text-base font-medium text-[#111827]">
                        {faq.question}
                      </span>
                      <ChevronDown
                        size={18}
                        className={`text-[#667085] shrink-0 transition-transform ${isOpen ? 'rotate-180 text-[#465C77]' : ''}`}
                      />
                    </button>
                    {isOpen && (
                      <div className="pb-4 text-sm text-[#667085] leading-relaxed whitespace-pre-line">
                        {faq.answer}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        );
      }

      case 'notices': {
        if (notices.length === 0) return null;
        return (
          <section
            key="notices"
            id="notices"
            className={`max-w-6xl mx-auto px-4 sm:px-6 ${sectionPad} border-t border-[#E5E7EB]`}
          >
            <div className="flex items-end justify-between gap-4 mb-5">
              <div>
                <p className="font-mono-tabular text-[11px] tracking-[0.2em] uppercase text-[#667085] font-semibold mb-1.5">
                  ANNOUNCEMENTS
                </p>
                <h2 className="text-xl sm:text-2xl font-semibold text-[#111827]">공지사항</h2>
              </div>
            </div>
            <div className="divide-y divide-[#E5E7EB] border-y border-[#E5E7EB]">
              {notices.slice(0, limit || 3).map((notice) => {
                const isOpen = expandedNoticeId === notice.id;
                return (
                  <div key={notice.id} className="py-3.5">
                    <button
                      type="button"
                      onClick={() => setExpandedNoticeId(isOpen ? null : notice.id)}
                      className="w-full min-h-[44px] flex items-center justify-between gap-4 text-left"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {notice.isPinned && (
                          <Pin size={14} className="text-[#465C77] shrink-0" aria-label="고정 공지" />
                        )}
                        <span className="text-sm sm:text-base font-medium truncate text-[#111827]">
                          {notice.title}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="hidden sm:inline text-xs font-mono-tabular text-[#667085]">
                          {formatKST(notice.createdAt, false)}
                        </span>
                        <ChevronDown
                          size={16}
                          className={`text-[#667085] transition-transform ${isOpen ? 'rotate-180 text-[#465C77]' : ''}`}
                        />
                      </div>
                    </button>
                    {isOpen && (
                      <div className="pt-2.5 pb-1 text-sm text-[#667085] leading-relaxed whitespace-pre-line">
                        {notice.content}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        );
      }

      case 'work_with_nova':
        return <WorkWithNovaSection key="work_with_nova" />;

      default:
        return null;
    }
  };

  const activeBanner = homeBannerSponsors[bannerIdx] || homeBannerSponsors[0];

  return (
    <>
      <SeoManager />

      {/* 1. Responsive Full-Width Store Hero Slider (Admin Managed, Zero Buyback Chart) */}
      <HeroSlider />

      {/* Top Featured Sponsor Banner / Multi-Banner Carousel (strictly hidden if 0) */}
      {activeBanner && (
        <section className="max-w-6xl mx-auto px-4 sm:px-6 py-4 sm:py-6 space-y-3">
          <SponsorBanner
            sponsor={activeBanner}
            placement="home_banner"
            path="/"
            variant="hero_banner"
            buttonRadiusClass={btnRadius}
            previewSuffix={previewSuffix}
          />
          {homeBannerSponsors.length > 1 && (
            <div className="flex items-center justify-between text-xs text-[#667085]">
              <div className="flex items-center gap-1.5">
                {homeBannerSponsors.map((sp, i) => (
                  <button
                    key={sp.id}
                    type="button"
                    aria-label={`${i + 1}번 스폰서 배너 보기`}
                    onClick={() => setBannerIdx(i)}
                    className={`h-1.5 rounded-full transition-all ${
                      i === bannerIdx ? 'w-6 bg-[#465C77]' : 'w-3 bg-[#E5E7EB] hover:bg-[#D1D5DB]'
                    }`}
                  />
                ))}
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  aria-label="이전 스폰서 배너"
                  onClick={() =>
                    setBannerIdx((prev) => (prev - 1 + homeBannerSponsors.length) % homeBannerSponsors.length)
                  }
                  className="w-7 h-7 inline-flex items-center justify-center rounded border border-[#E5E7EB] bg-[#FFFFFF] text-[#111827] hover:bg-[#F5F6F8]"
                >
                  <ChevronLeft size={14} />
                </button>
                <button
                  type="button"
                  aria-label="다음 스폰서 배너"
                  onClick={() => setBannerIdx((prev) => (prev + 1) % homeBannerSponsors.length)}
                  className="w-7 h-7 inline-flex items-center justify-center rounded border border-[#E5E7EB] bg-[#FFFFFF] text-[#111827] hover:bg-[#F5F6F8]"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </section>
      )}

      {/* 4. Dynamic Domain Sections */}
      {/* Pinned Notice Slim Bar & Official Channels */}
      <div className="border-b border-[#E5E7EB] bg-[#F5F6F8]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs text-[#667085]">
          {pinnedNotice ? (
            <a
              href="#notices"
              className="flex items-center gap-2 min-w-0 hover:text-[#111827] transition-colors"
            >
              <Pin size={13} className="text-[#465C77] shrink-0" aria-hidden="true" />
              <span className="font-medium text-[#111827] truncate">{pinnedNotice.title}</span>
              <span className="font-mono-tabular text-[11px] shrink-0">공지 →</span>
            </a>
          ) : (
            <span className="font-mono-tabular text-[11px] tracking-wider uppercase">
              {config.brand.tagline}
            </span>
          )}

          <div className="flex flex-wrap items-center gap-4 shrink-0">
            {isValidExternalUrl(config.brand.instagramUrl) && (
              <a
                href={config.brand.instagramUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-[#111827] inline-flex items-center gap-1 transition-colors"
              >
                <Instagram size={13} />
                <span>Instagram</span>
              </a>
            )}
            {isValidExternalUrl(config.brand.youtubeUrl) && (
              <a
                href={config.brand.youtubeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-[#111827] inline-flex items-center gap-1 transition-colors"
              >
                <Youtube size={13} />
                <span>YouTube</span>
              </a>
            )}
            {config.brand.email && (
              <a
                href={`mailto:${config.brand.email}`}
                className="hover:text-[#111827] inline-flex items-center gap-1 transition-colors"
              >
                <Mail size={13} />
                <span>문의</span>
              </a>
            )}
            {dmUrl && (
              <a
                href={dmUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#465C77] hover:text-[#111827] font-medium inline-flex items-center gap-1"
              >
                <MessageCircle size={13} />
                <span>@novapokemonkr</span>
              </a>
            )}
          </div>
        </div>
      </div>

      {orderedSections.map((sec) => renderSection(sec.id, sec.limit))}

      {/* Quick View Modal */}
      <ProductQuickViewModal
        product={quickViewProduct}
        previewSuffix={previewSuffix}
        onClose={() => setQuickViewProduct(null)}
      />
    </>
  );
};
