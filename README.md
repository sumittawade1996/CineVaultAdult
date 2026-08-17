# CineVault

A movie/trailer site: React + Vite frontend, Supabase (Postgres) database,
deployed on Netlify. Bulk movie upload via CSV, article publishing, SEO
meta tags per page, and an auto-generated `sitemap.xml`.

## 1. Create the Supabase project

1. Go to supabase.com → New project (free tier is fine).
2. Once it's created, open **SQL Editor → New query**, paste the contents of
   `supabase/schema.sql`, and run it. This creates the `movies` and
   `articles` tables, search indexing, and read/write policies.
3. Go to **Project Settings → API** and copy:
   - **Project URL** → `VITE_SUPABASE_URL`
   - **anon public key** → `VITE_SUPABASE_ANON_KEY`

## 2. Run locally

```bash
cp .env.example .env
# paste your Supabase URL + anon key into .env
npm install
npm run dev
```

## 2b. If you already have movies in Supabase (e.g. vxn.co.in)

Run `supabase/migrations/002_actors_channels.sql` in the SQL Editor. It
adds `actors` and `channel` columns to your existing `movies` table and
rebuilds the search index to include them — safe to re-run, won't touch
existing rows.

## 3. Add movies in bulk

- Go to `/admin/upload` in the running app.
- Download the CSV template link on that page (or use `sample-data/movies-template.csv`).
- Fill in one row per movie. Columns:
  `title, year, poster_url, trailer_url, description, keywords, tags, actors, channel, rating, runtime_minutes, featured`
  - `tags` = categories/genres (comma-separated, e.g. `"Action, Sci-Fi"`)
  - `actors` = cast (comma-separated, e.g. `"Actor One, Actor Two"`)
  - `channel` = one value, the source/platform (e.g. `Netflix`, `Theatrical`, `YouTube Originals`)
- The site automatically builds browse pages from these: `/actors`,
  `/channels`, `/categories`, and a detail page per item
  (e.g. `/actor/actor-one`) listing every matching movie. No extra setup —
  they're generated from whatever values are in your movie rows.
- For `poster_url`: find the movie on Google Images, right-click the image →
  "Copy image address" → paste it in. (Google Images itself has no public
  API for hotlinking at scale — for a large catalog, TMDB's free image CDN
  is more reliable long-term; happy to wire that in later if you want it.)
- Upload the CSV. Re-uploading the same file updates existing movies
  instead of duplicating them (matched by title → slug).

## 4. Write articles

Go to `/admin/article` to publish a blog-style post with its own SEO title/
description, tags, and cover image. Articles show on the homepage and at
`/articles`.

## 5. SEO

- Every movie and article page sets its own `<title>`, meta description,
  and Open Graph tags (`src/components/Seo.jsx`).
- `npm run build` automatically runs `scripts/generate-sitemap.mjs` first,
  which pulls every movie/article slug from Supabase and writes a fresh
  `public/sitemap.xml` + `public/robots.txt` before the site is built —
  so newly bulk-uploaded movies show up in the sitemap on the next deploy
  without any manual step.
- Set `SITE_URL` (see below) to your real domain so the sitemap uses
  absolute URLs — Google requires this.
- After your first deploy, submit `https://yourdomain.com/sitemap.xml` in
  Google Search Console.

## 6. Deploy to Netlify

1. Push this project to a GitHub repo.
2. Netlify → **Add new site → Import an existing project** → pick the repo.
   Build command and publish directory are already set via `netlify.toml`
   (`npm run build` / `dist`).
3. In **Site settings → Environment variables**, add:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `SITE_URL` — e.g. `https://cinevault.netlify.app` (or your custom domain)
4. Deploy. Every future push rebuilds the site and regenerates the sitemap.

## 7. Live active-user count

The navbar shows a "N watching now" badge (`src/components/ActiveUsers.jsx`).
It uses Supabase Realtime Presence: every open browser tab joins a shared
channel, and the badge shows how many distinct tabs are currently joined —
no extra table, cron job, or third-party analytics service needed.

Requirements:
- Realtime is on by default for new Supabase projects. If the count stays
  stuck at 1 with multiple tabs open, check **Project Settings → API →
  Realtime** is enabled.
- This counts concurrent visitors (like "X people viewing"), not a
  historical daily/monthly active-user total. If you also want historical
  traffic numbers (pageviews, DAU/MAU over time), that's a good fit for a
  lightweight analytics tool like Plausible or Google Analytics — say the
  word and I can wire one in.

## 8. Ads

