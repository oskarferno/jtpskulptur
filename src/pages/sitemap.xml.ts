import type { APIRoute } from 'astro';
import { getSupabaseClient } from '../lib/supabase';
import { getSiteUrl } from '../lib/site-url';

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
  // See lib/site-url.ts — matches whatever host is actually serving this
  // deployment until PUBLIC_SITE_URL is set at cutover. robots.txt already
  // fully blocks crawling on any non-production host, so a sitemap that
  // (for now) lists this deployment's own URLs carries no indexing risk.
  const BASE = getSiteUrl(request);
  const supabase = getSupabaseClient();
  const [{ data: artworks }, { data: posts }, { data: exhibitions }] = await Promise.all([
    supabase.from('artworks').select('slug, updated_at').eq('published', true),
    supabase.from('posts').select('slug, updated_at').eq('published', true),
    supabase.from('exhibitions').select('slug, created_at').eq('published', true),
  ]);

  const staticUrls = [
    { loc: `${BASE}/`, lastmod: undefined },
    { loc: `${BASE}/portfolio`, lastmod: undefined },
    { loc: `${BASE}/about`, lastmod: undefined },
    { loc: `${BASE}/contact`, lastmod: undefined },
    { loc: `${BASE}/privacy`, lastmod: undefined },
    { loc: `${BASE}/terms`, lastmod: undefined },
    { loc: `${BASE}/cookies`, lastmod: undefined },
    ...((exhibitions?.length ?? 0) > 0 ? [{ loc: `${BASE}/exhibitions`, lastmod: undefined }] : []),
    ...((posts?.length ?? 0) > 0 ? [{ loc: `${BASE}/journal`, lastmod: undefined }] : []),
  ];

  const artworkUrls = (artworks ?? []).map((a) => ({
    loc: `${BASE}/portfolio/${a.slug}`,
    lastmod: a.updated_at,
  }));

  const postUrls = (posts ?? []).map((p) => ({
    loc: `${BASE}/journal/${p.slug}`,
    lastmod: p.updated_at,
  }));

  const exhibitionUrls = (exhibitions ?? [])
    .filter((e): e is { slug: string; created_at: string } => !!e.slug)
    .map((e) => ({
      loc: `${BASE}/exhibitions/${e.slug}`,
      lastmod: e.created_at,
    }));

  const urls = [...staticUrls, ...artworkUrls, ...exhibitionUrls, ...postUrls];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (u) => `  <url>
    <loc>${u.loc}</loc>${u.lastmod ? `\n    <lastmod>${new Date(u.lastmod).toISOString()}</lastmod>` : ''}
  </url>`
  )
  .join('\n')}
</urlset>`;

  return new Response(xml, { headers: { 'Content-Type': 'application/xml' } });
};
