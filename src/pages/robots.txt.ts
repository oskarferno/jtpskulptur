import type { APIRoute } from 'astro';
import { isProductionHost } from '../lib/production-host';

export const prerender = false;

// Preview/staging deploys (any host that isn't the real production domain,
// e.g. *.pages.dev) must not be indexed — production and staging must never
// compete for the same search results.
export const GET: APIRoute = ({ url }) => {
  const isProduction = isProductionHost(url.hostname);

  const body = isProduction
    ? `User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /vendor\nDisallow: /api\n\nSitemap: https://jtpskulptur.com/sitemap.xml\n`
    : `User-agent: *\nDisallow: /\n`;

  return new Response(body, { headers: { 'Content-Type': 'text/plain' } });
};
