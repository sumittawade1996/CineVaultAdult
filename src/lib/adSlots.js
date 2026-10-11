// One entry per physical ad placement on the site.
//
// Each slot can be configured three ways:
//   1. `html`         — same snippet on every screen size (simplest)
//   2. `desktopHtml` + `mobileHtml` — different snippets/sizes per device
//      (mobileHtml is used below the 768px breakpoint, desktopHtml above it)
//   3. leave everything null — a visible placeholder box is shown instead,
//      so layout/spacing stays correct while you wait on ad-network approval
//
// If only `desktopHtml` is set and no `mobileHtml`, that slot simply won't
// render on mobile (useful for slots too wide for small screens, e.g. a
// 728x90 leaderboard). Same in reverse for mobile-only slots.
//
// Once you're approved by a network (AdSense, etc.), paste the FULL
// snippet they give you (script tag + <ins>/<div> together, exactly as
// provided) as a single string into the matching field below.
//
// Example once filled in:
// header: {
//   label: 'Header',
//   desktopHtml: `<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-XXXX" crossorigin="anonymous"></script>
//          <ins class="adsbygoogle" style="display:block" data-ad-client="ca-pub-XXXX" data-ad-slot="1111111111" data-ad-format="auto" data-full-width-responsive="true"></ins>
//          <script>(adsbygoogle = window.adsbygoogle || []).push({});</script>`,
//   mobileHtml: `<ins class="adsbygoogle" style="display:block" data-ad-client="ca-pub-XXXX" data-ad-slot="2222222222" data-ad-format="auto" data-full-width-responsive="true"></ins>
//          <script>(adsbygoogle = window.adsbygoogle || []).push({});</script>`,
// },

