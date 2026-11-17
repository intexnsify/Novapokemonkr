import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  ChevronDown,
  ExternalLink,
  Instagram,
  Mail,
  MessageCircle,
  Pin,
  Youtube,
} from 'lucide-react';
import { useSite } from '../context/SiteContext';
import { trackAnalyticsEvent } from '../lib/analytics';
import {
  formatKRW,
  formatKST,
  getEventStatus,
  getInstagramDmUrl,
  isValidExternalUrl,
} from '../lib/utils';
import { HomeSectionId } from '../types/nova';
import { getButtonRadiusClass, getSectionSpacingClass } from '../components/PublicLayout';
import { SafeImage } from '../components/SafeImage';
import { SeoManager } from '../components/SeoManager';
import { WorkWithNovaSection } from '../components/WorkWithNovaSection';

export const HomePage: React.FC = () => {
  const { config, products, posts, notices, events, sponsors, reviews, faqs, isPreviewDraft } =
    useSite();
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

  const homeSponsors = sponsors.filter((s) => s.placement === 'home_partners' || s.placement === 'home_banner');

  const renderSection = (sectionId: HomeSectionId, limit: number) => {
    switch (sectionId) {
      case 'actions': {
        if (visibleActions.length === 0) return null;
        return (
          <section key="actions" className={`max-w-6xl mx-auto px-4 sm:px-6 ${sectionPad}`}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {visibleActions.slice(0, limit || 4).map((action, idx) => {
                const isInternal = action.url.startsWith('/');
                const targetUrl = isInternal ? `${action.url}${previewSuffix}` : action.url;
                const content = (
                  <div
                    className="group h-full border p-6 sm:p-8 rounded-lg flex flex-col justify-between gap-6 nova-transition hover:-translate-y-0.5 hover:border-[#C5CBD3]/60"
                    style={{
                      backgroundColor: idx === 0 ? 'var(--nova-bg-card)' : 'var(--nova-bg-secondary)',
                      borderColor: 'var(--nova-border)',
                    }}
                  >
                    <div className="space-y-2">
                      <p className="text-xs tracking-[0.16em]" style={{ color: 'var(--nova-text-secondary)' }}>
                        0{idx + 1}. {idx === 0 ? 'CATALOG' : 'BUYBACK'}
                      </p>
                      <h2 className="text-xl sm:text-2xl font-semibold tracking-tight" style={{ color: 'var(--nova-text-primary)' }}>
                        {action.title}
                      </h2>
                      <p className="text-sm leading-relaxed" style={{ color: 'var(--nova-text-secondary)' }}>
                        {action.subtitle}
                      </p>
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t border-[#303741]/60">
                      <span className="text-sm font-medium" style={{ color: 'var(--nova-silver)' }}>
                        {action.ctaLabel}
                      </span>
                      <ArrowRight
                        size={18}
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

      case 'notices': {
        if (notices.length === 0) return null;
        return (
          <section key="notices" className={`max-w-6xl mx-auto px-4 sm:px-6 ${sectionPad} border-t border-[#303741]/60`}>
            <div className="flex items-end justify-between gap-4 mb-6">
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
                  <div key={notice.id} className="py-4">
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
                      <div className="pt-3 pb-1 text-sm text-[#929AA6] leading-relaxed whitespace-pre-line">
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

      case 'featured_products': {
        const displayProducts = products.slice(0, limit || 4);
        return (
          <section key="featured_products" className={`max-w-6xl mx-auto px-4 sm:px-6 ${sectionPad} border-t border-[#303741]/60`}>
            <div className="flex items-end justify-between gap-4 mb-8">
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
                <span>전체 보기</span>
                <ArrowRight size={15} />
              </Link>
            </div>

            {displayProducts.length === 0 ? (
              <div className="border border-[#303741] rounded-lg p-10 text-center space-y-3 bg-[#11151A]">
                <p className="text-sm font-medium text-[#F3F4F6]">새로운 컬렉션 입고 준비 중입니다</p>
                <p className="text-xs text-[#929AA6]">
                  찾으시는 특정 등급 카드나 박스가 있다면 Instagram DM으로 문의해 주세요.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
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

      case 'sponsors': {
        if (homeSponsors.length === 0) return null;
        return (
          <section key="sponsors" className={`max-w-6xl mx-auto px-4 sm:px-6 ${sectionPad} border-t border-[#303741]/60`}>
            <div className="mb-8">
              <p className="text-xs tracking-[0.18em] mb-1" style={{ color: 'var(--nova-text-secondary)' }}>
                PARTNERSHIP &amp; SPONSORED
              </p>
              <h2 className="text-xl sm:text-2xl font-semibold">협찬 및 파트너십</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {homeSponsors.slice(0, limit || 4).map((sp) => (
                <a
                  key={sp.id}
                  href={sp.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() =>
                    trackAnalyticsEvent('sponsor_click', '/', {
                      targetType: 'sponsor',
                      targetId: sp.id,
                      targetLabel: sp.name,
                    })
                  }
                  className="group border border-[#303741] rounded-lg p-6 bg-[#171C23] flex flex-col justify-between gap-5 nova-transition hover:border-[#C5CBD3]/60"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        {sp.logoUrl && (
                          <SafeImage
                            src={sp.logoUrl}
                            alt={sp.name}
                            className="w-9 h-9 rounded object-cover border border-[#303741]"
                          />
                        )}
                        <h3 className="font-brand text-base sm:text-lg font-bold tracking-[0.14em] text-[#F3F4F6] truncate">
                          {sp.name}
                        </h3>
                      </div>
                      {sp.isSponsored && (
                        <span className="px-2 py-0.5 text-[11px] font-medium border border-[#8068BA]/60 text-[#C5CBD3] bg-[#8068BA]/15 rounded shrink-0">
                          {sp.badgeLabel || '협찬'}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-[#929AA6] leading-relaxed">{sp.description}</p>
                  </div>
                  <div className="flex items-center justify-between pt-3 border-t border-[#303741]/60 text-xs text-[#C5CBD3]">
                    <span className="truncate">{sp.url}</span>
                    <ExternalLink size={14} className="shrink-0 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </a>
              ))}
            </div>
          </section>
        );
      }

      case 'news': {
        if (posts.length === 0) return null;
        return (
          <section key="news" className={`max-w-6xl mx-auto px-4 sm:px-6 ${sectionPad} border-t border-[#303741]/60`}>
            <div className="flex items-end justify-between gap-4 mb-8">
              <div>
                <p className="text-xs tracking-[0.18em] mb-1" style={{ color: 'var(--nova-text-secondary)' }}>
                  EDITORIAL &amp; TCG NEWS
                </p>
                <h2 className="text-xl sm:text-2xl font-semibold">콘텐츠 &amp; TCG 뉴스</h2>
              </div>
              <Link
                to={`/news${previewSuffix}`}
                className="text-sm font-medium text-[#C5CBD3] hover:text-[#F3F4F6] inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
              >
                <span>아카이브 보기</span>
                <ArrowRight size={15} />
              </Link>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {posts.slice(0, limit || 3).map((post) => (
                <Link
                  key={post.id}
                  to={`/news/${post.slug}${previewSuffix}`}
                  className="group border border-[#303741] rounded-lg overflow-hidden bg-[#171C23] flex flex-col nova-transition hover:border-[#C5CBD3]/60"
                >
                  {post.coverImage && (
                    <div className="aspect-[4/3] w-full overflow-hidden bg-[#11151A]">
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
                    <p className="text-xs font-mono-tabular text-[#929AA6]">
                      {formatKST(post.createdAt, false)}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        );
      }

      case 'events': {
        if (events.length === 0) return null;
        return (
          <section key="events" className={`max-w-6xl mx-auto px-4 sm:px-6 ${sectionPad} border-t border-[#303741]/60`}>
            <div className="flex items-end justify-between gap-4 mb-8">
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {events.slice(0, limit || 3).map((ev) => {
                const status = getEventStatus(ev.startAt, ev.endAt);
                return (
                  <div
                    key={ev.id}
                    className="border border-[#303741] rounded-lg p-6 bg-[#171C23] flex flex-col justify-between gap-4"
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
        return (
          <section key="community" className={`max-w-6xl mx-auto px-4 sm:px-6 ${sectionPad} border-t border-[#303741]/60`}>
            <div className="mb-8">
              <p className="text-xs tracking-[0.18em] mb-1" style={{ color: 'var(--nova-text-secondary)' }}>
                NOVA COMMUNITY
              </p>
              <h2 className="text-xl sm:text-2xl font-semibold">NOVA 커뮤니티</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {visibleCommunity.slice(0, limit || 6).map((ch) => (
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
                  className="group border border-[#303741] rounded-lg p-6 bg-[#171C23] flex flex-col justify-between gap-4 nova-transition hover:border-[#C5CBD3]/60"
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
          </section>
        );
      }

      case 'reviews': {
        if (reviews.length === 0) return null;
        return (
          <section key="reviews" className={`max-w-6xl mx-auto px-4 sm:px-6 ${sectionPad} border-t border-[#303741]/60`}>
            <div className="mb-8">
              <p className="text-xs tracking-[0.18em] mb-1" style={{ color: 'var(--nova-text-secondary)' }}>
                COLLECTOR TRUST
              </p>
              <h2 className="text-xl sm:text-2xl font-semibold">컬렉터 후기</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {reviews.slice(0, limit || 3).map((rev) => (
                <div
                  key={rev.id}
                  className="border border-[#303741] rounded-lg p-6 bg-[#171C23] flex flex-col justify-between gap-4"
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
          <section key="faq" className={`max-w-6xl mx-auto px-4 sm:px-6 ${sectionPad} border-t border-[#303741]/60`}>
            <div className="mb-8">
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
                      className="w-full min-h-[52px] py-4 flex items-center justify-between gap-4 text-left"
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
                      <div className="pb-5 text-sm text-[#929AA6] leading-relaxed whitespace-pre-line">
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

      case 'work_with_nova':
        return <WorkWithNovaSection key="work_with_nova" />;

      default:
        return null;
    }
  };

  return (
    <>
      <SeoManager />

      {/* Hero Section */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 pt-10 pb-12 md:pt-16 md:pb-16">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-stretch">
          {/* Left Identity Column */}
          <div className="lg:col-span-6 flex flex-col justify-between gap-8 py-2">
            <div className="space-y-6">
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

              <div className="space-y-3">
                <p
                  className="text-2xl sm:text-3xl lg:text-4xl font-semibold tracking-tight leading-tight text-balance"
                  style={{ color: 'var(--nova-text-primary)' }}
                >
                  {config.brand.headline}
                </p>
                <p
                  className="text-sm sm:text-base leading-relaxed max-w-xl"
                  style={{ color: 'var(--nova-text-secondary)' }}
                >
                  {config.brand.description}
                </p>
              </div>

              {/* Primary Hero CTAs */}
              <div className="flex flex-wrap items-center gap-3 pt-1">
                <Link
                  to={`/shop${previewSuffix}`}
                  className={`min-h-[44px] px-5 py-2.5 text-sm font-semibold inline-flex items-center gap-2 whitespace-nowrap nova-transition ${btnRadius}`}
                  style={{
                    backgroundColor: 'var(--nova-silver)',
                    color: 'var(--nova-bg-main)',
                  }}
                >
                  <span>카드 구매하기</span>
                  <ArrowRight size={16} />
                </Link>
                <Link
                  to={`/sell${previewSuffix}`}
                  className={`min-h-[44px] px-5 py-2.5 text-sm font-medium inline-flex items-center gap-2 border whitespace-nowrap nova-transition hover:border-[#C5CBD3] ${btnRadius}`}
                  style={{
                    backgroundColor: 'var(--nova-bg-secondary)',
                    color: 'var(--nova-text-primary)',
                    borderColor: 'var(--nova-border)',
                  }}
                >
                  <span>카드 매입 신청</span>
                </Link>
              </div>
            </div>

            {/* SNS Links (unregistered SNS automatically hidden) */}
            <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-[#303741]/70">
              {isValidExternalUrl(config.brand.instagramUrl) && (
                <a
                  href={config.brand.instagramUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="NOVA Instagram"
                  className="min-h-[40px] px-3 py-1.5 rounded border border-[#303741] bg-[#11151A] text-xs text-[#C5CBD3] hover:border-[#C5CBD3] inline-flex items-center gap-2 transition-colors"
                >
                  <Instagram size={15} />
                  <span>Instagram</span>
                </a>
              )}
              {isValidExternalUrl(config.brand.tiktokUrl) && (
                <a
                  href={config.brand.tiktokUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="NOVA TikTok"
                  className="min-h-[40px] px-3 py-1.5 rounded border border-[#303741] bg-[#11151A] text-xs text-[#C5CBD3] hover:border-[#C5CBD3] inline-flex items-center gap-2 transition-colors"
                >
                  <MessageCircle size={15} />
                  <span>TikTok</span>
                </a>
              )}
              {isValidExternalUrl(config.brand.youtubeUrl) && (
                <a
                  href={config.brand.youtubeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="NOVA YouTube"
                  className="min-h-[40px] px-3 py-1.5 rounded border border-[#303741] bg-[#11151A] text-xs text-[#C5CBD3] hover:border-[#C5CBD3] inline-flex items-center gap-2 transition-colors"
                >
                  <Youtube size={15} />
                  <span>YouTube</span>
                </a>
              )}
              {config.brand.email && (
                <a
                  href={`mailto:${config.brand.email}`}
                  aria-label="NOVA Email"
                  className="min-h-[40px] px-3 py-1.5 rounded border border-[#303741] bg-[#11151A] text-xs text-[#C5CBD3] hover:border-[#C5CBD3] inline-flex items-center gap-2 transition-colors"
                >
                  <Mail size={15} />
                  <span>Email</span>
                </a>
              )}
              {dmUrl && (
                <a
                  href={dmUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="min-h-[40px] px-3 py-1.5 text-xs text-[#929AA6] hover:text-[#F3F4F6] inline-flex items-center gap-1.5 transition-colors"
                >
                  <span>@novapokemonkr</span>
                </a>
              )}
            </div>
          </div>

          {/* Right Editorial Hero Visual */}
          <div className="lg:col-span-6">
            <div className="relative h-full min-h-[260px] sm:min-h-[340px] rounded-lg overflow-hidden border border-[#303741] bg-[#11151A]">
              <SafeImage
                src={config.brand.heroImageUrl}
                alt="NOVA Pokémon TCG Showcase"
                fallbackTitle="NOVA COLLECTION"
                className="w-full h-full object-cover"
              />
              <div
                className="absolute inset-0 pointer-events-none bg-gradient-to-t from-[#080A0D]/80 via-transparent to-transparent"
                aria-hidden="true"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Dynamic Configurable Sections */}
      {orderedSections.map((sec) => renderSection(sec.id, sec.limit))}
    </>
  );
};
