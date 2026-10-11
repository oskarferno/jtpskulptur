import type { APIRoute } from 'astro';
import { getSupabaseServerClient } from '../../../lib/supabase-server';

export const prerender = false;

export const GET: APIRoute = async ({ url, redirect }) => {
  const token = url.searchParams.get('token');
  if (!token) return redirect('/newsletter/unsubscribed?ok=0');

  const admin = getSupabaseServerClient();
  const { data: subscriber } = await admin
    .from('newsletter_subscribers')
    .select('id')
    .eq('unsubscribe_token', token)
    .maybeSingle();

  if (!subscriber) return redirect('/newsletter/unsubscribed?ok=0');

  const { error } = await admin
    .from('newsletter_subscribers')
    .update({ status: 'unsubscribed', unsubscribed_at: new Date().toISOString() })
    .eq('id', subscriber.id);

  // Was previously unchecked, so a failed save still said "Unsubscribed" while
  // the address stayed on the list. Never claim an unsubscribe that didn't happen.
  if (error) {
    console.error('[newsletter unsubscribe] could not save:', error.message);
    return redirect('/newsletter/unsubscribed?ok=0&reason=error');
  }

  return redirect('/newsletter/unsubscribed?ok=1');
};
