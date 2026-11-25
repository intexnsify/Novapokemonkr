import { origin } from '../seo/catalog.js';
import { useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { useSite } from '../context/SiteContext';

interface SeoManagerProps {
  title?: string;
  description?: string;
  image?: string;
}

export const SeoManager: React.FC<SeoManagerProps> = ({ title, description, image }) => {
  const {pathname} = useLocation();
  const { config } = useSite();

  useEffect(() => {
    const finalTitle = title ? `${title} | ${config.brand.name}` : config.seo.siteTitle;
    const finalDesc = description || config.seo.metaDescription;
    const finalImg = image || config.seo.ogImageUrl;

    const canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]') || document.createElement('link');
    canonical.rel='canonical';canonical.href=origin+pathname;document.head.appendChild(canonical);
    const schema=document.getElementById('product-schema');
    if(schema && JSON.parse(schema.textContent || '{}').offers?.url !== canonical.href) schema.remove();
    document.title = finalTitle;

    const setMeta = (selector: string, attr: 'name' | 'property', key: string, content: string) => {
      if (!content) return;
      let el = document.querySelector(selector) as HTMLMetaElement | null;
      if (!el) {
        el = document.createElement('meta');
        el.setAttribute(attr, key);
        document.head.appendChild(el);
      }
      el.setAttribute('content', content);
    };

    setMeta('meta[name="description"]', 'name', 'description', finalDesc);
    setMeta('meta[name="keywords"]', 'name', 'keywords', config.seo.keywords);
    setMeta('meta[property="og:title"]', 'property', 'og:title', finalTitle);
    setMeta('meta[property="og:description"]', 'property', 'og:description', finalDesc);
    setMeta('meta[property="og:image"]', 'property', 'og:image', finalImg);
    setMeta('meta[name="twitter:card"]', 'name', 'twitter:card', config.seo.twitterCard);
    setMeta('meta[name="twitter:title"]', 'name', 'twitter:title', finalTitle);
    setMeta('meta[name="twitter:description"]', 'name', 'twitter:description', finalDesc);
  }, [pathname, title, description, image, config.brand.name, config.seo]);

  return null;
};
