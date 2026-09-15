import type { APIRoute } from 'astro';
import { imageSize } from 'image-size';
import type { Bucket } from '../../../../lib/media';

export const prerender = false;

const ALLOWED_BUCKETS: Bucket[] = ['artwork-images', 'site-media', 'documents'];
const ALLOWED_MIME: Record<Bucket, string[]> = {
  'artwork-images': ['image/jpeg', 'image/png', 'image/webp'],
  'site-media': ['image/jpeg', 'image/png', 'image/webp'],
  documents: ['application/pdf'],
};

function jsonError(message: string, status = 400) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function extFor(mimeType: string) {
  return { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'application/pdf': 'pdf' }[mimeType] ?? 'bin';
}

export const POST: APIRoute = async ({ request, locals }) => {
  const supabase = locals.supabase!;

  const form = await request.formData();
  const file = form.get('file');
  const bucket = String(form.get('bucket') ?? '') as Bucket;
  const altText = form.get('alt_text');
  const caption = form.get('caption');

  if (!(file instanceof File)) return jsonError('No file provided.');
  if (!ALLOWED_BUCKETS.includes(bucket)) return jsonError('Invalid bucket.');
  if (!ALLOWED_MIME[bucket].includes(file.type)) return jsonError(`File type ${file.type} not allowed in ${bucket}.`);
  if (file.size > 20 * 1024 * 1024) return jsonError('File is too large (max 20MB).');

  const buffer = new Uint8Array(await file.arrayBuffer());

  let width: number | undefined;
  let height: number | undefined;
  if (file.type.startsWith('image/')) {
    try {
      const size = imageSize(buffer);
      width = size.width;
      height = size.height;
    } catch {
      // non-fatal; dimensions are optional
    }
  }

  const storagePath = `${crypto.randomUUID()}.${extFor(file.type)}`;

  const { error: uploadError } = await supabase.storage.from(bucket).upload(storagePath, buffer, {
    contentType: file.type,
    upsert: false,
  });

  if (uploadError) return jsonError(uploadError.message, 500);

  const { data: media, error: mediaError } = await supabase
    .from('media')
    .insert({
      storage_path: storagePath,
      bucket,
      width,
      height,
      mime_type: file.type,
      alt_text: typeof altText === 'string' && altText ? altText : null,
      caption: typeof caption === 'string' && caption ? caption : null,
    })
    .select()
    .single();

  if (mediaError) {
    await supabase.storage.from(bucket).remove([storagePath]);
    return jsonError(mediaError.message, 500);
  }

  return new Response(JSON.stringify({ media, bucket }), {
    status: 201,
    headers: { 'Content-Type': 'application/json' },
  });
};
