import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import { ArrowLeft, ExternalLink, Maximize2, Shield } from 'lucide-react';
import { useSite } from '../context/SiteContext';
import { trackAnalyticsEvent } from '../lib/analytics';
import { buildArticleSegments, sanitizeGalleryImages } from '../lib/newsImages';
import { formatKST, isValidExternalUrl, stripMarkdown } from '../lib/utils';
import { NewsImageItem } from '../types/nova';
import { SafeImage } from '../components/SafeImage';
import { SeoManager } from '../components/SeoManager';
import { LightboxImageEntry, NewsImageLightbox } from '../components/NewsImageLightbox';

export const NewsDetailPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const { posts, isPreviewDraft } = useSite();
  const previewSuffix = isPreviewDraft ? '?preview=draft' : '';
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const post = posts.find((p) => p.slug === slug || p.id === slug);

  useEffect(() => {
    if (slug) {
      trackAnalyticsEvent('page_view', `/news/${slug}`);
    }
  }, [slug]);

  const relatedPosts = useMemo(() => {
    if (!post) return [];
    const sameCat = posts.filter(
      (p) =>
        p.id !== post.id &&
        ((post.tcgCategory && p.tcgCategory === post.tcgCategory) || p.category === post.category)
    );
    const others = posts.filter((p) => p.id !== post.id && !sameCat.some((s) => s.id === p.id));
    return [...sameCat, ...others].slice(0, 3);
  }, [post, posts]);

  const galleryImages = useMemo(
    () => sanitizeGalleryImages(post?.galleryImages),
    [post?.galleryImages]
  );

  const segments = useMemo(() => {
    if (!post) return [];
    return buildArticleSegments(post.content, galleryImages);
  }, [post, galleryImages]);

  const markdownInlineUrls = useMemo(() => {
    if (!post?.content) return [];
    const matches: Array<{ url: string; alt: string }> = [];
    const mdImgRegex = /!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/g;
    let m: RegExpExecArray | null;
    while ((m = mdImgRegex.exec(post.content)) !== null) {
      const url = m[2]?.trim();
      if (url) {
        matches.push({ url, alt: m[1] || '' });
      }
    }
    return matches;
  }, [post?.content]);

  const { lightboxImages, urlToLightboxIndex } = useMemo(() => {
    const list: LightboxImageEntry[] = [];
    const indexMap = new Map<string, number>();

    const register = (entry: LightboxImageEntry, key?: string) => {
      const idx = list.length;
      list.push(entry);
      if (key && !indexMap.has(key)) indexMap.set(key, idx);
      if (entry.url && !indexMap.has(entry.url)) indexMap.set(entry.url, idx);
    };

    if (post?.coverImage) {
      register(
        {
          url: post.coverImage,
          alt: post.title,
          caption: post.title,
          source: post.sourceName || undefined,
          isCover: true,
        },
        '__cover__'
      );
    }

    galleryImages.forEach((img) => {
      register(
        {
          url: img.url,
          alt: img.alt || img.caption || post?.title,
          caption: img.caption,
          source: img.source,
          rights: img.rights,
          rightsNote: img.rightsNote,
        },
        img.id
      );
    });

    markdownInlineUrls.forEach((mdImg) => {
      if (!indexMap.has(mdImg.url)) {
        register({
          url: mdImg.url,
          alt: mdImg.alt || post?.title,
          caption: mdImg.alt || undefined,
          source: post?.sourceName || undefined,
        });
      }
    });

    return { lightboxImages: list, urlToLightboxIndex: indexMap };
  }, [post, galleryImages, markdownInlineUrls]);

  if (!post) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-20 text-center space-y-4">
        <p className="font-mono-tabular text-xs tracking-[0.2em] text-[#667085]">NOT FOUND</p>
        <h1 className="text-2xl font-semibold text-[#111827]">게시물을 찾을 수 없습니다</h1>
        <Link
          to={`/news${previewSuffix}`}
          className="inline-flex items-center gap-2 min-h-[44px] px-5 py-2.5 bg-[#111827] text-[#FFFFFF] hover:bg-[#465C77] rounded-md text-sm font-semibold transition-colors"
        >
          <ArrowLeft size={16} />
          <span>뉴스 목록으로</span>
        </Link>
      </div>
    );
  }

  const hasValidSourceUrl = Boolean(post.sourceUrl && isValidExternalUrl(post.sourceUrl));

  const openGalleryItemInLightbox = (img: NewsImageItem) => {
    const idx = urlToLightboxIndex.get(img.id) ?? urlToLightboxIndex.get(img.url);
    if (typeof idx === 'number') setLightboxIndex(idx);
  };

  const renderMarkdownWithZoomableImages = (markdownText: string) => (
    <ReactMarkdown
      components={{
        img: ({ src, alt }) => {
          if (!src) return null;
          const idx = urlToLightboxIndex.get(src);
          return (
            <figure className="my-6 rounded-lg border border-[#E5E7EB] bg-[#FFFFFF] overflow-hidden">
              <button
                type="button"
                onClick={() => {
                  if (typeof idx === 'number') setLightboxIndex(idx);
                }}
                aria-label={`${alt || '본문 이미지'} 크게 보기`}
                className="group relative w-full flex items-center justify-center p-2 sm:p-3 bg-[#F5F6F8] cursor-zoom-in focus:outline-none"
              >
                <SafeImage
                  src={src}
                  alt={alt || post.title}
                  fallbackTitle={alt || post.title}
                  className="max-w-full h-auto max-h-[70vh] w-auto object-contain rounded mx-auto block"
                />
                <span className="absolute bottom-3 right-3 px-2.5 py-1 rounded-md border border-[#E5E7EB] bg-[#FFFFFF]/90 text-[11px] text-[#111827] inline-flex items-center gap-1 opacity-90 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity shadow-sm">
                  <Maximize2 size={11} />
                  <span>크게 보기</span>
                </span>
              </button>
              {alt && (
                <figcaption className="px-4 py-2.5 border-t border-[#E5E7EB] bg-[#FFFFFF] text-xs text-[#667085] break-words">
                  {alt}
                </figcaption>
              )}
            </figure>
          );
        },
      }}
    >
      {markdownText}
    </ReactMarkdown>
  );

  const renderEditorialFigure = (img: NewsImageItem, orderIndex: number, compact = false) => {
    const hasMeta = Boolean(img.caption || img.source || img.rights || img.rightsNote);
    return (
      <figure
        key={img.id}
        className="w-full rounded-lg border border-[#E5E7EB] bg-[#FFFFFF] overflow-hidden my-2"
      >
        <button
          type="button"
          onClick={() => openGalleryItemInLightbox(img)}
          aria-label={`${img.caption || `기사 이미지 ${orderIndex + 1}`} 크게 보기`}
          className="group relative w-full flex items-center justify-center p-2 sm:p-3 bg-[#F5F6F8] cursor-zoom-in focus:outline-none"
        >
          <SafeImage
            src={img.url}
            alt={img.alt || img.caption || `${post.title} 이미지 ${orderIndex + 1}`}
            fallbackTitle={img.caption || post.title}
            className={`max-w-full w-auto h-auto ${
              compact ? 'max-h-[340px]' : 'max-h-[72vh]'
            } object-contain rounded mx-auto block`}
          />
          <span className="absolute bottom-3 right-3 px-2.5 py-1 rounded-md border border-[#E5E7EB] bg-[#FFFFFF]/90 text-[11px] text-[#111827] inline-flex items-center gap-1 opacity-90 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity shadow-sm">
            <Maximize2 size={11} />
            <span>터치하여 확대</span>
          </span>
        </button>

        {hasMeta && (
          <figcaption className="px-4 py-3 border-t border-[#E5E7EB] bg-[#FFFFFF] space-y-1.5 text-left">
            {img.caption && (
              <p className="text-xs sm:text-sm text-[#111827] leading-relaxed break-words">
                {img.caption}
              </p>
            )}
            {(img.source || img.rights || img.rightsNote) && (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[#667085] break-words">
                {img.source && <span>출처: {img.source}</span>}
                {img.rights && (
                  <span className="inline-flex items-center gap-1 text-[#4B5563]">
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

  return (
    <>
      <SeoManager
        title={post.seoTitle || post.title}
        description={post.seoDescription || post.summary || post.title}
        image={post.coverImage || galleryImages[0]?.url}
      />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10 md:py-14 space-y-12">
        <article className="max-w-3xl mx-auto space-y-8">
          <Link
            to={`/news${previewSuffix}`}
            className="inline-flex items-center gap-2 text-sm text-[#667085] hover:text-[#111827] transition-colors"
          >
            <ArrowLeft size={16} />
            <span>뉴스 목록으로</span>
          </Link>

          <header className="space-y-4 border-b border-[#E5E7EB] pb-7">
            <div className="flex flex-wrap items-center gap-2 text-xs text-[#667085]">
              <span className="font-medium text-[#111827]">{post.category}</span>
              {post.tcgCategory && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="text-[#465C77] font-semibold">{post.tcgCategory}</span>
                </>
              )}
              <span aria-hidden="true">·</span>
              <span className="font-mono-tabular">{formatKST(post.createdAt)} KST</span>
              {galleryImages.length > 0 && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono-tabular">
                    사진 {galleryImages.length + (post.coverImage ? 1 : 0)}장
                  </span>
                </>
              )}
            </div>
            <h1 className="text-2xl sm:text-3xl lg:text-[34px] font-semibold text-[#111827] leading-[1.24] text-balance">
              {post.title}
            </h1>
            {post.summary && (
              <p className="text-base sm:text-[17px] text-[#667085] leading-relaxed">
                {stripMarkdown(post.summary)}
              </p>
            )}

            {(post.sourceName || hasValidSourceUrl) && (
              <div className="pt-2 flex flex-wrap items-center justify-between gap-3 border border-[#E5E7EB] bg-[#F5F6F8] rounded-md px-4 py-3 text-xs">
                <div className="space-y-0.5">
                  <p className="text-[#111827] font-medium">
                    원문 출처: {post.sourceName || '외부 공식·뉴스 채널'}
                  </p>
                  {post.publishedAtSource && (
                    <p className="font-mono-tabular text-[#667085]">
                      원문 발행일: {formatKST(post.publishedAtSource)} KST
                    </p>
                  )}
                </div>
                {hasValidSourceUrl && (
                  <a
                    href={post.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="min-h-[38px] px-3.5 py-1.5 bg-[#111827] text-[#FFFFFF] hover:bg-[#465C77] rounded font-semibold inline-flex items-center gap-1.5 transition-colors"
                  >
                    <span>원문 보기</span>
                    <ExternalLink size={12} />
                  </a>
                )}
              </div>
            )}
          </header>

          {post.coverImage && (
            <figure className="w-full rounded-lg overflow-hidden border border-[#E5E7EB] bg-[#FFFFFF]">
              <button
                type="button"
                onClick={() => {
                  const idx = urlToLightboxIndex.get('__cover__');
                  if (typeof idx === 'number') setLightboxIndex(idx);
                }}
                aria-label="대표 이미지 크게 보기"
                className="group relative w-full flex items-center justify-center p-2 sm:p-3 bg-[#F5F6F8] cursor-zoom-in focus:outline-none"
              >
                <SafeImage
                  src={post.coverImage}
                  alt={post.title}
                  fallbackTitle={post.title}
                  className="max-w-full w-auto h-auto max-h-[65vh] sm:max-h-[540px] object-contain mx-auto rounded block"
                />
                <span className="absolute bottom-3 right-3 px-2.5 py-1 rounded-md border border-[#E5E7EB] bg-[#FFFFFF]/90 text-[11px] text-[#111827] inline-flex items-center gap-1 opacity-90 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity shadow-sm">
                  <Maximize2 size={11} />
                  <span>크게 보기</span>
                </span>
              </button>
            </figure>
          )}

          <div className="max-w-[68ch] space-y-6 text-[#1F2937] text-[15.5px] sm:text-[17px] leading-[1.82] [&_h2]:text-xl sm:[&_h2]:text-2xl [&_h2]:font-semibold [&_h2]:text-[#111827] [&_h2]:pt-6 [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:text-[#111827] [&_h3]:pt-4 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:space-y-2 [&_blockquote]:border [&_blockquote]:border-[#E5E7EB] [&_blockquote]:bg-[#F5F6F8] [&_blockquote]:p-4 [&_blockquote]:rounded-md [&_blockquote]:text-[#4B5563] [&_a]:text-[#465C77] [&_a]:underline [&_a]:underline-offset-4 [&_hr]:border-[#E5E7EB] [&_hr]:my-8">
            {segments.map((seg, idx) => {
              if (seg.type === 'markdown') {
                return (
                  <div key={`md-${idx}`} className="space-y-4">
                    {renderMarkdownWithZoomableImages(seg.text)}
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

        {/* Related News Section */}
        {relatedPosts.length > 0 && (
          <section className="pt-8 border-t border-[#E5E7EB] space-y-5">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-xl font-semibold text-[#111827]">관련 뉴스</h2>
              <Link
                to={`/news${previewSuffix}`}
                className="text-xs font-medium text-[#465C77] hover:text-[#111827]"
              >
                뉴스 전체 →
              </Link>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {relatedPosts.map((rel) => {
                const thumb = rel.coverImage || rel.galleryImages?.[0]?.url;
                return (
                  <Link
                    key={rel.id}
                    to={`/news/${rel.slug}${previewSuffix}`}
                    className="group border border-[#E5E7EB] rounded-lg overflow-hidden bg-[#FFFFFF] flex flex-col nova-card-hover hover:border-[#D1D5DB]"
                  >
                    {thumb && (
                      <div className="aspect-[16/10] bg-[#F5F6F8] border-b border-[#E5E7EB] overflow-hidden">
                        <SafeImage
                          src={thumb}
                          alt={rel.title}
                          fallbackTitle={rel.title}
                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                        />
                      </div>
                    )}
                    <div className="p-4 flex-1 flex flex-col justify-between gap-2.5">
                      <div className="space-y-1.5">
                        <p className="text-[11px] font-semibold text-[#465C77]">
                          {rel.tcgCategory || rel.category}
                        </p>
                        <h3 className="text-sm font-semibold text-[#111827] line-clamp-2 group-hover:text-[#465C77] transition-colors">
                          {rel.title}
                        </h3>
                      </div>
                      <p className="font-mono-tabular text-[11px] text-[#667085]">
                        {formatKST(rel.createdAt, false)}
                      </p>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        )}
      </div>

      <NewsImageLightbox
        images={lightboxImages}
        activeIndex={lightboxIndex}
        onClose={() => setLightboxIndex(null)}
        onChangeIndex={setLightboxIndex}
      />
    </>
  );
};
