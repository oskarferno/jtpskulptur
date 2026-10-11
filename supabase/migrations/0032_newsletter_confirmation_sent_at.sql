-- JTP Skulptur — newsletter: remember when the confirmation email last went out.
--
-- Until now a pending subscriber had no record of when (or whether) their
-- confirmation email was sent, so (1) every repeat submission sent another
-- email straight away — double emails from an impatient retry, and a way to
-- flood someone's inbox through the signup form — and (2) confirmation links
-- never expired, because there was nothing to measure their age from.
--
-- confirmation_sent_at is set only once the email provider has ACCEPTED the
-- message (see src/lib/newsletter.ts), so a send that failed leaves it null
-- and the visitor can retry at once. Code treats null as "use created_at", so
-- existing rows need no backfill, and signup keeps working if the code is
-- deployed before this is applied (the cooldown/expiry just can't act yet).
--
-- Access model: a nullable column on an existing table. newsletter_subscribers
-- has RLS enabled with admin-only policies and no public access at all; every
-- public signup/confirm/unsubscribe goes through server routes using the
-- service role. Nothing is granted, no policy changes, nothing is loosened.
alter table newsletter_subscribers
  add column confirmation_sent_at timestamptz;
