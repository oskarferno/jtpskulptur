import type { APIRoute } from 'astro';
import { getSupabaseClient } from '../lib/supabase';

export const prerender = false;

const BASE = 'https://www.jtpskulptur.com';

export const GET: APIRoute = async () => {
  const supabase = getSupabaseClient();
  const [{ data: artworks }, { data: posts }, { count: exhibitionCount }] = await Promise.all([
    supabase.from('artworks').select('slug, updated_at').eq('published', true),
    supabase.from('posts').select('slug, updated_at').eq('published', true),
    supabase.from('exhibitions').select('id', { count: 'exact', head: true }).eq('published', true),
  ]);

  const staticUrls = [
    { loc: `${BASE}/`, lastmod: undefined },
    { loc: `${BASE}/portfolio`, lastmod: undefined },
    { loc: `${BASE}/about`, lastmod: undefined },
    { loc: `${BASE}/contact`, lastmod: undefined },
    ...(exhibitionCount ? [{ loc: `${BASE}/exhibitions`, lastmod: undefined }] : []),
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

  const urls = [...staticUrls, ...artworkUrls, ...postUrls];

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
