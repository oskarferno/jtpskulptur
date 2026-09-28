-- JTP Skulptur — newsletter subscribers.
--
-- Double opt-in: a signup inserts a 'pending' row and gets a confirmation
-- email with confirm_token; clicking it flips the row to 'confirmed'. Only
-- 'confirmed' subscribers are ever emailed a newsletter. No consent is ever
-- implied by a purchase — checkout never touches this table.

create table newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'unsubscribed')),
  confirm_token uuid not null default gen_random_uuid(),
  unsubscribe_token uuid not null default gen_random_uuid(),
  confirmed_at timestamptz,
  unsubscribed_at timestamptz,
  source text,
  created_at timestamptz not null default now()
);

create index newsletter_subscribers_status_idx on newsletter_subscribers (status);

create table newsletter_campaigns (
  id uuid primary key default gen_random_uuid(),
  subject text not null,
  html_body text not null,
  sent_at timestamptz,
  recipient_count integer,
  created_at timestamptz not null default now()
);

alter table newsletter_subscribers enable row level security;
alter table newsletter_campaigns enable row level security;

-- No public select/update at all, even for a subscriber's own row — the
-- confirm/unsubscribe tokens must never be enumerable or guessable-by-query.
-- The public signup insert (0004's contact-form pattern) and the token-gated
-- confirm/unsubscribe actions all go through server API routes using the
-- service role, which look a row up by exact token match, never by scanning.
create policy "admin can manage newsletter_subscribers" on newsletter_subscribers
  for all using (is_admin()) with check (is_admin());

create policy "admin can manage newsletter_campaigns" on newsletter_campaigns
  for all using (is_admin()) with check (is_admin());
