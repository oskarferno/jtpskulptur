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

  let body: { title?: string };
  try {
    body = await request.json();
  } catch {
    return jsonError('Invalid JSON body.');
  }

  const title = (body.title ?? '').trim();
  if (!title) return jsonError('Title is required.');

  const { data, error } = await supabase.from('exhibitions').insert({ title, published: false }).select().single();
  if (error) return jsonError(error.message, 500);

  return new Response(JSON.stringify({ exhibition: data }), {
    status: 201,
    headers: { 'Content-Type': 'application/json' },
  });
};
