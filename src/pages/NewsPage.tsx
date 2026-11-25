import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowRight, ExternalLink, Pin, Search } from 'lucide-react';
import { useSite } from '../context/SiteContext';
import { trackAnalyticsEvent } from '../lib/analytics';
import {
  formatKST,
  isRetailRaffleCategory,
  isValidExternalUrl,
  stripMarkdown,
  toDateSafe,
} from '../lib/utils';
import { NewsTcgCategory, Post } from '../types/nova';
import { SafeImage } from '../components/SafeImage';
import { SeoManager } from '../components/SeoManager';
import { SponsorBanner } from '../components/SponsorBanner';

const TCG_NEWS_FILTERS = ['전체', '포켓몬 TCG', '원피스 TCG', '기타 TCG'] as const;

function resolvePostTcgCategory(post: Post): NewsTcgCategory {
  if (
    post.tcgCategory === '포켓몬 TCG' ||
    post.tcgCategory === '원피스 TCG' ||
    post.tcgCategory === '기타 TCG'
  ) {
    return post.tcgCategory;
  }
  const text = `${post.title} ${post.category} ${post.summary || ''}`.toLowerCase();
  if (text.includes('원피스') || text.includes('one piece') || /\bop[- ]?\d{2}\b/.test(text)) {
    return '원피스 TCG';
  }
  if (
    text.includes('포켓몬') ||
    text.includes('pokemon') ||
    text.includes('pokémon') ||
    text.includes('psa') ||
    text.includes('확장팩')
  ) {
    return '포켓몬 TCG';
  }
  return '기타 TCG';
}

