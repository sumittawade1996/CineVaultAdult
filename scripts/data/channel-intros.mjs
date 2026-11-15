// Hand-written channel intros (source of truth for the rows in `channel_descriptions`).
//
//   node scripts/seed-copy.mjs          checks these and the performer bios, writes
//                                       supabase/migrations/023_seed_site_copy.sql
//   npm run check:copy                  checks every link against the live site (indexed pages only)
//
// Links use the intro format of src/lib/introLinks.js: [words](/category/milf). A blank line starts a paragraph;
// the page shows the first above the videos and the rest below them under "About <channel>". Describe what the
// channel really holds; no exact counts (they go stale) and no superlatives (best, top-rated, exclusive). "Free" and
// "HD" (where most videos are) are fine: owner decision 2026-11-11, see scripts/lib/copyRules.mjs.
// `npm run dev` shows this text in place of the database (src/lib/localCopy.js); the live site shows the database.

export const CHANNEL_INTROS = {
  brazzers: `Watch free Brazzers videos on VEXN: full Brazzers scenes from the main site and from Brazzers Exxtra, most of them in HD and built around [big tits](/category/big-tits), [MILF](/category/milf) roles and a credited pornstar cast. The newer additions run 20 minutes or longer.

[Angela White](/actor/angela-white) appears in more Brazzers scenes here than anyone else, which makes the Angela White Brazzers scenes the obvious place to start. [Ricky Johnson](/actor/ricky-johnson), [Jordi Jae](/actor/jordi-jae) and [Violet Myers](/actor/violet-myers) also come up more than once, alongside Keiran Lee, Danny Delano and Scott Nails.

Alongside the Brazzers MILF scenes, the most common pairings are [brunette](/category/brunette), [big ass](/category/big-ass), [blowjob](/category/blowjob) and [hardcore](/category/hardcore). Group scenes are tagged [threesome](/category/threesome) or [group sex](/category/group-sex), and the [anal](/category/anal) scenes are tagged too. Smaller Brazzers sites such as Real Wife Stories, Big Wet Butts, Day With A Pornstar and Hot And Mean are filed under Brazzers as well.

Similar studio channels are [Adult Time](/channel/adult-time), [Reality Kings](/channel/reality-kings), [Vixen](/channel/vixen) and [Bangbros](/channel/bangbros), and the [list of channels](/channels) covers every studio and app on VEXN. Each video page lists the cast, tags and runtime, and the video plays from its source site.`,

  ullu: `Watch Ullu web series free on VEXN: Hindi originals from the Ullu app, streamed episode by episode with the series name, season and episode number in every title, so a series such as The Bucket List or Walkman plays in order.

The channel holds episodes of The Bucket List, Walkman, Nurse, Khalish, Anokha Rishta, Secretary, Aah Se Aaha Tak, Adha Adhura Pyaar and Tohfa, among others. Most episodes run about half an hour, and some uploads run well past an hour.

Ullu episodes are tagged [Indian](/category/indian), [Desi](/category/desi) and [Hindi](/category/hindi). The stories lean on Desi [bhabhi](/category/bhabhi) and [housewife](/category/housewives) roles and slow, [romantic](/category/romantic) build-ups.

For more Hindi web series, see the [Fliz Movies](/channel/fliz-movies) and [Rabbit Movies](/channel/rabbit-movies) channels, or the latest additions on [New on VEXN](/new). Each episode page lists the runtime and tags, and the video plays from its source site.`,

  'nuru-massage': `Free Nuru massage videos on VEXN: slow, oiled body-to-body massage scenes in which the masseuse works with a slippery nuru gel, most of them half an hour or longer.

Nuru is a Japanese massage style, and these studio scenes follow it: a long [massage](/category/massage) on the table or a mat before the sex. Many feature [big tits](/category/big-tits) and [MILF](/category/milf) masseuses, mostly [brunette](/category/brunette) performers, and a few are [lesbian](/category/lesbian) massages.

[Seth Gamble](/actor/seth-gamble) and [Chanel Preston](/actor/chanel-preston) appear in more than one scene, as do Payton Preslee, Siri Dahl and Rion King.

For Japanese features of an hour or more, see [JAV Movies](/channel/jav-movies) and the [Japanese](/category/japanese) category. Each video page lists the cast, tags and runtime, and the video plays from its source site.`,

  'adult-time': `Watch free Adult Time scenes on VEXN: full-length studio scenes from the Adult Time streaming network, most of them 20 minutes or longer and led by well-known pornstars.

[Angela White](/actor/angela-white) appears in more Adult Time scenes here than anyone else, and [Lena Paul](/actor/lena-paul), [Romi Rain](/actor/romi-rain) and [Alina Lopez](/actor/alina-lopez) each appear more than once.

Adult Time is known for girl-girl scenes, and several here are [lesbian](/category/lesbian). The rest lean on [big tits](/category/big-tits), [big ass](/category/big-ass) and [PAWG](/category/pawg) performers, with [MILF](/category/milf) roles and some [anal](/category/anal).

Related studio channels are [Brazzers](/channel/brazzers), [Vixen](/channel/vixen) and [Nuru Massage](/channel/nuru-massage). Each video page lists the cast, tags and runtime, and the video plays from its source site.`,

  bangbros: `Free Bangbros videos on VEXN: full-length Bangbros scenes, every one 20 minutes or longer, most of them centred on a [big ass](/category/big-ass) and a [big dick](/category/big-dick). A few come from Ass Parade, the Bangbros site for big-butt scenes.

The cast changes from scene to scene, so the channel is easiest to browse by theme: [anal](/category/anal), [MILF](/category/milf) and [blonde](/category/blonde) scenes, plus a few with [Japanese](/category/japanese) performers.

For more [PAWG](/category/pawg) and big ass studio scenes, see [Adult Time](/channel/adult-time) and [Brazzers](/channel/brazzers). Each video page lists the cast, tags and runtime, and the video plays from its source site.`,

  vixen: `Free Vixen videos on VEXN: polished, cinematic studio scenes from Vixen, usually around half an hour long, often with [lingerie](/category/lingerie) and a slow build-up.

[Blake Blossom](/actor/blake-blossom), [Angela White](/actor/angela-white), [Johnny Sins](/actor/johnny-sins) and [Alina Lopez](/actor/alina-lopez) each appear in more than one Vixen scene here.

Common themes are [threesome](/category/threesome) and [group sex](/category/group-sex) scenes, [interracial](/category/interracial) pairings, [Asian](/category/asian) performers, and scenes shot [outdoors](/category/outdoor) or in [public](/category/public).

Related channels are [Adult Time](/channel/adult-time), [Brazzers](/channel/brazzers) and [Reality Kings](/channel/reality-kings). Each video page lists the cast, tags and runtime, and the video plays from its source site.`,

  'reality-kings': `Free Reality Kings videos on VEXN: short clips from the Reality Kings network, most of them in HD and each around ten minutes, for a quick watch rather than a full feature.

Performers include [Jordi Jae](/actor/jordi-jae), [Xander Corvus](/actor/xander-corvus) and Sarah Vandella, and the scenes are tagged [big dick](/category/big-dick), [big tits](/category/big-tits), [small tits](/category/small-tits), [Latina](/category/latina) and [redhead](/category/redhead).

For full-length studio scenes, see [Brazzers](/channel/brazzers), [Bangbros](/channel/bangbros) and [Adult Time](/channel/adult-time). Each video page lists the cast, tags and runtime, and the video plays from its source site.`,

  'jav-movies': `Watch free JAV movies on VEXN: uncensored JAV, Japanese housewife and MILF features, full-length Japanese adult movies of one to almost three hours.

Most are [Japanese](/category/japanese) housewife and [MILF](/category/milf) stories, with [big tits](/category/big-tits), [creampie](/category/creampie) and [cheating](/category/cheating) plots common. Mary Tachibana, Waka Misono and Hana Haruna appear in more than one feature.

Shorter Japanese scenes are in the [JAV](/category/jav) category, and [Nuru Massage](/channel/nuru-massage) has studio scenes in a Japanese massage style. Each feature page lists the cast, tags and runtime, and the video plays from its source site.`,

  'fliz-movies': `Watch Fliz Movies web series free on VEXN: Hindi episodes from the Fliz app, several of them Desi bhabhi stories, each about half an hour and filed with the series name and episode number.

Series include Sarla Bhabhi, Mere Husband Kee Dulhaniya, Rasam, Rosgulla and The Cult. They are tagged [Indian](/category/indian), [Desi](/category/desi) and [Hindi](/category/hindi), with [bhabhi](/category/bhabhi) and [housewives](/category/housewives) roles at the centre.

More Hindi web series are on the [Ullu](/channel/ullu) and [Rabbit Movies](/channel/rabbit-movies) channels. Each episode page lists the runtime and tags, and the video plays from its source site.`,

  'rabbit-movies': `Watch Rabbit Movies web series free on VEXN: Hindi episodes from the Rabbit app, each around 40 minutes long, including Desi bhabhi stories.

Series include Rose Marlo, Jalebi, London Bhabhi and Lodam Bhabhi, tagged [Indian](/category/indian), [Desi](/category/desi), [Hindi](/category/hindi) and [bhabhi](/category/bhabhi).

More Hindi web series are on the [Ullu](/channel/ullu) and [Fliz Movies](/channel/fliz-movies) channels. Each episode page lists the runtime and tags, and the video plays from its source site.`,

  'nubile-films': `Free Nubile Films videos on VEXN: sensual, slow-paced studio scenes from Nubile Films, each longer than 20 minutes.

Holly Michaels appears twice, with Evfrat Mai, Grace Hartley and Xenia in the others. The scenes include a [threesome](/category/threesome), a [lesbian](/category/lesbian) scene and a [creampie](/category/creampie).

For more slow, [romantic](/category/romantic) scenes, see the [Nuru Massage](/channel/nuru-massage) channel. Each video page lists the cast, tags and runtime, and the video plays from its source site.`,

  vexn: `The VEXN channel collects free videos that do not belong to a named studio or app: single scenes, compilations, Desi clips and Indian adult movies, and full-length features of almost three hours from Eporner and other sources. More than half run 30 minutes or longer.

[Big tits](/category/big-tits), [MILF](/category/milf) and [brunette](/category/brunette) are the most common tags, followed by [big ass](/category/big-ass), [hardcore](/category/hardcore) and [blonde](/category/blonde). The [Desi](/category/desi) and [Indian](/category/indian) videos sit here too.

The most credited performers are [Lana Rhoades](/actor/lana-rhoades), [Dani Daniels](/actor/dani-daniels), [Kendra Sunderland](/actor/kendra-sunderland), [Lauren Phillips](/actor/lauren-phillips), [Alyx Star](/actor/alyx-star), [Blake Blossom](/actor/blake-blossom), [Angela White](/actor/angela-white) and [Lena Paul](/actor/lena-paul). Studio scenes have their own channels, listed under [all channels](/channels). Every video plays from its source site.`,

  'ai-movie': `AI Movie collects short AI-generated fantasy films, five to ten minutes each, told through synthetic narration and generated visuals. Common themes are [roleplay](/category/roleplay) and [MILF](/category/milf) scenarios, some set [outdoors](/category/outdoor), and a few are tagged [Indian](/category/indian).

No performers are credited because no real people appear. For filmed stories with a cast, see the Hindi web series on [Ullu](/channel/ullu) or the [romantic](/category/romantic) category. Every video plays from its source site.`,

  comatozze: `Comatozze collects the amateur, homemade videos credited to Comatozze, 12 to 22 minutes each. All are tagged [amateur](/category/amateur) and [homemade](/category/homemade), about half are filmed [POV](/category/pov), and [big dick](/category/big-dick) and [big tits](/category/big-tits) are the other common tags.

The same videos are on the [Comatozze performer page](/actor/comatozze), which also lists one scene filed under the VEXN channel. Every video plays from its source site, and each video page lists the cast, tags and length.`,

  ibamovies: `Ibamovies groups the web-series episodes whose titles name Ibamovies, including Hindi and Malayalam episodes of about 20 to 26 minutes. They are tagged [Indian](/category/indian) and [Desi](/category/desi), with [housewives](/category/housewives) and [MILF](/category/milf) roles.

More Hindi web series are on the [Ullu](/channel/ullu), [Fliz Movies](/channel/fliz-movies) and [Rabbit Movies](/channel/rabbit-movies) channels. Every video plays from its source site.`,

  'new-sensations': `New Sensations scenes on VEXN are short, about 12 to 13 minutes each, and most are girl-girl scenes tagged [lesbian](/category/lesbian), several with [masturbation](/category/masturbation).

[Alyx Star](/actor/alyx-star) appears in more than one, as do [Dani Daniels](/actor/dani-daniels) and [Karla Kush](/actor/karla-kush), with [Romi Rain](/actor/romi-rain) in another. For longer girl-girl scenes, see [Adult Time](/channel/adult-time). Every video plays from its source site.`,

  'naughty-america': `Naughty America clips on VEXN: short scenes of 5 to 18 minutes, several with [MILF](/category/milf) performers, [big tits](/category/big-tits) and [big ass](/category/big-ass).

[Ava Addams](/actor/ava-addams) appears here, with Reagan Foxx, Aleksa Mink and Gianna Michaels among the others. For full-length studio scenes, see [Brazzers](/channel/brazzers) and [Bangbros](/channel/bangbros). Every video plays from its source site.`,

  'modern-day-sins': `Modern-Day Sins scenes on VEXN run about 16 minutes and are built around [sneaky sex](/category/sneaky-sex): the chance of getting caught is part of the set-up.

Isiah Maxwell, Kenna James and Jane Wilde are among the performers, two scenes are also tagged [fetish](/category/fetish), and one is [interracial](/category/interracial). For more studio scenes, see [Brazzers](/channel/brazzers) and [Adult Time](/channel/adult-time). Every video plays from its source site.`,

  tushy: `Free Tushy videos on VEXN: short [anal](/category/anal) scenes from Tushy, the studio known for glossy, cinematic anal sex, each around 12 minutes long.

Every scene here is tagged anal and [big tits](/category/big-tits), many add [lingerie](/category/lingerie), and a few are [threesome](/category/threesome) scenes. [Oliver Flynn](/actor/oliver-flynn) appears in two, and [Gabbie Carter](/actor/gabbie-carter) and [Violet Myers](/actor/violet-myers) each star in one.

For longer studio scenes, see [Vixen](/channel/vixen), from the same studio group, and [Brazzers](/channel/brazzers). Each video page lists the cast, tags and runtime, and the video plays from its source site.`,

  'sex-art': `Free Sex Art videos on VEXN: slow, [romantic](/category/romantic) scenes from the Sex Art studio, each 20 to 27 minutes, with soft light and a long build-up.

The scenes star Ambar Lapiedra, Christy White, Angelika Grays and Berta Lusty, all are tagged [big ass](/category/big-ass), and a couple end in a [creampie](/category/creampie).

For more sensual studio scenes, see [Nubile Films](/channel/nubile-films) and the [erotic](/category/erotic) category. Each video page lists the cast, tags and runtime, and the video plays from its source site.`,
}