`src/components/AdSlot.jsx` is a placeholder drop-in. To enable Google
AdSense:
1. Uncomment the AdSense `<script>` tag in `index.html` and add your
   publisher ID.
2. Replace the placeholder inside `AdSlot.jsx` with your `<ins class="adsbygoogle">`
   snippet from AdSense.
Ad slots are already placed on the homepage, movie list, movie detail, and
article pages.

## 9. Locking down the admin pages before you go live

Right now `/admin/upload` and `/admin/article` are open to anyone who finds
the URL, because the Supabase policies allow public inserts (needed for the
CSV upload to work out of the box). Before launch, either:
- Don't link to `/admin/*` from your public nav (they're already
  unlisted — only reachable by direct URL), **and/or**
- Add Supabase Auth (email/password or magic link) and change the `insert`/
  `update` policies in `schema.sql` to `using (auth.role() = 'authenticated')`
  instead of `using (true)`. Ask me and I can wire this in.

## 10. Ad slots (expanded, responsive)

`src/lib/adSlots.js` now has more placements than before, and every slot
can carry **separate desktop and mobile ad code** — set `desktopHtml` and
`mobileHtml` instead of (or alongside) `html`. If a slot has `desktopOnly`
or `mobileOnly` set, it's automatically hidden on the other device size.

Placements now available:
- `header` / `footer` — site-wide, above/below every page
- `stickyMobile` — a dismissible bar pinned to the bottom of the screen,
  mobile only
- `homeLeaderboard` / `homeMidFeed` — homepage
- `listingTop` — top of `/movies` and the actor/channel/category index pages
- `inFeed` — inside every movie grid, after the 4th card
- `belowTrailer` / `detailSidebar` / `aboveRelated` — movie detail page
  (`detailSidebar` is desktop-only — there's no room for it on mobile)
- `articlesInFeed` / `midArticle` / `inArticle` — articles

Ads are also **lazy-loaded**: the real ad code for a slot only gets
injected once that slot is about to scroll into view, so ad scripts
further down a page don't compete with your initial page load.

To enable Google AdSense, same as before: uncomment the AdSense
`<script>` tag in `index.html` with your publisher ID, then paste your
snippets into the slots you want live in `adSlots.js`.

## 11. Social links

Your X and Telegram links live in one place: `src/lib/siteConfig.js`.
They show up as icons in the navbar and footer, and are included as
`sameAs` links in the homepage's structured data (helps search engines
associate your social accounts with the site). Edit that file any time
you want to change the handles.

## 12. What changed for SEO / performance / visuals

- **Canonical URLs** are now set automatically on every page (previously
  only the `url` prop, which nothing passed in, worked).
- **Structured data (JSON-LD)**: `WebSite`/`Organization` schema on the
  homepage, `Movie` schema on movie pages, `Article` schema on article
  pages — helps Google show richer results.
- Admin pages now send `noindex` so they don't get crawled.
- **Route-level code splitting**: only the homepage loads immediately;
  every other page downloads its code on first visit to that page,
  which shrinks the initial bundle.
- **Skeleton loading placeholders** replace the old plain "Loading…" text
  on Home, Movies, movie/article detail, and Articles — no layout jump
  when real content arrives, and it feels faster.
- Small visual polish: a subtle gradient on the hero, a stronger hover
  glow on movie cards, smooth-scroll.
- A `preconnect` hint to your Supabase project in `index.html` shaves a
  bit of latency off the first data fetch.
- **No changes to the database schema or `supabase/schema.sql`.**

## 13. Latest round of changes (hero, sitemap, domain, viewer count)

- **Homepage hero removed.** The big "Now Showing" banner is gone —
  replaced with a single compact heading line so visitors hit real
  content (Featured / Latest movies) immediately instead of scrolling
  past marketing copy.
- **Sitemap is now a sitemap *index*.** `public/sitemap.xml` no longer
  lists every URL directly — it points at four sub-sitemaps:
  `sitemap-pages.xml`, `sitemap-movies.xml`, `sitemap-articles.xml`,
  `sitemap-taxonomy.xml`. This scales much better as your catalog grows
  (a single sitemap file caps out at 50,000 URLs) and lets Google
  Search Console report indexing stats per content type. Movie and
  article sitemaps also now include `<image:image>` tags for posters
  and cover images, which helps them surface in Google Image search.
  All of this is generated automatically by `npm run build` — nothing
  to do by hand.
- **Domain updated to `https://vexn.org`** everywhere the old
  `vxn.co.in` placeholder was used — `.env`, `.env.example`, and the
  sitemap/robots fallback. Make sure `SITE_URL=https://vexn.org` is
  also set in your Netlify environment variables when you deploy.
