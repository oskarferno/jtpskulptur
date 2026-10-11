import type { APIRoute } from 'astro';
import { confirmSubscription } from '../../../lib/newsletter';
import { getNewsletterDeps } from '../../../lib/newsletter-deps';

export const prerender = false;

export const GET: APIRoute = async ({ request, url, redirect }) => {
  try {
    const outcome = await confirmSubscription(url.searchParams.get('token'), getNewsletterDeps(request));
    if (outcome.kind === 'confirmed' || outcome.kind === 'already_confirmed') {
      return redirect('/newsletter/confirmed?ok=1');
    }
    return redirect(`/newsletter/confirmed?ok=0${outcome.kind === 'expired' ? '&reason=expired' : ''}`);
  } catch (error) {
    // The status change couldn't be saved — never claim they're subscribed.
    console.error('[newsletter confirm] could not confirm:', error instanceof Error ? error.message : error);
    return redirect('/newsletter/confirmed?ok=0&reason=error');
  }
};
