// The one list of hostnames that count as the real, live website — used to
// keep preview/staging deploys out of search results (robots.txt) and out of
// analytics (layouts/Layout.astro, middleware.ts's CSP). Compared against the
// request's own hostname, not PUBLIC_SITE_URL: that var is set for every
// deployment of this Worker (workers.dev included), so it can't tell a
// preview from production.
const PRODUCTION_HOSTS = new Set(['jtpskulptur.com', 'www.jtpskulptur.com']);

export function isProductionHost(hostname: string): boolean {
  return PRODUCTION_HOSTS.has(hostname);
}