- **"Watching now" badge** now shows a base floor of 15,900 *plus* the
  real live Supabase Presence count, set in `src/lib/siteConfig.js` as
  `BASE_VIEWER_COUNT`. Change or zero it out any time — worth knowing
  this makes the number a marketing figure rather than a literal
  concurrent-visitor count, in case that matters for how you want to
  represent it to visitors.
- **Added a placeholder favicon** (`public/favicon.svg`) — every page
  was missing one entirely before. Swap it for your real logo whenever
  you have one; just keep the filename or update the `<link rel="icon">`
  in `index.html`.
- `robots.txt` now explicitly disallows `/admin/`.

## SEO — further recommendations (not yet implemented)

These are worth doing next, roughly in priority order:

1. **Submit both sitemaps** — `https://vexn.org/sitemap.xml` — to
   Google Search Console *and* Bing Webmaster Tools once you're live.
   Search Console will also tell you about any indexing errors.
2. **Poster hotlinking is a reliability and speed risk.** The CSV
   workflow currently tells you to grab poster URLs from Google Images.
   Those links can break or throttle at any time, which both hurts SEO
   (broken images) and slows page loads. Moving to TMDB's free image
   CDN (or self-hosting posters) is more reliable long-term — say the
   word and I can wire it in.
3. **Add Breadcrumb structured data** (`BreadcrumbList` schema) on
   movie/actor/channel/category detail pages — helps Google show
   breadcrumb trails in search results and reinforces site structure.
4. **Add `noindex` to search-result and page 2+ URLs** — right now
   `/movies?q=...` and `?page=2` etc. are all indexable, which can
   read as thin/duplicate content to Google. Worth adding `noindex` on
   filtered/paginated result pages while keeping `/movies` itself
   indexable.
5. **Pick one canonical domain form** — decide `vexn.org` vs
   `www.vexn.org` and set up a redirect from the one you don't use, so
   Google doesn't see two versions of the same site.
6. **Real favicon + Open Graph image** — replace the placeholder
   favicon with your actual logo, and add a default `og:image` (in
   `Seo.jsx`) for pages that don't have their own poster/cover, so
   shares on social/Telegram/Twitter always show an image.
7. **Fill in `seo_title` / `seo_description`** on every movie and
   article row when uploading — the site already displays them when
   present, but they're optional so nothing's forcing you to.

Happy to implement any of these next — just say which one.

## 14. Admin login + single-movie upload

- **Admin login gate**: `/admin/upload`, `/admin/article`, and
  `/admin/movie` now sit behind a simple login screen. Username
  `sumit`, password `sumit123` — set in `src/lib/adminAuth.js` if you
  ever want to change them. Logging in shows a small admin nav bar
  with links between the three admin tools and a Log out button.
  **Heads up**: this is a client-side gate, good enough to keep casual
  visitors out, but the password does live inside the JS bundle — a
  technical visitor who inspects it could read it. It is *not* the
  same as a real login system. The actual data-write protection is
  still your Supabase row-level security policies. If you'd rather
  have real auth (so the password isn't sitting in plain sight in the
  bundle), say the word and I'll wire in Supabase Auth instead.
- **Single movie upload** (`/admin/movie`, linked from the bulk upload
  page): the same fields as the CSV importer — title, year, poster
  URL, trailer URL, description, tags, actors, channel, rating,
  runtime, SEO keywords, featured toggle — but as a normal form for
  adding or fixing one movie at a time. Submitting a title that
  already exists updates that movie instead of creating a duplicate
  (same upsert-on-slug behavior as the CSV tool).

```
src/
  components/   Navbar, Footer, MovieCard, AdSlot, Seo, ActiveUsers,
                CardSkeletonGrid, RequireAdmin
  pages/        Home, Movies, MovieDetail, Articles, ArticleDetail,
                AdminUpload, AdminArticle, AdminMovie, Actors, ActorDetail,
                Channels, ChannelDetail, Categories, CategoryDetail,
                NotFound
  lib/          supabase.js (client), slugify.js, taxonomy.js,
                usePresence.js (live viewer count), adSlots.js,
                siteConfig.js (social links), adminAuth.js (admin login)
supabase/
  schema.sql            run this once for a brand-new project
  migrations/
    002_actors_channels.sql   run this against an existing DB (vxn.co.in)
scripts/
  generate-sitemap.mjs   runs before every build
sample-data/
  movies-template.csv
```
