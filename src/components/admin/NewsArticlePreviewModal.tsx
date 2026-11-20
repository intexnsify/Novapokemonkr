import React, { useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { ExternalLink, Maximize2, Shield, X } from 'lucide-react';
import { buildNewsPostMarkdown, NewsDraftData } from '../../lib/newsDraftStore';
import { buildArticleSegments, sanitizeGalleryImages } from '../../lib/newsImages';
import { formatKST, isValidExternalUrl } from '../../lib/utils';
import { NewsImageItem, NewsInboxItem } from '../../types/nova';
import { LightboxImageEntry, NewsImageLightbox } from '../NewsImageLightbox';
import { SafeImage } from '../SafeImage';

interface NewsArticlePreviewModalProps {
  item: NewsInboxItem;
  draft: NewsDraftData;
  onClose: () => void;
}

export const NewsArticlePreviewModal: React.FC<NewsArticlePreviewModalProps> = ({
  item,
  draft,
  onClose,
}) => {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const title = (draft.koreanTitle || item.originalTitle).trim();
  const galleryImages = useMemo(
    () => sanitizeGalleryImages(draft.galleryImages),
    [draft.galleryImages]
  );
  const markdownContent = useMemo(
    () => buildNewsPostMarkdown(item, draft.novaSummary || '(NOVA 요약 미입력)'),
    [item, draft.novaSummary]
  );
  const segments = useMemo(
    () => buildArticleSegments(markdownContent, galleryImages),
    [markdownContent, galleryImages]
  );

  const { lightboxImages, urlToLightboxIndex } = useMemo(() => {
    const list: LightboxImageEntry[] = [];
    const indexMap = new Map<string, number>();

    const register = (entry: LightboxImageEntry, key?: string) => {
      const idx = list.length;
      list.push(entry);
      if (key && !indexMap.has(key)) indexMap.set(key, idx);
      if (entry.url && !indexMap.has(entry.url)) indexMap.set(entry.url, idx);
    };

    if (draft.coverImage) {
      register(
        {
          url: draft.coverImage,
          alt: title,
          caption: title,
          source: item.sourceName || undefined,
          isCover: true,
        },
        '__cover__'
      );
    }

    galleryImages.forEach((img) => {
      register(
        {
          url: img.url,
          alt: img.alt || img.caption || title,
          caption: img.caption,
          source: img.source,
          rights: img.rights,
          rightsNote: img.rightsNote,
        },
        img.id
      );
    });

    return { lightboxImages: list, urlToLightboxIndex: indexMap };
  }, [draft.coverImage, galleryImages, item.sourceName, title]);

  const openGalleryItemInLightbox = (img: NewsImageItem) => {
    const idx = urlToLightboxIndex.get(img.id) ?? urlToLightboxIndex.get(img.url);
    if (typeof idx === 'number') setLightboxIndex(idx);
  };

  const renderEditorialFigure = (img: NewsImageItem, orderIndex: number, compact = false) => {
    const hasMeta = Boolean(img.caption || img.source || img.rights || img.rightsNote);
    return (
      <figure
        key={img.id}
        className="w-full rounded-xl border border-[#303741] bg-[#0B0E12] overflow-hidden my-1"
      >
        <button
          type="button"
          onClick={() => openGalleryItemInLightbox(img)}
          className="group relative w-full flex items-center justify-center p-2 sm:p-3 cursor-zoom-in focus:outline-none"
        >
          <SafeImage
            src={img.url}
            alt={img.alt || img.caption || `${title} 이미지 ${orderIndex + 1}`}
            fallbackTitle={img.caption || title}
            className={`max-w-full w-auto h-auto ${
              compact ? 'max-h-[320px]' : 'max-h-[68vh]'
            } object-contain rounded-md mx-auto block`}
          />
          <span className="absolute bottom-3 right-3 px-2.5 py-1 rounded-md border border-[#303741] bg-[#080A0D]/85 text-[11px] text-[#C5CBD3] inline-flex items-center gap-1 opacity-90 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
            <Maximize2 size={11} />
            <span>크게 보기</span>
          </span>
        </button>

        {hasMeta && (
          <figcaption className="px-4 py-3 border-t border-[#303741]/80 bg-[#11151A] space-y-1.5 text-left">
            {img.caption && (
              <p className="text-xs sm:text-sm text-[#F3F4F6] leading-relaxed break-words">
                {img.caption}
              </p>
            )}
            {(img.source || img.rights || img.rightsNote) && (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[#929AA6] break-words">
                {img.source && <span>출처: {img.source}</span>}
                {img.rights && (
                  <span className="inline-flex items-center gap-1 text-[#C5CBD3]">
                    <Shield size={11} />
                    <span>{img.rights}</span>
                  </span>
                )}
                {img.rightsNote && <span>· {img.rightsNote}</span>}
              </div>
            )}
          </figcaption>
        )}
      </figure>
    );
  };

  const hasValidSourceUrl = Boolean(item.originalUrl && isValidExternalUrl(item.originalUrl));

  return (
    <div
      className="fixed inset-0 z-50 bg-[#05070A]/90 backdrop-blur-sm flex flex-col"
      role="dialog"
      aria-modal="true"
      aria-label="공개 뉴스 페이지 미리보기"
    >
      <div className="h-14 shrink-0 border-b border-[#303741] bg-[#080A0D] px-4 sm:px-6 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-xs font-semibold text-[#F3F4F6] truncate">
            공개 페이지 미리보기
          </span>
          <span className="text-[11px] text-[#929AA6] hidden sm:inline truncate">
            독자에게 실제로 표시되는 레이아웃과 이미지 배치를 미리 확인합니다.
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="min-h-[36px] px-3 py-1.5 border border-[#303741] bg-[#171C23] text-xs text-[#F3F4F6] rounded hover:border-[#C5CBD3] inline-flex items-center gap-1.5 shrink-0"
        >
          <X size={14} />
          <span>편집으로 돌아가기</span>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto bg-[#080A0D]">
        <article className="max-w-3xl mx-auto px-4 sm:px-6 py-8 md:py-12 space-y-8">
          <header className="space-y-4 border-b border-[#303741] pb-6">
            <div className="flex flex-wrap items-center gap-2 text-xs text-[#929AA6]">
              <span>TCG 뉴스</span>
              <span aria-hidden="true">·</span>
              <span className="text-[#C5CBD3] font-medium">{draft.tcgCategory}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono-tabular">게시 시점 기준 KST</span>
              {galleryImages.length > 0 && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono-tabular text-[#C5CBD3]">
                    사진 {galleryImages.length + (draft.coverImage ? 1 : 0)}장
                  </span>
                </>
              )}
            </div>
            <h1 className="text-2xl sm:text-3xl font-semibold text-[#F3F4F6] leading-tight text-balance">
              {title}
            </h1>

            <div className="pt-2 flex flex-wrap items-center justify-between gap-3 border border-[#303741] bg-[#11151A] rounded-md px-4 py-3 text-xs">
              <div className="space-y-0.5">
                <p className="text-[#F3F4F6] font-medium">
                  원문 출처: {item.sourceName || '외부 공식·뉴스 채널'}
                </p>
                {item.publishedAtSource && (
                  <p className="font-mono-tabular text-[#929AA6]">
                    원문 발행일: {formatKST(item.publishedAtSource)} KST
                  </p>
                )}
              </div>
              {hasValidSourceUrl && (
                <a
                  href={item.originalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="min-h-[36px] px-3.5 py-1.5 bg-[#C5CBD3] text-[#080A0D] rounded font-semibold inline-flex items-center gap-1.5"
                >
                  <span>원문 보기</span>
                  <ExternalLink size={12} />
                </a>
              )}
            </div>
          </header>

          {draft.coverImage && (
            <figure className="w-full rounded-xl overflow-hidden border border-[#303741] bg-[#0B0E12]">
              <button
                type="button"
                onClick={() => {
                  const idx = urlToLightboxIndex.get('__cover__');
                  if (typeof idx === 'number') setLightboxIndex(idx);
                }}
                className="group relative w-full flex items-center justify-center p-2 sm:p-3 cursor-zoom-in focus:outline-none"
              >
                <SafeImage
                  src={draft.coverImage}
                  alt={title}
                  fallbackTitle={title}
                  className="max-w-full w-auto h-auto max-h-[60vh] sm:max-h-[480px] object-contain mx-auto rounded-md block"
                />
                <span className="absolute bottom-3 right-3 px-2.5 py-1 rounded-md border border-[#303741] bg-[#080A0D]/85 text-[11px] text-[#C5CBD3] inline-flex items-center gap-1 opacity-90 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                  <Maximize2 size={11} />
                  <span>크게 보기</span>
                </span>
              </button>
            </figure>
          )}

          <div className="space-y-6 text-[#F3F4F6]/90 text-sm sm:text-base leading-relaxed [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-[#F3F4F6] [&_h2]:pt-4 [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:text-[#C5CBD3] [&_h3]:pt-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1.5 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:space-y-1.5 [&_blockquote]:border [&_blockquote]:border-[#303741] [&_blockquote]:bg-[#11151A] [&_blockquote]:p-4 [&_blockquote]:rounded-md [&_blockquote]:text-[#929AA6] [&_a]:text-[#C5CBD3] [&_a]:underline [&_hr]:border-[#303741] [&_hr]:my-6">
            {segments.map((seg, idx) => {
              if (seg.type === 'markdown') {
                return (
                  <div key={`md-${idx}`} className="space-y-4">
                    <ReactMarkdown>{seg.text}</ReactMarkdown>
                  </div>
                );
              }
              if (seg.type === 'image') {
                return renderEditorialFigure(seg.image, seg.orderIndex, false);
              }
              return (
                <div
                  key={`grid-${idx}`}
                  className={`grid grid-cols-1 ${
                    seg.images.length > 1 ? 'sm:grid-cols-2' : ''
                  } gap-4 my-4`}
                >
                  {seg.images.map(({ image, orderIndex }) =>
                    renderEditorialFigure(image, orderIndex, seg.images.length > 1)
                  )}
                </div>
              );
            })}
          </div>
        </article>
      </div>

      <NewsImageLightbox
        images={lightboxImages}
        activeIndex={lightboxIndex}
        onClose={() => setLightboxIndex(null)}
        onChangeIndex={setLightboxIndex}
      />
    </div>
  );
};
