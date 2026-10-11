import { getEnv } from './env';

// Link previews (iMessage, WhatsApp, Slack, Facebook…) fetch og:image
// themselves and, unlike browsers, often ignore the EXIF Orientation tag —
// so a raw phone photo stored sideways-with-a-rotate-flag shows up sideways.
// They also centre-crop whatever they're given to roughly 1.91:1. Pointing
// og:image at the raw upload therefore gets both wrong.
//
// This builds the URL of /social-image (src/pages/social-image.ts), which
// serves the same photo upright and pre-cropped to 1200×630 around the focal
// point the admin already set for that image, so the crop keeps the subject.
export function socialImageUrl(siteOrigin: string, rawUrl: string, focal?: { x: number; y: number } | null): string {
  // Only our own Supabase media is routed through the endpoint (it refuses
  // anything else, so it can't be used as an open image proxy).
  if (!rawUrl.startsWith(`${getEnv().PUBLIC_SUPABASE_URL}/storage/v1/object/public/`)) return rawUrl;
  const params = new URLSearchParams({ src: rawUrl });
  if (focal) {
    params.set('x', String(Math.round(focal.x)));
    params.set('y', String(Math.round(focal.y)));
  }
  return `${siteOrigin}/social-image?${params}`;
}
