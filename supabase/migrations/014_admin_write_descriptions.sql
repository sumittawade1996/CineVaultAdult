-- 014_admin_write_descriptions.sql
-- The new "Site content" admin page (/admin/content) edits the hand-written channel intros and
-- performer bios. Until now those two tables had a public read policy and nothing else, so only
-- the service role could change them. This lets signed-in admins (public.admin_users) write them,
-- the same way 009 did for category_descriptions. Visitors still only read.

create policy "Admin insert channel_descriptions" on public.channel_descriptions
  for insert to authenticated with check (public.is_vexn_admin());
create policy "Admin update channel_descriptions" on public.channel_descriptions
  for update to authenticated
  using (public.is_vexn_admin()) with check (public.is_vexn_admin());
create policy "Admin delete channel_descriptions" on public.channel_descriptions
  for delete to authenticated using (public.is_vexn_admin());

create policy "Admin insert performer_descriptions" on public.performer_descriptions
  for insert to authenticated with check (public.is_vexn_admin());
create policy "Admin update performer_descriptions" on public.performer_descriptions
  for update to authenticated
  using (public.is_vexn_admin()) with check (public.is_vexn_admin());
create policy "Admin delete performer_descriptions" on public.performer_descriptions
  for delete to authenticated using (public.is_vexn_admin());
