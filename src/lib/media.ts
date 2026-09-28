import { getEnv } from './env';

export type Bucket = 'artwork-images' | 'site-media' | 'documents' | 'product-images';

export function publicMediaUrl(bucket: Bucket, storagePath: string) {
  const { PUBLIC_SUPABASE_URL } = getEnv();
  return `${PUBLIC_SUPABASE_URL}/storage/v1/object/public/${bucket}/${storagePath}`;
}

/** Height for a given target width that preserves the source's aspect ratio, for use with astro:assets' <Image>. */
export function scaledHeight(width: number, media?: { width: number | null; height: number | null } | null) {
  if (!media?.width || !media?.height) return Math.round(width * 1.25);
  return Math.round((width * media.height) / media.width);
}
