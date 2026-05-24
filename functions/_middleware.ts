/// <reference types="@cloudflare/workers-types" />

interface Env {
  DB: D1Database;
}

interface PlaceMeta {
  id: string;
  name: string;
  type: string;
  district: string | null;
  detail: string | null;
}

const SITE = 'https://aircondemocracy.com';

function xmlEscape(s: string): string {
  return s.replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[c]!);
}

// Inject per-place metadata at the edge so crawlers and social previews
// (FB, KakaoTalk, Twitter) get the right title/description/og:image without
// needing client-side JS to execute.
export const onRequest: PagesFunction<Env> = async (ctx) => {
  const url = new URL(ctx.request.url);

  // Only do work for /p/<id>; pass everything else through unchanged
  const placeMatch = url.pathname.match(/^\/p\/([^/]+)\/?$/);
  if (!placeMatch) return ctx.next();

  const placeId = decodeURIComponent(placeMatch[1]);

  // Fetch place data in parallel with the asset response
  const placePromise: Promise<PlaceMeta | null> = ctx.env.DB
    ? ctx.env.DB.prepare('SELECT id, name, type, district, detail FROM places WHERE id = ?')
        .bind(placeId)
        .first<PlaceMeta>()
        .catch(() => null)
    : Promise.resolve(null);

  // Forward to the next handler (which will serve index.html for the SPA)
  const response = await ctx.next();
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('text/html')) return response;

  const place = await placePromise;
  if (!place) return response;

  const placeUrl = `${SITE}/p/${encodeURIComponent(place.id)}`;
  const title = `${place.name} 에어컨 어때요? · 에어컨 민주주의`;
  const description = `${place.name}${place.district ? ` (${place.district})` : ''} — 지금 이 공간 에어컨 분위기에 익명으로 한 표 던지세요.`;

  const rewriter = new HTMLRewriter()
    .on('title', {
      element(el) {
        el.setInnerContent(title);
      },
    })
    .on('link[rel="canonical"]', {
      element(el) {
        el.setAttribute('href', placeUrl);
      },
    })
    .on('meta[name="description"]', {
      element(el) {
        el.setAttribute('content', description);
      },
    })
    .on('meta[property="og:title"]', {
      element(el) {
        el.setAttribute('content', title);
      },
    })
    .on('meta[property="og:description"]', {
      element(el) {
        el.setAttribute('content', description);
      },
    })
    .on('meta[property="og:url"]', {
      element(el) {
        el.setAttribute('content', placeUrl);
      },
    })
    .on('meta[name="twitter:title"]', {
      element(el) {
        el.setAttribute('content', title);
      },
    })
    .on('meta[name="twitter:description"]', {
      element(el) {
        el.setAttribute('content', description);
      },
    })
    .on('head', {
      element(el) {
        // Inject Place-specific structured data
        const ld = {
          '@context': 'https://schema.org',
          '@type': 'WebPage',
          name: title,
          description,
          url: placeUrl,
          inLanguage: 'ko-KR',
          isPartOf: {
            '@type': 'WebApplication',
            name: '에어컨 민주주의',
            url: SITE,
          },
        };
        el.append(`<script type="application/ld+json">${xmlEscape(JSON.stringify(ld))}</script>`, { html: true });
      },
    });

  return rewriter.transform(response);
};
