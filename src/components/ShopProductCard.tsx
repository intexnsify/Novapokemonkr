import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Eye, ShoppingBag } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { formatKRW } from '../lib/utils';
import { Product } from '../types/nova';
import { SafeImage } from './SafeImage';

interface ShopProductCardProps {
  product: Product;
  previewSuffix?: string;
  onQuickView?: (product: Product) => void;
}

export const ShopProductCard: React.FC<ShopProductCardProps> = ({
  product,
  previewSuffix = '',
  onQuickView,
}) => {
  const { addItem } = useCart();
  const [justAdded, setJustAdded] = useState(false);

  const isSoldOut = product.status === '판매완료';
  const isReserved = product.status === '예약중';
  const detailUrl = `/shop/${product.id}${previewSuffix}`;

  const handleAdd = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isSoldOut) return;
    const res = addItem(product, 1);
    if (res.ok) {
      setJustAdded(true);
      window.setTimeout(() => setJustAdded(false), 1500);
    }
  };

  const handleQuickView = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onQuickView?.(product);
  };

  const metaParts = [product.category, product.grade, product.language].filter(Boolean);

  return (
    <article className="min-w-0 group border border-[#E5E7EB] rounded-lg bg-[#FFFFFF] overflow-hidden flex flex-col nova-card-hover hover:border-[#D1D5DB]">
      <div className="relative aspect-square w-full bg-[#F5F6F8] overflow-hidden border-b border-[#E5E7EB]">
        <Link to={detailUrl} className="block w-full h-full">
          <SafeImage
            src={product.images?.[0]}
            alt={product.title}
            fallbackTitle={product.category}
            className={`w-full h-full object-contain p-2 sm:p-3 transition-transform duration-300 ease-out group-hover:scale-[1.03] ${
              isSoldOut ? 'opacity-60 grayscale-[35%]' : ''
            }`}
          />
        </Link>

        {/* Single quiet status indicator */}
        <span
          className={`absolute top-2.5 right-2.5 px-2 py-0.5 text-[11px] font-medium rounded border pointer-events-none ${
            isSoldOut
              ? 'bg-[#FFFFFF]/95 border-[#E5E7EB] text-[#667085]'
              : isReserved
                ? 'bg-[#FFFFFF]/95 border-[#D1D5DB] text-[#465C77]'
                : 'bg-[#FFFFFF]/95 border-[#E5E7EB] text-[#111827]'
          }`}
        >
          {product.status}
        </span>

        {/* Desktop hover action bar */}
        <div className="hidden md:flex absolute inset-x-2.5 bottom-2.5 items-center gap-1.5 opacity-0 translate-y-1 group-hover:opacity-100 group-hover:translate-y-0 group-focus-within:opacity-100 group-focus-within:translate-y-0 transition-all duration-200">
          {onQuickView && (
            <button
              type="button"
              onClick={handleQuickView}
              className="flex-1 min-h-[36px] px-2.5 py-1.5 text-xs font-medium bg-[#FFFFFF]/95 text-[#111827] border border-[#E5E7EB] hover:border-[#111827] rounded-md inline-flex items-center justify-center gap-1.5 shadow-sm backdrop-blur-sm transition-colors whitespace-nowrap"
            >
              <Eye size={13} />
              <span>빠른 보기</span>
            </button>
          )}
          <button
            type="button"
            disabled={isSoldOut}
            onClick={handleAdd}
            className={`flex-1 min-h-[36px] px-2.5 py-1.5 text-xs font-semibold rounded-md inline-flex items-center justify-center gap-1.5 shadow-sm transition-colors whitespace-nowrap ${
              isSoldOut
                ? 'bg-[#F5F6F8]/95 text-[#667085] border border-[#E5E7EB] cursor-not-allowed'
                : justAdded
                  ? 'bg-[#465C77] text-[#FFFFFF]'
                  : 'bg-[#111827] text-[#FFFFFF] hover:bg-[#465C77]'
            }`}
          >
            {justAdded ? <Check size={13} /> : <ShoppingBag size={13} />}
            <span>{isSoldOut ? '판매 완료' : justAdded ? '담김' : '장바구니 담기'}</span>
          </button>
        </div>
      </div>

      <div className="p-2.5 sm:p-4 flex-1 flex flex-col justify-between gap-3">
        <div className="space-y-1.5">
          <p className="text-[11px] font-mono-tabular text-[#667085] truncate">
            {metaParts.join(' · ')}
          </p>
          <Link to={detailUrl} className="block">
            <h3 className="text-sm sm:text-[15px] font-semibold text-[#111827] group-hover:text-[#465C77] transition-colors line-clamp-2 leading-snug">
              {product.title}
            </h3>
          </Link>
        </div>

        <div className="pt-2 border-t border-[#E5E7EB] flex flex-col items-stretch md:flex-row md:flex-wrap md:items-center justify-between gap-2">
          <span className="font-mono-tabular text-sm sm:text-[15px] font-semibold text-[#111827]">
            {formatKRW(product.price)}
          </span>

          {/* Mobile compact actions */}
          <div className="flex md:hidden items-center gap-1.5">
            {onQuickView && (
              <button
                type="button"
                onClick={handleQuickView}
                aria-label={`${product.title} 빠른 보기`}
                className="min-w-11 min-h-11 px-1 border border-[#E5E7EB] rounded-md text-[#111827] inline-flex items-center justify-center hover:bg-[#F5F6F8]"
              >
                <Eye size={14} />
              </button>
            )}
            <button
              type="button"
              disabled={isSoldOut}
              onClick={handleAdd}
              aria-label={`${product.title} 장바구니 담기`}
              className={`flex-1 min-h-11 px-1 text-xs font-semibold rounded-md inline-flex items-center justify-center gap-1 whitespace-nowrap transition-colors ${
                isSoldOut
                  ? 'bg-[#F5F6F8] text-[#667085] border border-[#E5E7EB] cursor-not-allowed'
                  : justAdded
                    ? 'bg-[#465C77] text-[#FFFFFF]'
                    : 'bg-[#111827] text-[#FFFFFF]'
              }`}
            >
              {justAdded ? <Check size={13} /> : <ShoppingBag size={13} />}
              <span>{isSoldOut ? '완료' : justAdded ? '담김' : '담기'}</span>
            </button>
          </div>

          <Link
            to={detailUrl}
            className="hidden md:inline text-xs font-medium text-[#667085] group-hover:text-[#111827] transition-colors whitespace-nowrap"
          >
            상세 보기 →
          </Link>
        </div>
      </div>
    </article>
  );
};
