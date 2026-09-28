import { getEnv } from './env';

// The one place that decides which absolute origin belongs in outbound
// URLs — canonical tags, OG/JSON-LD, sitemap entries, and every
// transactional-email link (newsletter confirm/unsubscribe, vendor
// order notifications). Every one of those call sites should go through
// this instead of reading Astro.site or a hardcoded hostname directly.
//
// Before the production domain is live, PUBLIC_SITE_URL is unset, so this
// falls back to the actual request's own origin — whatever is really
// serving the request right now (localhost in dev, the workers.dev preview
// once deployed). That fallback isn't new: it's exactly what
// api/checkout/session.ts already had to do by hand, after Astro.site
// (permanently set to the not-yet-live jtpskulptur.com in astro.config.mjs)
// sent a real test customer to a 404. The same bug silently affected every
// other place reading Astro.site directly — this fixes all of them from
// one place instead of patching each call site separately.
//
// After cutover: set PUBLIC_SITE_URL=https://jtpskulptur.com (one env var
// in wrangler.jsonc) and every one of those call sites switches to the real
// production domain automatically, with no further code changes needed.
export function getSiteUrl(request: Request): string {
  const configured = getEnv().PUBLIC_SITE_URL;
  return configured ? configured.replace(/\/$/, '') : new URL(request.url).origin;
}
