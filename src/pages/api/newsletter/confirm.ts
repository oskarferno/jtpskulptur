import type { APIRoute } from 'astro';
import { getSupabaseServerClient } from '../../../lib/supabase-server';
import { sendEmail } from '../../../lib/resend';
import { renderNewsletterWelcomeEmail } from '../../../lib/email-templates';
import { getSiteUrl } from '../../../lib/site-url';

export const prerender = false;

export const GET: APIRoute = async ({ request, url, redirect }) => {
  const token = url.searchParams.get('token');
  if (!token) return redirect('/newsletter/confirmed?ok=0');

  const admin = getSupabaseServerClient();
  const { data: subscriber } = await admin
    .from('newsletter_subscribers')
    .select('id, email, status, unsubscribe_token')
    .eq('confirm_token', token)
    .maybeSingle();

  if (!subscriber) return redirect('/newsletter/confirmed?ok=0');

  if (subscriber.status !== 'confirmed') {
    await admin
      .from('newsletter_subscribers')
      .update({ status: 'confirmed', confirmed_at: new Date().toISOString() })
      .eq('id', subscriber.id);

    const siteUrl = getSiteUrl(request); // see lib/site-url.ts
    const unsubscribeUrl = `${siteUrl}/api/newsletter/unsubscribe?token=${subscriber.unsubscribe_token}`;
    const { subject, html, text } = renderNewsletterWelcomeEmail(unsubscribeUrl);
    await sendEmail({ to: subscriber.email, subject, html, text }).catch((err) =>
      console.error('[newsletter confirm] welcome email failed', err)
    );
  }

  return redirect('/newsletter/confirmed?ok=1');
};
