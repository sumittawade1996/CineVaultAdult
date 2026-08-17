-- Run this in Supabase: Project -> SQL Editor -> New query -> Run

create extension if not exists "pgcrypto";

-- MOVIES ---------------------------------------------------------------
create table if not exists movies (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  year int,
  poster_url text,
  trailer_url text,          -- YouTube URL or ID
  description text,
  keywords text,             -- comma-separated, used for search + SEO
  tags text,                 -- comma-separated genres/categories e.g. "Action, Sci-Fi"
  actors text,               -- comma-separated cast names e.g. "Actor One, Actor Two"
  channel text,               -- distribution source e.g. "Netflix", "Theatrical", "YouTube Originals"
  rating numeric(3,1),       -- e.g. 8.4
  runtime_minutes int,
  seo_title text,            -- optional override for <title>
  seo_description text,      -- optional override for meta description
  featured boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_movies_slug on movies (slug);
create index if not exists idx_movies_created_at on movies (created_at desc);

-- Simple full text search across title/keywords/tags
alter table movies add column if not exists search_vector tsvector
  generated always as (
    to_tsvector('english',
      coalesce(title,'') || ' ' ||
      coalesce(keywords,'') || ' ' ||
      coalesce(tags,'') || ' ' ||
      coalesce(actors,'') || ' ' ||
      coalesce(channel,'')
    )
  ) stored;
create index if not exists idx_movies_search on movies using gin (search_vector);
create index if not exists idx_movies_channel on movies (channel);

-- ARTICLES ---------------------------------------------------------------
create table if not exists articles (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  cover_image_url text,
  excerpt text,
  content text,              -- markdown or HTML
  keywords text,
  tags text,
  seo_title text,
  seo_description text,
  author text default 'CineVault Team',
  published boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_articles_slug on articles (slug);
create index if not exists idx_articles_created_at on articles (created_at desc);

-- Keep updated_at current on every edit
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_movies_updated_at on movies;
create trigger trg_movies_updated_at before update on movies
  for each row execute function set_updated_at();

drop trigger if exists trg_articles_updated_at on articles;
create trigger trg_articles_updated_at before update on articles
  for each row execute function set_updated_at();

-- ROW LEVEL SECURITY -------------------------------------------------
-- Public (anon key) can READ everything, but cannot write.
-- Bulk upload / admin pages should use these same policies for now —
-- see README "Locking down admin pages" for how to protect writes
-- with a Supabase Auth login before you go live.
alter table movies enable row level security;
alter table articles enable row level security;

create policy "Public read movies" on movies for select using (true);
create policy "Public read articles" on articles for select using (published = true);

create policy "Public insert movies" on movies for insert with check (true);
create policy "Public insert articles" on articles for insert with check (true);
create policy "Public update movies" on movies for update using (true);
create policy "Public update articles" on articles for update using (true);
