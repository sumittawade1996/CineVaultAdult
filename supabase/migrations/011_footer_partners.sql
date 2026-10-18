-- 011_footer_partners.sql
-- Plan task T15: partner links in the footer that can be added, paused or
-- removed with a row change in the database, with no deploy.
--
-- Add a partner:   insert into public.footer_partners (name, url, label, sort_order)
--                  values ('Name', 'https://partner.example/?ref=vexn', 'Label', 20);
-- Pause a partner: update public.footer_partners set is_active = false where name = 'Name';

create table if not exists public.footer_partners (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  url text not null check (url ~* '^https?://'),   -- full referral link, ref parameter included
  label text,                                      -- link text; falls back to name
  description text,
  rel text not null default 'sponsored noopener',
  open_in_new_tab boolean not null default true,
  is_active boolean not null default true,
  sort_order integer not null default 100,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists footer_partners_url_key on public.footer_partners (lower(url));
create index if not exists footer_partners_active_idx on public.footer_partners (is_active, sort_order);

create or replace function public.set_footer_partners_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists footer_partners_set_updated_at on public.footer_partners;
create trigger footer_partners_set_updated_at
  before update on public.footer_partners
  for each row execute function public.set_footer_partners_updated_at();

alter table public.footer_partners enable row level security;

-- Visitors read active partners inside their date window; nothing else.
create policy "Public read active footer_partners" on public.footer_partners
  for select to anon, authenticated
  using (is_active and (starts_at is null or starts_at <= now())
                   and (ends_at   is null or ends_at   >  now()));

-- Admins manage every row (including paused and scheduled ones).
create policy "Admin read all footer_partners" on public.footer_partners
  for select to authenticated using (public.is_vexn_admin());
create policy "Admin insert footer_partners" on public.footer_partners
  for insert to authenticated with check (public.is_vexn_admin());
create policy "Admin update footer_partners" on public.footer_partners
  for update to authenticated
  using (public.is_vexn_admin()) with check (public.is_vexn_admin());
create policy "Admin delete footer_partners" on public.footer_partners
  for delete to authenticated using (public.is_vexn_admin());

revoke insert, update, delete, truncate, references, trigger on public.footer_partners from anon;
revoke truncate, references, trigger on public.footer_partners from authenticated;

-- First partner. Check the URL (and add the referral parameter, if the
-- partner gave you one) before relying on it.
insert into public.footer_partners (name, url, label, sort_order)
values ('VEXN India', 'https://www.vexn.co.in', 'VEXN India', 10)
on conflict do nothing;
