// Run with: npm test   (Node's built-in test runner; no database, no network,
// no email is ever sent — storage and the mailer are in-memory fakes.)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CONFIRM_LINK_TTL_MS,
  EMAIL_RE,
  RESEND_COOLDOWN_MS,
  confirmSubscription,
  normalizeEmail,
  requestSubscription,
  type NewsletterDeps,
  type OutgoingEmail,
  type Subscriber,
} from '../src/lib/newsletter.ts';

function setup(options: { failSend?: boolean; failUpdate?: boolean; failSecondSend?: boolean } = {}) {
  let clock = new Date('2026-10-12T10:00:00Z').getTime();
  let tokenCounter = 0;
  let idCounter = 0;
  const rows = new Map<string, Subscriber>();
  const sent: OutgoingEmail[] = [];
  const logs: string[] = [];
  let sendCalls = 0;

  const deps: NewsletterDeps = {
    store: {
      async findByEmail(email) {
        return [...rows.values()].find((r) => r.email === email) ?? null;
      },
      async findByConfirmToken(token) {
        return [...rows.values()].find((r) => r.confirm_token === token) ?? null;
      },
      async insert(email) {
        const row: Subscriber = {
          id: `id-${++idCounter}`,
          email,
          status: 'pending',
          confirm_token: `confirm-${++tokenCounter}`,
          unsubscribe_token: `unsub-${++tokenCounter}`,
          created_at: new Date(clock).toISOString(),
          confirmation_sent_at: null,
        };
        rows.set(row.id, row);
        return { ...row };
      },
      async update(id, patch) {
        if (options.failUpdate && 'status' in patch) throw new Error('db down');
        const row = rows.get(id)!;
        Object.assign(row, patch);
      },
    },
    async sendMail(email) {
      sendCalls++;
      if (options.failSend || (options.failSecondSend && sendCalls > 1)) throw new Error('Resend 403: domain not verified');
      sent.push(email);
      return { id: `provider-${sent.length}` };
    },
    now: () => new Date(clock),
    newToken: () => `confirm-${++tokenCounter}`,
    siteUrl: 'https://example.test',
    replyTo: 'studio@example.test',
    templates: {
      confirm: (url) => ({ subject: 'Confirm', html: `<a href="${url}">c</a>`, text: url }),
      welcome: (url) => ({ subject: 'Welcome', html: url, text: url }),
    },
    log: (event) => logs.push(event),
  };

  return {
    deps,
    rows,
    sent,
    logs,
    advance: (ms: number) => {
      clock += ms;
    },
    only: () => [...rows.values()][0],
  };
}

const input = { email: 'new@person.test', source: 'footer' };

test('new signup: saved as pending, one confirmation email accepted, link carries the token', async () => {
  const t = setup();
  const result = await requestSubscription(input, t.deps);
  assert.equal(result.kind, 'email_sent');
  assert.equal(t.rows.size, 1);
  assert.equal(t.only().status, 'pending');
  assert.equal(t.sent.length, 1);
  assert.equal(t.sent[0].to, 'new@person.test');
  assert.equal(t.sent[0].replyTo, 'studio@example.test');
  assert.ok(t.sent[0].text.includes(`https://example.test/api/newsletter/confirm?token=${t.only().confirm_token}`));
  assert.ok(t.only().confirmation_sent_at, 'send time is recorded once the provider accepts');
});

test('provider failure on a new signup is reported, not hidden — and the retry is not throttled', async () => {
  const t = setup({ failSend: true });
  const result = await requestSubscription(input, t.deps);
  assert.equal(result.kind, 'email_failed');
  assert.equal(t.sent.length, 0);
  assert.equal(t.only().status, 'pending');
  assert.equal(t.only().confirmation_sent_at, null, 'nothing was sent, so nothing is recorded as sent');
  // Provider recovers; the very next attempt (no waiting) sends.
  t.deps.sendMail = async (email) => {
    t.sent.push(email);
    return { id: 'provider-ok' };
  };
  const retry = await requestSubscription(input, t.deps);
  assert.equal(retry.kind, 'email_sent');
  assert.equal(t.sent.length, 1);
  assert.equal(t.rows.size, 1, 'still one row, no duplicate subscriber');
});

test('already confirmed: nothing is sent', async () => {
  const t = setup();
  await requestSubscription(input, t.deps);
  t.only().status = 'confirmed';
  t.sent.length = 0;
  const result = await requestSubscription(input, t.deps);
  assert.equal(result.kind, 'already_confirmed');
  assert.equal(t.sent.length, 0);
});

test('repeat submission inside the cooldown does not send a second email', async () => {
  const t = setup();
  await requestSubscription(input, t.deps);
  t.advance(RESEND_COOLDOWN_MS - 1000);
  const again = await requestSubscription(input, t.deps);
  assert.equal(again.kind, 'recently_sent');
  assert.equal(t.sent.length, 1);
});

test('repeat submission after the cooldown re-sends the same, still-valid link', async () => {
  const t = setup();
  await requestSubscription(input, t.deps);
  const token = t.only().confirm_token;
  t.advance(RESEND_COOLDOWN_MS + 1000);
  const again = await requestSubscription(input, t.deps);
  assert.equal(again.kind, 'email_sent');
  assert.equal(t.sent.length, 2);
  assert.equal(t.only().confirm_token, token);
});

