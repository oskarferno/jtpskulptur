-- Allow the public (anon) contact form to insert messages directly with the
-- anon key, without needing the service_role key in the running app. Public
-- still has no select/update/delete on contact_messages (see 0002).

create policy "public can submit contact messages" on contact_messages
  for insert
  with check (true);
