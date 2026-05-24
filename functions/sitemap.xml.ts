/// <reference types="@cloudflare/workers-types" />

interface Env {
  DB: D1Database;
}

const SITE = 'https://aircondemocracy.com';
const STATIC_PATHS: { loc: string; changefreq: string; priority: number }[] = [
  { loc: '/', changefreq: 'always', priority: 1.0 },
];

function xmlEscape(s: string): string {
  return s.replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[c]!);
}

export const onRequest: PagesFunction<Env> = async ({ env }) => {
  let placeIds: string[] = [];
  try {
    const { results } = await env.DB.prepare('SELECT id FROM places ORDER BY created_at DESC LIMIT 5000').all<{ id: string }>();
    placeIds = (results ?? []).map((r) => r.id);
  } catch {
    // tolerate missing/unbound DB during preview
  }

  const now = new Date().toISOString();

  const urls: string[] = [
    ...STATIC_PATHS.map(
      (p) =>
        `<url><loc>${xmlEscape(SITE + p.loc)}</loc><lastmod>${now}</lastmod><changefreq>${p.changefreq}</changefreq><priority>${p.priority}</priority></url>`
    ),
    ...placeIds.map(
      (id) =>
        `<url><loc>${xmlEscape(`${SITE}/p/${encodeURIComponent(id)}`)}</loc><lastmod>${now}</lastmod><changefreq>hourly</changefreq><priority>0.7</priority></url>`
    ),
  ];

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('\n')}
</urlset>`;

  return new Response(body, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
};
