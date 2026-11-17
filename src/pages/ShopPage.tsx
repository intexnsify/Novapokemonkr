import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search } from 'lucide-react';
import { useSite } from '../context/SiteContext';
import { trackAnalyticsEvent } from '../lib/analytics';
import { formatKRW, getInstagramDmUrl } from '../lib/utils';
import { ProductCategory } from '../types/nova';
import { SafeImage } from '../components/SafeImage';
import { SeoManager } from '../components/SeoManager';
import { SponsorBanner } from '../components/SponsorBanner';

const CATEGORIES: ('전체' | ProductCategory)[] = [
  '전체',
  '싱글카드',
  '등급카드',
  '미개봉 박스',
  '팩',
  '기타',
];

type SortOption = 'order' | 'price_asc' | 'price_desc' | 'newest';

export const ShopPage: React.FC = () => {
  const { config, products, sponsors, isPreviewDraft } = useSite();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<'전체' | ProductCategory>('전체');
  const [sortBy, setSortBy] = useState<SortOption>('order');

  useEffect(() => {
    trackAnalyticsEvent('page_view', '/shop');
  }, []);

  const previewSuffix = isPreviewDraft ? '?preview=draft' : '';
  const dmUrl = getInstagramDmUrl(config.brand.instagramUrl);
  const shopBanners = sponsors.filter((s) => s.placement === 'shop_banner');

  const filteredProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = products.filter((p) => {
      if (selectedCategory !== '전체' && p.category !== selectedCategory) return false;
      if (!q) return true;
      return (
        p.title.toLowerCase().includes(q) ||
        (p.setCode || '').toLowerCase().includes(q) ||
        (p.grade || '').toLowerCase().includes(q) ||
        (p.language || '').toLowerCase().includes(q)
      );
    });

    if (sortBy === 'price_asc') {
      return [...list].sort((a, b) => a.price - b.price);
    }
    if (sortBy === 'price_desc') {
      return [...list].sort((a, b) => b.price - a.price);
    }
    if (sortBy === 'newest') {
      return [...list].reverse();
    }
    return list;
  }, [products, searchQuery, selectedCategory, sortBy]);

  return (
    <>
      <SeoManager
        title="카드 구매하기"
        description="NOVA가 엄선한 Pokémon TCG 싱글카드, 등급카드, 미개봉 박스 카탈로그."
      />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 md:py-14 space-y-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-[#303741] pb-6">
          <div className="space-y-2">
            <p className="font-brand text-xs tracking-[0.2em] text-[#929AA6]">COLLECTION CATALOG</p>
            <h1 className="text-2xl sm:text-3xl font-semibold text-[#F3F4F6]">카드 구매하기</h1>
            <p className="text-sm text-[#929AA6]">
              모든 상품은 실물 확인 후 Instagram DM(@novapokemonkr)을 통해 안전하게 거래가 진행됩니다.
            </p>
          </div>
          <p className="text-xs font-mono-tabular text-[#929AA6]">
            총 {filteredProducts.length}개 항목
          </p>
        </div>

        {/* Optional Shop Sponsor Banner */}
        {shopBanners.length > 0 && (
          <div className="space-y-3">
            {shopBanners.map((sp) => (
              <SponsorBanner
                key={sp.id}
                sponsor={sp}
                placement="shop_banner"
                path="/shop"
                variant="shop_ad"
                previewSuffix={previewSuffix}
              />
            ))}
          </div>
        )}

        {/* Search, Category Filter & Price Sort Controls */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search
                size={16}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#929AA6]"
                aria-hidden="true"
              />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="카드명, 세트 코드, 등급(PSA 10 등) 검색"
                aria-label="상품 검색"
                className="w-full min-h-[44px] pl-10 pr-4 py-2 text-sm bg-[#11151A] border border-[#303741] rounded-md text-[#F3F4F6] placeholder:text-[#929AA6] focus:outline-none focus:border-[#C5CBD3]"
              />
            </div>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              aria-label="정렬 기준"
              className="min-h-[44px] px-3.5 py-2 text-sm bg-[#11151A] border border-[#303741] rounded-md text-[#F3F4F6] focus:outline-none focus:border-[#C5CBD3]"
            >
              <option value="order">추천순</option>
              <option value="price_asc">낮은 가격순</option>
              <option value="price_desc">높은 가격순</option>
              <option value="newest">최신 등록순</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            {CATEGORIES.map((cat) => {
              const active = selectedCategory === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`min-h-[40px] px-3.5 py-1.5 text-xs font-medium rounded-md whitespace-nowrap shrink-0 transition-colors border ${
                    active
                      ? 'bg-[#C5CBD3] text-[#080A0D] border-[#C5CBD3]'
                      : 'bg-[#11151A] text-[#929AA6] border-[#303741] hover:text-[#F3F4F6]'
                  }`}
                >
                  {cat}
                </button>
              );
            })}
          </div>
        </div>

        {/* Product Grid or Luxury Empty State */}
        {filteredProducts.length === 0 ? (
          <div className="border border-[#303741] rounded-lg p-12 sm:p-16 text-center bg-[#11151A] space-y-4">
            <p className="font-brand text-xs tracking-[0.2em] text-[#929AA6]">NO ITEMS FOUND</p>
            <h2 className="text-lg sm:text-xl font-semibold text-[#F3F4F6]">
              {products.length === 0
                ? '현재 공개된 상품이 준비 중입니다'
                : '조건에 일치하는 상품이 없습니다'}
            </h2>
            <p className="text-sm text-[#929AA6] max-w-md mx-auto leading-relaxed">
              {products.length === 0
                ? '새로운 등급 카드와 컬렉션 박스가 곧 업데이트됩니다. 찾으시는 카드가 있다면 Instagram DM으로 문의해 주세요.'
                : '검색어나 카테고리 필터를 초기화하여 다른 컬렉션을 확인해 보세요.'}
            </p>
            <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
              {products.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedCategory('전체');
                  }}
                  className="min-h-[44px] px-4 py-2 text-sm font-medium border border-[#303741] rounded-md text-[#F3F4F6] hover:border-[#C5CBD3]"
                >
                  필터 초기화
                </button>
              )}
              {dmUrl && (
                <a
                  href={dmUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="min-h-[44px] px-5 py-2 text-sm font-semibold bg-[#C5CBD3] text-[#080A0D] rounded-md inline-flex items-center"
                >
                  Instagram DM으로 카드 찾기
                </a>
              )}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredProducts.map((product) => (
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
                <div className="p-5 flex-1 flex flex-col justify-between gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5 text-xs text-[#929AA6] flex-wrap">
                      <span>{product.category}</span>
                      {product.language && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span>{product.language}</span>
                        </>
                      )}
                      {product.grade && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span>{product.grade}</span>
                        </>
                      )}
                      {product.isSample && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono-tabular text-[#C5CBD3]">SAMPLE</span>
                        </>
                      )}
                    </div>
                    <h2 className="text-base font-semibold text-[#F3F4F6] leading-snug line-clamp-2">
                      {product.title}
                    </h2>
                  </div>

                  <div className="pt-3 border-t border-[#303741]/60 flex items-center justify-between">
                    <span className="font-mono-tabular text-base font-semibold text-[#C5CBD3]">
                      {formatKRW(product.price)}
                    </span>
                    <span
                      className={`text-xs font-medium ${
                        product.status === '판매중'
                          ? 'text-[#C5CBD3]'
                          : product.status === '예약중'
                            ? 'text-[#8068BA]'
                            : 'text-[#929AA6]'
                      }`}
                    >
                      {product.status}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </>
  );
};
