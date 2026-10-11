// Newsletter signup / confirmation logic, with its dependencies (subscriber
// storage, the mailer, the clock) passed in, so it can be tested without a
// database or an email provider — see tests/newsletter.test.ts. The routes in
// src/pages/api/newsletter/ are thin adapters around these functions.
//
// The flow is double opt-in (see migration 0012): a signup stores a 'pending'
// subscriber and emails a confirmation link; clicking it makes the subscriber
// 'confirmed'. Only confirmed subscribers are ever sent a newsletter.
//
// Deliberately self-contained (no imports from the rest of src/) so Node's
// built-in test runner can load it directly.

export type SubscriberStatus = 'pending' | 'confirmed' | 'unsubscribed';

export interface Subscriber {
  id: string;
  email: string;
  status: SubscriberStatus;
  confirm_token: string;
  unsubscribe_token: string;
  created_at: string;
  // When the latest confirmation email was handed to the provider. Null for
  // rows from before migration 0032 — treated as created_at.
  confirmation_sent_at: string | null;
}

export interface NewsletterStore {
  findByEmail(email: string): Promise<Subscriber | null>;
  findByConfirmToken(token: string): Promise<Subscriber | null>;
  insert(email: string, source: string | null): Promise<Subscriber>;
  update(id: string, patch: Partial<Pick<Subscriber, 'status' | 'confirm_token' | 'confirmation_sent_at'> & {
    confirmed_at: string | null;
    unsubscribed_at: string | null;
  }>): Promise<void>;
}

export interface OutgoingEmail {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
}

// Resolves with the provider's id for the message once the provider has
// ACCEPTED it (which is not the same as delivered), and rejects if the
// provider refused it or could not be reached.
export type SendMail = (email: OutgoingEmail) => Promise<{ id: string | null }>;

export interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

export interface NewsletterDeps {
  store: NewsletterStore;
  sendMail: SendMail;
  now: () => Date;
  newToken: () => string;
  siteUrl: string;
  replyTo?: string;
  templates: {
    confirm: (confirmUrl: string) => EmailTemplate;
    welcome: (unsubscribeUrl: string) => EmailTemplate;
  };
  log?: (event: string, details?: Record<string, unknown>) => void;
}

// A second signup for an address that is still waiting to confirm does not
// send another email within this window — stops accidental double emails
// (double-click, impatient retry) and stops the form being used to flood
// someone's inbox. After it, retrying sends a fresh email.
export const RESEND_COOLDOWN_MS = 2 * 60 * 1000;

// How long a confirmation link stays valid after the email that carries it
// was sent. Past this, the link says "expired" and the visitor signs up
// again to get a new one.
export const CONFIRM_LINK_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(value: unknown): string {
  return String(value ?? '').trim().toLowerCase();
}

export type SubscribeOutcome =
  // A confirmation email was accepted by the provider (new signup, resend, or
  // a returning unsubscribed address).
  | { kind: 'email_sent'; providerId: string | null }
  // Pending, and a confirmation email went out inside the cooldown — nothing
  // new is sent.
  | { kind: 'recently_sent' }
  // Already confirmed — nothing to send. The route answers exactly as for
  // 'email_sent', so the form can't be used to find out who is subscribed.
  | { kind: 'already_confirmed' }
  // The address is saved/pending but the provider refused or couldn't be
  // reached, so no email is on its way.
  | { kind: 'email_failed'; reason: string };

function describeError(error: unknown): string {
  if (error instanceof Error) return error.message.slice(0, 200);
  return 'unknown error';
}

async function sendConfirmation(
  deps: NewsletterDeps,
  subscriber: Subscriber,
  confirmToken: string
): Promise<SubscribeOutcome> {
  const confirmUrl = `${deps.siteUrl}/api/newsletter/confirm?token=${confirmToken}`;
  const template = deps.templates.confirm(confirmUrl);
  let providerId: string | null;
  try {
    ({ id: providerId } = await deps.sendMail({ to: subscriber.email, replyTo: deps.replyTo, ...template }));
  } catch (error) {
    deps.log?.('confirmation email failed', { reason: describeError(error) });
    return { kind: 'email_failed', reason: describeError(error) };
  }
  deps.log?.('confirmation email accepted by provider', { providerId });

  // Only now has the provider accepted it, so only now is it recorded as sent.
  // Failing to record that never turns a sent email into a reported failure —
  // the worst case is that the cooldown/expiry clock isn't started.
  try {
    await deps.store.update(subscriber.id, { confirmation_sent_at: deps.now().toISOString() });
  } catch (error) {
    deps.log?.('could not record confirmation send time', { reason: describeError(error) });
  }
  return { kind: 'email_sent', providerId };
}

