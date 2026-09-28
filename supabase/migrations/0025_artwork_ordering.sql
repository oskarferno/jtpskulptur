-- JTP Skulptur — admin-controlled artwork ordering.
--
-- artworks.display_order already exists (integer, default 0, lower = first)
-- and is what Portfolio, the homepage and the artwork prev/next links already
-- sort by — but nothing in Admin could change it, imported rows share values
-- (ties), and a new artwork defaulted to 0, i.e. the very front. This
-- migration does not add a second "portfolio order": display_order stays the
-- Portfolio order.
--
-- Featured needs its own position (an artwork can be #8 in the Portfolio and
-- #1 in the homepage's Featured Work), so it gets a separate column.
--
-- Nullable on purpose: NULL means "no featured position yet". Public queries
-- sort `featured_display_order asc nulls last, display_order asc`, so every
-- existing row keeps working (and keeps today's order) with no backfill. It
-- is also never cleared when an artwork is un-featured, so the value is
-- preserved; the Admin API gives it a fresh last-place value when the
-- artwork is featured again.
alter table artworks
  add column featured_display_order integer;

-- Applies an Admin drag-and-drop result in one atomic statement: position N
-- (1-based) for the N-th id in p_ids. p_kind 'portfolio' writes
-- display_order, 'featured' writes featured_display_order. Only rows whose
-- value actually changes are touched, so updated_at (and the sitemap
-- lastmod derived from it) isn't bumped for artworks that merely kept their
-- place.
--
-- Access model — three separate layers, none of them loosened:
--   * privileges: EXECUTE is revoked from PUBLIC/anon and granted to
--     `authenticated` only (Postgres grants EXECUTE to PUBLIC by default);
--   * RLS: the function is SECURITY INVOKER, so the UPDATE runs under the
--     caller's own RLS — "admin can update artworks" still decides;
--   * an explicit is_admin() check, because an RLS-filtered UPDATE would
--     otherwise "succeed" silently on zero rows for a non-admin.
-- The table's column privileges and policies are untouched.
create function reorder_artworks(p_ids uuid[], p_kind text)
returns void as $$
begin
  if not is_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  if p_kind = 'portfolio' then
    update artworks a set display_order = t.pos
    from unnest(p_ids) with ordinality as t (id, pos)
    where a.id = t.id and a.display_order is distinct from t.pos;
  elsif p_kind = 'featured' then
    update artworks a set featured_display_order = t.pos
    from unnest(p_ids) with ordinality as t (id, pos)
    where a.id = t.id and a.featured_display_order is distinct from t.pos;
  else
    raise exception 'invalid kind: %', p_kind;
  end if;
end;
$$ language plpgsql security invoker set search_path = public;

revoke execute on function reorder_artworks(uuid[], text) from public, anon;
grant execute on function reorder_artworks(uuid[], text) to authenticated;
