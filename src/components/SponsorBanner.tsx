import React, { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink } from 'lucide-react';
import { trackAnalyticsEvent, trackSponsorImpressionOnce } from '../lib/analytics';
import { Sponsor } from '../types/nova';
import { SafeImage } from './SafeImage';

interface SponsorBannerProps {
  sponsor: Sponsor;
  placement: string;
  path: string;
  variant?: 'hero_banner' | 'inline_ad' | 'shop_ad';
  buttonRadiusClass?: string;
  previewSuffix?: string;
}

function getDomainLabel(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

export const SponsorBanner: React.FC<SponsorBannerProps> = ({
  sponsor,
  placement,
  path,
  variant = 'hero_banner',
  buttonRadiusClass = 'rounded-md',
  previewSuffix = '',
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      trackSponsorImpressionOnce(sponsor.id, sponsor.name, placement, path);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          trackSponsorImpressionOnce(sponsor.id, sponsor.name, placement, path);
          observer.disconnect();
        }
      },
      { threshold: 0.35 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [sponsor.id, sponsor.name, placement, path]);

  const desktopImg = sponsor.desktopBannerUrl?.trim() || '';
  const mobileImg = sponsor.mobileBannerUrl?.trim() || '';
  const hasBannerImage = Boolean(desktopImg || mobileImg);
  const effectiveDesktopImg = desktopImg || mobileImg;
  const effectiveMobileImg = mobileImg || desktopImg;
  const ctaText = sponsor.ctaLabel?.trim() || '공식 사이트';
  const badgeText = sponsor.badgeLabel?.trim() || '협찬';

  const handleClick = () => {
    trackAnalyticsEvent('sponsor_click', path, {
      targetType: placement,
      targetId: sponsor.id,
      targetLabel: sponsor.name,
    });
  };

  if (hasBannerImage) {
    return (
      <div
        ref={containerRef}
        className="border border-[#303741] rounded-lg overflow-hidden bg-[#11151A] hover:border-[#8068BA]/70 transition-colors"
      >
        <a
          href={sponsor.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={handleClick}
          className="block group"
        >
          {/* Desktop banner */}
          <div className="hidden md:block w-full max-h-[220px] overflow-hidden bg-[#080A0D]">
            <SafeImage
              src={effectiveDesktopImg}
              alt={`${sponsor.name} 공식 스폰서 배너`}
              fallbackTitle={sponsor.name}
              className="w-full h-full max-h-[220px] object-cover transition-transform duration-300 group-hover:scale-[1.01]"
            />
          </div>

          {/* Mobile banner */}
          <div className="block md:hidden w-full max-h-[200px] overflow-hidden bg-[#080A0D]">
            <SafeImage
              src={effectiveMobileImg}
              alt={`${sponsor.name} 모바일 스폰서 배너`}
              fallbackTitle={sponsor.name}
              className="w-full h-full max-h-[200px] object-cover"
            />
          </div>
        </a>

        {/* Clean metadata & action bar below banner visual */}
        <div className="px-4 py-3 sm:px-5 border-t border-[#303741]/80 bg-[#11151A] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {sponsor.logoUrl && (
              <div className="w-8 h-8 rounded border border-[#303741] bg-[#080A0D] overflow-hidden shrink-0">
                <SafeImage src={sponsor.logoUrl} alt={sponsor.name} className="w-full h-full object-cover" />
              </div>
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-xs">
                {sponsor.isSponsored && (
                  <span className="px-1.5 py-0.5 text-[10px] font-medium border border-[#8068BA]/60 text-[#C5CBD3] bg-[#8068BA]/15 rounded-sm shrink-0">
                    {badgeText}
                  </span>
                )}
                <span className="font-brand text-xs sm:text-sm font-bold tracking-[0.14em] text-[#F3F4F6] truncate">
                  {sponsor.name}
                </span>
                <span className="hidden sm:inline text-[#929AA6]" aria-hidden="true">
                  ·
                </span>
                <span className="hidden sm:inline text-[11px] font-mono-tabular text-[#929AA6] truncate">
                  {getDomainLabel(sponsor.url)}
                </span>
              </div>
              {sponsor.description && (
                <p className="text-xs text-[#929AA6] truncate mt-0.5">{sponsor.description}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <a
              href={sponsor.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={handleClick}
              className={`min-h-[36px] px-3.5 py-1.5 text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap nova-transition ${buttonRadiusClass}`}
              style={{
                backgroundColor: 'var(--nova-silver)',
                color: 'var(--nova-bg-main)',
              }}
            >
              <span>{ctaText}</span>
              <ExternalLink size={12} />
            </a>
            <Link
              to={`/sponsors${previewSuffix}`}
              className={`min-h-[36px] px-3 py-1.5 text-xs font-medium border border-[#303741] bg-[#171C23] text-[#C5CBD3] hover:text-[#F3F4F6] hover:border-[#C5CBD3] inline-flex items-center whitespace-nowrap ${buttonRadiusClass}`}
            >
              협찬 안내
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Editorial text-based banner fallback when PC/Mobile banner image is not registered
  const isInline = variant === 'inline_ad' || variant === 'shop_ad';

  return (
    <div
      ref={containerRef}
      className={`border border-[#303741] rounded-lg transition-colors hover:border-[#8068BA]/65 ${
        isInline ? 'bg-[#171C23]' : 'bg-[#11151A]'
      } p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4`}
    >
      <div className="flex items-start sm:items-center gap-3.5 min-w-0">
        {sponsor.logoUrl ? (
          <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-md border border-[#303741] bg-[#080A0D] overflow-hidden shrink-0">
            <SafeImage
              src={sponsor.logoUrl}
              alt={sponsor.name}
              fallbackTitle={sponsor.name}
              className="w-full h-full object-cover"
            />
          </div>
        ) : (
          <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-md border border-[#303741] bg-[#080A0D] flex items-center justify-center shrink-0">
            <span className="font-brand text-sm font-bold text-[#C5CBD3] tracking-wider">
              {sponsor.name.slice(0, 2).toUpperCase()}
            </span>
          </div>
        )}

        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {sponsor.isSponsored && (
              <span className="px-1.5 py-0.5 text-[10px] font-medium border border-[#8068BA]/60 text-[#C5CBD3] bg-[#8068BA]/15 rounded-sm">
                {badgeText}
              </span>
            )}
            <span className="text-[11px] tracking-[0.14em] text-[#929AA6] uppercase">
              {variant === 'hero_banner' ? 'MAIN SPONSOR' : 'SPONSORED'}
            </span>
            <span className="text-[#929AA6]" aria-hidden="true">
              ·
            </span>
            <span className="font-brand text-sm font-bold tracking-[0.14em] text-[#F3F4F6]">
              {sponsor.name}
            </span>
            <span className="hidden sm:inline text-[#929AA6]" aria-hidden="true">
              ·
            </span>
            <span className="hidden sm:inline text-[11px] font-mono-tabular text-[#929AA6]">
              {getDomainLabel(sponsor.url)}
            </span>
          </div>
          {sponsor.description && (
            <p className="text-xs sm:text-sm text-[#929AA6] leading-snug line-clamp-2">
              {sponsor.description}
            </p>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 shrink-0">
        <a
          href={sponsor.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={handleClick}
          className={`min-h-[40px] px-4 py-2 text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap nova-transition ${buttonRadiusClass}`}
          style={{
            backgroundColor: 'var(--nova-silver)',
            color: 'var(--nova-bg-main)',
          }}
        >
          <span>{ctaText}</span>
          <ExternalLink size={13} />
        </a>
        <Link
          to={`/sponsors${previewSuffix}`}
          className={`min-h-[40px] px-3.5 py-2 text-xs font-medium border border-[#303741] bg-[#171C23] text-[#C5CBD3] hover:text-[#F3F4F6] hover:border-[#C5CBD3] inline-flex items-center whitespace-nowrap nova-transition ${buttonRadiusClass}`}
        >
          <span>협찬 · 광고 안내</span>
        </Link>
      </div>
    </div>
  );
};