// Optional search titles (30-53 characters; the site adds " | VEXN"). A channel without one gets
// "Free <name> Porn Videos and Full Scenes". Editable later in Admin > Site content > Channel intros.
export const CHANNEL_SEO_TITLES = {
  'jav-movies': 'Free JAV Movies – Full-Length Uncensored JAV',
  ullu: 'Ullu Web Series – Watch Free Hindi Episodes',
  'fliz-movies': 'Fliz Movies Web Series – Free Hindi Episodes',
  'rabbit-movies': 'Rabbit Movies Web Series – Free Hindi Episodes',
  'nuru-massage': 'Free Nuru Massage Videos – Oil Massage Scenes',
  'ai-movie': 'AI Movie – Free AI-Generated Adult Films',
  tushy: 'Free Tushy Videos – Anal Scenes From Tushy',
  'sex-art': 'Free Sex Art Videos – Romantic Studio Scenes',
}

// Optional search descriptions (140-160 characters, plain text, no links). A channel without one gets the first
// sentences of its intro. Editable later in Admin > Site content > Channel intros.
export const CHANNEL_SEO_DESCRIPTIONS = {
  'jav-movies': 'Watch free JAV movies on VEXN: full-length uncensored Japanese adult films, housewife and MILF features of one to almost three hours, newest first.',
  ullu: 'Watch Ullu web series free on VEXN: Hindi episodes from the Ullu app, filed by series, season and episode number so every Desi drama plays in order.',
  'fliz-movies': 'Watch Fliz Movies web series free on VEXN: Hindi episodes from the Fliz app, Desi bhabhi stories among them, about half an hour each, in episode order.',
  'rabbit-movies': 'Watch Rabbit Movies web series free on VEXN: Hindi episodes from the Rabbit app, around 40 minutes each, with Desi bhabhi stories and episode numbers.',
  'nuru-massage': 'Free Nuru massage videos on VEXN: slow, oiled body-to-body massage scenes with slippery nuru gel, most of them half an hour or longer, newest first.',
  'ai-movie': 'Free AI-generated adult films on VEXN: AI fantasy videos with synthetic narration and generated visuals, from roleplay and MILF to Indian scenarios.',
  tushy: 'Free Tushy videos on VEXN: anal scenes from the Tushy studio, known for glossy, cinematic anal sex, about 12 minutes each. Cast and length on every page.',
  'sex-art': 'Free Sex Art videos on VEXN: slow, romantic studio scenes with soft light and a long build-up, each 20 to 27 minutes. Cast and length on every page.',
}
