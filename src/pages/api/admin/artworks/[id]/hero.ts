import type { APIRoute } from 'astro';

export const prerender = false;

function jsonError(message: string, status = 400) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// Sets this artwork as the single homepage hero, atomically un-setting
// whichever artwork previously held it — see set_homepage_hero() in
// migration 0019_homepage_hero.sql. A plain field PATCH can't do this
// safely in one step: two separate UPDATEs from here (unset old, set new)
// aren't atomic, and a partial unique index on artworks.is_homepage_hero
// means setting a second row true before the first is unset would fail
// outright.
export const POST: APIRoute = async ({ params, locals }) => {
  const supabase = locals.supabase!;
  const { id } = params;
  if (!id) return jsonError('Missing artwork id.');

  const { error } = await supabase.rpc('set_homepage_hero', { p_artwork_id: id });
  if (error) {
    console.error('[admin artworks] set hero failed', error);
    return jsonError('Could not set as homepage hero. Please try again.', 500);
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};

// Unsets this artwork as hero, if it currently is one — always safe (never
// violates the unique index), so a plain update is fine here.
export const DELETE: APIRoute = async ({ params, locals }) => {
  const supabase = locals.supabase!;
  const { id } = params;
  if (!id) return jsonError('Missing artwork id.');

  const { error } = await supabase.from('artworks').update({ is_homepage_hero: false }).eq('id', id);
  if (error) {
    console.error('[admin artworks] unset hero failed', error);
    return jsonError('Could not update. Please try again.', 500);
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
