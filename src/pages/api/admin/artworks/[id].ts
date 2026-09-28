import type { APIRoute } from 'astro';
import type { Database } from '../../../../types/database';
import { nextArtworkPosition } from '../../../../lib/artwork-order';

export const prerender = false;

type ArtworkUpdate = Database['public']['Tables']['artworks']['Update'];

const EDITABLE_FIELDS = [
  'title',
  'slug',
  'year',
  'description',
  'material',
  'dimensions',
  'series',
  'category_id',
  'published',
  'featured',
  'display_order',
  'seo_title',
  'seo_description',
  'availability',
  'price',
  'currency',
  'inventory',
  'sku',
  'vendor_id',
  'primary_image_id',
  'hero_image_id',
  'hero_focal_x',
  'hero_focal_y',
] as const satisfies readonly (keyof ArtworkUpdate)[];

// is_homepage_hero is deliberately not editable here — it's exclusive
// (at most one artwork at a time, enforced by a partial unique index), so
// setting it needs the atomic swap in POST/DELETE
// /api/admin/artworks/[id]/hero.ts, not a plain field write that could
// leave two artworks flagged or silently fail the unique constraint.
const IMAGE_FIELDS = ['primary_image_id', 'hero_image_id'] as const;

const AVAILABILITY_VALUES = ['available', 'sold', 'not_for_sale'] as const;

function jsonError(message: string, status = 400) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export const PATCH: APIRoute = async ({ params, request, locals }) => {
  const supabase = locals.supabase!;
  const { id } = params;
  if (!id) return jsonError('Missing artwork id.');

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return jsonError('Invalid JSON body.');
  }

  const update: ArtworkUpdate = {};
  for (const field of EDITABLE_FIELDS) {
    if (field in body) {
      (update as Record<string, unknown>)[field] = body[field];
    }
  }

  if (typeof update.title === 'string' && update.title.trim().length === 0) {
    return jsonError('Title cannot be empty.');
  }
  if (typeof update.slug === 'string') {
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(update.slug)) {
      return jsonError('Slug must be lowercase letters, numbers, and hyphens only.');
    }
  }
  if ('availability' in update && !AVAILABILITY_VALUES.includes(update.availability as (typeof AVAILABILITY_VALUES)[number])) {
    return jsonError('Invalid availability value.');
  }
  if (typeof update.price === 'number' && (!Number.isFinite(update.price) || update.price < 0)) {
    return jsonError('Price must be a non-negative number.');
  }
  if (typeof update.inventory === 'number' && (!Number.isInteger(update.inventory) || update.inventory < 0)) {
    return jsonError('Inventory must be a non-negative whole number.');
  }
  for (const field of IMAGE_FIELDS) {
    if (field in update && update[field] !== null && typeof update[field] !== 'string') {
      return jsonError(`${field} must be a media id or null.`);
    }
  }
  for (const field of ['hero_focal_x', 'hero_focal_y'] as const) {
    if (field in update) {
      const value = update[field];
      if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > 100) {
        return jsonError(`${field} must be a whole number between 0 and 100.`);
      }
    }
  }

  // "Available" must mean genuinely purchasable — never silently save a
  // listing that would appear in Shop with no valid price. This checks the
  // *resulting* state (existing row's fields for anything this request
  // doesn't touch), not just the fields present in this one request.
  if ('availability' in update || 'price' in update) {
    const willBeAvailable = 'availability' in update ? update.availability === 'available' : undefined;
    const needsCurrentRow = willBeAvailable === undefined || (willBeAvailable && !('price' in update));

    const current = needsCurrentRow
      ? (await supabase.from('artworks').select('availability, price').eq('id', id).single()).data
      : null;

    const resolvedAvailability = 'availability' in update ? update.availability : current?.availability;
    const resolvedPrice = 'price' in update ? update.price : current?.price;

    if (resolvedAvailability === 'available' && (typeof resolvedPrice !== 'number' || resolvedPrice <= 0)) {
      return jsonError('A price is required before this artwork can be marked Available.');
    }
  }

  // Becoming Published or Featured puts the artwork last in that order (the
  // edit form re-sends both flags on every save, so only an actual
  // false → true change counts). Un-publishing / un-featuring never touches
  // the stored positions. An explicit display_order in the request wins.
  if (update.published === true || update.featured === true) {
    const { data: current } = await supabase.from('artworks').select('published, featured').eq('id', id).single();
    if (current) {
      if (update.published === true && !current.published && !('display_order' in update)) {
        update.display_order = await nextArtworkPosition(supabase, 'display_order');
      }
      if (update.featured === true && !current.featured) {
        update.featured_display_order = await nextArtworkPosition(supabase, 'featured_display_order');
      }
    }
  }

  // Replacing/removing an image can leave the old media row (and its
  // Storage file) orphaned — fetch what's currently set so it can be
  // cleaned up after a successful update, but only once we know the old
  // value is genuinely being replaced, not just re-saved unchanged.
  const touchesImages = IMAGE_FIELDS.some((f) => f in update);
  const previousImages = touchesImages
    ? (await supabase.from('artworks').select('primary_image_id, hero_image_id').eq('id', id).single()).data
    : null;

  const { data, error } = await supabase.from('artworks').update(update).eq('id', id).select().single();

  if (error) {
    console.error('[admin artworks] update failed', error);
    return jsonError('Could not save. Please try again.', 500);
  }

  if (touchesImages && previousImages) {
    const stillReferenced = (mediaId: string) => data.primary_image_id === mediaId || data.hero_image_id === mediaId;
    const orphaned = [previousImages.primary_image_id, previousImages.hero_image_id].filter(
      (mediaId): mediaId is string => !!mediaId && !stillReferenced(mediaId)
    );
    // Dedupe in case primary and hero happened to point at the same media row.
    for (const mediaId of new Set(orphaned)) {
      const { data: media } = await supabase.from('media').select('storage_path, bucket').eq('id', mediaId).single();
      await supabase.from('media').delete().eq('id', mediaId);
      if (media) {
        await supabase.storage.from(media.bucket).remove([media.storage_path]);
      }
    }
  }

  return new Response(JSON.stringify({ artwork: data }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};

export const DELETE: APIRoute = async ({ params, locals }) => {
  const supabase = locals.supabase!;
  const { id } = params;
  if (!id) return jsonError('Missing artwork id.');

  const { error } = await supabase.from('artworks').delete().eq('id', id);

  if (error) {
    console.error('[admin artworks] delete failed', error);
    return jsonError('Could not delete. Please try again.', 500);
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