export const NewsPage: React.FC = () => {
  const { posts, sponsors, isPreviewDraft, loading } = useSite();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialCategory = searchParams.get('category') || '전체';
  const [selectedCat, setSelectedCat] = useState<string>(initialCategory);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    trackAnalyticsEvent('page_view', '/news');
  }, []);

  useEffect(() => {
    const paramCat = searchParams.get('category') || '전체';
    setSelectedCat(paramCat);
  }, [searchParams]);

  const previewSuffix = isPreviewDraft ? '?preview=draft' : '';
  const newsInlineSponsors = useMemo(
    () => sponsors.filter((s) => s.placement === 'news_inline'),
    [sponsors]
  );

  const retailPostCount = useMemo(
    () => posts.filter((p) => isRetailRaffleCategory(p.category)).length,
    [posts]
  );

  const handleSelectCategory = (cat: string) => {
    setSelectedCat(cat);
    const next = new URLSearchParams(searchParams);
    if (cat === '전체') {
      next.delete('category');
    } else {
      next.set('category', cat);
    }
    setSearchParams(next, { replace: true });
  };

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return [...posts]
      .filter((p) => {
        const isRetail = isRetailRaffleCategory(p.category);

        if (selectedCat === '정가 구매·추첨') {
          if (!isRetail) return false;
        } else if (selectedCat === '전체' || selectedCat === 'TCG 뉴스') {
          if (isRetail) return false;
        } else if (
          selectedCat === '포켓몬 TCG' ||
          selectedCat === '원피스 TCG' ||
          selectedCat === '기타 TCG'
        ) {
          if (isRetail) return false;
          if (resolvePostTcgCategory(p) !== selectedCat) return false;
        } else if (p.category !== selectedCat) {
          return false;
        }

        if (!q) return true;
        return (
          p.title.toLowerCase().includes(q) ||
          (p.summary || '').toLowerCase().includes(q) ||
          (p.sourceName || '').toLowerCase().includes(q) ||
          (p.tcgCategory || '').toLowerCase().includes(q) ||
          p.content.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
        const ta = toDateSafe(a.createdAt)?.getTime() ?? toDateSafe(a.publishedAtSource)?.getTime() ?? 0;
        const tb = toDateSafe(b.createdAt)?.getTime() ?? toDateSafe(b.publishedAtSource)?.getTime() ?? 0;
        return tb - ta;
      });
  }, [posts, selectedCat, searchQuery]);

  const leadPost = filtered.find((p) => p.isPinned) || filtered[0];
  const remainingPosts = leadPost ? filtered.filter((p) => p.id !== leadPost.id) : [];
  const secondaryPosts = remainingPosts.slice(0, 3);
  const archivePosts = remainingPosts.slice(3);

  return (
    <>
      <SeoManager
        title="TCG 뉴스 · 에디토리얼"
        description="NOVA가 큐레이션·요약한 글로벌 포켓몬·원피스·기타 TCG 신제품 소식 및 컬렉팅 가이드."
      />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 md:py-14 space-y-10">
        {/* Editorial Masthead */}
        <header className="nova-editorial-header flex flex-col md:flex-row md:items-end justify-between gap-5">
          <div className="space-y-2.5">
            <p className="font-mono-tabular text-[11px] tracking-[0.22em] uppercase text-[#465C77] font-semibold">
              NOVA EDITORIAL · NEWS
            </p>
            <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-[#111827] text-balance">
              TCG 뉴스 &amp; 아카이브
            </h1>
            <p className="text-sm sm:text-base text-[#667085] max-w-2xl leading-relaxed">
              국내외 공식 발표, 신규 확장팩 소식, 에디토리얼 컬렉팅 가이드를 원문 출처와 함께 정리합니다.
            </p>
          </div>
          <Link
            to={`/drops${previewSuffix}`}
            className="min-h-[42px] px-4 py-2 border border-[#E5E7EB] bg-[#FFFFFF] text-xs font-medium text-[#111827] hover:border-[#111827] rounded-md inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
          >
            <span>정가 구매·추첨 전용 허브</span>
            <ArrowRight size={14} />
          </Link>
        </header>

        {/* Category & Search Toolbar */}
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
          <div className="flex flex-wrap items-center gap-1.5">
            {TCG_NEWS_FILTERS.map((cat) => {
              const active = selectedCat === cat || (cat === '전체' && selectedCat === 'TCG 뉴스');
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => handleSelectCategory(cat)}
                  className={`min-h-[40px] px-3.5 py-1.5 text-xs font-medium rounded-md whitespace-nowrap shrink-0 border transition-colors ${
                    active
                      ? 'bg-[#111827] text-[#FFFFFF] border-[#111827] font-semibold'
                      : 'bg-[#FFFFFF] text-[#667085] border-[#E5E7EB] hover:text-[#111827] hover:border-[#D1D5DB]'
                  }`}
                >
                  {cat}
                </button>
              );
            })}

            {retailPostCount > 0 && (
              <>
                <span className="text-[#D1D5DB] px-1 hidden sm:inline" aria-hidden="true">
                  |
                </span>
                <button
                  type="button"
                  onClick={() => handleSelectCategory('정가 구매·추첨')}
                  className={`min-h-[40px] px-3.5 py-1.5 text-xs font-medium rounded-md whitespace-nowrap shrink-0 border transition-colors ${
                    selectedCat === '정가 구매·추첨'
                      ? 'bg-[#465C77] text-[#FFFFFF] border-[#465C77] font-semibold'
                      : 'bg-[#FFFFFF] text-[#667085] border-[#E5E7EB] hover:text-[#111827]'
                  }`}
                >
                  정가 구매·추첨 브리핑
                </button>
              </>
            )}
          </div>

          <div className="relative sm:w-64">
            <Search
              size={15}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#667085]"
              aria-hidden="true"
            />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="기사 · 출처 검색"
              aria-label="뉴스 검색"
              className="w-full min-h-[42px] pl-9 pr-3 py-1.5 text-sm bg-[#FFFFFF] border border-[#E5E7EB] rounded-md text-[#111827] placeholder:text-[#667085] focus:outline-none focus:border-[#465C77]"
            />
          </div>
        </div>

        {loading && posts.length === 0 ? (
          <div className="space-y-6 animate-pulse">
            <div className="grid grid-cols-1 lg:grid-cols-12 border border-[#E5E7EB] rounded-lg overflow-hidden bg-[#FFFFFF]">
              <div className="lg:col-span-7 min-h-[300px] bg-[#F5F6F8]" />
              <div className="lg:col-span-5 p-8 space-y-4">
                <div className="h-3 w-24 bg-[#F5F6F8] rounded" />
                <div className="h-7 w-full bg-[#F5F6F8] rounded" />
                <div className="h-4 w-5/6 bg-[#F5F6F8] rounded" />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[1, 2, 3].map((k) => (
                <div key={k} className="border border-[#E5E7EB] rounded-lg overflow-hidden bg-[#FFFFFF]">
                  <div className="aspect-[16/10] bg-[#F5F6F8]" />
                  <div className="p-5 space-y-3">
                    <div className="h-3 w-20 bg-[#F5F6F8] rounded" />
                    <div className="h-5 w-full bg-[#F5F6F8] rounded" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="border border-[#E5E7EB] rounded-lg p-12 text-center bg-[#FFFFFF] space-y-2">
            <p className="text-base font-medium text-[#111827]">게시된 콘텐츠가 없습니다</p>
            <p className="text-sm text-[#667085]">선택한 카테고리 또는 검색어에 해당하는 기사가 아직 없습니다.</p>
          </div>
        ) : (
          <div className="space-y-10">
            {/* Tier 1: Lead Feature Article */}
            {leadPost &&
              (() => {
                const pinnedThumb = leadPost.coverImage || leadPost.galleryImages?.[0]?.url;
                const pinnedPhotoCount =
                  (leadPost.coverImage ? 1 : 0) + (leadPost.galleryImages?.length ?? 0);
                const leadExcerpt = stripMarkdown(leadPost.summary || leadPost.content);
                return (
                  <article className="group grid grid-cols-1 lg:grid-cols-12 border border-[#E5E7EB] rounded-lg overflow-hidden bg-[#FFFFFF] nova-card-hover hover:border-[#D1D5DB]">
                    {pinnedThumb && (
                      <Link
                        to={`/news/${leadPost.slug}${previewSuffix}`}
                        className="lg:col-span-7 aspect-[16/10] lg:aspect-auto lg:min-h-[340px] bg-[#F5F6F8] overflow-hidden block border-b lg:border-b-0 lg:border-r border-[#E5E7EB]"
                      >
                        <SafeImage
                          src={pinnedThumb}
                          alt={leadPost.title}
                          fallbackTitle={leadPost.title}
                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.025]"
                        />
                      </Link>
                    )}
                    <div
                      className={`${
                        pinnedThumb ? 'lg:col-span-5' : 'lg:col-span-12'
                      } p-6 sm:p-8 flex flex-col justify-between gap-6`}
                    >
                      <div className="space-y-3.5">
                        <div className="flex flex-wrap items-center gap-2 text-xs text-[#667085]">
                          {leadPost.isPinned && <Pin size={13} className="text-[#465C77]" />}
                          <span className="text-[#465C77] font-semibold">
                            {leadPost.tcgCategory || leadPost.category}
                          </span>
                          {leadPost.sourceName && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span>{leadPost.sourceName}</span>
                            </>
                          )}
                          <span aria-hidden="true">·</span>
                          <span className="font-mono-tabular">
                            {formatKST(leadPost.createdAt, false)}
                          </span>
                          {pinnedPhotoCount > 1 && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="font-mono-tabular">사진 {pinnedPhotoCount}장</span>
                            </>
                          )}
                        </div>
                        <Link to={`/news/${leadPost.slug}${previewSuffix}`} className="block">
                          <h2 className="text-xl sm:text-2xl lg:text-[26px] font-semibold text-[#111827] leading-snug text-balance group-hover:text-[#465C77] transition-colors">
                            {leadPost.title}
                          </h2>
                        </Link>
                        {leadExcerpt && (
                          <p className="text-sm text-[#667085] leading-relaxed line-clamp-3">
                            {leadExcerpt}
                          </p>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-[#E5E7EB]">
                        <Link
                          to={`/news/${leadPost.slug}${previewSuffix}`}
                          className="text-xs font-semibold text-[#111827] group-hover:text-[#465C77] inline-flex items-center gap-1.5"
                        >
                          <span>NOVA 요약 읽기</span>
                          <ArrowRight size={13} />
                        </Link>
                        {leadPost.sourceUrl && isValidExternalUrl(leadPost.sourceUrl) && (
                          <a
                            href={leadPost.sourceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs font-medium text-[#667085] hover:text-[#111827] inline-flex items-center gap-1"
                          >
                            <span>원문 보기</span>
                            <ExternalLink size={12} />
                          </a>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })()}

            {/* Strictly Separated Native Sponsor Slot */}
            {newsInlineSponsors.length > 0 && (
              <div className="space-y-3">
                {newsInlineSponsors.map((sp) => (
                  <SponsorBanner
                    key={sp.id}
                    sponsor={sp}
                    placement="news_inline"
                    path="/news"
                    variant="inline_ad"
                    previewSuffix={previewSuffix}
                  />
                ))}
              </div>
            )}

            {/* Tier 2: Secondary Highlights Grid */}
            {secondaryPosts.length > 0 && (
              <section className="space-y-4">
                <p className="font-mono-tabular text-[11px] tracking-[0.18em] uppercase text-[#667085]">
                  FEATURED STORIES
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {secondaryPosts.map((post) => {
                    const thumb = post.coverImage || post.galleryImages?.[0]?.url;
                    const photoCount = (post.coverImage ? 1 : 0) + (post.galleryImages?.length ?? 0);
                    const excerpt = stripMarkdown(post.summary || post.content);
                    return (
                      <article
                        key={post.id}
                        className="group border border-[#E5E7EB] rounded-lg overflow-hidden bg-[#FFFFFF] flex flex-col nova-card-hover hover:border-[#D1D5DB]"
                      >
                        {thumb && (
                          <Link
                            to={`/news/${post.slug}${previewSuffix}`}
                            className="aspect-[16/10] w-full overflow-hidden bg-[#F5F6F8] border-b border-[#E5E7EB] block"
                          >
                            <SafeImage
                              src={thumb}
                              alt={post.title}
                              fallbackTitle={post.title}
                              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                            />
                          </Link>
                        )}
                        <div className="p-5 flex-1 flex flex-col justify-between gap-4">
                          <div className="space-y-2">
                            <div className="flex flex-wrap items-center gap-1.5 text-xs text-[#667085]">
                              <span className="text-[#465C77] font-semibold">
                                {post.tcgCategory || post.category}
                              </span>
                              {post.sourceName && (
                                <>
                                  <span aria-hidden="true">·</span>
                                  <span className="truncate">{post.sourceName}</span>
                                </>
                              )}
                              {photoCount > 1 && (
                                <>
                                  <span aria-hidden="true">·</span>
                                  <span className="font-mono-tabular">사진 {photoCount}장</span>
                                </>
                              )}
                            </div>
                            <Link to={`/news/${post.slug}${previewSuffix}`} className="block">
                              <h3 className="text-base font-semibold text-[#111827] leading-snug line-clamp-2 group-hover:text-[#465C77] transition-colors">
                                {post.title}
                              </h3>
                            </Link>
                            {excerpt && (
                              <p className="text-xs text-[#667085] line-clamp-2 leading-relaxed">
                                {excerpt}
                              </p>
                            )}
                          </div>

                          <div className="flex items-center justify-between gap-2 pt-3 border-t border-[#E5E7EB] text-xs">
                            <span className="font-mono-tabular text-[#667085]">
                              {formatKST(post.createdAt, false)}
                            </span>
                            <div className="flex items-center gap-3">
                              {post.sourceUrl && isValidExternalUrl(post.sourceUrl) && (
                                <a
                                  href={post.sourceUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[#667085] hover:text-[#111827] inline-flex items-center gap-1 font-medium"
                                >
                                  <span>원문</span>
                                  <ExternalLink size={11} />
                                </a>
                              )}
                              <Link
                                to={`/news/${post.slug}${previewSuffix}`}
                                className="text-[#111827] hover:text-[#465C77] font-semibold"
                              >
                                읽기 →
                              </Link>
                            </div>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            )}

            {/* Tier 3: Editorial Archive Ledger */}
            {archivePosts.length > 0 && (
              <section className="space-y-4 pt-2">
                <p className="font-mono-tabular text-[11px] tracking-[0.18em] uppercase text-[#667085]">
                  MORE STORIES · ARCHIVE
                </p>
                <div className="divide-y divide-[#E5E7EB] border border-[#E5E7EB] bg-[#FFFFFF] rounded-lg overflow-hidden">
                  {archivePosts.map((post) => {
                    const thumb = post.coverImage || post.galleryImages?.[0]?.url;
                    const excerpt = stripMarkdown(post.summary || post.content);
                    return (
                      <article
                        key={post.id}
                        className="group p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-[#F5F6F8] transition-colors"
                      >
                        <Link
                          to={`/news/${post.slug}${previewSuffix}`}
                          className="flex items-start gap-4 min-w-0 flex-1"
                        >
                          {thumb && (
                            <div className="w-20 h-16 sm:w-24 sm:h-16 rounded border border-[#E5E7EB] bg-[#F5F6F8] overflow-hidden shrink-0">
                              <SafeImage
                                src={thumb}
                                alt={post.title}
                                fallbackTitle={post.title}
                                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                              />
                            </div>
                          )}
                          <div className="min-w-0 space-y-1">
                            <div className="flex flex-wrap items-center gap-1.5 text-xs text-[#667085]">
                              <span className="text-[#465C77] font-semibold">
                                {post.tcgCategory || post.category}
                              </span>
                              {post.sourceName && (
                                <>
                                  <span aria-hidden="true">·</span>
                                  <span>{post.sourceName}</span>
                                </>
                              )}
                              <span aria-hidden="true">·</span>
                              <span className="font-mono-tabular">
                                {formatKST(post.createdAt, false)}
                              </span>
                            </div>
                            <h3 className="text-base font-semibold text-[#111827] leading-snug group-hover:text-[#465C77] transition-colors line-clamp-1">
                              {post.title}
                            </h3>
                            {excerpt && (
                              <p className="text-xs text-[#667085] line-clamp-1">{excerpt}</p>
                            )}
                          </div>
                        </Link>
                        <div className="flex items-center gap-3 shrink-0 text-xs self-end sm:self-center">
                          {post.sourceUrl && isValidExternalUrl(post.sourceUrl) && (
                            <a
                              href={post.sourceUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[#667085] hover:text-[#111827] inline-flex items-center gap-1"
                            >
                              <span>원문</span>
                              <ExternalLink size={11} />
                            </a>
                          )}
                          <Link
                            to={`/news/${post.slug}${previewSuffix}`}
                            className="font-semibold text-[#111827] hover:text-[#465C77]"
                          >
                            읽기 →
                          </Link>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    <div className="max-w-6xl mx-auto px-4 py-5"><Link to="/sell" className="text-sm underline">포켓몬카드 매입 견적 신청하기 →</Link></div></>
  );
};
