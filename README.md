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

### Posters vs. players on movie cards

Movie cards in every grid show a **static poster image**, never the trailer
player itself — embedding twenty third-party players on `/movies` was the
single biggest performance cost on the site. Set `poster_url` whenever you
add a movie:

- YouTube trailers get a thumbnail automatically when `poster_url` is empty.
- Eporner embeds can be filled in bulk with
  `node scripts/backfill-posters.mjs` (dry run) and
  `node scripts/backfill-posters.mjs --apply` (writes `poster_url`).
- Anything else (Luluvdo, RedTube, …) shows the branded placeholder until
  you paste a poster URL in `/admin/movie`.

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

Writes to `movies` and `articles` are limited to signed-in admins. Setup, once:

1. In Supabase: Authentication > Users > Add user (your email + a strong
   password). Then Authentication > Sign In / Providers > Email: turn
   **off** "Allow new users to sign up".
2. Run `supabase/migrations/003_admin_policies.sql` (adds `admin_users`, the
   `is_vexn_admin()` function and the admin policies), then register yourself:
   `insert into public.admin_users (user_id, note) select id, 'owner' from auth.users where email = 'you@example.com';`
3. Deploy the site, then run `supabase/migrations/004_close_public_writes.sql`
   (removes the old public insert/update policies and the anon write rights).
   Run it only after the new login is live, because the old admin pages wrote
   with the public anon key.

Scripts that write to the database (for example `scripts/backfill-posters.mjs
--apply`) need `SUPABASE_SERVICE_ROLE_KEY` in your local `.env`. Never put that
key in a `VITE_` variable and never commit it.

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

- **Admin login**: `/admin/upload`, `/admin/article`, and `/admin/movie`
  sit behind a Supabase Auth sign-in (email + password; see section 9 for
  setup). Only users listed in `public.admin_users` can write, and that is
  enforced by the database's row-level security policies, not by the
  browser. Signing in shows a small admin nav bar with links between the
  three admin tools and a Log out button. There is no shared password in the
  JS bundle any more.
- **Single movie upload** (`/admin/movie`, linked from the bulk upload
  page): the same fields as the CSV importer — title, year, poster
  URL, trailer URL, description, tags, actors, channel, rating,
  runtime, SEO keywords, featured toggle — but as a normal form for
  adding or fixing one movie at a time. Submitting a title that
  already exists updates that movie instead of creating a duplicate
  (same upsert-on-slug behavior as the CSV tool).

## 15. Removed and unknown movies (404 / 410 / 301)

A movie URL that no longer exists must not answer HTTP 200 (a "soft 404").
`netlify/edge-functions/movie-gate.js` runs on every `/movie/*` request:

- slug listed in `public.removed_movies` with `redirect_to` -> **301** to that
  performer, channel or category page
- slug listed in `public.removed_movies` -> **410 Gone**
- slug in neither `movies` nor `removed_movies` -> **404**
- everything else is served exactly as before (prerendered pages cost no
  extra database call; the removed list is cached for 5 minutes, and if
  Supabase is unreachable the page is served normally).

The 404/410 body is the normal app shell, so visitors see the "not found"
page with search and popular categories (`src/pages/NotFound.jsx`), and the
response carries `X-Robots-Tag: noindex`. The same function still serves live
Open Graph tags to link-preview bots (X, Telegram, Slack, ...).

Maintenance:
- Deleting a movie in `/admin/movie` records it in `removed_movies`
  automatically; renaming one records a 301 from the old slug to the new one.
- If you delete rows with SQL, also run
  `insert into removed_movies (slug, reason) values ('the-slug', 'why');`
  (add `redirect_to` as `/actor/...` or `/channel/...` when a close page exists).
- Adding a movie back with the same slug clears its `removed_movies` row
  (database trigger), so it cannot be answered with 410 by mistake.
- Offline test of the function: `node scripts/test-movie-gate.mjs`.
- After a deploy, check with `curl -I https://vexn.org/movie/<removed-slug>`
  (expect 301 or 410) and `curl -I https://vexn.org/movie/does-not-exist`
  (expect 404). Migrations: `005_removed_movies.sql`, `006_seed_removed_movies.sql`.

## 16. Canonicals, noindex and the adult label

