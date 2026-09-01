import { useEffect } from 'react';

const SITE = 'Mummy شافت';

function upsertMeta(selector, attrs) {
  let el = document.head.querySelector(selector);
  if (!el) {
    el = document.createElement('meta');
    document.head.appendChild(el);
  }
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
}

/** Per-page SEO: title, description, canonical, Open Graph, Twitter, JSON-LD. */
export function useSeo({ title, description, image, type = 'website', jsonLd, noIndex = false }) {
  useEffect(() => {
    const fullTitle = title ? `${title} — ${SITE}` : `${SITE} — مكتشف ومتتبّع أعمالي`;
    document.title = fullTitle;

    const desc =
      description ||
      'اكتشف الأفلام والمسلسلات والأنمي عبر بيانات TMDB وJikan وTVmaze، وتابع تجربتك الشخصية: الحالة، تقييمك، الجودة، الملاحظات، والحلقات.';

    upsertMeta('meta[name="description"]', { name: 'description', content: desc });
    upsertMeta('meta[name="robots"]', {
      name: 'robots',
      content: noIndex ? 'noindex,nofollow' : 'index,follow',
    });
    upsertMeta('meta[property="og:title"]', { property: 'og:title', content: fullTitle });
    upsertMeta('meta[property="og:description"]', { property: 'og:description', content: desc });
    upsertMeta('meta[property="og:type"]', { property: 'og:type', content: type });
    upsertMeta('meta[property="og:site_name"]', { property: 'og:site_name', content: SITE });
    upsertMeta('meta[property="og:url"]', { property: 'og:url', content: window.location.href });
    upsertMeta('meta[name="twitter:card"]', {
      name: 'twitter:card',
      content: image ? 'summary_large_image' : 'summary',
    });
    if (image) {
      upsertMeta('meta[property="og:image"]', { property: 'og:image', content: image });
      upsertMeta('meta[name="twitter:image"]', { name: 'twitter:image', content: image });
    }

    let canonical = document.head.querySelector('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.rel = 'canonical';
      document.head.appendChild(canonical);
    }
    canonical.href = window.location.origin + window.location.pathname;

    const scriptId = 'mummy-jsonld';
    document.getElementById(scriptId)?.remove();
    if (jsonLd) {
      const script = document.createElement('script');
      script.id = scriptId;
      script.type = 'application/ld+json';
      script.textContent = JSON.stringify(jsonLd);
      document.head.appendChild(script);
    }
    return () => document.getElementById(scriptId)?.remove();
  }, [title, description, image, type, noIndex, JSON.stringify(jsonLd || null)]);
}

export default useSeo;
