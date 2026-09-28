import Stripe from 'stripe';
import { getEnv } from './env';

// Lazily created for the same reason as getSupabaseClient(): Cloudflare's
// env bindings aren't reliably populated at module-evaluation time.
let client: Stripe | undefined;

export function getStripeClient(): Stripe {
  if (!client) {
    const { STRIPE_SECRET_KEY } = getEnv();
    if (!STRIPE_SECRET_KEY) {
      throw new Error('Missing STRIPE_SECRET_KEY');
    }
    client = new Stripe(STRIPE_SECRET_KEY, {
      // The Workers runtime has no Node net/http/tls modules — Stripe's
      // default HTTP client needs to be swapped for its fetch-based one.
      httpClient: Stripe.createFetchHttpClient(),
      // Avoids a dependency on Node's Math.random-seeded crypto for
      // idempotency-key generation; the fetch client already covers actual
      // network calls, this only affects an internal telemetry code path.
      telemetry: false,
    });
  }
  return client;
}

/**
 * Verifies a Stripe webhook signature. Cloudflare Workers has no Node
 * `crypto` module, only the async WebCrypto API — Stripe's sync
 * `constructEvent()` throws ("SubtleCryptoProvider cannot be used in a
 * synchronous context") on every single call in this runtime.
 * `constructEventAsync()` is Stripe's own documented alternative for exactly
 * this case. Always use this, never the sync version, for the webhook route.
 */
export async function verifyStripeWebhook(rawBody: string, signature: string): Promise<Stripe.Event> {
  const { STRIPE_WEBHOOK_SECRET } = getEnv();
  if (!STRIPE_WEBHOOK_SECRET) {
    throw new Error('Missing STRIPE_WEBHOOK_SECRET');
  }
  return getStripeClient().webhooks.constructEventAsync(rawBody, signature, STRIPE_WEBHOOK_SECRET);
}
