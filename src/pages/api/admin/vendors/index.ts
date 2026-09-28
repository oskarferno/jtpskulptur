import type { APIRoute } from 'astro';

export const prerender = false;

function jsonError(message: string, status = 400) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export const POST: APIRoute = async ({ request, locals }) => {
  const supabase = locals.supabase!;

  let body: { name?: string };
  try {
    body = await request.json();
  } catch {
    return jsonError('Invalid JSON body.');
  }

  const name = (body.name ?? '').trim();
  if (!name) return jsonError('Name is required.');

  const { data, error } = await supabase.from('vendors').insert({ name, active: false }).select().single();

  if (error) {
    console.error('[admin vendors] create failed', error);
    return jsonError('Could not create vendor. Please try again.', 500);
  }

  return new Response(JSON.stringify({ vendor: data }), {
    status: 201,
    headers: { 'Content-Type': 'application/json' },
  });
};
