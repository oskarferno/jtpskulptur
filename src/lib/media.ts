const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;

export type Bucket = 'artwork-images' | 'site-media' | 'documents';

export function publicMediaUrl(bucket: Bucket, storagePath: string) {
  return `${supabaseUrl}/storage/v1/object/public/${bucket}/${storagePath}`;
}
