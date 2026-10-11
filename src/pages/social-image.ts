import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { getEnv } from '../lib/env';

export const prerender = false;

// The share-preview image behind og:image — see lib/social-image.ts for why.
// GET /social-image?src=<our Supabase media URL>&x=<0-100>&y=<0-100>
// returns that photo upright (the Images binding applies EXIF orientation and
// strips the tag) and cropped to 1200×630 with its centre at the focal point.
const WIDTH = 1200;
const HEIGHT = 630;

function percent(value: string | null, fallback: number): number {
  const n = Number(value);
  return value !== null && Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : fallback;
}

export const GET: APIRoute = async ({ url, locals }) => {
  const src = url.searchParams.get('src') ?? '';

  // Only our own public media bucket URLs — never an arbitrary URL, so this
  // can't be used as an open proxy or to reach anything internal.
  const allowedPrefix = `${getEnv().PUBLIC_SUPABASE_URL}/storage/v1/object/public/`;
  if (!src.startsWith(allowedPrefix) || src.includes('..')) {
    return new Response('Bad request', { status: 400 });
  }

  const x = percent(url.searchParams.get('x'), 50);
  const y = percent(url.searchParams.get('y'), 50);

  // caches.default is Cloudflare-specific (not in the DOM CacheStorage type).
  const cache = (caches as unknown as { default?: Cache }).default;
  if (cache) {
    const cached = await cache.match(url.href);
    if (cached) return cached;
  }

  const upstream = await fetch(src, { redirect: 'manual' }).catch(() => null);
  const contentType = upstream?.headers.get('content-type') ?? '';
  if (!upstream?.ok || !upstream.body || !contentType.startsWith('image/')) {
    return new Response('Not found', { status: 404 });
  }

  const images = (env as { IMAGES?: ImagesBinding }).IMAGES;
  if (!images) {
    // No Images binding (some local setups): send the crawler/browser to the
    // regular image pipeline's centre crop rather than failing.
    const fallback = new URL('/_image', url.origin);
    fallback.searchParams.set('href', src);
    fallback.searchParams.set('w', String(WIDTH));
    fallback.searchParams.set('h', String(HEIGHT));
    fallback.searchParams.set('fit', 'cover');
    fallback.searchParams.set('f', 'jpeg');
    fallback.searchParams.set('q', '80');
    return Response.redirect(fallback.href, 302);
  }

  const result = await images
    .input(upstream.body)
    .transform({
      width: WIDTH,
      height: HEIGHT,
      fit: 'cover',
      // 'remainder' places the crop window like CSS object-position
      // (x% / y% of the overflow) — the same rule every on-site crop of
      // these images already uses with the stored focal point.
      gravity: { x: x / 100, y: y / 100, mode: 'remainder' },
    })
    .output({ format: 'image/jpeg', quality: 80 });

  // The URL carries the source file and the focal point, so a changed photo
  // or focal point is a different URL — safe to cache hard.
  const response = new Response(result.response().body, {
    headers: {
      'Content-Type': 'image/jpeg',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
  if (cache) locals.cfContext?.waitUntil(cache.put(url.href, response.clone()));
  return response;
};
