-- The public insert policy on contact_messages (0004) is `with check (true)`
-- — anyone with the anon key (inherently public, shipped to every browser)
-- can insert directly via the Supabase REST API, bypassing the app's
-- honeypot/timing anti-spam checks entirely. Those checks need request
-- context the database doesn't have, but basic shape/length limits don't —
-- add them at the DB level so a direct API call can't insert unbounded junk.

alter table contact_messages
  add constraint contact_messages_name_length check (char_length(name) between 1 and 200),
  add constraint contact_messages_email_length check (char_length(email) between 3 and 320),
  add constraint contact_messages_email_shape check (email like '%_@_%.__%'),
  add constraint contact_messages_subject_length check (subject is null or char_length(subject) <= 300),
  add constraint contact_messages_message_length check (char_length(message) between 1 and 5000);

-- Fix a stale comment from 0002: contact form inserts go through the anon
-- key with RLS (see 0004), not the service role key.
comment on table contact_messages is
  'Public contact form submissions. Public can insert only (RLS, 0004); admin can read/update/delete.';
