-- JTP Skulptur — allow an admin profile to also act as a vendor.
-- Previously is_vendor()/current_vendor_id() hard-required role='vendor',
-- so a single profiles row could never have both admin and vendor RLS
-- access — even setting vendor_id on an admin's own row did nothing, since
-- these two functions are the actual security boundary vendor-scoped
-- policies rely on (middleware.ts is defense-in-depth on top of this, not
-- the boundary itself). Loosened to accept either role, still gated on
-- vendor_id actually being set — this changes nothing for existing admin
-- profiles that have no vendor_id (e.g. the original admin, Jens Wollinger).

create or replace function is_vendor() returns boolean as $$
  select exists (
    select 1 from profiles where id = auth.uid() and role in ('admin', 'vendor') and vendor_id is not null
  );
$$ language sql stable security definer set search_path = public;

create or replace function current_vendor_id() returns uuid as $$
  select vendor_id from profiles where id = auth.uid() and role in ('admin', 'vendor');
$$ language sql stable security definer set search_path = public;