`src/components/Seo.jsx` (with `src/lib/seoUrl.js`) sets the head tags for every page:

- **Canonical** is the clean URL on https://vexn.org. Tracking parameters
  (`utm_*`, `fbclid`, `gclid`, X's `s`/`t`, ...) are dropped and the page stays
  indexable. `?page=1` is the same as no parameter; `?page=n` is canonical to
  itself.
- **Variants are `noindex, follow`**: any other parameter (`?sort=`, `?q=`,
  filters), plus page 2+ of listings and anything passed `noindex`. `robots.txt`
  also disallows `?q=` and `?sort=`.
- **Adult label**: one `<meta name="rating" content="RTA-5042-1996-1400-1577-RTA">`
  on every page and the same value as an HTTP `Rating` header (`netlify.toml`).
- The static shell in `index.html` marks its `title`, `description` and `rating`
  tags with `data-rh="true"` so react-helmet replaces them instead of duplicating
  them; `scripts/prerender.mjs` strips them before injecting each page's head.

Tests: `node scripts/test-seo-url.mjs`.

## 17. Sitemaps and what gets indexed

`scripts/generate-sitemap.mjs` runs before every build and writes a sitemap
index (`public/sitemap.xml`) plus `sitemap-pages`, `-movies`, `-video`,
`-articles` and `-taxonomy`:

- `lastmod` is the row's real `updated_at` (a page's lastmod is the newest row
  it lists). Pages with no meaningful date, such as the legal pages, have none.
- `sitemap-video.xml` has one `<video:video>` per movie that has a poster:
  title, description, thumbnail, embed player URL, duration, publication date
  (`source_published_at`, else `created_at`), tags and
  `<video:family_friendly>no</video:family_friendly>`.
- Taxonomy pages follow `src/lib/indexing.js`: categories need 10 titles,
  performers 5, channels 3; attribute tags (`hd`, `4k`, `pornstar`,
  `web-series`, studio labels) and the `eporner` channel are never indexed.
  The same function sets `noindex` on the page, so page and sitemap agree.
- `public/robots.txt` is edited by hand and is the source of truth; the script
  only refreshes its `Sitemap:` line.
- `source_published_at` (migration `007_source_published_at.sql`) is the date
  the source site published a video. It feeds `uploadDate` in the movie
  markup and the video sitemap.
- Run it into a scratch folder without touching tracked files:
  `SITEMAP_OUT_DIR=/tmp/sm node scripts/generate-sitemap.mjs`.
- Tests: `node scripts/test-indexing.mjs`.

## 18. Breadcrumbs and movie-page markup

- Movie, category/performer/channel and article pages show a visible
  breadcrumb (`src/components/Breadcrumbs.jsx`) and emit the matching
  `BreadcrumbList` JSON-LD (`src/lib/breadcrumbs.js`). A movie's middle step is
  its first topic tag; attribute tags such as `hd` or `4k` are skipped.
- The movie `VideoObject` states `isFamilyFriendly: false` and no longer
  includes `aggregateRating` (Google requires a rating count and the site only
  has one editor-set score per video). `uploadDate` is the source publication
  date (`source_published_at`), falling back to the import date.
- The "not found" page (`src/pages/NotFound.jsx`) shows a search box, popular
  categories and the six newest featured videos so visitors who hit a dead link
  have somewhere to go.
- Tests: `node scripts/test-breadcrumbs.mjs`.

## 19. Page-view recording

Page views are sent to a Netlify Edge Function, not to Supabase directly.

- `src/lib/analytics.js` posts one small beacon per page to `/api/pv`
  (`netlify/edge-functions/page-view.js`). It adds the country (from the CDN),
  a bot check and a per-IP limit, trims every field, and inserts into
  `public.page_views`. No cookies; the session id is random per tab and lives in
  `sessionStorage`. The browser skips known bots itself.
- Columns added by `008_page_views_and_function_hardening.sql`: `session_id`,
  `visitor_type`, `country`, `device`, `utm_source/medium/campaign`,
  `status_code` (404 when the not-found page was shown).
- Optional: set `SUPABASE_SERVICE_ROLE_KEY` in Netlify's environment. The
  function then writes with it, and the public insert policy on `page_views`
  can be dropped (see the comment at the end of migration 008).
