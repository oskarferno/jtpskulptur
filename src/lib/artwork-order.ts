import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../types/database';

// The next free "last place" for an artwork's Portfolio order (display_order)
// or Featured order (featured_display_order). New artworks — and artworks
// that become Published / Featured — are placed here, so they land at the end
// of the list unless the admin then drags them elsewhere. Gaps left by
// unpublished/unfeatured artworks are harmless: only relative order matters.
export async function nextArtworkPosition(
  supabase: SupabaseClient<Database>,
  column: 'display_order' | 'featured_display_order'
): Promise<number> {
  const { data } = await supabase
    .from('artworks')
    .select(column)
    .not(column, 'is', null)
    .order(column, { ascending: false })
    .limit(1)
    .maybeSingle();
  const current = (data as Record<string, number | null> | null)?.[column] ?? 0;
  return current + 1;
}
