import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Check, Copy, MessageCircle } from 'lucide-react';
import { useSite } from '../context/SiteContext';
import { trackAnalyticsEvent } from '../lib/analytics';
import { copyToClipboardSafe, formatKRW, getInstagramDmUrl } from '../lib/utils';
import { SafeImage } from '../components/SafeImage';
import { SeoManager } from '../components/SeoManager';

export const ProductDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { config, products, isPreviewDraft } = useSite();
  const [activeImageIdx, setActiveImageIdx] = useState(0);
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [showManualPrompt, setShowManualPrompt] = useState(false);

  const product = products.find((p) => p.id === id);
  const previewSuffix = isPreviewDraft ? '?preview=draft' : '';
  const dmUrl = getInstagramDmUrl(config.brand.instagramUrl);

  useEffect(() => {
    if (id) {
      trackAnalyticsEvent('page_view', `/shop/${id}`);
    }
  }, [id]);

  if (!product) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-16 text-center space-y-4">
        <p className="font-brand text-xs tracking-[0.2em] text-[#929AA6]">NOT FOUND</p>
        <h1 className="text-2xl font-semibold text-[#F3F4F6]">상품을 찾을 수 없습니다</h1>
        <p className="text-sm text-[#929AA6]">삭제되었거나 비공개로 전환된 컬렉션일 수 있습니다.</p>
        <Link
          to={`/shop${previewSuffix}`}
          className="inline-flex items-center gap-2 min-h-[44px] px-5 py-2.5 bg-[#C5CBD3] text-[#080A0D] rounded-md text-sm font-semibold"
        >
          <ArrowLeft size={16} />
          <span>카탈로그로 돌아가기</span>
        </Link>
      </div>
    );
  }

  const inquiryText =
    product.dmPrompt ||
    `[NOVA 구매 문의] ${product.title} (${formatKRW(product.price)}) 구매 가능 여부 문의드립니다.`;
  const images = product.images?.length ? product.images : [''];

  const handleCopyInquiry = async () => {
    const ok = await copyToClipboardSafe(inquiryText);
    if (ok) {
      setCopiedPrompt(true);
      setTimeout(() => setCopiedPrompt(false), 2500);
    } else {
      setShowManualPrompt(true);
    }
  };

  return (
    <>
      <SeoManager
        title={product.title}
        description={product.description || `${product.title} — ${formatKRW(product.price)}`}
        image={product.images?.[0]}
      />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 md:py-14 space-y-8">
        <Link
          to={`/shop${previewSuffix}`}
          className="inline-flex items-center gap-2 text-sm text-[#929AA6] hover:text-[#F3F4F6] transition-colors"
        >
          <ArrowLeft size={16} />
          <span>카탈로그로 돌아가기</span>
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
          {/* Sticky Gallery Left */}
          <div className="lg:col-span-7 space-y-3 lg:sticky lg:top-24">
            <div className="aspect-[4/3] w-full rounded-lg overflow-hidden border border-[#303741] bg-[#11151A]">
              <SafeImage
                src={images[activeImageIdx]}
                alt={product.title}
                fallbackTitle={product.title}
                className="w-full h-full object-cover"
              />
            </div>

            {images.length > 1 && (
              <div className="grid grid-cols-4 sm:grid-cols-6 gap-2.5">
                {images.map((img, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setActiveImageIdx(idx)}
                    className={`aspect-square rounded overflow-hidden border transition-colors ${
                      activeImageIdx === idx ? 'border-[#C5CBD3]' : 'border-[#303741] opacity-70 hover:opacity-100'
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

          {/* Contiguous Purchase Inquiry Module Right */}
          <div className="lg:col-span-5 border border-[#303741] rounded-lg p-6 sm:p-8 bg-[#171C23] space-y-6">
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-xs text-[#929AA6] flex-wrap">
                <span>{product.category}</span>
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
                {product.isSample && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono-tabular text-[#C5CBD3]">SAMPLE</span>
                  </>
                )}
              </div>

              <h1 className="text-xl sm:text-2xl font-semibold text-[#F3F4F6] leading-snug">
                {product.title}
              </h1>

              <div className="flex items-baseline justify-between gap-4 pt-2">
                <p className="font-mono-tabular text-2xl font-semibold text-[#F3F4F6]">
                  {formatKRW(product.price)}
                </p>
                <span className="text-xs font-medium text-[#C5CBD3]">{product.status}</span>
              </div>
            </div>

            <div className="border-t border-[#303741] pt-5 space-y-2 text-sm">
              {product.grade && (
                <div className="flex justify-between py-1">
                  <span className="text-[#929AA6]">상태 / 등급</span>
                  <span className="text-[#F3F4F6] font-medium">{product.grade}</span>
                </div>
              )}
              <div className="flex justify-between py-1">
                <span className="text-[#929AA6]">거래 방식</span>
                <span className="text-[#F3F4F6] font-medium">Instagram DM 1:1 확인 후 거래</span>
              </div>
            </div>

            {product.description && (
              <div className="border-t border-[#303741] pt-5 space-y-2">
                <p className="text-xs font-medium text-[#929AA6]">상세 설명</p>
                <p className="text-sm text-[#F3F4F6]/90 leading-relaxed whitespace-pre-line">
                  {product.description}
                </p>
              </div>
            )}

            {/* DM Inquiry Actions (No fake checkout) */}
            <div className="border-t border-[#303741] pt-5 space-y-3">
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
                  className="w-full min-h-[48px] px-5 py-3 bg-[#C5CBD3] text-[#080A0D] rounded-md text-sm font-semibold flex items-center justify-center gap-2 hover:bg-[#F3F4F6] transition-colors"
                >
                  <MessageCircle size={17} />
                  <span>Instagram DM으로 구매 문의</span>
                </a>
              )}

              <button
                type="button"
                onClick={handleCopyInquiry}
                className="w-full min-h-[44px] px-4 py-2.5 bg-[#11151A] border border-[#303741] text-[#F3F4F6] rounded-md text-xs font-medium flex items-center justify-center gap-2 hover:border-[#C5CBD3] transition-colors"
              >
                {copiedPrompt ? <Check size={15} /> : <Copy size={15} />}
                <span>{copiedPrompt ? '문의 문구 복사됨' : 'DM 문의 문구 복사하기'}</span>
              </button>

              {showManualPrompt && (
                <div className="space-y-1.5 pt-1">
                  <p className="text-xs text-[#929AA6]">
                    직접 선택하여 복사 후 DM에 붙여넣어 주세요:
                  </p>
                  <input
                    type="text"
                    readOnly
                    value={inquiryText}
                    onClick={(e) => e.currentTarget.select()}
                    className="w-full min-h-[40px] px-3 py-1.5 text-xs bg-[#080A0D] border border-[#303741] rounded text-[#F3F4F6]"
                  />
                </div>
              )}

              <p className="text-[11px] text-[#929AA6] leading-relaxed">
                웹사이트 내 직접 결제는 지원하지 않으며, Instagram 공식 계정(@novapokemonkr)을 통해 실물 사진 확인 후 안전하게 안내해 드립니다.
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
