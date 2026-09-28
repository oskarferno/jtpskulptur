import type { APIRoute } from 'astro';

export const prerender = false;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const KINDS = ['portfolio', 'featured'] as const;

function jsonError(message: string, status = 400) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// Saves a drag-and-drop result: `ids` in their new order, position 1..n.
// The work happens in reorder_artworks() (migration 0025) as one atomic
// statement; it runs as the signed-in user, so RLS and its own is_admin()
// check — not just this route's middleware — decide who may reorder.
export const POST: APIRoute = async ({ request, locals }) => {
  const supabase = locals.supabase!;

  let body: { kind?: unknown; ids?: unknown };
  try {
    body = await request.json();
  } catch {
    return jsonError('Invalid JSON body.');
  }

  const kind = KINDS.find((k) => k === body.kind);
  if (!kind) return jsonError('Invalid ordering type.');

  const ids = body.ids;
  if (!Array.isArray(ids) || ids.length === 0 || ids.length > 500 || !ids.every((id) => typeof id === 'string' && UUID_RE.test(id))) {
    return jsonError('Invalid artwork list.');
  }
  if (new Set(ids).size !== ids.length) return jsonError('Duplicate artworks in list.');

  const { error } = await supabase.rpc('reorder_artworks', { p_ids: ids as string[], p_kind: kind });
  if (error) {
    console.error('[admin artworks] reorder failed', error);
    return jsonError('Could not save the new order. Please try again.', 500);
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