- Tests: `node scripts/test-page-view.mjs`.

## 20. Content rules for imports and the review report

VEXN does not publish step-family, incest or in-law themes, teen/school
themes, non-consensual or "leaked"/hidden-camera material, forced themes,
virgin themes, or hypnosis/unconscious themes.

- `src/lib/contentRules.js` holds the rules (`block` and `review` levels) and
  checks the title, slug, tags, keywords and description.
- The admin importers use it: `AdminUpload` skips blocked rows and flags review
  rows, `AdminMovie` refuses to save a blocked row.
- `npm run review-content -- out.csv` (`scripts/review-content.mjs`) lists the
  rows already in the catalogue that match. It only reads; nothing is changed or
  deleted by it.
- Tests: `node scripts/test-content-rules.mjs`.

## 21. Category pages with written copy

- `public.category_descriptions` (migrations `009` and `010`) holds, per
  category slug: an optional H1, an intro, the SEO title (30–53 characters) and
  description (140–160), an optional FAQ and an `is_indexable` switch. A page
  shows the intro followed by one sentence built from live data.
- The copy for about 24 categories is in
  `scripts/data/category-descriptions.mjs`. `npm run seed-categories` checks
  lengths and content rules and writes `010_seed_category_descriptions.sql`.
  Edit a row directly in Supabase to change a page without a deploy; the
  prerendered HTML picks it up on the next build.
- A category with `is_indexable = false` (web-series, until the rights are
  confirmed) is `noindex` and left out of the sitemap.
- Categories without a row fall back to a sentence built from the data.

## 22. "New" pages

- `/new` lists the 24 latest additions and links to a weekly archive;
  `/new/2026-w41` lists everything added in that ISO week (20 per page).
  Weeks come from `created_at` (`src/lib/weeks.js`), so nothing is maintained
  by hand. Weeks with fewer than 5 additions are `noindex` and not in the
  sitemap.
- Related videos on a movie page (`src/lib/related.js`): same performer first,
  then shared topic tags, then the same channel, then the newest. The build and
  the browser use the same code, so the list does not change after load.
- Tests: `node scripts/test-weeks.mjs`, `node scripts/test-related.mjs`.

## 23. Partners: footer list and /partners page

- `public.footer_partners` (migrations `011_footer_partners.sql`,
  `012_footer_partners_details.sql`): visitors can only read active rows inside
  their date window. Add a partner with
  `insert into public.footer_partners (name, url, label, description, details, sort_order) values (...)`,
  pause one with `update ... set is_active = false`. No deploy needed; the
  browser caches the list for 10 minutes and the next build embeds it in the
  HTML.
- Footer: a "Partners" list (link text = `label`, falling back to `name`, with the
  site address under it; the first 8 rows) and an "All partners" link.
- `/partners` (`src/pages/Partners.jsx`): one card per partner with name,
  address, `description` (one line), `details` (longer text, a blank line starts a
  new paragraph) and a "Visit" button, plus a note that the links are sponsored
  and lead to third-party adult sites. The page is `noindex` and not in the
  sitemap; remove `noindex` in `Partners.jsx` and add it to `STATIC_ROUTES` in
  `scripts/generate-sitemap.mjs` if you want it searchable.
- Links carry `rel="sponsored noopener"` (`src/lib/partnerLinks.js` always marks
  a paid link). Put the partner's referral parameter in `url`.
- Tests: `node scripts/test-partners.mjs`.

## 24. Source check and page audit

- `npm run check-embeds` (`scripts/check-dead-embeds.mjs`) asks Eporner and
  Pornhub whether each embedded video still exists, about one request per
  second, and confirms a removal twice. Report only. The workflow
  `.github/workflows/check-dead-embeds.yml` runs it every Monday and fails when
  a video is confirmed removed; it needs `VITE_SUPABASE_URL` and
  `VITE_SUPABASE_ANON_KEY` as repository secrets.
- `node scripts/audit-pages.mjs` (after a build) checks every prerendered page
  for title, description, canonical, one H1, the adult rating tag, and, on movie
  pages, the schema markup, poster alt text, player and related links.
- `npm test` runs every offline test.

## 25. Channel, source and controlled categories