test('when the old link has expired, a fresh signup gets a new link and the old one stops working', async () => {
  const t = setup();
  await requestSubscription(input, t.deps);
  const oldToken = t.only().confirm_token;
  t.advance(CONFIRM_LINK_TTL_MS + 1000);
  const again = await requestSubscription(input, t.deps);
  assert.equal(again.kind, 'email_sent');
  assert.notEqual(t.only().confirm_token, oldToken);
  assert.ok(t.sent[1].text.includes(t.only().confirm_token));
  assert.equal((await confirmSubscription(oldToken, t.deps)).kind, 'invalid');
  assert.equal((await confirmSubscription(t.only().confirm_token, t.deps)).kind, 'confirmed');
});

test('unsubscribed address signing up again: pending with a new token, only subscribed after confirming', async () => {
  const t = setup();
  await requestSubscription(input, t.deps);
  const oldToken = t.only().confirm_token;
  await confirmSubscription(oldToken, t.deps);
  t.only().status = 'unsubscribed';
  t.sent.length = 0;

  const result = await requestSubscription(input, t.deps);
  assert.equal(result.kind, 'email_sent');
  assert.equal(t.only().status, 'pending');
  assert.notEqual(t.only().confirm_token, oldToken);
  assert.equal(t.sent.length, 1);
  // An old email can't revive an unsubscribed/pending address.
  assert.equal((await confirmSubscription(oldToken, t.deps)).kind, 'invalid');
  assert.equal(t.only().status, 'pending');
  assert.equal((await confirmSubscription(t.only().confirm_token, t.deps)).kind, 'confirmed');
});

test('unsubscribed address + provider failure: reported, and retrying immediately is allowed', async () => {
  const t = setup();
  await requestSubscription(input, t.deps);
  t.only().status = 'unsubscribed';
  t.deps.sendMail = async () => {
    throw new Error('Resend 429');
  };
  const failed = await requestSubscription(input, t.deps);
  assert.equal(failed.kind, 'email_failed');
  assert.equal(t.only().confirmation_sent_at, null);
  t.deps.sendMail = async (email) => {
    t.sent.push(email);
    return { id: 'ok' };
  };
  assert.equal((await requestSubscription(input, t.deps)).kind, 'email_sent');
});

test('confirm: valid link confirms and sends the welcome email with an unsubscribe link; a second click is harmless', async () => {
  const t = setup();
  await requestSubscription(input, t.deps);
  t.sent.length = 0;
  const first = await confirmSubscription(t.only().confirm_token, t.deps);
  assert.equal(first.kind, 'confirmed');
  assert.equal(t.only().status, 'confirmed');
  assert.equal(t.sent.length, 1);
  assert.ok(t.sent[0].text.includes(`/api/newsletter/unsubscribe?token=${t.only().unsubscribe_token}`));
  const second = await confirmSubscription(t.only().confirm_token, t.deps);
  assert.equal(second.kind, 'already_confirmed');
  assert.equal(t.sent.length, 1, 'no second welcome email');
});

test('confirm: expired link is refused and the status is unchanged', async () => {
  const t = setup();
  await requestSubscription(input, t.deps);
  t.advance(CONFIRM_LINK_TTL_MS + 1000);
  const result = await confirmSubscription(t.only().confirm_token, t.deps);
  assert.equal(result.kind, 'expired');
  assert.equal(t.only().status, 'pending');
});

test('confirm: unknown or missing token is invalid', async () => {
  const t = setup();
  assert.equal((await confirmSubscription('nope', t.deps)).kind, 'invalid');
  assert.equal((await confirmSubscription(null, t.deps)).kind, 'invalid');
});

test('confirm: a failing welcome email does not undo the confirmation', async () => {
  const t = setup({ failSecondSend: true });
  await requestSubscription(input, t.deps);
  const result = await confirmSubscription(t.only().confirm_token, t.deps);
  assert.equal(result.kind, 'confirmed');
  assert.equal(t.only().status, 'confirmed');
  assert.ok(t.logs.includes('welcome email failed'));
});

test('confirm: if the status change cannot be saved it throws, so nobody is told they are subscribed', async () => {
  const t = setup({ failUpdate: true });
  await requestSubscription(input, t.deps);
  await assert.rejects(() => confirmSubscription(t.only().confirm_token, t.deps), /db down/);
  assert.equal(t.only().status, 'pending');
});

test('failing to record the send time never turns an accepted email into a reported failure', async () => {
  const t = setup();
  const realUpdate = t.deps.store.update;
  t.deps.store.update = async (id, patch) => {
    if ('confirmation_sent_at' in patch) throw new Error('column does not exist');
    return realUpdate(id, patch);
  };
  const result = await requestSubscription(input, t.deps);
  assert.equal(result.kind, 'email_sent');
  assert.equal(t.sent.length, 1);
});

test('email normalisation and validation', () => {
  assert.equal(normalizeEmail('  Foo@Bar.COM '), 'foo@bar.com');
  assert.equal(normalizeEmail(null), '');
  for (const ok of ['a@b.co', 'first.last+tag@sub.example.org']) assert.ok(EMAIL_RE.test(ok), ok);
  for (const bad of ['', 'plain', 'a@b', 'a b@c.de', '@x.com', 'a@@b.co']) assert.ok(!EMAIL_RE.test(bad), bad);
});