export const AD_SLOTS = {
  // ---------- Site-wide ----------
  header: {
    label: 'Header',
    format: 'leaderboard',
    html:`<script>
  atOptions = {
    'key' : '8da577ca328ba184ddebad9b4587e3d4',
    'format' : 'iframe',
    'height' : 90,
    'width' : 728,
    'params' : {}
  };
</script>
<script src="https://supportiveinvoicevarnish.com/8da577ca328ba184ddebad9b4587e3d4/invoke.js"></script>`
	, // shows below the nav on every non-admin page
  },
  stickyMobile: {
    label: 'Sticky footer',
    format: 'sticky',
    mobileOnly: true,
    dismissible: true,
    html: `<script>
  atOptions = {
    'key' : '2260e6c38ea6fb994bedaf818bff091f',
    'format' : 'iframe',
    'height' : 50,
    'width' : 320,
    'params' : {}
  };
</script>
<script src="https://supportiveinvoicevarnish.com/2260e6c38ea6fb994bedaf818bff091f/invoke.js"></script>`, // fixed bar pinned to the bottom of the screen, mobile only
  },
  footer: {
    label: 'Footer',
    format: 'leaderboard',
    html: `<script>
  atOptions = {
    'key' : '2260e6c38ea6fb994bedaf818bff091f',
    'format' : 'iframe',
    'height' : 50,
    'width' : 320,
    'params' : {}
  };
</script>
<script src="https://supportiveinvoicevarnish.com/2260e6c38ea6fb994bedaf818bff091f/invoke.js"></script>`, // shows just above the site footer on every non-admin page
  },
  // The Adsterra "social bar" script (f010135b…js) was removed on 2026-10-11:
  // it injected a fake "MESSAGES — Anna: watch this video alone" notification
  // and changed the tab title to "(1) New Message!", a deceptive-ad pattern
  // that risks X / Google flagging the domain. Do not re-add it.

  // ---------- Homepage ----------
  homeLeaderboard: {
    label: 'Homepage leaderboard',
    format: 'leaderboard',
    html: `<script async="async" data-cfasync="false" src="https://supportiveinvoicevarnish.com/5de161d2a3fd4a9ee2823cd1195c61f7/invoke.js"></script>
<div id="container-5de161d2a3fd4a9ee2823cd1195c61f7"></div>
`
, // shows on the homepage, above "Latest additions"
  },
  homeMidFeed: {
    label: 'Homepage mid-feed',
    format: 'rectangle',
    html: `<script async="async" data-cfasync="false" src="https://supportiveinvoicevarnish.com/5de161d2a3fd4a9ee2823cd1195c61f7/invoke.js"></script>
<div id="container-5de161d2a3fd4a9ee2823cd1195c61f7"></div>
`, // shows between "Latest additions" and "From the blog"
  },

  // ---------- Movie listing / grids (home, /movies, actor/channel/category, taxonomy pages) ----------
  inFeed: {
    label: 'In-feed — after 4th movie',
    format: 'rectangle',
    html: `<script async="async" data-cfasync="false" src="https://supportiveinvoicevarnish.com/5de161d2a3fd4a9ee2823cd1195c61f7/invoke.js"></script>
<div id="container-5de161d2a3fd4a9ee2823cd1195c61f7"></div>
`, // shows in every movie grid
  },
  listingTop: {
    label: 'Above movie list',
    format: 'leaderboard',
    html: `<script>
  atOptions = {
    'key' : '2260e6c38ea6fb994bedaf818bff091f',
    'format' : 'iframe',
    'height' : 50,
    'width' : 320,
    'params' : {}
  };
</script>
<script src="https://supportiveinvoicevarnish.com/2260e6c38ea6fb994bedaf818bff091f/invoke.js"></script>`, // shows at the top of /movies, above the search box
  },

  // ---------- Movie detail ----------
  playerOverlay: {
    label: 'Player overlay',
    format: 'player-overlay',
    dismissible: true,
    desktopOnly: true, // phones already get this same ad in the sticky bottom bar
    // Same Adsterra unit as `footer` / `stickyMobile` (320x50), at the
    // site owner's request (2026-10-09). Loaded on its own (2026-10-09 test
    // page, no other ad scripts) this unit renders as a normal 320x50 iframe
    // inside its container — no fixed overlay, no tab-title change — as do
    // the header, sidebar and 5de161 native units. The page-wide fake
    // "MESSAGES" notification and "(1) New Message!" tab title came from
    // the since-removed social-bar script, not this key.
    // Shown top-right (below the player's link-out shield), desktop only —
    // phones already get this same ad in the sticky bottom bar.
    html: `<script>
  atOptions = {
    'key' : '2260e6c38ea6fb994bedaf818bff091f',
    'format' : 'iframe',
    'height' : 50,
    'width' : 320,
    'params' : {}
  };
</script>
<script src="https://supportiveinvoicevarnish.com/2260e6c38ea6fb994bedaf818bff091f/invoke.js"></script>`,
  },
  belowTrailer: {
    label: 'Below trailer',
    format: 'rectangle',
    html: `<script async="async" data-cfasync="false" src="https://supportiveinvoicevarnish.com/5de161d2a3fd4a9ee2823cd1195c61f7/invoke.js"></script>
<div id="container-5de161d2a3fd4a9ee2823cd1195c61f7"></div>
`, // shows on the movie/trailer detail page, right under the embedded player
  },
  detailSidebar: {
    label: 'Movie detail sidebar',
    format: 'skyscraper',
    desktopOnly: true,
    html: `<script>
  atOptions = {
    'key' : '6bcb3d24a85049a80b9ca3de2d230325',
    'format' : 'iframe',
    'height' : 600,
    'width' : 160,
    'params' : {}
  };
</script>
<script src="https://supportiveinvoicevarnish.com/6bcb3d24a85049a80b9ca3de2d230325/invoke.js"></script>`
, // shows next to the poster, desktop only (hidden on mobile — no room)
  },
  aboveRelated: {
    label: 'Above related movies',
    format: 'rectangle',
    html: `<script async="async" data-cfasync="false" src="https://supportiveinvoicevarnish.com/5de161d2a3fd4a9ee2823cd1195c61f7/invoke.js"></script>
<div id="container-5de161d2a3fd4a9ee2823cd1195c61f7"></div>
`, // shows just before "You might also like"
  },

  // ---------- Articles ----------
  articlesInFeed: {
    label: 'Articles listing',
    format: 'leaderboard',
    html: `<script async="async" data-cfasync="false" src="https://supportiveinvoicevarnish.com/5de161d2a3fd4a9ee2823cd1195c61f7/invoke.js"></script>
<div id="container-5de161d2a3fd4a9ee2823cd1195c61f7"></div>
`, // shows at the top of /articles
  },
  inArticle: {
    label: 'In-article',
    format: 'rectangle',
    html: `<script async="async" data-cfasync="false" src="https://supportiveinvoicevarnish.com/5de161d2a3fd4a9ee2823cd1195c61f7/invoke.js"></script>
<div id="container-5de161d2a3fd4a9ee2823cd1195c61f7"></div>
`, // shows at the bottom of each article page
  },
  midArticle: {
    label: 'Mid-article',
    format: 'rectangle',
    html: `<script async="async" data-cfasync="false" src="https://supportiveinvoicevarnish.com/5de161d2a3fd4a9ee2823cd1195c61f7/invoke.js"></script>
<div id="container-5de161d2a3fd4a9ee2823cd1195c61f7"></div>
`, // shows part-way down long article bodies
  },
}
