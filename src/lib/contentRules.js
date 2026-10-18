// Content rules for imports and for the review report (plan T17, section 8).
//
//  - `block`: the item must not be imported. These are the themes the site
//    does not publish: non-consensual or "leaked" material, forced themes,
//    anything that reads as youth/school, step-family/incest/taboo/in-law
//    themes, virgin themes, hypnosis/unconscious themes.
//  - `review`: allowed, but a person should look at it (family words such as
//    "mom", Desi relation words, a teacher without a student, someone
//    sleeping).
//
// The same rules drive the admin importers (src/pages/AdminUpload.jsx,
// AdminMovie.jsx) and scripts/review-content.mjs, which lists the existing
// catalogue rows that match.

const word = (alts) => new RegExp(`\\b(?:${alts})\\b`, 'i')

export const RULES = [
  { id: 'non-consent', level: 'block', label: 'non-consent',
    re: word('non-?consen\\w*|rape\\w*|drugged|passed out|blackmail\\w*|revenge porn|without (?:her )?permission|against (?:her|his) will|unaware') },
  { id: 'leaked-hidden-cam', level: 'block', label: 'leaked / hidden camera',
    re: word('leak(?:ed|s)?|mms|hidden ?cam\\w*|spy ?cam\\w*|voyeur\\w*') },
  { id: 'forced', level: 'block', label: 'forced',
    re: word('forc(?:e|ed|es|ing)|fo\\*+ed|coerc\\w*') },
  { id: 'youth-school', level: 'block', label: 'youth / school',
    re: word('teen\\w*|schoolgirl\\w*|school ?girl|students?|college(?: girl| student)?|barely legal|jailbait|lolita|sorority|18 ?yo|young(?:er)? (?:girl|boy|guy)') },
  { id: 'step-family', level: 'block', label: 'step-family / incest / taboo / in-law',
    re: word('step[- ]?(?:mom|mother|dad|father|son|daughter|sister|brother|sis|bro|family|parent)\\w*|stief\\w*|incest\\w*|taboo|(?:mother|father|sister|brother|daughter|son)[- ]in[- ]law|in-laws?') },
  { id: 'virgin', level: 'block', label: 'virgin',
    re: word('virgin\\w*') },
  { id: 'hypno', level: 'block', label: 'hypnosis / unconscious',
    re: word('hypno\\w*|mind control|brainwash\\w*|unconscious') },

  { id: 'family-word', level: 'review', label: 'family word',
    re: word('mom|mommy|mother|aunt|auntie|uncle|daughter|son|sister|brother|cousin|niece|nephew|grandma|grandpa') },
  { id: 'desi-relation', level: 'review', label: 'Desi relation word',
    re: word('devar|dever|jija|saali|sasur|sasural|bahu|chachi|chacha|nanad') },
  { id: 'teacher', level: 'review', label: 'teacher / professor',
    re: word('teacher|professor|tutor|principal') },
  { id: 'sleeping', level: 'review', label: 'sleeping',
    re: word('sleeping|asleep|wakes up') },
]

// "younger guy" stays listed on purpose: the 9-11 Oct 2026 rename of step-family
// titles turned "stepson" into "younger guy" (see the 301s in netlify.toml), so
// the retitled videos are still step-family content.

// slug is checked too: a title can be reworded while the URL still carries the
// blocked word (it is derived from the title when a row is imported).
const FIELDS = ['title', 'slug', 'tags', 'keywords', 'description']

// -> { block: [{ id, label, match }], review: [...] }
export function checkContent(movie) {
  const text = FIELDS.map((f) => movie?.[f] || '').join(' ')
  const out = { block: [], review: [] }
  for (const rule of RULES) {
    const m = text.match(rule.re)
    if (m) out[rule.level].push({ id: rule.id, label: rule.label, match: m[0] })
  }
  return out
}

export const describe = (hits) => hits.map((h) => `${h.label} ("${h.match}")`).join(', ')
