import { useModalFocus } from './useModalFocus';
import React, { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Check, Minus, Plus, ShoppingBag, X } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { formatKRW } from '../lib/utils';
import { Product } from '../types/nova';
import { ProductGallery } from './ProductGallery';

interface ProductQuickViewModalProps {
  product: Product | null;
  previewSuffix?: string;
  onClose: () => void;
}

export const ProductQuickViewModal: React.FC<ProductQuickViewModalProps> = ({
  product,
  previewSuffix = '',
  onClose,
}) => {
  const { addItem, openCart } = useCart();
  const modalRef = useRef<HTMLDivElement>(null);
  useModalFocus(!!product, modalRef);
  const [qty, setQty] = useState(1);
  const [addedFeedback, setAddedFeedback] = useState(false);

  useEffect(() => {
    setQty(1);
    setAddedFeedback(false);
  }, [product?.id]);

  useEffect(() => {
    if (!product) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !document.querySelector('dialog[open]')) onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', handleKey);
    };
  }, [product, onClose]);

  if (!product) return null;

  const isSoldOut = product.status === '판매완료';
  const maxQty = product.category === '등급카드' || product.category === '싱글카드' ? 5 : 20;

  const handleAddToCart = () => {
    if (isSoldOut) return;
    const res = addItem(product, qty);
    if (res.ok) {
      setAddedFeedback(true);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-[#111827]/60 backdrop-blur-xs flex items-center justify-center p-4"
      ref={modalRef}
      role="dialog"
      aria-modal="true"
      aria-label={`${product.title} 빠른 보기`}
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl bg-[#FFFFFF] border border-[#E5E7EB] rounded-lg shadow-xl overflow-hidden max-h-[90dvh] flex flex-col nova-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-3.5 border-b border-[#E5E7EB] flex items-center justify-between gap-4 bg-[#FFFFFF]">
          <p className="font-mono-tabular text-xs text-[#667085] uppercase tracking-[0.12em]">
            QUICK VIEW · {product.category}
          </p>
          <button
            type="button"
            onClick={onClose}
            aria-label="빠른 보기 닫기"
            className="w-11 h-11 inline-flex items-center justify-center rounded-md border border-[#E5E7EB] text-[#111827] hover:bg-[#F5F6F8] transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-5 sm:p-6 overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-6">
          <ProductGallery key={product.id} product={product} compact/>

          {/* Right: Specs & Actions */}
          <div className="flex flex-col justify-between gap-5">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2 text-xs text-[#667085]">
                <span>{product.category}</span>
                <span aria-hidden="true">·</span>
                <span className="font-medium text-[#111827]">{product.status}</span>
                {product.grade && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>{product.grade}</span>
                  </>
                )}
                {product.language && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>{product.language}</span>
                  </>
                )}
              </div>

              <h2 className="text-lg sm:text-xl font-semibold text-[#111827] leading-snug">
                {product.title}
              </h2>

              <p className="tabular-nums text-3xl font-bold text-[#111827]">
                {formatKRW(product.price)}
              </p>

              {product.setCode && (
                <p className="text-xs font-mono-tabular text-[#667085]">
                  세트 / 식별 코드: <span className="text-[#111827]">{product.setCode}</span>
                </p>
              )}

              {product.description && (
                <p className="text-sm text-[#4B5563] leading-relaxed line-clamp-4">
                  {product.description}
                </p>
              )}
            </div>

            <div className="space-y-3 pt-4 border-t border-[#E5E7EB]">
              {product.status === '예약중' && <p className="text-xs text-slate-600">예약 중 · 구매 가능 여부는 DM 확인이 필요합니다.</p>}
              {!isSoldOut && (
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-medium text-[#667085]">수량</span>
                  <div className="inline-flex items-center border border-[#E5E7EB] rounded-md bg-[#FFFFFF]">
                    <button
                      type="button"
                      onClick={() => setQty((q) => Math.max(1, q - 1))}
                      aria-label="수량 감소"
                      className="w-11 h-11 inline-flex items-center justify-center text-[#111827] hover:bg-[#F5F6F8]"
                    >
                      <Minus size={14} />
                    </button>
                    <span className="w-10 text-center text-sm font-mono-tabular text-[#111827]">
                      {qty}
                    </span>
                    <button
                      type="button"
                      onClick={() => setQty((q) => Math.min(maxQty, q + 1))}
                      aria-label="수량 증가"
                      className="w-11 h-11 inline-flex items-center justify-center text-[#111827] hover:bg-[#F5F6F8]"
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-2.5">
                <button
                  type="button"
                  disabled={isSoldOut}
                  onClick={handleAddToCart}
                  className={`flex-1 min-h-[44px] px-4 py-2.5 text-sm font-semibold rounded-md inline-flex items-center justify-center gap-2 transition-colors ${
                    isSoldOut
                      ? 'bg-[#F5F6F8] text-[#667085] border border-[#E5E7EB] cursor-not-allowed'
                      : addedFeedback
                        ? 'bg-[#465C77] text-[#FFFFFF]'
                        : 'bg-[#111827] text-[#FFFFFF] hover:bg-[#465C77]'
                  }`}
                >
                  {addedFeedback ? <Check size={16} /> : <ShoppingBag size={16} />}
                  <span>
                    {isSoldOut
                      ? '판매 완료된 상품'
                      : addedFeedback
                        ? '장바구니에 담겼습니다'
                        : '장바구니 담기'}
                  </span>
                </button>

                {addedFeedback && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      openCart();
                    }}
                    className="min-h-[44px] px-4 py-2.5 text-sm font-medium border border-[#111827] text-[#111827] rounded-md hover:bg-[#F5F6F8] transition-colors whitespace-nowrap"
                  >
                    장바구니 열기
                  </button>
                )}
              </div>

              <Link
                to={`/shop/${product.id}${previewSuffix}`}
                onClick={onClose}
                className="w-full min-h-[42px] px-4 py-2 border border-[#E5E7EB] rounded-md text-xs font-medium text-[#111827] hover:border-[#111827] inline-flex items-center justify-center gap-1.5 transition-colors"
              >
                <span>상세 정보 · 스펙 전체 보기</span>
                <ArrowRight size={14} />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
