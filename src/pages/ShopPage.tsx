import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Search } from 'lucide-react';
import { useSite } from '../context/SiteContext';
import { trackAnalyticsEvent } from '../lib/analytics';
import { getInstagramDmUrl } from '../lib/utils';
import { newestFirst, productCollections } from '../lib/products';
import { SafeImage } from '../components/SafeImage';
import { Product, ProductCategory } from '../types/nova';
import { ProductQuickViewModal } from '../components/ProductQuickViewModal';
import { SeoManager } from '../components/SeoManager';
import { ShopProductCard } from '../components/ShopProductCard';
import { SponsorBanner } from '../components/SponsorBanner';

const CATEGORIES: ('전체' | ProductCategory)[] = [
  '전체',
  '등급카드',
  '싱글카드',
  '미개봉 박스',
  '팩',
  '기타',
];

type SortOption = 'order' | 'price_asc' | 'price_desc' | 'newest';

export const ShopPage: React.FC = () => {
  const { config, products, sponsors, isPreviewDraft } = useSite();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<'전체' | ProductCategory>('전체');
  const [collection, setCollection] = useState('');
  const collections = useMemo(() => productCollections(products), [products]);
  const [sortBy, setSortBy] = useState<SortOption>('order');
  const [quickViewProduct, setQuickViewProduct] = useState<Product | null>(null);

  useEffect(() => {
    trackAnalyticsEvent('page_view', '/shop');
  }, []);

  const previewSuffix = isPreviewDraft ? '?preview=draft' : '';
  const dmUrl = getInstagramDmUrl(config.brand.instagramUrl);
  const shopBanners = sponsors.filter((s) => s.placement === 'shop_banner');

  const filteredProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const source = collection ? collections.find(c=>c.id===collection)?.products || [] : products;
    const list = source.filter((p) => {
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
      return [...list].sort(newestFirst);
    }
    return list;
  }, [products, searchQuery, selectedCategory, sortBy, collection, collections]);

  return (
    <>
      <SeoManager
        title="SHOP · 카드 구매 카탈로그"
        description="NOVA가 엄선한 Pokémon TCG 등급카드, 싱글카드, 미개봉 박스 스토어 및 장바구니 DM 문의."
      />

      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 py-10 md:py-14 space-y-9">
        {/* Market Header */}
        <header className="nova-editorial-header space-y-6">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div className="space-y-2">
              <p className="font-mono-tabular text-[11px] tracking-[0.22em] uppercase text-[#465C77] font-semibold">
                NOVA STORE · CARDS &amp; SEALED ARCHIVE
              </p>
              <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-[#111827]">
                THE NOVA COLLECTION
              </h1>
              <p className="text-sm sm:text-base text-[#667085] max-w-2xl leading-relaxed">
                한 장의 카드, 하나의 컬렉션. 마음에 드는 상품을 고르고 Instagram DM으로 구매를 문의하세요.
              </p>
            </div>
            <p className="text-xs font-mono-tabular text-[#667085] shrink-0">
              총 {filteredProducts.length}개 상품
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              to={`/shop${previewSuffix}`}
              className="min-h-[42px] px-4 py-2 rounded-md text-xs font-semibold bg-[#111827] text-[#FFFFFF] inline-flex items-center"
            >
              판매 카탈로그 (구매)
            </Link>
            <Link
              to={`/sell${previewSuffix}`}
              className="min-h-[42px] px-4 py-2 rounded-md text-xs font-medium border border-[#E5E7EB] bg-[#FFFFFF] text-[#667085] hover:text-[#111827] hover:border-[#D1D5DB] inline-flex items-center gap-1.5 transition-colors"
            >
              <span>비공개 카드 매입 신청 (판매)</span>
              <ArrowRight size={13} />
            </Link>
          </div>
        </header>

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

        {collections.length > 0 && <section aria-label="컬렉션 둘러보기" className="collection-directory">{collections.map(c=><button key={c.id} aria-pressed={collection===c.id} onClick={()=>{setCollection(collection===c.id?'':c.id);setSelectedCategory('전체');setSearchQuery('');}}><SafeImage src={c.products[0].images?.[0]} alt="" loading="lazy" className="w-16 h-20 object-contain shrink-0"/><span><small>{c.subtitle}</small><strong>{c.title}</strong><span>{c.products.length}개 · 전체 보기 →</span></span></button>)}</section>}

        {/* Search, Category Filter & Price Sort Controls */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search
                size={16}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#667085]"
                aria-hidden="true"
              />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="카드명, 세트 코드, 등급(PSA 10 등) 검색"
                aria-label="상품 검색"
                className="w-full min-h-[44px] pl-10 pr-4 py-2 text-sm bg-[#FFFFFF] border border-[#E5E7EB] rounded-md text-[#111827] placeholder:text-[#667085] focus:outline-none focus:border-[#465C77]"
              />
            </div>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              aria-label="정렬 기준"
              className="min-h-[44px] px-3.5 py-2 text-sm bg-[#FFFFFF] border border-[#E5E7EB] rounded-md text-[#111827] focus:outline-none focus:border-[#465C77]"
            >
              <option value="order">추천순</option>
              <option value="price_asc">낮은 가격순</option>
              <option value="price_desc">높은 가격순</option>
              <option value="newest">최신 등록순</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            {CATEGORIES.filter(cat=>cat==='전체'||products.some(p=>p.category===cat)).map((cat) => {
              const active = selectedCategory === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  aria-pressed={active}
                  onClick={() => {setSelectedCategory(cat);setCollection('');}}
                  className={`min-h-11 px-4 py-2 text-sm font-medium rounded-full whitespace-nowrap shrink-0 transition-colors border ${
                    active
                      ? 'bg-[#111827] text-[#FFFFFF] border-[#111827]'
                      : 'bg-[#FFFFFF] text-[#667085] border-[#E5E7EB] hover:text-[#111827] hover:border-[#D1D5DB]'
                  }`}
                >
                  {cat}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex items-center justify-between"><h2 className="text-xl font-semibold">{collections.find(c=>c.id===collection)?.title || (selectedCategory==='전체'?'전체 컬렉션':selectedCategory)}</h2><span className="text-sm text-slate-500" aria-live="polite">{filteredProducts.length}개 상품</span></div>
        {/* Product Gallery Grid */}
        {filteredProducts.length === 0 ? (
          <div className="border border-[#E5E7EB] rounded-lg p-12 sm:p-16 text-center bg-[#FFFFFF] space-y-4">
            <p className="font-mono-tabular text-xs tracking-[0.2em] text-[#667085]">NO ITEMS FOUND</p>
            <h2 className="text-lg sm:text-xl font-semibold text-[#111827]">
              {products.length === 0
                ? '현재 공개된 상품이 준비 중입니다'
                : '조건에 일치하는 상품이 없습니다'}
            </h2>
            <p className="text-sm text-[#667085] max-w-md mx-auto leading-relaxed">
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
                    setCollection('');
                    setSelectedCategory('전체');
                  }}
                  className="min-h-[44px] px-4 py-2 text-sm font-medium border border-[#E5E7EB] rounded-md text-[#111827] hover:border-[#111827]"
                >
                  필터 초기화
                </button>
              )}
              {dmUrl && (
                <a
                  href={dmUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="min-h-[44px] px-5 py-2 text-sm font-semibold bg-[#111827] text-[#FFFFFF] hover:bg-[#465C77] rounded-md inline-flex items-center transition-colors"
                >
                  Instagram DM으로 카드 찾기
                </a>
              )}
            </div>
          </div>
        ) : (
          <div className="nova-product-grid">
            {filteredProducts.map((product) => (
              <ShopProductCard
                key={product.id}
                product={product}
                previewSuffix={previewSuffix}
                onQuickView={setQuickViewProduct}
              />
            ))}
          </div>
        )}
      </div>

      <ProductQuickViewModal
        product={quickViewProduct}
        previewSuffix={previewSuffix}
        onClose={() => setQuickViewProduct(null)}
      />
    </>
  );
};
