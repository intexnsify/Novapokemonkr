import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react';
import { useSite } from '../context/SiteContext';
import { isValidExternalUrl } from '../lib/utils';
import { SafeImage } from './SafeImage';

export const HeroSlider: React.FC = () => {
  const { heroSlides, isPreviewDraft } = useSite();
  const [activeIndex, setActiveIndex] = useState(0);
  const [userInteracted, setUserInteracted] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const previewSuffix = isPreviewDraft ? '?preview=draft' : '';

  const slideCount = heroSlides.length;

  useEffect(() => {
    if (activeIndex >= slideCount && slideCount > 0) {
      setActiveIndex(0);
    }
  }, [activeIndex, slideCount]);

  useEffect(() => {
    if (slideCount <= 1 || userInteracted || isHovered) return;
    if (
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      return;
    }
    const timer = window.setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % slideCount);
    }, 5500);
    return () => window.clearInterval(timer);
  }, [slideCount, userInteracted, isHovered]);

  const goTo = useCallback(
    (index: number) => {
      if (slideCount === 0) return;
      setUserInteracted(true);
      setActiveIndex(((index % slideCount) + slideCount) % slideCount);
    },
    [slideCount]
  );

  const goPrev = useCallback(() => goTo(activeIndex - 1), [activeIndex, goTo]);
  const goNext = useCallback(() => goTo(activeIndex + 1), [activeIndex, goTo]);

  if (slideCount === 0) return null;

  const current = heroSlides[activeIndex] || heroSlides[0];
  const isLightSlide = current.accentTheme === 'light';
  const rawCta = current.ctaUrl?.trim() || '/shop';
  const isExternal = isValidExternalUrl(rawCta);
  const internalTarget = rawCta.startsWith('/') ? `${rawCta}${previewSuffix}` : `/${rawCta}`;
  const desktopImg = current.desktopImageUrl || current.mobileImageUrl || '';
  const mobileImg = current.mobileImageUrl || current.desktopImageUrl || '';

  return (
    <section
      aria-label="메인 프로모션 배너"
      className="relative w-full border-b border-[#E5E7EB] bg-[#F5F6F8] overflow-hidden"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onTouchStart={(e) => {
        touchStartX.current = e.touches[0]?.clientX ?? null;
      }}
      onTouchEnd={(e) => {
        if (touchStartX.current === null || slideCount <= 1) return;
        const endX = e.changedTouches[0]?.clientX ?? touchStartX.current;
        const delta = endX - touchStartX.current;
        touchStartX.current = null;
        if (Math.abs(delta) >= 42) {
          if (delta > 0) goPrev();
          else goNext();
        }
      }}
    >
      <div className="relative w-full min-h-[380px] sm:min-h-[440px] lg:min-h-[500px] flex items-end md:items-center">
        {/* Background Media Layer */}
        <div className="absolute inset-0">
          <div className="hidden md:block w-full h-full">
            <SafeImage
              key={`hero-desk-${current.id}-${desktopImg}`}
              src={desktopImg}
              alt={current.title}
              fallbackTitle="NOVA"
              className="w-full h-full object-cover"
            />
          </div>
          <div className="block md:hidden w-full h-full">
            <SafeImage
              key={`hero-mob-${current.id}-${mobileImg}`}
              src={mobileImg}
              alt={current.title}
              fallbackTitle="NOVA"
              className="w-full h-full object-cover"
            />
          </div>

          {/* Contrast Scrim */}
          {isLightSlide ? (
            <div className="absolute inset-0 bg-gradient-to-t md:bg-gradient-to-r from-[#FFFFFF]/95 via-[#FFFFFF]/82 to-[#FFFFFF]/30" />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-t md:bg-gradient-to-r from-[#111827]/90 via-[#111827]/62 to-[#111827]/20" />
          )}
        </div>

        {/* Content Foreground */}
        <div className="relative z-10 max-w-6xl mx-auto w-full px-4 sm:px-6 py-10 sm:py-14 md:py-16">
          <div className="max-w-xl space-y-4">
            {current.badge && (
              <p
                className={`font-mono-tabular text-[11px] font-semibold tracking-[0.18em] uppercase ${
                  isLightSlide ? 'text-[#465C77]' : 'text-[#CBD5E1]'
                }`}
              >
                {current.badge}
              </p>
            )}

            <h1
              className={`font-editorial text-2xl sm:text-4xl lg:text-[2.75rem] font-semibold leading-[1.18] tracking-tight text-balance ${
                isLightSlide ? 'text-[#111827]' : 'text-[#FFFFFF]'
              }`}
            >
              {current.title}
            </h1>

            {current.subtitle && (
              <p
                className={`text-sm sm:text-base leading-relaxed max-w-lg ${
                  isLightSlide ? 'text-[#4B5563]' : 'text-[#E5E7EB]'
                }`}
              >
                {current.subtitle}
              </p>
            )}

            {current.ctaLabel && (
              <div className="pt-2 flex items-center gap-3">
                {isExternal ? (
                  <a
                    href={rawCta}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`inline-flex items-center justify-center gap-2 min-h-[44px] px-6 py-2.5 text-sm font-semibold rounded-md transition-colors whitespace-nowrap ${
                      isLightSlide
                        ? 'bg-[#111827] text-[#FFFFFF] hover:bg-[#465C77]'
                        : 'bg-[#FFFFFF] text-[#111827] hover:bg-[#F5F6F8]'
                    }`}
                  >
                    <span>{current.ctaLabel}</span>
                    <ArrowRight size={15} />
                  </a>
                ) : (
                  <Link
                    to={internalTarget}
                    className={`inline-flex items-center justify-center gap-2 min-h-[44px] px-6 py-2.5 text-sm font-semibold rounded-md transition-colors whitespace-nowrap ${
                      isLightSlide
                        ? 'bg-[#111827] text-[#FFFFFF] hover:bg-[#465C77]'
                        : 'bg-[#FFFFFF] text-[#111827] hover:bg-[#F5F6F8]'
                    }`}
                  >
                    <span>{current.ctaLabel}</span>
                    <ArrowRight size={15} />
                  </Link>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Navigation Arrows (Desktop & Tablet) */}
        {slideCount > 1 && (
          <>
            <button
              type="button"
              onClick={goPrev}
              aria-label="이전 슬라이드"
              className="hidden md:inline-flex absolute left-4 top-1/2 -translate-y-1/2 z-20 w-11 h-11 items-center justify-center rounded-full border border-[#FFFFFF]/30 bg-[#111827]/50 text-[#FFFFFF] hover:bg-[#111827]/80 backdrop-blur-sm transition-colors"
            >
              <ChevronLeft size={20} />
            </button>
            <button
              type="button"
              onClick={goNext}
              aria-label="다음 슬라이드"
              className="hidden md:inline-flex absolute right-4 top-1/2 -translate-y-1/2 z-20 w-11 h-11 items-center justify-center rounded-full border border-[#FFFFFF]/30 bg-[#111827]/50 text-[#FFFFFF] hover:bg-[#111827]/80 backdrop-blur-sm transition-colors"
            >
              <ChevronRight size={20} />
            </button>
          </>
        )}

        {/* Bottom Indicator Bars */}
        {slideCount > 1 && (
          <div className="absolute bottom-4 left-0 right-0 z-20 px-4 sm:px-6">
            <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
              <div className="flex items-center gap-2" role="tablist" aria-label="슬라이드 선택">
                {heroSlides.map((slide, idx) => {
                  const isActive = idx === activeIndex;
                  return (
                    <button
                      key={slide.id}
                      type="button"
                      role="tab"
                      aria-selected={isActive}
                      aria-label={`${idx + 1}번 배너: ${slide.title}`}
                      onClick={() => goTo(idx)}
                      className={`h-1.5 rounded-full transition-all duration-300 ${
                        isActive
                          ? isLightSlide
                            ? 'w-8 bg-[#111827]'
                            : 'w-8 bg-[#FFFFFF]'
                          : isLightSlide
                            ? 'w-4 bg-[#111827]/25 hover:bg-[#111827]/50'
                            : 'w-4 bg-[#FFFFFF]/40 hover:bg-[#FFFFFF]/75'
                      }`}
                    />
                  );
                })}
              </div>

              <div className="flex md:hidden items-center gap-1.5">
                <button
                  type="button"
                  onClick={goPrev}
                  aria-label="이전 슬라이드"
                  className="w-9 h-9 inline-flex items-center justify-center rounded-full bg-[#111827]/60 text-[#FFFFFF] border border-[#FFFFFF]/25"
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  type="button"
                  onClick={goNext}
                  aria-label="다음 슬라이드"
                  className="w-9 h-9 inline-flex items-center justify-center rounded-full bg-[#111827]/60 text-[#FFFFFF] border border-[#FFFFFF]/25"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};
