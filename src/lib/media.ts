import { getEnv } from './env';

export type Bucket = 'artwork-images' | 'site-media' | 'documents';

export function publicMediaUrl(bucket: Bucket, storagePath: string) {
  const { PUBLIC_SUPABASE_URL } = getEnv();
  return `${PUBLIC_SUPABASE_URL}/storage/v1/object/public/${bucket}/${storagePath}`;
}
