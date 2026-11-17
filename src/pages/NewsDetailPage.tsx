import React, { useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import { ArrowLeft } from 'lucide-react';
import { useSite } from '../context/SiteContext';
import { trackAnalyticsEvent } from '../lib/analytics';
import { formatKST } from '../lib/utils';
import { SafeImage } from '../components/SafeImage';
import { SeoManager } from '../components/SeoManager';

export const NewsDetailPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const { posts, isPreviewDraft } = useSite();
  const previewSuffix = isPreviewDraft ? '?preview=draft' : '';

  const post = posts.find((p) => p.slug === slug || p.id === slug);

  useEffect(() => {
    if (slug) {
      trackAnalyticsEvent('page_view', `/news/${slug}`);
    }
  }, [slug]);

  if (!post) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16 text-center space-y-4">
        <p className="font-brand text-xs tracking-[0.2em] text-[#929AA6]">NOT FOUND</p>
        <h1 className="text-2xl font-semibold text-[#F3F4F6]">게시물을 찾을 수 없습니다</h1>
        <Link
          to={`/news${previewSuffix}`}
          className="inline-flex items-center gap-2 min-h-[44px] px-5 py-2.5 bg-[#C5CBD3] text-[#080A0D] rounded-md text-sm font-semibold"
        >
          <ArrowLeft size={16} />
          <span>뉴스 목록으로</span>
        </Link>
      </div>
    );
  }

  return (
    <>
      <SeoManager
        title={post.seoTitle || post.title}
        description={post.seoDescription || post.summary || post.title}
        image={post.coverImage}
      />

      <article className="max-w-3xl mx-auto px-4 sm:px-6 py-10 md:py-14 space-y-8">
        <Link
          to={`/news${previewSuffix}`}
          className="inline-flex items-center gap-2 text-sm text-[#929AA6] hover:text-[#F3F4F6] transition-colors"
        >
          <ArrowLeft size={16} />
          <span>뉴스 목록으로</span>
        </Link>

        <header className="space-y-4 border-b border-[#303741] pb-6">
          <div className="flex items-center gap-2 text-xs text-[#929AA6]">
            <span>{post.category}</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono-tabular">{formatKST(post.createdAt)} KST</span>
            {post.isSample && (
              <>
                <span aria-hidden="true">·</span>
                <span className="font-mono-tabular text-[#C5CBD3]">SAMPLE</span>
              </>
            )}
          </div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-[#F3F4F6] leading-tight text-balance">
            {post.title}
          </h1>
          {post.summary && (
            <p className="text-base text-[#929AA6] leading-relaxed">{post.summary}</p>
          )}
        </header>

        {post.coverImage && (
          <div className="aspect-[16/9] w-full rounded-lg overflow-hidden border border-[#303741] bg-[#11151A]">
            <SafeImage
              src={post.coverImage}
              alt={post.title}
              fallbackTitle={post.title}
              className="w-full h-full object-cover"
            />
          </div>
        )}

        <div className="space-y-4 text-[#F3F4F6]/90 text-sm sm:text-base leading-relaxed [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-[#F3F4F6] [&_h2]:pt-4 [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:text-[#C5CBD3] [&_h3]:pt-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1.5 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:space-y-1.5 [&_blockquote]:border [&_blockquote]:border-[#303741] [&_blockquote]:bg-[#11151A] [&_blockquote]:p-4 [&_blockquote]:rounded-md [&_blockquote]:text-[#929AA6] [&_a]:text-[#C5CBD3] [&_a]:underline [&_img]:rounded-md [&_img]:border [&_img]:border-[#303741] [&_img]:my-4">
          <ReactMarkdown>{post.content}</ReactMarkdown>
        </div>
      </article>
    </>
  );
};
