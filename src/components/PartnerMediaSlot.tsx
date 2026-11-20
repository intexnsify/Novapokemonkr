import React from 'react';
import { SafeImage } from './SafeImage';

export interface PartnerMediaSlotProps {
  title: string;
  brandName?: string;
  imageUrl?: string;
  mobileImageUrl?: string;
  videoUrl?: string;
  posterUrl?: string;
  caption?: string;
  aspectClass?: string;
}

function getYouTubeEmbedUrl(rawUrl?: string): string | null {
  if (!rawUrl) return null;
  try {
    const parsed = new URL(rawUrl.trim());
    const host = parsed.hostname.replace(/^www\./, '').toLowerCase();
    if (host === 'youtu.be') {
      const id = parsed.pathname.split('/').filter(Boolean)[0];
      return id ? `https://www.youtube-nocookie.com/embed/${id}` : null;
    }
    if (host === 'youtube.com' || host === 'm.youtube.com') {
      if (parsed.pathname === '/watch') {
        const id = parsed.searchParams.get('v');
        return id ? `https://www.youtube-nocookie.com/embed/${id}` : null;
      }
      if (parsed.pathname.startsWith('/shorts/') || parsed.pathname.startsWith('/embed/')) {
        const id = parsed.pathname.split('/').filter(Boolean)[1];
        return id ? `https://www.youtube-nocookie.com/embed/${id}` : null;
      }
    }
  } catch {
    return null;
  }
  return null;
}

function isDirectVideoFile(rawUrl?: string): boolean {
  if (!rawUrl) return false;
  return /\.(mp4|webm|mov)(\?.*)?$/i.test(rawUrl.trim());
}

/**
 * Extensible campaign media & video showcase slot for PARTNERS.
 */
export const PartnerMediaSlot: React.FC<PartnerMediaSlotProps> = ({
  title,
  brandName,
  imageUrl,
  mobileImageUrl,
  videoUrl,
  posterUrl,
  caption,
  aspectClass = 'aspect-[16/9]',
}) => {
  const youtubeSrc = getYouTubeEmbedUrl(videoUrl);
  const directVideo = isDirectVideoFile(videoUrl) ? videoUrl?.trim() : null;
  const desktopVisual = imageUrl?.trim() || mobileImageUrl?.trim() || '';
  const mobileVisual = mobileImageUrl?.trim() || imageUrl?.trim() || '';

  return (
    <figure className="border border-[#E5E7EB] rounded-lg overflow-hidden bg-[#FFFFFF]">
      {youtubeSrc ? (
        <div className={`${aspectClass} w-full bg-[#111827]`}>
          <iframe
            src={youtubeSrc}
            title={title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            loading="lazy"
            className="w-full h-full border-0"
          />
        </div>
      ) : directVideo ? (
        <div className={`${aspectClass} w-full bg-[#111827]`}>
          <video
            src={directVideo}
            poster={posterUrl || desktopVisual || undefined}
            controls
            playsInline
            preload="metadata"
            className="w-full h-full object-cover"
          />
        </div>
      ) : desktopVisual ? (
        <>
          <div className={`hidden sm:block ${aspectClass} w-full overflow-hidden bg-[#F5F6F8]`}>
            <SafeImage
              src={desktopVisual}
              alt={title}
              fallbackTitle={brandName || title}
              className="w-full h-full object-cover"
            />
          </div>
          <div className="block sm:hidden aspect-[16/10] w-full overflow-hidden bg-[#F5F6F8]">
            <SafeImage
              src={mobileVisual}
              alt={title}
              fallbackTitle={brandName || title}
              className="w-full h-full object-cover"
            />
          </div>
        </>
      ) : (
        <div className="aspect-[16/9] w-full bg-[#F5F6F8] flex flex-col items-center justify-center px-6 text-center gap-2">
          <span className="font-brand text-sm sm:text-base font-bold tracking-[0.2em] text-[#111827]">
            {brandName || 'PARTNER'}
          </span>
          <span className="text-xs text-[#667085] max-w-sm">
            캠페인 전용 비주얼 · 영상 쇼케이스 슬롯 (배너 이미지 또는 영상 URL 등록 시 자동 노출)
          </span>
        </div>
      )}

      {caption && (
        <figcaption className="px-4 py-2.5 border-t border-[#E5E7EB] bg-[#F5F6F8] text-xs text-[#667085]">
          {caption}
        </figcaption>
      )}
    </figure>
  );
};
