import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Check,
  ChevronDown,
  Copy,
  MessageCircle,
  ShoppingBag,
} from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useSite } from '../context/SiteContext';
import { trackAnalyticsEvent } from '../lib/analytics';
import { copyToClipboardSafe, formatKRW, getInstagramDmUrl } from '../lib/utils';
import { Product } from '../types/nova';
import { ProductGallery } from '../components/ProductGallery';
import { availabilityRank, newestFirst, productSpecs } from '../lib/products';
import { ProductQuickViewModal } from '../components/ProductQuickViewModal';
import { SeoManager } from '../components/SeoManager';
import { ShopProductCard } from '../components/ShopProductCard';

export const ProductDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { config, products, isPreviewDraft } = useSite();
  const { addItem, openCart } = useCart();

  const [shippingOpen, setShippingOpen] = useState(false);
  const [addedToCart, setAddedToCart] = useState(false);
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [showManualPrompt, setShowManualPrompt] = useState(false);
  const [quickViewProduct, setQuickViewProduct] = useState<Product | null>(null);

  const product = products.find((p) => p.id === id);
  const previewSuffix = isPreviewDraft ? '?preview=draft' : '';
  const dmUrl = getInstagramDmUrl(config.brand.instagramUrl);

  useEffect(() => {
    setAddedToCart(false);
    if (id) {
      trackAnalyticsEvent('page_view', `/shop/${id}`);
    }
  }, [id]);

  const relatedProducts = useMemo(() => {
    if (!product) return [];
    const sameCat = products.filter((p) => p.id !== product.id && p.category === product.category);
    const others = products.filter((p) => p.id !== product.id && p.category !== product.category);
    return [...sameCat, ...others].sort((a,b) => availabilityRank(a)-availabilityRank(b) || Number(b.category === product.category)-Number(a.category === product.category) || newestFirst(a,b)).slice(0, 4);
  }, [product, products]);

  if (!product) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-20 text-center space-y-4">
        <p className="font-mono-tabular text-xs tracking-[0.2em] text-[#667085]">NOT FOUND</p>
        <h1 className="text-2xl font-semibold text-[#111827]">상품을 찾을 수 없습니다</h1>
        <p className="text-sm text-[#667085]">삭제되었거나 비공개로 전환된 컬렉션일 수 있습니다.</p>
        <Link
          to={`/shop${previewSuffix}`}
          className="inline-flex items-center gap-2 min-h-[44px] px-5 py-2.5 bg-[#111827] text-[#FFFFFF] hover:bg-[#465C77] rounded-md text-sm font-semibold transition-colors"
        >
          <ArrowLeft size={16} />
          <span>스토어 카탈로그로 돌아가기</span>
        </Link>
      </div>
    );
  }

  const isSoldOut = product.status === '판매완료';
  const inquiryText =
    product.dmPrompt ||
    `[NOVA 구매 문의] ${product.title} (${formatKRW(product.price)}) 구매 가능 여부 문의드립니다.`;
  const handleCopyInquiry = async () => {
    const ok = await copyToClipboardSafe(inquiryText);
    if (ok) {
      setCopiedPrompt(true);
      setTimeout(() => setCopiedPrompt(false), 2500);
    } else {
      setShowManualPrompt(true);
    }
  };

  const handleAddToCart = () => {
    if (isSoldOut) return;
    const res = addItem(product, 1);
    if (res.ok) {
      setAddedToCart(true);
    }
  };

  const categorySpecs = productSpecs(product);

  return (
    <>
      <SeoManager
        title={product.title}
        description={product.description || `${product.title} — ${formatKRW(product.price)}`}
        image={product.images?.[0]}
      />

      <div className="product-detail max-w-7xl mx-auto px-4 sm:px-6 py-8 md:py-14 space-y-12">
        <div className="space-y-8">
          <Link
            to={`/shop${previewSuffix}`}
            className="inline-flex items-center gap-2 text-sm text-[#667085] hover:text-[#111827] transition-colors"
          >
            <ArrowLeft size={16} />
            <span>NOVA 스토어 목록으로</span>
          </Link>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
            <div className="lg:col-span-7 lg:sticky lg:top-24"><ProductGallery key={product.id} product={product}/></div>
            {/* Contiguous Purchase & Cart Module Right */}
            <div className="lg:col-span-5 space-y-6 product-information">
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-xs text-[#667085] flex-wrap">
                  <span className="font-medium text-[#465C77]">{product.category}</span>
                  {product.language && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span>{product.language}</span>
                    </>
                  )}
                  {product.setCode && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono-tabular">{product.setCode}</span>
                    </>
                  )}
                </div>

                <h1 className="text-xl sm:text-2xl font-semibold text-[#111827] leading-snug text-balance">
                  {product.title}
                </h1>

                <div className="flex items-baseline justify-between gap-4 pt-2">
                  <p className="text-3xl sm:text-4xl font-bold tracking-tight tabular-nums text-[#111827]">
                    {formatKRW(product.price)}
                  </p>
                  <span
                    className={`text-xs font-semibold ${
                      product.status === '판매중'
                        ? 'text-[#0F6B4B]'
                        : product.status === '예약중'
                          ? 'text-[#465C77]'
                          : 'text-[#667085]'
                    }`}
                  >
                    {product.status}
                  </span>
                </div>
              </div>

              {product.status === '예약중' && <p className="text-sm text-[#465C77] bg-slate-50 p-3 rounded-lg">예약 진행 중입니다. 장바구니는 재고를 확보하지 않으며, 구매 가능 여부는 DM으로 확인해 주세요.</p>}
              {/* Cart & DM Actions */}
              <div className="border-t border-[#E5E7EB] pt-5 space-y-2.5">
                {dmUrl && !isSoldOut && (
                  <a
                    href={dmUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() =>
                      trackAnalyticsEvent('dm_click', `/shop/${product.id}`, {
                        targetType: 'product_dm',
                        targetId: product.id,
                        targetLabel: product.title,
                      })
                    }
                    className="w-full min-h-[44px] px-4 py-2.5 bg-[#111827] text-white hover:bg-[#29364a] rounded-md text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
                  >
                    <MessageCircle size={15} />
                    <span>구매 문의하기</span>
                  </a>
                )}

                <button
                  type="button"
                  disabled={isSoldOut}
                  onClick={handleAddToCart}
                  className={`w-full min-h-[48px] px-5 py-3 rounded-md text-sm font-semibold flex items-center justify-center gap-2 transition-colors ${
                    isSoldOut
                      ? 'bg-[#F5F6F8] text-[#667085] border border-[#E5E7EB] cursor-not-allowed'
                      : addedToCart
                        ? 'bg-[#465C77] text-[#FFFFFF]'
                        : 'bg-white text-[#111827] border border-[#D1D5DB] hover:bg-[#F5F6F8]'
                  }`}
                >
                  {addedToCart ? <Check size={17} /> : <ShoppingBag size={17} />}
                  <span>
                    {isSoldOut
                      ? '판매 완료된 상품입니다'
                      : addedToCart
                        ? '장바구니에 담겼습니다'
                        : '장바구니 담기'}
                  </span>
                </button>

                {addedToCart && (
                  <button
                    type="button"
                    onClick={openCart}
                    className="w-full min-h-[42px] px-4 py-2 border border-[#111827] text-[#111827] rounded-md text-xs font-semibold hover:bg-[#F5F6F8] transition-colors"
                  >
                    장바구니 열기 · 일괄 DM 문의하기
                  </button>
                )}


                <button
                  type="button"
                  onClick={handleCopyInquiry}
                  className="min-h-[44px] py-2 bg-[#FFFFFF] text-[#667085] rounded-md text-xs font-medium flex items-center justify-center gap-2 hover:text-[#111827] hover:border-[#D1D5DB] transition-colors"
                >
                  {copiedPrompt ? <Check size={14} className="text-[#465C77]" /> : <Copy size={14} />}
                  <span>{copiedPrompt ? '문의 문구 복사됨' : '문의 문구 복사하기'}</span>
                </button>

                {showManualPrompt && (
                  <div className="space-y-1.5 pt-1">
                    <p className="text-xs text-[#667085]">
                      직접 선택하여 복사 후 DM에 붙여넣어 주세요:
                    </p>
                    <input
                      type="text"
                      readOnly
                      value={inquiryText}
                      onClick={(e) => e.currentTarget.select()}
                      className="w-full min-h-[40px] px-3 py-1.5 text-xs bg-[#F5F6F8] border border-[#E5E7EB] rounded text-[#111827]"
                    />
                  </div>
                )}

                <p className="text-[11px] text-[#667085] leading-relaxed pt-1">
                  웹사이트 내 직접 카드 결제는 지원하지 않으며, Instagram 공식 계정(@novapokemonkr)을 통해 실물 확인 후 안전하게 안내해 드립니다.
                </p>
              </div>

              {/* Category-Specific Specs */}
              <div className="border-t border-[#E5E7EB] pt-5 space-y-2.5 text-sm">
                {categorySpecs.map((spec) => (
                  <div key={spec.label} className="flex justify-between gap-4 py-1">
                    <span className="text-[#667085]">{spec.label}</span>
                    <span className="text-[#111827] font-medium text-right">{spec.value}</span>
                  </div>
                ))}
                <div className="flex justify-between gap-4 py-1">
                  <span className="text-[#667085]">거래 방식</span>
                  <span className="text-[#111827] font-medium text-right">Instagram DM 1:1 확인</span>
                </div>
              </div>

              {product.description && (
                <div className="border-t border-[#E5E7EB] pt-5 space-y-2">
                  <p className="text-xs font-medium text-[#667085]">상세 설명</p>
                  <p className="text-sm text-[#374151] leading-relaxed whitespace-pre-line">
                    {product.description}
                  </p>
                </div>
              )}

              {/* Shipping / Refund Policy Accordion */}
              <div className="border-t border-[#E5E7EB] pt-4">
                <button
                  type="button"
                  onClick={() => setShippingOpen((v) => !v)}
                  aria-expanded={shippingOpen}
                  className="w-full flex items-center justify-between text-xs font-semibold text-[#111827] py-1"
                >
                  <span>포장 · 배송 · 교환/환불 기준 안내</span>
                  <ChevronDown
                    size={15}
                    className={`text-[#667085] transition-transform ${shippingOpen ? 'rotate-180' : ''}`}
                  />
                </button>
                {shippingOpen && (
                  <p className="mt-2.5 text-xs text-[#667085] leading-relaxed whitespace-pre-line bg-[#F5F6F8] border border-[#E5E7EB] rounded p-3.5">
                    {config.legal.shippingRefundPolicy}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Related Products */}
        {relatedProducts.length > 0 && (
          <section className="pt-8 border-t border-[#E5E7EB] space-y-5">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-xl font-semibold text-[#111827]">관련 컬렉션 상품</h2>
              <Link
                to={`/shop${previewSuffix}`}
                className="text-xs font-medium text-[#465C77] hover:text-[#111827]"
              >
                스토어 전체 →
              </Link>
            </div>
            <div className="nova-product-grid">
              {relatedProducts.map((rel) => (
                <ShopProductCard
                  key={rel.id}
                  product={rel}
                  previewSuffix={previewSuffix}
                  onQuickView={setQuickViewProduct}
                />
              ))}
            </div>
          </section>
        )}
      </div>

      <div className="product-mobile-purchase lg:hidden">
        <div><span className="text-[10px] text-slate-500">{product.status}</span><p className="font-bold tabular-nums text-base">{formatKRW(product.price)}</p></div>
        <button className="mobile-cart" disabled={isSoldOut} onClick={handleAddToCart} aria-label="장바구니 담기">{addedToCart?<Check size={20}/>:<ShoppingBag size={20}/>}</button>
        {dmUrl && !isSoldOut ? <a href={dmUrl} target="_blank" rel="noopener noreferrer" onClick={()=>trackAnalyticsEvent('dm_click', `/shop/${product.id}`, {targetType:'product_dm',targetId:product.id,targetLabel:product.title})}>구매 문의하기</a>:<button disabled>판매 완료</button>}
      </div>

      <ProductQuickViewModal
        product={quickViewProduct}
        previewSuffix={previewSuffix}
        onClose={() => setQuickViewProduct(null)}
      />
    </>
  );
};
