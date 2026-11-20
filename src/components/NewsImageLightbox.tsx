import React, { useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, Shield, X } from 'lucide-react';
import { SafeImage } from './SafeImage';

export interface LightboxImageEntry {
  url: string;
  alt?: string;
  caption?: string;
  source?: string;
  rights?: string;
  rightsNote?: string;
  isCover?: boolean;
}

interface NewsImageLightboxProps {
  images: LightboxImageEntry[];
  activeIndex: number | null;
  onClose: () => void;
  onChangeIndex: (nextIndex: number) => void;
}

export const NewsImageLightbox: React.FC<NewsImageLightboxProps> = ({
  images,
  activeIndex,
  onClose,
  onChangeIndex,
}) => {
  const touchStartX = useRef<number | null>(null);

  useEffect(() => {
    if (activeIndex === null) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowLeft' && images.length > 1) {
        onChangeIndex((activeIndex - 1 + images.length) % images.length);
      } else if (e.key === 'ArrowRight' && images.length > 1) {
        onChangeIndex((activeIndex + 1) % images.length);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [activeIndex, images.length, onClose, onChangeIndex]);

  if (activeIndex === null || activeIndex < 0 || activeIndex >= images.length) {
    return null;
  }

  const current = images[activeIndex];
  const hasMultiple = images.length > 1;

  const goPrev = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    onChangeIndex((activeIndex - 1 + images.length) % images.length);
  };

  const goNext = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    onChangeIndex((activeIndex + 1) % images.length);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-[#05070A]/95 backdrop-blur-sm flex flex-col justify-between p-3 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label="이미지 크게 보기"
      onClick={onClose}
      onTouchStart={(e) => {
        touchStartX.current = e.touches[0]?.clientX ?? null;
      }}
      onTouchEnd={(e) => {
        if (touchStartX.current === null || !hasMultiple) return;
        const endX = e.changedTouches[0]?.clientX ?? touchStartX.current;
        const delta = endX - touchStartX.current;
        touchStartX.current = null;
        if (Math.abs(delta) >= 45) {
          if (delta > 0) {
            onChangeIndex((activeIndex - 1 + images.length) % images.length);
          } else {
            onChangeIndex((activeIndex + 1) % images.length);
          }
        }
      }}
    >
      {/* Top Bar */}
      <div
        className="flex items-center justify-between gap-3 text-xs text-[#C5CBD3] shrink-0"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2">
          <span className="font-mono-tabular px-2.5 py-1 rounded border border-[#303741] bg-[#11151A] text-[#F3F4F6]">
            {activeIndex + 1} / {images.length}
          </span>
          {current.isCover && (
            <span className="px-2 py-0.5 rounded border border-[#303741] bg-[#171C23] text-[#C5CBD3] text-[11px]">
              대표 이미지
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label="이미지 크게 보기 닫기"
          className="min-w-[44px] min-h-[44px] inline-flex items-center justify-center rounded-full border border-[#303741] bg-[#11151A] text-[#F3F4F6] hover:border-[#C5CBD3]"
        >
          <X size={20} />
        </button>
      </div>

      {/* Main Image Area */}
      <div className="relative flex-1 min-h-0 flex items-center justify-center my-2 sm:my-4">
        {hasMultiple && (
          <button
            type="button"
            onClick={goPrev}
            aria-label="이전 이미지"
            className="hidden sm:inline-flex absolute left-1 md:left-4 z-10 min-w-[44px] min-h-[44px] items-center justify-center rounded-full border border-[#303741] bg-[#11151A]/90 text-[#F3F4F6] hover:border-[#C5CBD3]"
          >
            <ChevronLeft size={22} />
          </button>
        )}

        <div
          className="max-w-full max-h-full flex items-center justify-center overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          <SafeImage
            src={current.url}
            alt={current.caption || current.alt || '기사 이미지'}
            fallbackTitle={current.caption || 'NOVA ARCHIVE'}
            className="max-w-full max-h-[68vh] sm:max-h-[75vh] w-auto h-auto object-contain rounded-lg border border-[#303741]/80 bg-[#080A0D]"
          />
        </div>

        {hasMultiple && (
          <button
            type="button"
            onClick={goNext}
            aria-label="다음 이미지"
            className="hidden sm:inline-flex absolute right-1 md:right-4 z-10 min-w-[44px] min-h-[44px] items-center justify-center rounded-full border border-[#303741] bg-[#11151A]/90 text-[#F3F4F6] hover:border-[#C5CBD3]"
          >
            <ChevronRight size={22} />
          </button>
        )}
      </div>

      {/* Mobile Prev/Next + Metadata Footer */}
      <div
        className="max-w-3xl w-full mx-auto space-y-2 shrink-0"
        onClick={(e) => e.stopPropagation()}
      >
        {hasMultiple && (
          <div className="flex sm:hidden items-center justify-between gap-3">
            <button
              type="button"
              onClick={goPrev}
              className="flex-1 min-h-[40px] px-3 rounded border border-[#303741] bg-[#11151A] text-xs font-medium text-[#F3F4F6] inline-flex items-center justify-center gap-1"
            >
              <ChevronLeft size={15} />
              <span>이전</span>
            </button>
            <button
              type="button"
              onClick={goNext}
              className="flex-1 min-h-[40px] px-3 rounded border border-[#303741] bg-[#11151A] text-xs font-medium text-[#F3F4F6] inline-flex items-center justify-center gap-1"
            >
              <span>다음</span>
              <ChevronRight size={15} />
            </button>
          </div>
        )}

        {(current.caption || current.source || current.rights || current.rightsNote) && (
          <div className="rounded-lg border border-[#303741] bg-[#11151A]/95 px-4 py-3 space-y-1 text-left">
            {current.caption && (
              <p className="text-xs sm:text-sm text-[#F3F4F6] leading-snug break-words">
                {current.caption}
              </p>
            )}
            {(current.source || current.rights || current.rightsNote) && (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[#929AA6] break-words">
                {current.source && <span>출처: {current.source}</span>}
                {current.rights && (
                  <span className="inline-flex items-center gap-1 text-[#C5CBD3]">
                    <Shield size={11} />
                    <span>권한: {current.rights}</span>
                  </span>
                )}
                {current.rightsNote && <span>· {current.rightsNote}</span>}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
