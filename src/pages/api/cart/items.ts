import type { APIRoute } from 'astro';
import { getSupabaseClient } from '../../../lib/supabase';
import { publicMediaUrl } from '../../../lib/media';

export const prerender = false;

const MAX_IDS = 50;

interface CartItemView {
  type: 'artwork' | 'product';
  id: string;
  slug: string;
  name: string;
  price: number;
  currency: string;
  inventory: number;
  image: string | null;
}

export const GET: APIRoute = async ({ url }) => {
  const artworkIds = (url.searchParams.get('artworkIds') ?? '').split(',').map((id) => id.trim()).filter(Boolean).slice(0, MAX_IDS);
  const productIds = (url.searchParams.get('productIds') ?? '').split(',').map((id) => id.trim()).filter(Boolean).slice(0, MAX_IDS);

  if (artworkIds.length === 0 && productIds.length === 0) {
    return new Response(JSON.stringify({ items: [] }), { headers: { 'Content-Type': 'application/json' } });
  }

  const supabase = getSupabaseClient();

  // Anon-key client: RLS means a no-longer-purchasable artwork/product id
  // simply comes back absent here, never leaked with its data — same
  // enforcement as every other public page. inventory > 0 matches exactly
  // what the Shop listing itself requires (src/pages/shop/index.astro) — an
  // item that's technically still 'available'/'active' but sold out isn't
  // purchasable either, so the cart must not treat it as valid.
  const [{ data: artworks }, { data: products }] = await Promise.all([
    artworkIds.length > 0
      ? supabase
          .from('artworks')
          .select('id, slug, title, price, currency, inventory, media:primary_image_id (bucket, storage_path, alt_text)')
          .in('id', artworkIds)
          .eq('published', true)
          .eq('availability', 'available')
          .gt('inventory', 0)
      : Promise.resolve({ data: [] }),
    productIds.length > 0
      ? supabase
          .from('products')
          .select('id, slug, name, price, currency, inventory, primary_image:primary_image_id (bucket, storage_path, alt_text)')
          .in('id', productIds)
          .eq('active', true)
          .gt('inventory', 0)
      : Promise.resolve({ data: [] }),
  ]);

  const items: CartItemView[] = [
    ...(artworks ?? [])
      .filter((a) => a.price !== null)
      .map((a): CartItemView => ({
        type: 'artwork',
        id: a.id,
        slug: a.slug,
        name: a.title,
        price: a.price!,
        currency: a.currency,
        inventory: a.inventory,
        image: a.media ? publicMediaUrl(a.media.bucket, a.media.storage_path) : null,
      })),
    ...(products ?? []).map((p): CartItemView => ({
      type: 'product',
      id: p.id,
      slug: p.slug,
      name: p.name,
      price: p.price,
      currency: p.currency,
      inventory: p.inventory,
      image: p.primary_image ? publicMediaUrl(p.primary_image.bucket, p.primary_image.storage_path) : null,
    })),
  ];

  return new Response(JSON.stringify({ items }), { headers: { 'Content-Type': 'application/json' } });
};
