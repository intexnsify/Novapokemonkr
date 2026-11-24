import React, { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink } from 'lucide-react';
import { useSite } from '../context/SiteContext';
import { trackAnalyticsEvent, trackSponsorImpressionOnce } from '../lib/analytics';
import { Sponsor } from '../types/nova';
import { PartnerMediaSlot } from './PartnerMediaSlot';
import { SafeImage } from './SafeImage';

interface SponsorBannerProps {
  sponsor: Sponsor;
  placement: string;
  path: string;
  variant?: 'hero_banner' | 'inline_ad' | 'shop_ad' | 'home_campaign';
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
  const { sponsorMeta } = useSite();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const meta = sponsorMeta[sponsor.id];

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
  const videoUrl = meta?.videoUrl?.trim() || '';
  const hasBannerImage = Boolean(desktopImg || mobileImg);
  const hasRichMedia = hasBannerImage || Boolean(videoUrl);
  const effectiveDesktopImg = desktopImg || mobileImg;
  const effectiveMobileImg = mobileImg || desktopImg;
  const ctaText = sponsor.ctaLabel?.trim() || '공식 사이트';
  const badgeText = sponsor.badgeLabel?.trim() || '협찬';
  const headline = meta?.headline?.trim();
  const campaignLabel = meta?.campaignName?.trim();

  const handleClick = () => {
    trackAnalyticsEvent('sponsor_click', path, {
      targetType: placement,
      targetId: sponsor.id,
      targetLabel: sponsor.name,
    });
  };

  if (variant === 'home_campaign') {
    const repackDefault = sponsor.id === 'sponsor_repack' &&
      /^https:\/\/(www\.)?repack\.co\.kr\/?$/.test(sponsor.url) && !campaignLabel && !headline;
    const campaignUrl = repackDefault ? 'https://www.repack.co.kr/events' : sponsor.url;
    const brandImage = repackDefault ? 'https://www.repack.co.kr/opengraph-image.png' : '';
    return (
      <aside ref={containerRef} aria-label={`${sponsor.name} 파트너 캠페인`}
        className="grid overflow-hidden rounded-xl border border-zinc-700 bg-zinc-950 text-white sm:grid-cols-2">
        {hasRichMedia ? (
          <div className="self-center p-3 sm:p-5">
            <PartnerMediaSlot title={headline || campaignLabel || sponsor.name}
              brandName={sponsor.name} imageUrl={effectiveDesktopImg} mobileImageUrl={effectiveMobileImg}
              videoUrl={videoUrl} aspectClass="aspect-[2/1]" />
          </div>
        ) : brandImage && !sponsor.logoUrl ? (
          <SafeImage src={brandImage} alt="리팩 공식 브랜드 이미지" fallbackTitle="REPACK"
            className="aspect-[1200/630] h-full w-full object-cover" />
        ) : (
          <div aria-hidden="true" className="flex min-h-28 items-center justify-center bg-linear-to-br from-zinc-800 via-zinc-950 to-zinc-700 px-5 py-6">
            {sponsor.logoUrl ? (
              <SafeImage src={sponsor.logoUrl} alt="" className="h-20 max-w-full object-contain" />
            ) : (
              <span className="break-all text-center font-brand text-3xl font-bold tracking-wider text-zinc-200 sm:text-4xl">{sponsor.name}</span>
            )}
          </div>
        )}
        <div className="flex flex-col items-start justify-center gap-3 p-5 sm:p-8">
          <p className="text-xs font-semibold text-zinc-300">{sponsor.isSponsored ? '광고' : '파트너'} · {sponsor.name}</p>
          <h3 className="text-xl font-bold sm:text-2xl">{campaignLabel || headline || (repackDefault ? '리팩과 함께하는 이벤트' : sponsor.name)}</h3>
          {(campaignLabel && headline || sponsor.description) && (
            <p className="text-sm leading-relaxed text-zinc-300">{(campaignLabel && headline) || sponsor.description}</p>
          )}
          <div className="mt-2 grid w-full gap-2 min-[370px]:grid-cols-2 sm:grid-cols-1 lg:grid-cols-2">
            <a href={campaignUrl} target="_blank" rel="noopener noreferrer" onClick={handleClick}
              className={`inline-flex min-h-12 items-center justify-center gap-1.5 bg-white px-2 text-sm font-bold text-zinc-950 hover:bg-zinc-100 ${buttonRadiusClass}`}>
              {sponsor.ctaLabel?.trim() || (repackDefault ? '리팩 이벤트 보기' : `${sponsor.name} 바로가기`)}
              <ExternalLink size={14} aria-hidden="true" />
            </a>
            <Link to={`/sponsors${previewSuffix}`}
              onClick={() => trackAnalyticsEvent('action_click', path, {
                targetType: placement, targetId: 'partnership_guide', targetLabel: '파트너십 · 광고 안내',
              })}
              className={`inline-flex min-h-12 items-center justify-center gap-1 rounded-md border border-zinc-400 bg-zinc-300 px-2 text-sm font-semibold text-zinc-950 hover:bg-zinc-200 ${buttonRadiusClass}`}>
              파트너십 · 광고 안내
            </Link>
          </div>
        </div>
      </aside>
    );
  }

