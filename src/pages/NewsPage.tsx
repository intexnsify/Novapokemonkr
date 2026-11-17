import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Pin, Search } from 'lucide-react';
import { useSite } from '../context/SiteContext';
import { trackAnalyticsEvent } from '../lib/analytics';
import { formatKST, isRetailRaffleCategory } from '../lib/utils';
import { SafeImage } from '../components/SafeImage';
import { SeoManager } from '../components/SeoManager';
import { SponsorBanner } from '../components/SponsorBanner';

export const NewsPage: React.FC = () => {
  const { posts, sponsors, isPreviewDraft } = useSite();
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

  const categories = useMemo(() => {
    const set = new Set<string>(['전체', '정가 구매·추첨', 'TCG 뉴스']);
    posts.forEach((p) => {
      if (p.category) set.add(p.category);
    });
    return Array.from(set);
  }, [posts]);

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
    return posts.filter((p) => {
      if (selectedCat !== '전체') {
        if (selectedCat === '정가 구매·추첨') {
          if (!isRetailRaffleCategory(p.category) && p.category !== selectedCat) return false;
        } else if (selectedCat === 'TCG 뉴스') {
          if (isRetailRaffleCategory(p.category)) return false;
        } else if (p.category !== selectedCat) {
          return false;
        }
      }
      if (!q) return true;
      return (
        p.title.toLowerCase().includes(q) ||
        (p.summary || '').toLowerCase().includes(q) ||
        p.content.toLowerCase().includes(q)
      );
    });
  }, [posts, selectedCat, searchQuery]);

  const pinnedPost = filtered.find((p) => p.isPinned) || filtered[0];
  const restPosts = pinnedPost ? filtered.filter((p) => p.id !== pinnedPost.id) : filtered;

  return (
    <>
      <SeoManager
        title="콘텐츠 & TCG 뉴스"
        description="NOVA의 Pokémon TCG 에디토리얼 아카이브, 컬렉팅 가이드, 신규 소식."
      />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 md:py-14 space-y-8">
        <div className="border-b border-[#303741] pb-6 space-y-2">
          <p className="font-brand text-xs tracking-[0.2em] text-[#929AA6]">EDITORIAL ARCHIVE</p>
          <h1 className="text-2xl sm:text-3xl font-semibold text-[#F3F4F6]">콘텐츠 &amp; TCG 뉴스</h1>
          <p className="text-sm text-[#929AA6]">
            Pokémon TCG 발매 동향, 감정 및 보관 가이드, NOVA 큐레이션 아티클을 확인하세요.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => handleSelectCategory(cat)}
                className={`min-h-[40px] px-3.5 py-1.5 text-xs font-medium rounded-md whitespace-nowrap shrink-0 border transition-colors ${
                  selectedCat === cat
                    ? 'bg-[#C5CBD3] text-[#080A0D] border-[#C5CBD3]'
                    : 'bg-[#11151A] text-[#929AA6] border-[#303741] hover:text-[#F3F4F6]'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="relative sm:w-64">
            <Search
              size={15}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#929AA6]"
              aria-hidden="true"
            />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="기사 검색"
              aria-label="뉴스 검색"
              className="w-full min-h-[40px] pl-9 pr-3 py-1.5 text-sm bg-[#11151A] border border-[#303741] rounded-md text-[#F3F4F6] placeholder:text-[#929AA6] focus:outline-none focus:border-[#C5CBD3]"
            />
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="border border-[#303741] rounded-lg p-12 text-center bg-[#11151A] space-y-2">
            <p className="text-base font-medium text-[#F3F4F6]">게시된 콘텐츠가 없습니다</p>
            <p className="text-sm text-[#929AA6]">곧 새로운 TCG 아티클이 업데이트됩니다.</p>
          </div>
        ) : (
          <div className="space-y-8">
            {pinnedPost && (
              <Link
                to={`/news/${pinnedPost.slug}${previewSuffix}`}
                className="group grid grid-cols-1 lg:grid-cols-12 border border-[#303741] rounded-lg overflow-hidden bg-[#171C23] hover:border-[#C5CBD3]/60 transition-colors"
              >
                {pinnedPost.coverImage && (
                  <div className="lg:col-span-6 aspect-[4/3] lg:aspect-auto lg:h-full bg-[#11151A] overflow-hidden">
                    <SafeImage
                      src={pinnedPost.coverImage}
                      alt={pinnedPost.title}
                      fallbackTitle={pinnedPost.title}
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                    />
                  </div>
                )}
                <div
                  className={`${
                    pinnedPost.coverImage ? 'lg:col-span-6' : 'lg:col-span-12'
                  } p-6 sm:p-8 flex flex-col justify-between gap-6`}
                >
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-xs text-[#929AA6]">
                      {pinnedPost.isPinned && <Pin size={13} className="text-[#8068BA]" />}
                      <span>{pinnedPost.category}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono-tabular">
                        {formatKST(pinnedPost.createdAt, false)}
                      </span>
                      {pinnedPost.isSample && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono-tabular text-[#C5CBD3]">SAMPLE</span>
                        </>
                      )}
                    </div>
                    <h2 className="text-xl sm:text-2xl font-semibold text-[#F3F4F6] leading-snug">
                      {pinnedPost.title}
                    </h2>
                    {pinnedPost.summary && (
                      <p className="text-sm text-[#929AA6] leading-relaxed">{pinnedPost.summary}</p>
                    )}
                  </div>
                  <span className="text-xs font-medium text-[#C5CBD3]">아티클 읽기 →</span>
                </div>
              </Link>
            )}

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

            {restPosts.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {restPosts.map((post) => (
                  <Link
                    key={post.id}
                    to={`/news/${post.slug}${previewSuffix}`}
                    className="group border border-[#303741] rounded-lg overflow-hidden bg-[#171C23] flex flex-col hover:border-[#C5CBD3]/60 transition-colors"
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
            )}
          </div>
        )}
      </div>
    </>
  );
};