- `movies.source` (migration `013_movie_source.sql`) is the site that hosts the
  player (Eporner, PornHub, ...), filled from `trailer_url` by
  `src/lib/source.js`. `movies.channel` is now only a studio or collection
  (Nuru Massage, Brazzers, AI Movie, JAV Movies, ...) and may be empty. The movie
  page shows "Source: Eporner". `/channel/eporner`, `/channel/pornhub` and
  `/channel/youtube` 301 to `/channels`.
- `src/lib/categories.js` is the controlled list: about 55 topic categories (each with a hand-written hub in `scripts/data/category-descriptions.mjs`), the
  label tags (HD, 4K, studio names) and the aliases (Housewife -> Housewives,
  Romance -> Romantic, ...). The importer and the admin form rewrite aliases.
  `npm run tag-report` shows how the live catalogue sits against it.
- Tests: `node scripts/test-source.mjs`, `node scripts/test-categories.mjs`.

## 26. Performer and channel pages

- On screens 960 px wide and up, the space beside the intro holds a "Watch next"
  column (one or two poster cards from the page's own videos; `pickRail` in
  `src/lib/taxonomyFacts.js`). To put an ad there, fill in `taxonomyRail.html`
  in `src/lib/adSlots.js` (300x250); while it is empty no box is shown.

- Performer and channel pages show an "at a glance" block (runtime range, how
  many videos run 30 minutes or more, channels or sources, frequent co-stars, the
  three longest videos). It is counted from the page's own video list
  (`src/lib/taxonomyFacts.js`), so the built HTML and the browser agree.
- The intros are rows in `performer_descriptions` and `channel_descriptions`.
  Write them from catalogue facts only and avoid exact counts that go stale.

## 27. Articles

- Articles show the byline, the published date and, when it changed on a later
  day, the updated date (`src/lib/articleDates.js`); the JSON-LD has the dates and
  an Organization author. `npm run check-links` lists, for every published
  article, the word count, dead internal links and numbers that need a source.
- Rule for statistics: use our own data (the catalogue and `page_views`) and say
  how many weeks it covers; do not quote other sites' figures.
- Merged articles are unpublished and 301 in `netlify.toml`.

## 28. Promotion tools

- `scripts/promo/utm.mjs` builds tagged links; `posts.mjs` is the post calendar;
  `npm run promo-calendar -- out.csv` writes it as a CSV with the final text,
  link and X length. Nothing is scheduled or posted by these scripts.
- `npm run promo-weekly` prints the Telegram "new this week" message; `--send`
  posts it (needs `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID`).
- `npm run indexnow` lists the URLs it would submit to IndexNow; `--send`
  submits them. The key file is `public/<key>.txt`. Run it after a deploy.
- `public/manifest.webmanifest` and the two icons make the site installable.
- Tests: `node scripts/test-promo.mjs`, `node scripts/test-taxonomy-facts.mjs`,
  `node scripts/test-article-dates.mjs`.

## 29. Movie copy rewrite

- `node scripts/rewrite-movie-copy.mjs` is a dry run: it prints the counts and
  samples and writes a before/after CSV to Downloads. `--apply` saves the old
  text to Downloads, then updates the rows. Rows that the content rules block are
  skipped. A field that is already clean (no picture-quality or pitch wording, right
  length) is not touched, so the script can be run again after new imports.
- The wording comes from `scripts/lib/movieCopy.mjs`: the clean opening sentences of
  the old text are kept; the rest is built only from the row (cast, runtime, tags,
  channel, source, a setting or episode number the title names). It never claims
  picture quality, popularity or "no signup".
- Test: `node scripts/test-movie-copy.mjs`.

## 30. Edge gates, CI and indexing

- `netlify/edge-functions/movie-gate.js` (movies) and `taxonomy-gate.js` (`/actor`,
  `/category`, `/channel`, `/article`) answer 404 or 410 for addresses that do not exist and
  pass everything else through; both fail open when Supabase is unreachable. Shared
  helpers are in `netlify/edge-functions/lib/gate-common.js`. Tests:
  `node scripts/test-movie-gate.mjs`, `node scripts/test-taxonomy-gate.mjs`.
