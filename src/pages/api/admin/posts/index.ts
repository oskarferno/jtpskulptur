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

  let body: { title?: string; slug?: string };
  try {
    body = await request.json();
  } catch {
    return jsonError('Invalid JSON body.');
  }

  const title = (body.title ?? '').trim();
  const slug = (body.slug ?? '').trim();

  if (!title) return jsonError('Title is required.');
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) {
    return jsonError('Slug must be lowercase letters, numbers, and hyphens only.');
  }

  const { data, error } = await supabase.from('posts').insert({ title, slug, published: false }).select().single();
  if (error) return jsonError(error.message, 500);

  return new Response(JSON.stringify({ post: data }), {
    status: 201,
    headers: { 'Content-Type': 'application/json' },
  });
};