  if (hasRichMedia) {
    return (
      <aside
        ref={containerRef}
        aria-label={`${sponsor.name} 스폰서 광고`}
        className="border border-[#E5E7EB] rounded-lg overflow-hidden bg-[#FFFFFF] hover:border-[#D1D5DB] transition-colors"
      >
        <div className="px-4 py-2 bg-[#F5F6F8] border-b border-[#E5E7EB] flex items-center justify-between gap-2 text-[11px] text-[#667085]">
          <span className="font-mono-tabular tracking-[0.14em] uppercase text-[#465C77] font-semibold truncate">
            SPONSORED · {badgeText}
            {campaignLabel ? ` · ${campaignLabel}` : ''}
          </span>
          <span className="font-mono-tabular text-[#667085] truncate">{getDomainLabel(sponsor.url)}</span>
        </div>

        {videoUrl ? (
          <div className="bg-[#111827]">
            <PartnerMediaSlot
              title={headline || sponsor.name}
              brandName={sponsor.name}
              imageUrl={effectiveDesktopImg}
              mobileImageUrl={effectiveMobileImg}
              videoUrl={videoUrl}
              aspectClass="aspect-[21/9]"
            />
          </div>
        ) : (
          <a
            href={sponsor.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={handleClick}
            className="block group"
          >
            <div className="hidden md:block w-full max-h-[240px] overflow-hidden bg-[#F5F6F8]">
              <SafeImage
                src={effectiveDesktopImg}
                alt={`${sponsor.name} 공식 스폰서 배너`}
                fallbackTitle={sponsor.name}
                className="w-full h-full max-h-[240px] object-cover transition-transform duration-300 group-hover:scale-[1.015]"
              />
            </div>

            <div className="block md:hidden w-full max-h-[190px] overflow-hidden bg-[#F5F6F8]">
              <SafeImage
                src={effectiveMobileImg}
                alt={`${sponsor.name} 모바일 스폰서 배너`}
                fallbackTitle={sponsor.name}
                className="w-full h-full max-h-[190px] object-cover"
              />
            </div>
          </a>
        )}

        <div className="px-4 py-3.5 sm:px-5 border-t border-[#E5E7EB] bg-[#FFFFFF] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {sponsor.logoUrl && (
              <div className="w-9 h-9 rounded border border-[#E5E7EB] bg-[#F5F6F8] overflow-hidden shrink-0">
                <SafeImage src={sponsor.logoUrl} alt={sponsor.name} className="w-full h-full object-cover" />
              </div>
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-xs">
                <span className="font-brand text-xs sm:text-sm font-bold tracking-[0.14em] text-[#111827] truncate">
                  {sponsor.name}
                </span>
                {headline && (
                  <span className="text-xs font-medium text-[#465C77] truncate hidden sm:inline">
                    · {headline}
                  </span>
                )}
              </div>
              {sponsor.description && (
                <p className="text-xs text-[#667085] truncate mt-0.5">{sponsor.description}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <a
              href={sponsor.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={handleClick}
              className={`min-h-[38px] px-4 py-1.5 text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap bg-[#111827] text-[#FFFFFF] hover:bg-[#465C77] transition-colors ${buttonRadiusClass}`}
            >
              <span>{ctaText}</span>
              <ExternalLink size={12} />
            </a>
            <Link
              to={`/sponsors${previewSuffix}`}
              className={`min-h-[38px] px-3 py-1.5 text-xs font-medium border border-[#E5E7EB] bg-[#F5F6F8] text-[#667085] hover:text-[#111827] hover:border-[#D1D5DB] inline-flex items-center whitespace-nowrap transition-colors ${buttonRadiusClass}`}
            >
              파트너십
            </Link>
          </div>
        </div>
      </aside>
    );
  }

  return (
    <aside
      ref={containerRef}
      aria-label={`${sponsor.name} 스폰서 안내`}
      className="border border-[#E5E7EB] rounded-lg bg-[#F5F6F8] p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:border-[#D1D5DB] transition-colors"
    >
      <div className="flex items-start sm:items-center gap-4 min-w-0">
        {sponsor.logoUrl ? (
          <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-md border border-[#E5E7EB] bg-[#FFFFFF] overflow-hidden shrink-0">
            <SafeImage
              src={sponsor.logoUrl}
              alt={sponsor.name}
              fallbackTitle={sponsor.name}
              className="w-full h-full object-cover"
            />
          </div>
        ) : (
          <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-md border border-[#E5E7EB] bg-[#FFFFFF] flex items-center justify-center shrink-0">
            <span className="font-brand text-sm font-bold text-[#111827] tracking-wider">
              {sponsor.name.slice(0, 2).toUpperCase()}
            </span>
          </div>
        )}

        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2 text-xs text-[#667085]">
            <span className="font-mono-tabular text-[11px] font-semibold tracking-[0.12em] uppercase text-[#465C77]">
              {variant === 'hero_banner' ? 'MAIN SPONSOR' : 'SPONSORED'} · {badgeText}
            </span>
            <span aria-hidden="true">·</span>
            <span className="font-brand text-sm font-bold tracking-[0.14em] text-[#111827]">
              {sponsor.name}
            </span>
            {campaignLabel && (
              <>
                <span className="hidden sm:inline" aria-hidden="true">·</span>
                <span className="hidden sm:inline text-xs font-medium text-[#111827]">{campaignLabel}</span>
              </>
            )}
            <span className="hidden sm:inline" aria-hidden="true">
              ·
            </span>
            <span className="hidden sm:inline text-[11px] font-mono-tabular">
              {getDomainLabel(sponsor.url)}
            </span>
          </div>
          {headline && (
            <p className="text-xs sm:text-sm font-medium text-[#111827] truncate">{headline}</p>
          )}
          {sponsor.description && (
            <p className="text-xs sm:text-sm text-[#667085] leading-snug line-clamp-2">
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
          className={`min-h-[40px] px-4 py-2 text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap bg-[#111827] text-[#FFFFFF] hover:bg-[#465C77] transition-colors ${buttonRadiusClass}`}
        >
          <span>{ctaText}</span>
          <ExternalLink size={13} />
        </a>
        <Link
          to={`/sponsors${previewSuffix}`}
          className={`min-h-[40px] px-3.5 py-2 text-xs font-medium border border-[#E5E7EB] bg-[#FFFFFF] text-[#667085] hover:text-[#111827] hover:border-[#D1D5DB] inline-flex items-center whitespace-nowrap transition-colors ${buttonRadiusClass}`}
        >
          <span>협찬 · 광고 안내</span>
        </Link>
      </div>
    </aside>
  );
};
