import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Check,
  ChevronDown,
  Copy,
  Maximize2,
  MessageCircle,
  ShoppingBag,
} from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useSite } from '../context/SiteContext';
import { trackAnalyticsEvent } from '../lib/analytics';
import { copyToClipboardSafe, formatKRW, getInstagramDmUrl } from '../lib/utils';
import { Product } from '../types/nova';
import { LightboxImageEntry, NewsImageLightbox } from '../components/NewsImageLightbox';
import { ProductQuickViewModal } from '../components/ProductQuickViewModal';
import { SafeImage } from '../components/SafeImage';
import { SeoManager } from '../components/SeoManager';
import { ShopProductCard } from '../components/ShopProductCard';

export const ProductDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { config, products, isPreviewDraft } = useSite();
  const { addItem, openCart } = useCart();

  const [activeImageIdx, setActiveImageIdx] = useState(0);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [shippingOpen, setShippingOpen] = useState(false);
  const [addedToCart, setAddedToCart] = useState(false);
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [showManualPrompt, setShowManualPrompt] = useState(false);
  const [quickViewProduct, setQuickViewProduct] = useState<Product | null>(null);

  const product = products.find((p) => p.id === id);
  const previewSuffix = isPreviewDraft ? '?preview=draft' : '';
  const dmUrl = getInstagramDmUrl(config.brand.instagramUrl);

  useEffect(() => {
    setActiveImageIdx(0);
    setAddedToCart(false);
    if (id) {
      trackAnalyticsEvent('page_view', `/shop/${id}`);
    }
  }, [id]);

  const relatedProducts = useMemo(() => {
    if (!product) return [];
    const sameCat = products.filter((p) => p.id !== product.id && p.category === product.category);
    const others = products.filter((p) => p.id !== product.id && p.category !== product.category);
    return [...sameCat, ...others].slice(0, 3);
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
  const images = product.images?.length ? product.images : [''];
  const lightboxEntries: LightboxImageEntry[] = images
    .filter(Boolean)
    .map((url, idx) => ({
      url,
      alt: `${product.title} 이미지 ${idx + 1}`,
      caption: `${product.title} (${idx + 1}/${images.length})`,
    }));

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

  const categorySpecs: Array<{ label: string; value: string }> = [];
  if (product.category === '등급카드') {
    categorySpecs.push({ label: '감정 / 등급', value: product.grade || '정품 감정 슬랩' });
    if (product.setCode) categorySpecs.push({ label: '세트 · 카드 번호', value: product.setCode });
    if (product.language) categorySpecs.push({ label: '언어', value: product.language });
  } else if (product.category === '미개봉 박스' || product.category === '팩') {
    categorySpecs.push({ label: '밀봉 · 포장 상태', value: product.grade || '공장 출고 밀봉' });
    if (product.setCode) categorySpecs.push({ label: '확장팩 코드', value: product.setCode });
    if (product.language) categorySpecs.push({ label: '발매 언어', value: product.language });
  } else {
    if (product.grade) categorySpecs.push({ label: '카드 상태 / 등급', value: product.grade });
    if (product.setCode) categorySpecs.push({ label: '세트 · 번호', value: product.setCode });
    if (product.language) categorySpecs.push({ label: '언어', value: product.language });
  }

  return (
    <>
      <SeoManager
        title={product.title}
        description={product.description || `${product.title} — ${formatKRW(product.price)}`}
        image={product.images?.[0]}
      />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 md:py-14 space-y-12">
        <div className="space-y-8">
          <Link
            to={`/shop${previewSuffix}`}
            className="inline-flex items-center gap-2 text-sm text-[#667085] hover:text-[#111827] transition-colors"
          >
            <ArrowLeft size={16} />
            <span>NOVA 스토어 목록으로</span>
          </Link>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
            {/* Sticky Gallery Left */}
            <div className="lg:col-span-7 space-y-3 lg:sticky lg:top-24">
              <div className="relative aspect-[4/3] w-full rounded-lg overflow-hidden border border-[#E5E7EB] bg-[#F5F6F8]">
                <button
                  type="button"
                  onClick={() => {
                    if (lightboxEntries.length > 0) setLightboxIndex(activeImageIdx);
                  }}
                  aria-label="상품 이미지 크게 보기"
                  className="group relative w-full h-full block cursor-zoom-in"
                >
                  <SafeImage
                    src={images[activeImageIdx]}
                    alt={product.title}
                    fallbackTitle={product.title}
                    className="w-full h-full object-cover"
                  />
                  {lightboxEntries.length > 0 && (
                    <span className="absolute bottom-3 right-3 px-2.5 py-1 rounded-md border border-[#E5E7EB] bg-[#FFFFFF]/90 text-[11px] font-medium text-[#111827] inline-flex items-center gap-1 opacity-90 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity shadow-sm">
                      <Maximize2 size={11} />
                      <span>확대 보기</span>
                    </span>
                  )}
                </button>
              </div>

              {images.length > 1 && (
                <div className="grid grid-cols-4 sm:grid-cols-6 gap-2.5">
                  {images.map((img, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setActiveImageIdx(idx)}
                      className={`aspect-square rounded overflow-hidden border transition-colors ${
                        activeImageIdx === idx
                          ? 'border-[#465C77] ring-1 ring-[#465C77]'
                          : 'border-[#E5E7EB] opacity-75 hover:opacity-100'
                      }`}
                    >
                      <SafeImage
                        src={img}
                        alt={`${product.title} ${idx + 1}`}
                        className="w-full h-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Contiguous Purchase & Cart Module Right */}
            <div className="lg:col-span-5 border border-[#E5E7EB] rounded-lg p-6 sm:p-8 bg-[#FFFFFF] space-y-6">
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
                  <p className="font-mono-tabular text-2xl font-semibold text-[#111827]">
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

              {/* Cart & DM Actions */}
              <div className="border-t border-[#E5E7EB] pt-5 space-y-2.5">
                <button
                  type="button"
                  disabled={isSoldOut}
                  onClick={handleAddToCart}
                  className={`w-full min-h-[48px] px-5 py-3 rounded-md text-sm font-semibold flex items-center justify-center gap-2 transition-colors ${
                    isSoldOut
                      ? 'bg-[#F5F6F8] text-[#667085] border border-[#E5E7EB] cursor-not-allowed'
                      : addedToCart
                        ? 'bg-[#465C77] text-[#FFFFFF]'
                        : 'bg-[#111827] text-[#FFFFFF] hover:bg-[#465C77]'
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

                {dmUrl && (
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
                    className="w-full min-h-[44px] px-4 py-2.5 bg-[#F5F6F8] border border-[#E5E7EB] text-[#111827] hover:border-[#111827] rounded-md text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
                  >
                    <MessageCircle size={15} />
                    <span>Instagram DM으로 바로 문의</span>
                  </a>
                )}

                <button
                  type="button"
                  onClick={handleCopyInquiry}
                  className="w-full min-h-[42px] px-4 py-2 bg-[#FFFFFF] border border-[#E5E7EB] text-[#667085] rounded-md text-xs font-medium flex items-center justify-center gap-2 hover:text-[#111827] hover:border-[#D1D5DB] transition-colors"
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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
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

      <NewsImageLightbox
        images={lightboxEntries}
        activeIndex={lightboxIndex}
        onClose={() => setLightboxIndex(null)}
        onChangeIndex={setLightboxIndex}
      />

      <ProductQuickViewModal
        product={quickViewProduct}
        previewSuffix={previewSuffix}
        onClose={() => setQuickViewProduct(null)}
      />
    </>
  );
};
