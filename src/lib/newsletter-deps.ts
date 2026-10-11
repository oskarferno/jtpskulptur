import { env } from 'cloudflare:workers';
import { getSupabaseServerClient } from './supabase-server';
import { sendEmail } from './resend';
import { getSiteUrl } from './site-url';
import { renderNewsletterConfirmEmail, renderNewsletterWelcomeEmail } from './email-templates';
import type { NewsletterDeps, NewsletterStore, SendMail, Subscriber } from './newsletter';

// Where a plain "Reply" to a newsletter confirmation/welcome email goes. The
// From address stays the verified no-reply@ sender (no SPF/DKIM trouble); this
// just means a subscriber who replies reaches the studio instead of a void.
const STUDIO_REPLY_TO = 'jtp.skulptur@gmail.com';

type Row = Record<string, unknown>;

function toSubscriber(row: Row): Subscriber {
  return {
    id: String(row.id),
    email: String(row.email),
    status: row.status as Subscriber['status'],
    confirm_token: String(row.confirm_token),
    unsubscribe_token: String(row.unsubscribe_token),
    created_at: String(row.created_at),
    // Absent until migration 0032 is applied — treated as "not recorded".
    confirmation_sent_at: (row.confirmation_sent_at as string | null | undefined) ?? null,
  };
}

// Subscribers in the real database. `select('*')` rather than naming the
// 0032 column, so signup keeps working if this is deployed before that
// migration is applied (the cooldown/expiry just can't take effect yet).
function supabaseStore(): NewsletterStore {
  const admin = getSupabaseServerClient();
  const table = () => admin.from('newsletter_subscribers');
  return {
    async findByEmail(email) {
      const { data, error } = await table().select('*').eq('email', email).maybeSingle();
      if (error) throw new Error(`newsletter lookup failed: ${error.message}`);
      return data ? toSubscriber(data as Row) : null;
    },
    async findByConfirmToken(token) {
      const { data, error } = await table().select('*').eq('confirm_token', token).maybeSingle();
      if (error) throw new Error(`newsletter lookup failed: ${error.message}`);
      return data ? toSubscriber(data as Row) : null;
    },
    async insert(email, source) {
      const { data, error } = await table().insert({ email, source }).select('*').single();
      if (error || !data) throw new Error(`newsletter insert failed: ${error?.message ?? 'no row returned'}`);
      return toSubscriber(data as Row);
    },
    async update(id, patch) {
      const { error } = await table().update(patch).eq('id', id);
      if (error) throw new Error(`newsletter update failed: ${error.message}`);
    },
  };
}

// ---------------------------------------------------------------------------
// Local preview only. The dev server's .dev.vars points at the PRODUCTION
// Supabase project, so to test signups without writing to the real
// subscriber list, `astro dev` can run with NEWSLETTER_TEST_MODE=memory: an
// in-memory list, and a mailer that only really sends to an allow-list of
// controlled test addresses. Everything in this section sits behind
// import.meta.env.DEV, which the production build replaces with `false`:
// there testConfig() compiles to `return null` (the env var names don't appear
// in the output), so the helpers below are unreachable dead code. Checked in
// dist/ — keep it that way if this file changes.
// ---------------------------------------------------------------------------
interface TestConfig {
  allow: string[];
}

function testConfig(): TestConfig | null {
  if (!import.meta.env.DEV) return null;
  const vars = env as unknown as Record<string, string | undefined>;
  if (vars.NEWSLETTER_TEST_MODE !== 'memory') return null;
  return { allow: (vars.NEWSLETTER_TEST_ALLOW ?? '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean) };
}

let memoryRows: Subscriber[] | undefined;
function memoryStore(): NewsletterStore {
  const rows = (memoryRows ??= []);
  return {
    async findByEmail(email) {
      return rows.find((r) => r.email === email) ?? null;
    },
    async findByConfirmToken(token) {
      return rows.find((r) => r.confirm_token === token) ?? null;
    },
    async insert(email) {
      const row: Subscriber = {
        id: crypto.randomUUID(),
        email,
        status: 'pending',
        confirm_token: crypto.randomUUID(),
        unsubscribe_token: crypto.randomUUID(),
        created_at: new Date().toISOString(),
        confirmation_sent_at: null,
      };
      rows.push(row);
      return { ...row };
    },
    async update(id, patch) {
      Object.assign(rows.find((r) => r.id === id)!, patch);
    },
  };
}

function testMailer(config: TestConfig): SendMail {
  return async (email) => {
    const to = email.to.toLowerCase();
    // Addresses starting "fail-" simulate the provider refusing the request.
    if (to.startsWith('fail-')) throw new Error('Resend 403: simulated provider rejection');
    if (config.allow.includes(to)) return sendEmail(email); // a real send, to a controlled address
    console.info('[newsletter test] captured (not sent):', email.subject, '→', email.text.match(/https?:\S+/)?.[0]);
    return { id: 'captured' };
  };
}

export function getNewsletterDeps(request: Request): NewsletterDeps {
  const test = testConfig();
  return {
    store: test ? memoryStore() : supabaseStore(),
    sendMail: test ? testMailer(test) : sendEmail,
    now: () => new Date(),
    newToken: () => crypto.randomUUID(),
    // In test mode links must point at the preview server actually handling
    // the request, not the production domain PUBLIC_SITE_URL names.
    siteUrl: test ? new URL(request.url).origin : getSiteUrl(request),
    replyTo: STUDIO_REPLY_TO,
    templates: { confirm: renderNewsletterConfirmEmail, welcome: renderNewsletterWelcomeEmail },
    // Event names and provider ids only — never an email address or a token.
    log: (event, details) => console.info('[newsletter]', event, details ?? ''),
  };
}