/**
 * Handles one signup. Throws only if the subscriber could not be saved at all;
 * a failure to email is reported as an outcome, never hidden.
 */
export async function requestSubscription(
  input: { email: string; source: string | null },
  deps: NewsletterDeps
): Promise<SubscribeOutcome> {
  const existing = await deps.store.findByEmail(input.email);

  if (!existing) {
    const created = await deps.store.insert(input.email, input.source);
    return sendConfirmation(deps, created, created.confirm_token);
  }

  if (existing.status === 'confirmed') return { kind: 'already_confirmed' };

  const sentAt = existing.confirmation_sent_at ?? existing.created_at;
  const sinceLastSend = deps.now().getTime() - new Date(sentAt).getTime();

  if (existing.status === 'pending') {
    // Within the cooldown nothing is sent. (A row whose last send FAILED has
    // confirmation_sent_at unset, so a retry is never blocked by an email
    // that was never actually sent.)
    if (existing.confirmation_sent_at && sinceLastSend < RESEND_COOLDOWN_MS) {
      return { kind: 'recently_sent' };
    }
    // The old link may already be expired; issue a fresh one then, so the
    // email always carries a link that works.
    const linkExpired = sinceLastSend > CONFIRM_LINK_TTL_MS;
    const token = linkExpired ? deps.newToken() : existing.confirm_token;
    if (linkExpired) await deps.store.update(existing.id, { confirm_token: token });
    return sendConfirmation(deps, existing, token);
  }

  // 'unsubscribed': signing up again starts the confirmation process again —
  // they stay unsubscribed (never emailed a newsletter) until they confirm.
  const token = deps.newToken();
  await deps.store.update(existing.id, {
    status: 'pending',
    unsubscribed_at: null,
    confirm_token: token,
    confirmation_sent_at: null,
  });
  return sendConfirmation(deps, existing, token);
}

export type ConfirmOutcome =
  | { kind: 'confirmed' }
  | { kind: 'already_confirmed' }
  | { kind: 'invalid' }
  | { kind: 'expired' };

/**
 * Handles a click on the confirmation link. Throws if the status change could
 * not be saved (so the visitor is never told they're subscribed when they
 * aren't); a failed welcome email never undoes a successful confirmation.
 */
export async function confirmSubscription(token: string | null, deps: NewsletterDeps): Promise<ConfirmOutcome> {
  if (!token) return { kind: 'invalid' };

  const subscriber = await deps.store.findByConfirmToken(token);
  if (!subscriber) return { kind: 'invalid' };

  if (subscriber.status === 'confirmed') return { kind: 'already_confirmed' };

  // A link is only good for the email it came with: an unsubscribed address
  // that hasn't signed up again can't be revived by an old email.
  if (subscriber.status === 'unsubscribed') return { kind: 'invalid' };

  const sentAt = subscriber.confirmation_sent_at ?? subscriber.created_at;
  if (deps.now().getTime() - new Date(sentAt).getTime() > CONFIRM_LINK_TTL_MS) return { kind: 'expired' };

  await deps.store.update(subscriber.id, { status: 'confirmed', confirmed_at: deps.now().toISOString() });

  const unsubscribeUrl = `${deps.siteUrl}/api/newsletter/unsubscribe?token=${subscriber.unsubscribe_token}`;
  try {
    const { id } = await deps.sendMail({
      to: subscriber.email,
      replyTo: deps.replyTo,
      ...deps.templates.welcome(unsubscribeUrl),
    });
    deps.log?.('welcome email accepted by provider', { providerId: id });
  } catch (error) {
    deps.log?.('welcome email failed', { reason: describeError(error) });
  }

  return { kind: 'confirmed' };
}
