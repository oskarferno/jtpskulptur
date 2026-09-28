-- JTP Skulptur — newsletter composer.
--
-- Extends newsletter_campaigns from a bare subject/html_body pair into a
-- proper draft/sent record: preview text, an optional hero image (reusing
-- the existing media table — no separate newsletter image store), an
-- optional CTA, and a status column that's the source of truth for "can
-- this still be edited / sent" rather than inferring it from sent_at being
-- null. html_body becomes content_markdown: the composer edits Markdown,
-- and HTML is rendered from it at preview/send time (src/lib/email-templates.ts),
-- never stored pre-rendered.
--
-- No existing rows to migrate (table is empty pre-production).

alter table newsletter_campaigns
  add column status text not null default 'draft' check (status in ('draft', 'sent')),
  add column preview_text text,
  add column primary_image_id uuid references media (id) on delete set null,
  add column cta_text text,
  add column cta_url text,
  add column updated_at timestamptz not null default now();

alter table newsletter_campaigns rename column html_body to content_markdown;
alter table newsletter_campaigns alter column content_markdown drop not null;
alter table newsletter_campaigns alter column content_markdown set default '';

create index newsletter_campaigns_status_idx on newsletter_campaigns (status);

create trigger newsletter_campaigns_set_updated_at before update on newsletter_campaigns
  for each row execute function set_updated_at();
