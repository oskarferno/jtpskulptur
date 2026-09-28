import type { APIContext } from 'astro';

/**
 * Verifies the current request's user is actually an admin — required in any
 * /api/admin/* route that uses the service-role client (which bypasses RLS
 * entirely). The middleware's /api/admin gate only checks that *some* user
 * is authenticated, not their role; for routes using the RLS-scoped
 * `locals.supabase` client that's fine, because is_admin() policies are the
 * real boundary. That protection doesn't exist for service-role routes, so
 * they must check this themselves. Returns true if the caller is an admin;
 * otherwise the second element is the 401/403 Response to return as-is.
 */
export async function requireAdmin(locals: APIContext['locals']): Promise<[true, null] | [false, Response]> {
  if (!locals.user || !locals.supabase) {
    return [false, new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })];
  }
  const { data: profile } = await locals.supabase.from('profiles').select('role').eq('id', locals.user.id).maybeSingle();
  if (profile?.role !== 'admin') {
    return [false, new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 })];
  }
  return [true, null];
}