- `.github/workflows/ci.yml` runs the tests and the bundle build on pull requests and on
  pushes to main. Add the secrets `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to let
  it also run the full prerender build.
- Which pages are indexed is decided in `src/lib/indexing.js`: label tags
  (`LABEL_TAGS`) and tag aliases never, other tags from 10 titles, performers from 5,
  channels from 3, except the catch-all channel `VEXN` (`CATCH_ALL_CHANNELS`). The sitemap
  generator and the page use the same function.
- `public/sitemap*.xml` are generated by `npm run build` and are not committed.
- Since migration 004 (applied 2026-10-19) the public key can only read `movies` and `articles`.
  Admins write through the admin pages (Supabase Auth). Bulk scripts that write need
  `SUPABASE_SERVICE_ROLE_KEY` in your local `.env` (never commit it), or the same change can be
  run as SQL in the Supabase editor.
- A video that hits a blocked theme (`src/lib/contentRules.js`) is held: it stays visible but is
  left out of the sitemaps and carries `noindex` (`isHeldMovie`) until it is decided.

## 31. Admin: site content and channel views

- `/admin/content` edits channel intros, performer bios, category pages and footer
  partners (admin policies: migrations 009, 011, 014). Saved text shows in open pages on
  the next load; the prerendered HTML changes at the next deploy.
- `/admin/dashboard` shows views per channel (7, 30, 90 days, all time), the most viewed
  videos of a channel and its views per day. It reads `page_views` through three
  admin-only functions (migration 015); visitors cannot call them.
- A video added without a channel goes into the `VEXN` channel
  (`DEFAULT_CHANNEL` in `src/lib/siteConfig.js`).
- Migration 016 adds `movies.search_compact` so a name typed without its space still
  finds the video.

## 32. Install as an app, and page scrolling

- `src/components/InstallButton.jsx` (header and phone menu) offers "Install app" when the browser
  fires `beforeinstallprompt` (Chrome, Edge), and "Add to Home Screen" with the two steps on iPhone
  and iPad. Nothing shows when the site is already installed or cannot be installed. The detection is
  in `src/lib/installMode.js` (`node scripts/test-install.mjs`). For a local look at the iPhone
  variant, open the dev server with `?installdemo=ios`.
- `public/sw.js` is a minimal service worker (it makes the site installable and shows
  `public/offline.html` when there is no connection); it caches nothing else. It is registered in
  production builds only (`src/main.jsx`). `netlify.toml` serves the manifest with its proper type
  and keeps `sw.js` uncached.
- `src/lib/useScrollBehavior.js` and `src/lib/pageScroll.js`: a link opens the new page at the top,
  a video page scrolls to its player and keeps it there while the page settles (until the visitor
  scrolls), and Back returns to the same place in the list.

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
    003_admin_policies.sql    admin_users + admin-only write policies
    004_close_public_writes.sql   removes public write access (run after deploy)
    005_removed_movies.sql    table of removed movies for 410/301 answers
    006_seed_removed_movies.sql   initial list of removed slugs
    007_source_published_at.sql   date the source published a video
    008_page_views_and_function_hardening.sql   page_views columns, bounded inserts
    009_category_descriptions.sql   table for category page copy
    010_seed_category_descriptions.sql   the written copy (generated)
    011_footer_partners.sql   partner links for the footer
    012_footer_partners_details.sql   longer text for the /partners page
    013_movie_source.sql      source column; channel only for studios
    014_admin_write_descriptions.sql   admins can write channel and performer text
    015_admin_channel_views.sql        admin-only views-per-channel functions
    016_search_compact.sql             name search without spaces
scripts/
  generate-sitemap.mjs   runs before every build
  test-movie-gate.mjs    offline test of the 404/410 edge function
  test-seo-url.mjs       offline test of canonical / noindex rules
  test-indexing.mjs      offline test of the taxonomy indexing rules
  test-breadcrumbs.mjs   offline test of the breadcrumb trails
  test-content-rules.mjs, test-weeks.mjs, test-related.mjs, test-partners.mjs,
  test-dead-embeds.mjs, test-seo-text.mjs, test-page-view.mjs   other offline tests (npm test runs all)
  check-dead-embeds.mjs  weekly source check (report only)
  review-content.mjs     list catalogue rows that match the content rules
  audit-pages.mjs        audit the prerendered pages in dist/
  seed-category-descriptions.mjs   check + generate the category copy SQL
sample-data/
  movies-template.csv
```
