-- JTP Skulptur — artwork enquiry context on the contact form.
--
-- Lets a visitor on an artwork's page start a Contact submission that's
-- already tied to that artwork (see "Ask about this work" on
-- portfolio/[slug].astro), without creating a second contact form or
-- email flow — this is still the same contact_messages table and the same
-- /api/contact.ts endpoint, just with two additional, optional columns.
--
-- artwork_id is never trusted from the client directly: the API route
-- re-resolves the submitted artwork slug against `artworks` server-side
-- (published only) before storing this. A general enquiry (the existing,
-- unchanged flow) simply leaves both columns at their defaults.
--
-- enquiry_type is intentionally NOT constrained to always agree with
-- "artwork_id is not null": `on delete set null` means artwork_id can
-- legitimately become null later (if that artwork is ever deleted) while
-- enquiry_type='artwork' correctly stays as a record of how the enquiry
-- originated — a strict equivalence check would make deleting an artwork
-- that has any enquiries fail outright, which is worse than a slightly
-- looser invariant. The app only ever writes the two consistently at
-- insert time (see api/contact.ts).
alter table contact_messages
  add column artwork_id uuid references artworks (id) on delete set null,
  add column enquiry_type text not null default 'general'
    check (enquiry_type in ('general', 'artwork'));

create index contact_messages_artwork_idx on contact_messages (artwork_id) where artwork_id is not null;
