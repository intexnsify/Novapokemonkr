import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Bell,
  Camera,
  ChevronDown,
  ExternalLink,
  Instagram,
  Mail,
  MessageCircle,
  Newspaper,
  Pin,
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
} from '../lib/utils';
import { HomeSectionId, Sponsor } from '../types/nova';
import { getButtonRadiusClass, getSectionSpacingClass } from '../components/PublicLayout';
import { SafeImage } from '../components/SafeImage';
import { SeoManager } from '../components/SeoManager';
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
      className="group border border-[#303741] rounded-lg p-5 bg-[#171C23] flex flex-col justify-between gap-3.5 nova-transition hover:border-[#8068BA]/70"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3.5 min-w-0">
          {sponsor.logoUrl ? (
            <div className="w-12 h-12 rounded-md border border-[#303741] bg-[#080A0D] overflow-hidden shrink-0">
              <SafeImage
                src={sponsor.logoUrl}
                alt={sponsor.name}
                fallbackTitle={sponsor.name}
                className="w-full h-full object-cover"
              />
            </div>
          ) : (
            <div className="w-12 h-12 rounded-md border border-[#303741] bg-[#080A0D] flex items-center justify-center shrink-0">
              <span className="font-brand text-sm font-bold text-[#C5CBD3] tracking-wider">
                {sponsor.name.slice(0, 2).toUpperCase()}
              </span>
            </div>
          )}

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-brand text-base font-bold tracking-[0.14em] text-[#F3F4F6] truncate">
                {sponsor.name}
              </h3>
              {sponsor.isSponsored && (
                <span className="px-1.5 py-0.5 text-[10px] font-medium border border-[#8068BA]/60 text-[#C5CBD3] bg-[#8068BA]/15 rounded-sm shrink-0">
                  {sponsor.badgeLabel || '협찬'}
                </span>
              )}
            </div>
            <p className="text-[11px] font-mono-tabular text-[#929AA6] truncate mt-0.5">
              {getDisplayDomain(sponsor.url)}
            </p>
          </div>
        </div>

        <ExternalLink
          size={15}
          className="text-[#929AA6] group-hover:text-[#F3F4F6] group-hover:translate-x-0.5 transition-all shrink-0"
        />
      </div>

      {showSummary && sponsor.description && (
        <p className="text-xs text-[#929AA6] line-clamp-1 pt-2.5 border-t border-[#303741]/60">
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
    isPreviewDraft,
    isAdminVerified,
  } = useSite();
  const [openFaqId, setOpenFaqId] = useState<string | null>(null);
  const [expandedNoticeId, setExpandedNoticeId] = useState<string | null>(null);

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

  // Top spotlight prefers explicit 'home_banner' sponsors, falling back to top partner (e.g. REPACK)
  const topSpotlightSponsor: Sponsor | undefined = useMemo(() => {
    const explicitBanner = sponsors.find((s) => s.placement === 'home_banner');
    return explicitBanner || partnerGridSponsors[0];
  }, [sponsors, partnerGridSponsors]);

  const retailRafflePosts = useMemo(
    () => posts.filter((p) => isRetailRaffleCategory(p.category)),
    [posts]
  );

  const newsBriefingPosts = useMemo(() => {
    const nonRetail = posts.filter((p) => !isRetailRaffleCategory(p.category));
    return nonRetail.length > 0 ? nonRetail : posts;
  }, [posts]);

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
            className={`max-w-6xl mx-auto px-4 sm:px-6 ${sectionPad} border-t border-[#303741]/60`}
          >
            <div className="flex items-end justify-between gap-4 mb-5">
              <div>
                <p className="text-xs tracking-[0.18em] mb-1" style={{ color: 'var(--nova-text-secondary)' }}>
                  RETAIL DROP &amp; RAFFLE
                </p>
                <h2 className="text-xl sm:text-2xl font-semibold">정가 구매 · 추첨 정보</h2>
              </div>
              <div className="flex flex-wrap items-center gap-3 shrink-0">
                {isAdminVerified && (
                  <Link
                    to="/admin?tab=drops"
                    className="px-2.5 py-1 text-xs font-medium border border-[#8068BA]/60 bg-[#8068BA]/15 text-[#E3DCF7] hover:border-[#C5CBD3] rounded inline-flex items-center gap-1 whitespace-nowrap"
                  >
                    <Camera size={12} />
                    <span>사진·상품 관리</span>
                  </Link>
                )}
                <Link
                  to={dropsUrl}
                  className="text-sm font-medium text-[#C5CBD3] hover:text-[#F3F4F6] inline-flex items-center gap-1.5 whitespace-nowrap"
                >
                  <span>전체 정가·추첨 보기</span>
                  <ArrowRight size={15} />
                </Link>
              </div>
            </div>

            {displayDrops.length > 0 ? (
              <div className="space-y-4">
                {featuredCampaign && (
                  <div className="border border-[#303741] rounded-lg p-4 sm:p-5 bg-[#11151A] flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-[#929AA6]">
                        <span className="font-mono-tabular text-[#8068BA] font-semibold">
                          ACTIVE CAMPAIGN
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="text-[#C5CBD3] font-medium">
                          {featuredCampaign.retailer}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>{featuredCampaign.saleType}</span>
                        {featuredCampDropCount > 0 && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="font-mono-tabular text-[#C5CBD3]">
                              총 {featuredCampDropCount}종
                            </span>
                          </>
                        )}
                      </div>
                      <h3 className="text-base sm:text-lg font-semibold text-[#F3F4F6] truncate">
                        {featuredCampaign.title}
                      </h3>
                      <p className="text-xs font-mono-tabular text-[#929AA6]">
                        응모 마감:{' '}
                        <span className="text-[#F3F4F6]">
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
                      className={`min-h-[40px] px-4 py-2 text-xs font-semibold inline-flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 ${btnRadius}`}
                      style={{
                        backgroundColor: 'var(--nova-silver)',
                        color: 'var(--nova-bg-main)',
                      }}
                    >
                      <span>캠페인 전체 조건 · {featuredCampDropCount || displayDrops.length}종 보기</span>
                      <ArrowRight size={14} />
                    </Link>
                  </div>
                )}

                <div
                  className={`grid ${
                    displayDrops.length <= 2
                      ? 'grid-cols-1 md:grid-cols-2'
                      : displayDrops.length === 4
                        ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'
                        : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
                  } gap-4`}
                >
                  {displayDrops.map((drop) => {
                    const st = getDropStatusInfo(drop);
                    const hasUrl = isValidExternalUrl(drop.officialUrl);
                    return (
                      <div
                        key={drop.id}
                        className="border border-[#303741] rounded-lg overflow-hidden bg-[#171C23] flex flex-col justify-between hover:border-[#C5CBD3]/60 nova-transition"
                      >
                        <div>
                          <div className="h-36 w-full bg-[#11151A] border-b border-[#303741]/60 overflow-hidden">
                            {drop.imageUrl ? (
                              <SafeImage
                                src={drop.imageUrl}
                                alt={drop.title}
                                fallbackTitle={drop.title}
                                className="w-full h-full object-contain p-2 bg-[#0D1015]"
                              />
                            ) : (
                              <div className="w-full h-full flex flex-col items-center justify-center px-3 text-center bg-gradient-to-br from-[#11151A] via-[#171C23] to-[#080A0D]">
                                <span className="font-brand text-[10px] tracking-[0.18em] text-[#929AA6] mb-1">
                                  {drop.tcg} · {drop.country}
                                </span>
                                <span className="text-xs font-medium text-[#C5CBD3] line-clamp-2">
                                  {drop.title}
                                </span>
                              </div>
                            )}
                          </div>

                          <div className="p-4 space-y-2.5">
                            <div className="flex items-center justify-between gap-2 text-[11px] text-[#929AA6]">
                              <span className="truncate">
                                {drop.tcg} · {drop.country} · {drop.retailer}
                              </span>
                              <span
                                className={`px-1.5 py-0.5 text-[10px] font-semibold border rounded-sm shrink-0 ${
                                  st.isEnded
                                    ? 'border-[#303741] text-[#929AA6]'
                                    : st.isUrgent
                                      ? 'border-amber-400/55 text-amber-200'
                                      : st.isActive
                                        ? 'border-emerald-400/45 text-emerald-200'
                                        : 'border-[#303741] text-[#C5CBD3]'
                                }`}
                              >
                                {st.label}
                              </span>
                            </div>

                            <h3 className="text-sm sm:text-base font-semibold text-[#F3F4F6] line-clamp-2 leading-snug">
                              {drop.title}
                            </h3>

                            <div className="flex items-baseline justify-between gap-2 pt-1 text-xs">
                              <span className="text-[#929AA6]">{drop.saleType}</span>
                              <span className="font-mono-tabular text-sm font-semibold text-[#F3F4F6]">
                                {formatDropPrice(drop.price, drop.currency)}
                              </span>
                            </div>

                            {Boolean(drop.endAt) && (
                              <p className="text-[11px] font-mono-tabular text-[#929AA6] pt-1 border-t border-[#303741]/50">
                                마감 {formatDropDateTime(drop.endAt, drop.timezoneLabel)}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="px-4 pb-4 pt-1 flex items-center gap-2">
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
                              className={`min-h-[38px] flex-1 px-3 py-1.5 text-xs font-semibold border border-[#303741] bg-[#11151A] text-[#C5CBD3] hover:text-[#F3F4F6] hover:border-[#C5CBD3] inline-flex items-center justify-center gap-1.5 ${btnRadius}`}
                            >
                              <span>공식 페이지</span>
                              <ExternalLink size={12} />
                            </a>
                          ) : (
                            <Link
                              to={dropsUrl}
                              className={`min-h-[38px] flex-1 px-3 py-1.5 text-xs font-medium border border-[#303741] text-[#C5CBD3] inline-flex items-center justify-center ${btnRadius}`}
                            >
                              상세 보기
                            </Link>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : displayRetail.length === 0 ? (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                <div className="lg:col-span-7 border border-[#303741] rounded-lg p-6 bg-[#171C23] flex flex-col justify-between gap-5">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-xs text-[#929AA6]">
                      <Bell size={14} className="text-[#8068BA]" aria-hidden="true" />
                      <span>공식 발매 · 사전예약 · 추첨 브리핑</span>
                    </div>
                    <h3 className="text-base sm:text-lg font-semibold text-[#F3F4F6]">
                      신규 확장팩 정가 판매처와 공식 추첨 일정을 모아 전합니다
                    </h3>
                    <p className="text-sm text-[#929AA6] leading-relaxed">
                      포켓몬 스토어, 대형 마트, 공식 유통사 사전예약 및 현장 추첨 소식이 등록되면 이곳에 가장 먼저 표시됩니다.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2.5 pt-1">
                    <Link
                      to={dropsUrl}
                      className={`min-h-[40px] px-4 py-2 text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap ${btnRadius}`}
                      style={{
                        backgroundColor: 'var(--nova-silver)',
                        color: 'var(--nova-bg-main)',
                      }}
                    >
                      <span>정가·추첨 페이지 보기</span>
                      <ArrowRight size={14} />
                    </Link>
                  </div>
                </div>

                <div className="lg:col-span-5 border border-[#303741] rounded-lg p-6 bg-[#11151A] flex flex-col justify-between gap-4">
                  {pinnedNotice ? (
                    <>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-xs text-[#929AA6]">
                          <Pin size={13} className="text-[#8068BA]" aria-hidden="true" />
                          <span>NOVA 주요 공지</span>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono-tabular">{formatKST(pinnedNotice.createdAt, false)}</span>
                        </div>
                        <h3 className="text-base font-semibold text-[#F3F4F6] line-clamp-2">
                          {pinnedNotice.title}
                        </h3>
                        <p className="text-xs text-[#929AA6] leading-relaxed line-clamp-3">
                          {pinnedNotice.content}
                        </p>
                      </div>
                      {dmUrl && (
                        <a
                          href={config.brand.instagramUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs font-medium text-[#C5CBD3] hover:text-[#F3F4F6] inline-flex items-center gap-1.5 pt-2 border-t border-[#303741]/60"
                        >
                          <span>Instagram에서 실시간 알림 보기</span>
                          <ExternalLink size={13} />
                        </a>
                      )}
                    </>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-xs tracking-[0.14em] text-[#929AA6]">REALTIME CHANNEL</p>
                      <h3 className="text-base font-semibold text-[#F3F4F6]">
                        실시간 재입고 · 추첨 소식 채널
                      </h3>
                      <p className="text-xs text-[#929AA6] leading-relaxed">
                        공식 Instagram 계정을 팔로우하시면 긴급 재입고 및 추첨 응모 소식을 빠르게 확인하실 수 있습니다.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className={`grid ${getAdaptiveColsClass(displayRetail.length, 4)} gap-4`}>
                {displayRetail.map((post) => (
                  <Link
                    key={post.id}
                    to={`/news/${post.slug}${previewSuffix}`}
                    className="group border border-[#303741] rounded-lg overflow-hidden bg-[#171C23] flex flex-col nova-transition hover:border-[#C5CBD3]/60"
                  >
                    {post.coverImage && (
                      <div className="aspect-[16/10] w-full overflow-hidden bg-[#11151A]">
                        <SafeImage
                          src={post.coverImage}
                          alt={post.title}
                          fallbackTitle={post.title}
                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                        />
                      </div>
                    )}
                    <div className="p-5 flex-1 flex flex-col justify-between gap-3">
                      <div className="space-y-2">
                        <div className="flex items-center gap-1.5 text-xs text-[#929AA6]">
                          <span className="text-[#C5CBD3] font-medium">{post.category}</span>
                        </div>
                        <h3 className="text-base font-semibold text-[#F3F4F6] leading-snug line-clamp-2">
                          {post.title}
                        </h3>
                      </div>
                      <div className="flex items-center justify-between pt-2 border-t border-[#303741]/60 text-xs text-[#929AA6]">
                        <span className="font-mono-tabular">{formatKST(post.createdAt, false)}</span>
                        <span className="text-[#C5CBD3] font-medium">자세히 →</span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>
        );
      }

      case 'news': {
        const displayNews = newsBriefingPosts.slice(0, limit || 4);
        return (
          <section
            key="news"
            id="tcg-news"
            className={`max-w-6xl mx-auto px-4 sm:px-6 ${sectionPad} border-t border-[#303741]/60`}
          >
            <div className="flex items-end justify-between gap-4 mb-6">
              <div>
                <p className="text-xs tracking-[0.18em] mb-1" style={{ color: 'var(--nova-text-secondary)' }}>
                  GLOBAL TCG BRIEFING
                </p>
                <h2 className="text-xl sm:text-2xl font-semibold">전 세계 TCG 최신 뉴스</h2>
              </div>
              <Link
                to={`/news${previewSuffix}`}
                className="text-sm font-medium text-[#C5CBD3] hover:text-[#F3F4F6] inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
              >
                <span>전체 뉴스 보기</span>
                <ArrowRight size={15} />
              </Link>
            </div>

            {displayNews.length === 0 ? (
              <div className="border border-[#303741] rounded-lg p-8 bg-[#11151A] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-xs text-[#929AA6]">
                    <Newspaper size={14} aria-hidden="true" />
                    <span>TCG 뉴스 아카이브</span>
                  </div>
                  <p className="text-sm font-medium text-[#F3F4F6]">
                    국내외 포켓몬카드 신규 소식과 에디토리얼 기사가 곧 업데이트됩니다.
                  </p>
                </div>
                <Link
                  to={`/news${previewSuffix}`}
                  className="text-xs font-medium text-[#C5CBD3] hover:text-[#F3F4F6] inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
                >
                  <span>아카이브로 이동</span>
                  <ArrowRight size={14} />
                </Link>
              </div>
            ) : displayNews.length === 1 ? (
              <Link
                to={`/news/${displayNews[0].slug}${previewSuffix}`}
                className="group grid grid-cols-1 lg:grid-cols-12 border border-[#303741] rounded-lg overflow-hidden bg-[#171C23] hover:border-[#C5CBD3]/60 nova-transition"
              >
                {displayNews[0].coverImage && (
                  <div className="lg:col-span-5 aspect-[16/10] lg:aspect-auto lg:h-full bg-[#11151A] overflow-hidden">
                    <SafeImage
                      src={displayNews[0].coverImage}
                      alt={displayNews[0].title}
                      fallbackTitle={displayNews[0].title}
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                    />
                  </div>
                )}
                <div
                  className={`${
                    displayNews[0].coverImage ? 'lg:col-span-7' : 'lg:col-span-12'
                  } p-6 sm:p-8 flex flex-col justify-between gap-4`}
                >
                  <div className="space-y-2.5">
                    <div className="flex items-center gap-2 text-xs text-[#929AA6]">
                      <span>{displayNews[0].category}</span>
                      {displayNews[0].isPinned && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="text-[#C5CBD3]">대표 기사</span>
                        </>
                      )}
                      <span aria-hidden="true">·</span>
                      <span className="font-mono-tabular">{formatKST(displayNews[0].createdAt, false)}</span>
                      {displayNews[0].isSample && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono-tabular text-[#C5CBD3]">SAMPLE</span>
                        </>
                      )}
                    </div>
                    <h3 className="text-lg sm:text-xl font-semibold text-[#F3F4F6] leading-snug">
                      {displayNews[0].title}
                    </h3>
                    {displayNews[0].summary && (
                      <p className="text-sm text-[#929AA6] leading-relaxed line-clamp-3">
                        {displayNews[0].summary}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center justify-between pt-3 border-t border-[#303741]/60 text-xs font-medium text-[#C5CBD3]">
                    <span>기사 전문 읽기</span>
                    <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              </Link>
            ) : (
              <div className={`grid ${getAdaptiveColsClass(displayNews.length, 4)} gap-4`}>
                {displayNews.map((post) => (
                  <Link
                    key={post.id}
                    to={`/news/${post.slug}${previewSuffix}`}
                    className="group border border-[#303741] rounded-lg overflow-hidden bg-[#171C23] flex flex-col nova-transition hover:border-[#C5CBD3]/60"
                  >
                    {post.coverImage && (
                      <div className="aspect-[16/10] w-full overflow-hidden bg-[#11151A]">
                        <SafeImage
                          src={post.coverImage}
                          alt={post.title}
                          fallbackTitle={post.title}
                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                        />
                      </div>
                    )}
                    <div className="p-5 flex-1 flex flex-col justify-between gap-3">
                      <div className="space-y-2">
                        <div className="flex items-center gap-1.5 text-xs text-[#929AA6]">
                          <span>{post.category}</span>
                          {post.isPinned && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="text-[#C5CBD3]">대표</span>
                            </>
                          )}
                          {post.isSample && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="font-mono-tabular text-[#C5CBD3]">SAMPLE</span>
                            </>
                          )}
                        </div>
                        <h3 className="text-base font-semibold text-[#F3F4F6] leading-snug line-clamp-2">
                          {post.title}
                        </h3>
                        {post.summary && (
                          <p className="text-xs text-[#929AA6] line-clamp-2 leading-relaxed">
                            {post.summary}
                          </p>
                        )}
                      </div>
                      <p className="text-xs font-mono-tabular text-[#929AA6] pt-2 border-t border-[#303741]/60">
                        {formatKST(post.createdAt, false)}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
            {newsInlineSponsors.length > 0 && (
              <div className="mt-6 space-y-3">
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

      case 'sponsors': {
        const displayPartners =
          partnerGridSponsors.length > 0
            ? partnerGridSponsors.slice(0, limit || 8)
            : topSpotlightSponsor
              ? [topSpotlightSponsor]
              : [];
        if (displayPartners.length === 0) return null;

        return (
          <section
            key="sponsors"
            id="sponsors"
            className={`max-w-6xl mx-auto px-4 sm:px-6 ${sectionPad} border-t border-[#303741]/60`}
          >
            <div className="flex items-end justify-between gap-4 mb-6">
              <div>
                <p className="text-xs tracking-[0.18em] mb-1" style={{ color: 'var(--nova-text-secondary)' }}>
                  OFFICIAL PARTNERS
                </p>
                <h2 className="text-xl sm:text-2xl font-semibold">공식 파트너 브랜드</h2>
              </div>
              <Link
                to={`/sponsors${previewSuffix}`}
                className="text-sm font-medium text-[#C5CBD3] hover:text-[#F3F4F6] inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
              >
                <span>협찬 · 광고 안내</span>
                <ArrowRight size={15} />
              </Link>
            </div>

            <div className={`grid ${getAdaptiveColsClass(displayPartners.length, 4)} gap-4`}>
              {displayPartners.map((sp) => (
                <PartnerLogoTile
                  key={sp.id}
                  sponsor={sp}
                  showSummary={sp.id !== topSpotlightSponsor?.id}
                  onClickTrack={() => trackSponsorClick(sp, 'home_partners')}
                />
              ))}
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
            className={`max-w-6xl mx-auto px-4 sm:px-6 ${sectionPad} border-t border-[#303741]/60`}
          >
            <div className="mb-5">
              <p className="text-xs tracking-[0.18em] mb-1" style={{ color: 'var(--nova-text-secondary)' }}>
                STORE &amp; BUYBACK
              </p>
              <h2 className="text-xl sm:text-2xl font-semibold">카드 구매 · 매입 서비스</h2>
            </div>
            <div className={`grid ${getAdaptiveColsClass(displayActions.length, 2)} gap-4`}>
              {displayActions.map((action, idx) => {
                const isInternal = action.url.startsWith('/');
                const targetUrl = isInternal ? `${action.url}${previewSuffix}` : action.url;
                const content = (
                  <div
                    className="group h-full border p-5 sm:p-6 rounded-lg flex flex-col justify-between gap-4 nova-transition hover:-translate-y-0.5 hover:border-[#C5CBD3]/60"
                    style={{
                      backgroundColor: idx === 0 ? 'var(--nova-bg-card)' : 'var(--nova-bg-secondary)',
                      borderColor: 'var(--nova-border)',
                    }}
                  >
                    <div className="space-y-1.5">
                      <p className="text-xs tracking-[0.16em]" style={{ color: 'var(--nova-text-secondary)' }}>
                        0{idx + 1}. {idx === 0 ? 'CATALOG' : 'BUYBACK'}
                      </p>
                      <h3 className="text-lg sm:text-xl font-semibold tracking-tight" style={{ color: 'var(--nova-text-primary)' }}>
                        {action.title}
                      </h3>
                      <p className="text-xs sm:text-sm leading-relaxed" style={{ color: 'var(--nova-text-secondary)' }}>
                        {action.subtitle}
                      </p>
                    </div>
                    <div className="flex items-center justify-between pt-2.5 border-t border-[#303741]/60">
                      <span className="text-xs sm:text-sm font-medium" style={{ color: 'var(--nova-silver)' }}>
                        {action.ctaLabel}
                      </span>
                      <ArrowRight
                        size={16}
                        className="text-[#C5CBD3] transition-transform group-hover:translate-x-1"
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

      case 'featured_products': {
        const displayProducts = products.slice(0, limit || 4);
        return (
          <section
            key="featured_products"
            className={`max-w-6xl mx-auto px-4 sm:px-6 ${sectionPad} border-t border-[#303741]/60`}
          >
            <div className="flex items-end justify-between gap-4 mb-6">
              <div>
                <p className="text-xs tracking-[0.18em] mb-1" style={{ color: 'var(--nova-text-secondary)' }}>
                  CURATED COLLECTION
                </p>
                <h2 className="text-xl sm:text-2xl font-semibold">큐레이션 컬렉션</h2>
              </div>
              <Link
                to={`/shop${previewSuffix}`}
                className="text-sm font-medium text-[#C5CBD3] hover:text-[#F3F4F6] inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
              >
                <span>스토어 전체 보기</span>
                <ArrowRight size={15} />
              </Link>
            </div>

            {displayProducts.length === 0 ? (
              <div className="border border-[#303741] rounded-lg p-8 text-center space-y-2 bg-[#11151A]">
                <p className="text-sm font-medium text-[#F3F4F6]">새로운 컬렉션 입고 준비 중입니다</p>
                <p className="text-xs text-[#929AA6]">
                  찾으시는 특정 등급 카드나 박스가 있다면 Instagram DM으로 문의해 주세요.
                </p>
              </div>
            ) : displayProducts.length === 1 ? (
              <Link
                to={`/shop/${displayProducts[0].id}${previewSuffix}`}
                className="group grid grid-cols-1 lg:grid-cols-12 border border-[#303741] rounded-lg overflow-hidden bg-[#171C23] nova-transition hover:border-[#C5CBD3]/60"
              >
                <div className="lg:col-span-5 aspect-[4/3] lg:aspect-auto lg:h-full overflow-hidden bg-[#11151A]">
                  <SafeImage
                    src={displayProducts[0].images?.[0]}
                    alt={displayProducts[0].title}
                    fallbackTitle={displayProducts[0].title}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                  />
                </div>
                <div className="lg:col-span-7 p-6 sm:p-8 flex flex-col justify-between gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5 text-xs text-[#929AA6]">
                      <span>{displayProducts[0].category}</span>
                      <span aria-hidden="true">·</span>
                      <span>{displayProducts[0].status}</span>
                      {displayProducts[0].isSample && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono-tabular text-[#C5CBD3]">SAMPLE</span>
                        </>
                      )}
                    </div>
                    <h3 className="text-lg sm:text-xl font-semibold text-[#F3F4F6]">
                      {displayProducts[0].title}
                    </h3>
                    {displayProducts[0].description && (
                      <p className="text-sm text-[#929AA6] line-clamp-2 leading-relaxed">
                        {displayProducts[0].description}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center justify-between pt-3 border-t border-[#303741]/60">
                    <p className="font-mono-tabular text-base font-semibold text-[#C5CBD3]">
                      {formatKRW(displayProducts[0].price)}
                    </p>
                    <span className="text-xs font-medium text-[#C5CBD3]">상세 보기 →</span>
                  </div>
                </div>
              </Link>
            ) : (
              <div className={`grid ${getAdaptiveColsClass(displayProducts.length, 4)} gap-4`}>
                {displayProducts.map((product) => (
                  <Link
                    key={product.id}
                    to={`/shop/${product.id}${previewSuffix}`}
                    className="group border border-[#303741] rounded-lg overflow-hidden bg-[#171C23] flex flex-col nova-transition hover:-translate-y-0.5 hover:border-[#C5CBD3]/60"
                  >
                    <div className="aspect-[4/3] w-full overflow-hidden bg-[#11151A]">
                      <SafeImage
                        src={product.images?.[0]}
                        alt={product.title}
                        fallbackTitle={product.title}
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                      />
                    </div>
                    <div className="p-4 flex-1 flex flex-col justify-between gap-3">
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-1.5 text-xs text-[#929AA6]">
                          <span>{product.category}</span>
                          <span aria-hidden="true">·</span>
                          <span>{product.status}</span>
                          {product.isSample && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="font-mono-tabular text-[#C5CBD3]">SAMPLE</span>
                            </>
                          )}
                        </div>
                        <h3 className="text-sm font-semibold text-[#F3F4F6] line-clamp-2 leading-snug">
                          {product.title}
                        </h3>
                      </div>
                      <p className="font-mono-tabular text-sm font-semibold text-[#C5CBD3]">
                        {formatKRW(product.price)}
                      </p>
                    </div>
                  </Link>
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
            className={`max-w-6xl mx-auto px-4 sm:px-6 ${sectionPad} border-t border-[#303741]/60`}
          >
            <div className="flex items-end justify-between gap-4 mb-6">
              <div>
                <p className="text-xs tracking-[0.18em] mb-1" style={{ color: 'var(--nova-text-secondary)' }}>
                  LIVE &amp; SCHEDULE (KST)
                </p>
                <h2 className="text-xl sm:text-2xl font-semibold">라이브 &amp; 이벤트</h2>
              </div>
              <Link
                to={`/events${previewSuffix}`}
                className="text-sm font-medium text-[#C5CBD3] hover:text-[#F3F4F6] inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
              >
                <span>전체 일정</span>
                <ArrowRight size={15} />
              </Link>
            </div>
            <div className={`grid ${getAdaptiveColsClass(displayEvents.length, 3)} gap-4`}>
              {displayEvents.map((ev) => {
                const status = getEventStatus(ev.startAt, ev.endAt);
                return (
                  <div
                    key={ev.id}
                    className="border border-[#303741] rounded-lg p-5 sm:p-6 bg-[#171C23] flex flex-col justify-between gap-4"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-xs text-[#929AA6]">
                        <span className={status === '진행 중' ? 'text-[#C5CBD3] font-semibold' : ''}>
                          {status}
                        </span>
                        {ev.locationOrPlatform && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span>{ev.locationOrPlatform}</span>
                          </>
                        )}
                        {ev.isSample && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="font-mono-tabular text-[#C5CBD3]">SAMPLE</span>
                          </>
                        )}
                      </div>
                      <h3 className="text-base font-semibold text-[#F3F4F6]">{ev.title}</h3>
                      {ev.description && (
                        <p className="text-sm text-[#929AA6] leading-relaxed">{ev.description}</p>
                      )}
                    </div>
                    <div className="pt-3 border-t border-[#303741]/60 flex items-center justify-between gap-3 text-xs">
                      <span className="font-mono-tabular text-[#C5CBD3]">
                        {formatKST(ev.startAt)} KST
                      </span>
                      {ev.externalUrl && isValidExternalUrl(ev.externalUrl) && (
                        <a
                          href={ev.externalUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[#C5CBD3] hover:text-[#F3F4F6] inline-flex items-center gap-1 whitespace-nowrap"
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
            className={`max-w-6xl mx-auto px-4 sm:px-6 ${sectionPad} border-t border-[#303741]/60`}
          >
            <div className="mb-6">
              <p className="text-xs tracking-[0.18em] mb-1" style={{ color: 'var(--nova-text-secondary)' }}>
                NOVA COMMUNITY
              </p>
              <h2 className="text-xl sm:text-2xl font-semibold">NOVA 커뮤니티</h2>
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
                className="group border border-[#303741] rounded-lg p-6 sm:p-7 bg-[#171C23] flex flex-col sm:flex-row sm:items-center justify-between gap-5 nova-transition hover:border-[#C5CBD3]/60"
              >
                <div className="space-y-1.5 min-w-0">
                  <span className="text-xs uppercase tracking-wider text-[#929AA6] block">
                    {displayCommunity[0].platform}
                  </span>
                  <h3 className="text-base sm:text-lg font-semibold text-[#F3F4F6]">
                    {displayCommunity[0].name}
                  </h3>
                  <p className="text-sm text-[#929AA6] leading-relaxed">
                    {displayCommunity[0].description}
                  </p>
                </div>
                <span
                  className={`min-h-[42px] px-4 py-2 text-xs font-semibold border border-[#303741] bg-[#11151A] text-[#F3F4F6] group-hover:border-[#C5CBD3] inline-flex items-center gap-2 whitespace-nowrap shrink-0 ${btnRadius}`}
                >
                  <span>채널 바로가기</span>
                  <ExternalLink size={14} />
                </span>
              </a>
            ) : (
              <div className={`grid ${getAdaptiveColsClass(displayCommunity.length, 3)} gap-4`}>
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
                    className="group border border-[#303741] rounded-lg p-5 sm:p-6 bg-[#171C23] flex flex-col justify-between gap-4 nova-transition hover:border-[#C5CBD3]/60"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs uppercase tracking-wider text-[#929AA6]">
                          {ch.platform}
                        </span>
                        <ExternalLink size={14} className="text-[#929AA6] group-hover:text-[#F3F4F6]" />
                      </div>
                      <h3 className="text-base font-semibold text-[#F3F4F6]">{ch.name}</h3>
                      <p className="text-sm text-[#929AA6] leading-relaxed">{ch.description}</p>
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
            className={`max-w-6xl mx-auto px-4 sm:px-6 ${sectionPad} border-t border-[#303741]/60`}
          >
            <div className="mb-6">
              <p className="text-xs tracking-[0.18em] mb-1" style={{ color: 'var(--nova-text-secondary)' }}>
                COLLECTOR TRUST
              </p>
              <h2 className="text-xl sm:text-2xl font-semibold">컬렉터 후기</h2>
            </div>
            <div className={`grid ${getAdaptiveColsClass(displayReviews.length, 3)} gap-4`}>
              {displayReviews.map((rev) => (
                <div
                  key={rev.id}
                  className="border border-[#303741] rounded-lg p-5 sm:p-6 bg-[#171C23] flex flex-col justify-between gap-4"
                >
                  <p className="text-sm text-[#F3F4F6] leading-relaxed">“{rev.content}”</p>
                  <div className="flex items-center justify-between text-xs text-[#929AA6] pt-3 border-t border-[#303741]/60">
                    <span>
                      {rev.authorName}
                      {rev.context ? ` · ${rev.context}` : ''}
                    </span>
                    {rev.isSample && (
                      <span className="font-mono-tabular text-[#C5CBD3]">SAMPLE</span>
                    )}
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
            className={`max-w-6xl mx-auto px-4 sm:px-6 ${sectionPad} border-t border-[#303741]/60`}
          >
            <div className="mb-6">
              <p className="text-xs tracking-[0.18em] mb-1" style={{ color: 'var(--nova-text-secondary)' }}>
                FAQ
              </p>
              <h2 className="text-xl sm:text-2xl font-semibold">자주 묻는 질문</h2>
            </div>
            <div className="divide-y divide-[#303741] border-y border-[#303741]">
              {faqs.slice(0, limit || 10).map((faq) => {
                const isOpen = openFaqId === faq.id;
                return (
                  <div key={faq.id}>
                    <button
                      type="button"
                      onClick={() => setOpenFaqId(isOpen ? null : faq.id)}
                      aria-expanded={isOpen}
                      className="w-full min-h-[50px] py-3.5 flex items-center justify-between gap-4 text-left"
                    >
                      <span className="text-sm sm:text-base font-medium text-[#F3F4F6]">
                        {faq.question}
                      </span>
                      <ChevronDown
                        size={18}
                        className={`text-[#929AA6] shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                      />
                    </button>
                    {isOpen && (
                      <div className="pb-4 text-sm text-[#929AA6] leading-relaxed whitespace-pre-line">
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
            className={`max-w-6xl mx-auto px-4 sm:px-6 ${sectionPad} border-t border-[#303741]/60`}
          >
            <div className="flex items-end justify-between gap-4 mb-5">
              <div>
                <p className="text-xs tracking-[0.18em] mb-1" style={{ color: 'var(--nova-text-secondary)' }}>
                  ANNOUNCEMENTS
                </p>
                <h2 className="text-xl sm:text-2xl font-semibold">공지사항</h2>
              </div>
            </div>
            <div className="divide-y divide-[#303741] border-y border-[#303741]">
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
                          <Pin size={14} className="text-[#8068BA] shrink-0" aria-label="고정 공지" />
                        )}
                        <span className="text-sm sm:text-base font-medium truncate text-[#F3F4F6]">
                          {notice.title}
                        </span>
                        {notice.isSample && (
                          <span className="text-[11px] font-mono-tabular tracking-wider text-[#929AA6] shrink-0">
                            SAMPLE
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="hidden sm:inline text-xs font-mono-tabular text-[#929AA6]">
                          {formatKST(notice.createdAt, false)}
                        </span>
                        <ChevronDown
                          size={16}
                          className={`text-[#929AA6] transition-transform ${isOpen ? 'rotate-180' : ''}`}
                        />
                      </div>
                    </button>
                    {isOpen && (
                      <div className="pt-2.5 pb-1 text-sm text-[#929AA6] leading-relaxed whitespace-pre-line">
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

  return (
    <>
      <SeoManager />

      {/* 1. NOVA Main Visual (Hero) */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 pt-6 pb-6 md:pt-10 md:pb-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-stretch">
          {/* Left Identity Column */}
          <div className="lg:col-span-6 flex flex-col justify-between gap-6 py-1">
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div
                  className="relative w-16 h-16 sm:w-[72px] sm:h-[72px] rounded-full overflow-hidden ring-1 ring-[#8068BA]/35 shrink-0"
                  style={{ backgroundColor: 'var(--nova-bg-main)' }}
                >
                  <SafeImage
                    key={config.brand.logoUrl}
                    src={config.brand.logoUrl}
                    alt={`${config.brand.name} 로고`}
                    fallbackTitle="NOVA"
                    className="w-full h-full object-cover scale-[1.08]"
                  />
                </div>
                <div className="min-w-0">
                  <h1 className="font-brand text-3xl sm:text-4xl font-bold tracking-[0.22em] text-[#F3F4F6]">
                    {config.brand.name}
                  </h1>
                  <p className="text-[11px] sm:text-xs tracking-[0.18em] text-[#929AA6] mt-1 truncate">
                    {config.brand.tagline}
                  </p>
                </div>
              </div>

              <div className="space-y-2.5">
                <p
                  className="text-2xl sm:text-3xl lg:text-[34px] font-semibold tracking-tight leading-tight text-balance"
                  style={{ color: 'var(--nova-text-primary)' }}
                >
                  {config.brand.headline}
                </p>
                <p
                  className="text-sm sm:text-[15px] leading-relaxed max-w-xl"
                  style={{ color: 'var(--nova-text-secondary)' }}
                >
                  {config.brand.description}
                </p>
              </div>

              {/* Primary Media-First Hero CTAs */}
              <div className="flex flex-wrap items-center gap-2.5 pt-1">
                <Link
                  to={`/drops${previewSuffix}`}
                  className={`min-h-[44px] px-5 py-2.5 text-sm font-semibold inline-flex items-center gap-2 whitespace-nowrap nova-transition ${btnRadius}`}
                  style={{
                    backgroundColor: 'var(--nova-silver)',
                    color: 'var(--nova-bg-main)',
                  }}
                >
                  <span>정가 구매·추첨 보기</span>
                  <ArrowRight size={16} />
                </Link>
                <Link
                  to={`/news${previewSuffix}`}
                  className={`min-h-[44px] px-4 py-2.5 text-sm font-medium inline-flex items-center gap-2 border whitespace-nowrap nova-transition hover:border-[#C5CBD3] ${btnRadius}`}
                  style={{
                    backgroundColor: 'var(--nova-bg-secondary)',
                    color: 'var(--nova-text-primary)',
                    borderColor: 'var(--nova-border)',
                  }}
                >
                  <span>TCG 최신 뉴스</span>
                </Link>
              </div>
            </div>

            {/* SNS Links (unregistered SNS automatically hidden) */}
            <div className="flex flex-wrap items-center gap-2.5 pt-4 border-t border-[#303741]/70">
              {isValidExternalUrl(config.brand.instagramUrl) && (
                <a
                  href={config.brand.instagramUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="NOVA Instagram"
                  className="min-h-[38px] px-3 py-1.5 rounded border border-[#303741] bg-[#11151A] text-xs text-[#C5CBD3] hover:border-[#C5CBD3] inline-flex items-center gap-2 transition-colors"
                >
                  <Instagram size={14} />
                  <span>Instagram</span>
                </a>
              )}
              {isValidExternalUrl(config.brand.tiktokUrl) && (
                <a
                  href={config.brand.tiktokUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="NOVA TikTok"
                  className="min-h-[38px] px-3 py-1.5 rounded border border-[#303741] bg-[#11151A] text-xs text-[#C5CBD3] hover:border-[#C5CBD3] inline-flex items-center gap-2 transition-colors"
                >
                  <MessageCircle size={14} />
                  <span>TikTok</span>
                </a>
              )}
              {isValidExternalUrl(config.brand.youtubeUrl) && (
                <a
                  href={config.brand.youtubeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="NOVA YouTube"
                  className="min-h-[38px] px-3 py-1.5 rounded border border-[#303741] bg-[#11151A] text-xs text-[#C5CBD3] hover:border-[#C5CBD3] inline-flex items-center gap-2 transition-colors"
                >
                  <Youtube size={14} />
                  <span>YouTube</span>
                </a>
              )}
              {config.brand.email && (
                <a
                  href={`mailto:${config.brand.email}`}
                  aria-label="NOVA Email"
                  className="min-h-[38px] px-3 py-1.5 rounded border border-[#303741] bg-[#11151A] text-xs text-[#C5CBD3] hover:border-[#C5CBD3] inline-flex items-center gap-2 transition-colors"
                >
                  <Mail size={14} />
                  <span>Email</span>
                </a>
              )}
              {dmUrl && (
                <a
                  href={dmUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="min-h-[38px] px-2.5 py-1.5 text-xs text-[#929AA6] hover:text-[#F3F4F6] inline-flex items-center gap-1.5 transition-colors"
                >
                  <span>@novapokemonkr</span>
                </a>
              )}
            </div>
          </div>

          {/* Right Editorial Hero Visual */}
          <div className="lg:col-span-6 flex flex-col gap-3">
            <div className="flex-1 min-h-[260px] sm:min-h-[320px] max-h-[420px] rounded-lg overflow-hidden border border-[#303741] bg-[#080A0D] flex items-center justify-center">
              <SafeImage
                src={config.brand.heroImageUrl}
                alt="NOVA Pokémon TCG Showcase"
                fallbackTitle="NOVA COLLECTION"
                className="w-full h-full object-contain"
              />
            </div>
            {pinnedNotice && (
              <a
                href="#notices"
                className="px-3.5 py-2.5 rounded-lg border border-[#303741] bg-[#11151A] flex items-center justify-between gap-3 hover:border-[#C5CBD3]/60 transition-colors"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Pin size={13} className="text-[#8068BA] shrink-0" aria-hidden="true" />
                  <span className="text-xs font-medium text-[#F3F4F6] truncate">
                    {pinnedNotice.title}
                  </span>
                </div>
                <span className="text-[11px] font-mono-tabular text-[#929AA6] shrink-0">
                  공지 →
                </span>
              </a>
            )}
          </div>
        </div>
      </section>

      {/* Top Main Sponsor Banner (Near upper content without obstructing Retail Drop & News) */}
      {topSpotlightSponsor && (
        <section className="max-w-6xl mx-auto px-4 sm:px-6 pb-7 md:pb-8">
          <SponsorBanner
            sponsor={topSpotlightSponsor}
            placement="home_banner"
            path="/"
            variant="hero_banner"
            buttonRadiusClass={btnRadius}
            previewSuffix={previewSuffix}
          />
        </section>
      )}

      {/* Dynamic Configurable Sections */}
      {orderedSections.map((sec) => renderSection(sec.id, sec.limit))}
    </>
  );
};
