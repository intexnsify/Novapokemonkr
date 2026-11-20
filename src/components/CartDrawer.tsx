import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Copy, MessageCircle, Minus, Plus, ShoppingBag, Trash2, X } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useSite } from '../context/SiteContext';
import { trackAnalyticsEvent } from '../lib/analytics';
import { copyToClipboardSafe, formatKRW, getInstagramDmUrl } from '../lib/utils';
import { SafeImage } from './SafeImage';

export const CartDrawer: React.FC = () => {
  const { items, totalCount, subtotal, isOpen, closeCart, updateQuantity, removeItem, clearCart } =
    useCart();
  const { config, isPreviewDraft } = useSite();
  const [copied, setCopied] = useState(false);

  const previewSuffix = isPreviewDraft ? '?preview=draft' : '';
  const dmUrl = getInstagramDmUrl(config.brand.instagramUrl);

  useEffect(() => {
    if (!isOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeCart();
    };
    window.addEventListener('keydown', handleKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', handleKey);
    };
  }, [isOpen, closeCart]);

  const inquirySummary = useMemo(() => {
    if (items.length === 0) return '';
    const lines = items.map(
      (item, idx) =>
        `${idx + 1}. ${item.product.title} (${item.product.category}) × ${item.entry.quantity}개 — ${formatKRW(item.lineTotal)}`
    );
    return [
      '[NOVA 스토어 상품 구매 문의]',
      ...lines,
      `예상 합계: ${formatKRW(subtotal)}`,
      '',
      '실물 확인 및 결제·배송 안내 부탁드립니다.',
    ].join('\n');
  }, [items, subtotal]);

  if (!isOpen) return null;

  const handleCopySummary = async () => {
    if (!inquirySummary) return;
    const ok = await copyToClipboardSafe(inquirySummary);
    if (ok) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-[#111827]/50 backdrop-blur-xs flex justify-end"
      role="dialog"
      aria-modal="true"
      aria-label="장바구니"
      onClick={closeCart}
    >
      <aside
        className="w-full max-w-md h-full bg-[#FFFFFF] border-l border-[#E5E7EB] shadow-2xl flex flex-col nova-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#E5E7EB] flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <ShoppingBag size={18} className="text-[#111827]" />
            <h2 className="text-base font-semibold text-[#111827]">
              장바구니 <span className="font-mono-tabular text-sm text-[#667085]">({totalCount})</span>
            </h2>
          </div>

          <button
            type="button"
            onClick={closeCart}
            aria-label="장바구니 닫기"
            className="w-10 h-10 inline-flex items-center justify-center rounded-md border border-[#E5E7EB] text-[#111827] hover:bg-[#F5F6F8] transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Item List */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {items.length === 0 ? (
            <div className="py-16 text-center space-y-4">
              <div className="w-12 h-12 mx-auto rounded-full bg-[#F5F6F8] border border-[#E5E7EB] flex items-center justify-center text-[#667085]">
                <ShoppingBag size={20} />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-[#111827]">장바구니가 비어 있습니다</p>
                <p className="text-xs text-[#667085]">
                  스토어에서 관심 있는 카드와 박스를 담아 일괄 문의해 보세요.
                </p>
              </div>
              <Link
                to={`/shop${previewSuffix}`}
                onClick={closeCart}
                className="inline-flex items-center justify-center min-h-[42px] px-5 py-2 bg-[#111827] text-[#FFFFFF] hover:bg-[#465C77] rounded-md text-xs font-semibold transition-colors"
              >
                스토어 둘러보기
              </Link>
            </div>
          ) : (
            <>
              {items.map(({ entry, product, lineTotal }) => (
                <div
                  key={product.id}
                  className="p-3.5 border border-[#E5E7EB] rounded-lg bg-[#FFFFFF] flex gap-3.5"
                >
                  <Link
                    to={`/shop/${product.id}${previewSuffix}`}
                    onClick={closeCart}
                    className="w-20 h-20 rounded border border-[#E5E7EB] bg-[#F5F6F8] overflow-hidden shrink-0"
                  >
                    <SafeImage
                      src={product.images?.[0]}
                      alt={product.title}
                      fallbackTitle={product.category}
                      className="w-full h-full object-cover"
                    />
                  </Link>

                  <div className="flex-1 min-w-0 flex flex-col justify-between gap-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-[11px] font-mono-tabular text-[#667085]">
                          {product.category}
                          {product.grade ? ` · ${product.grade}` : ''}
                        </p>
                        <Link
                          to={`/shop/${product.id}${previewSuffix}`}
                          onClick={closeCart}
                          className="text-sm font-medium text-[#111827] hover:text-[#465C77] line-clamp-2 leading-snug"
                        >
                          {product.title}
                        </Link>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeItem(product.id)}
                        aria-label={`${product.title} 삭제`}
                        className="p-1 text-[#667085] hover:text-[#111827] shrink-0"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <div className="inline-flex items-center border border-[#E5E7EB] rounded bg-[#F5F6F8]">
                        <button
                          type="button"
                          onClick={() => updateQuantity(product.id, entry.quantity - 1)}
                          aria-label="수량 감소"
                          className="w-7 h-7 inline-flex items-center justify-center text-[#111827] hover:bg-[#E5E7EB]"
                        >
                          <Minus size={12} />
                        </button>
                        <span className="w-7 text-center text-xs font-mono-tabular text-[#111827]">
                          {entry.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => updateQuantity(product.id, entry.quantity + 1)}
                          aria-label="수량 증가"
                          className="w-7 h-7 inline-flex items-center justify-center text-[#111827] hover:bg-[#E5E7EB]"
                        >
                          <Plus size={12} />
                        </button>
                      </div>

                      <span className="font-mono-tabular text-sm font-semibold text-[#111827]">
                        {formatKRW(lineTotal)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}

              <div className="p-3.5 rounded-lg bg-[#F5F6F8] border border-[#E5E7EB] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-mono-tabular uppercase tracking-wider text-[#667085]">
                    DM 문의 요약 메시지
                  </span>
                  <button
                    type="button"
                    onClick={clearCart}
                    className="text-[11px] text-[#667085] hover:text-[#111827] underline"
                  >
                    목록 비우기
                  </button>
                </div>
                <pre className="text-xs text-[#111827] whitespace-pre-wrap font-sans leading-relaxed bg-[#FFFFFF] border border-[#E5E7EB] rounded p-2.5 max-h-36 overflow-y-auto">
                  {inquirySummary}
                </pre>
              </div>
            </>
          )}
        </div>

        {/* Footer Actions */}
        {items.length > 0 && (
          <div className="p-5 border-t border-[#E5E7EB] bg-[#FFFFFF] space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-[#667085]">예상 합계 ({totalCount}개)</span>
              <span className="font-mono-tabular text-xl font-semibold text-[#111827]">
                {formatKRW(subtotal)}
              </span>
            </div>

            <div className="grid grid-cols-1 gap-2">
              <button
                type="button"
                onClick={handleCopySummary}
                className="min-h-[44px] px-4 py-2.5 text-sm font-semibold rounded-md border border-[#111827] bg-[#FFFFFF] text-[#111827] hover:bg-[#F5F6F8] inline-flex items-center justify-center gap-2 transition-colors"
              >
                {copied ? <Check size={16} className="text-[#465C77]" /> : <Copy size={16} />}
                <span>{copied ? 'DM 문의 내용 복사 완료' : 'DM 문의 내용 복사하기'}</span>
              </button>

              {dmUrl && (
                <a
                  href={dmUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() =>
                    trackAnalyticsEvent('dm_click', '/shop', {
                      targetType: 'cart_drawer_dm',
                      targetLabel: `Cart (${totalCount} items)`,
                    })
                  }
                  className="min-h-[44px] px-4 py-2.5 text-sm font-semibold rounded-md bg-[#111827] text-[#FFFFFF] hover:bg-[#465C77] inline-flex items-center justify-center gap-2 transition-colors"
                >
                  <MessageCircle size={16} />
                  <span>Instagram DM으로 일괄 문의하기</span>
                </a>
              )}
            </div>

            <p className="text-[11px] text-[#667085] leading-relaxed">
              ※ 현재 온라인 카드 결제는 지원하지 않습니다. 위 문의 내용을 복사해 Instagram DM으로 보내주시면
              재고·실물 확인 후 1:1 거래를 안내해 드립니다.
            </p>
          </div>
        )}
      </aside>
    </div>
  );
};
