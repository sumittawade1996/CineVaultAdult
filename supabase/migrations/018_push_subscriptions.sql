-- 018_push_subscriptions.sql
-- Web push ("new videos" alerts). A visitor who turns the alerts on gives the browser's push address (endpoint)
-- and two keys the browser needs to encrypt a message (p256dh, auth). Nothing else is stored: no name, no email,
-- no IP address, no account.
--
-- Visitors cannot read, change or list this table. They can only call the two functions below, each of which
-- takes the visitor's own endpoint (an address nobody else can guess). The daily sender
-- (scripts/send-push.mjs, GitHub Actions) uses the service role key, which bypasses these rules.

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  endpoint text not null unique check (endpoint ~ '^https://' and length(endpoint) <= 1000),
  p256dh text not null check (length(p256dh) between 20 and 200),
  auth text not null check (length(auth) between 10 and 100),
  created_at timestamptz not null default now(),
  last_sent_at timestamptz
);

alter table public.push_subscriptions enable row level security; -- no policies: no direct access for visitors

create or replace function public.push_subscribe(p_endpoint text, p_p256dh text, p_auth text)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.push_subscriptions (endpoint, p256dh, auth)
  values (p_endpoint, p_p256dh, p_auth)
  on conflict (endpoint) do update set p256dh = excluded.p256dh, auth = excluded.auth;
$$;

create or replace function public.push_unsubscribe(p_endpoint text)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.push_subscriptions where endpoint = p_endpoint;
$$;

revoke all on function public.push_subscribe(text, text, text) from public;
revoke all on function public.push_unsubscribe(text) from public;
grant execute on function public.push_subscribe(text, text, text) to anon, authenticated;
grant execute on function public.push_unsubscribe(text) to anon, authenticated;
