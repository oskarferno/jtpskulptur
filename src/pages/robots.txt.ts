import type { APIRoute } from 'astro';

export const prerender = false;

// Preview/staging deploys (any host that isn't the real production domain,
// e.g. *.pages.dev) must not be indexed — production and staging must never
// compete for the same search results.
const PRODUCTION_HOSTS = new Set(['jtpskulptur.com', 'www.jtpskulptur.com']);

export const GET: APIRoute = ({ url }) => {
  const isProduction = PRODUCTION_HOSTS.has(url.hostname);

  const body = isProduction
    ? `User-agent: *\nAllow: /\n\nSitemap: https://www.jtpskulptur.com/sitemap.xml\n`
    : `User-agent: *\nDisallow: /\n`;

  return new Response(body, { headers: { 'Content-Type': 'text/plain' } });
};
