// node scripts/test-article-html.mjs — the parts of src/lib/articleHtml.js that need no browser
// (the HTML cleaning itself is DOMPurify's, and is checked in the browser).
import assert from 'node:assert/strict'
import { articleAdvice, articleChecks, cleanArticleHtml, demoteH1 } from '../src/lib/articleHtml.js'

const body = `<h1>Intro</h1><p>One two three <a href="/category/milf">MILF</a> and <a href="https://vexn.org/channel/ullu">Ullu</a>
and <a href="https://example.com">out</a>.</p><h2>A</h2><h3>a</h3><h2 class="x">B</h2><img src="/a.jpg" alt="An image"><img src="/b.jpg">`

const cases = [
  () => assert.equal(demoteH1('<h1>T</h1><h1 class="a">U</h1><h10>'), '<h2>T</h2><h2 class="a">U</h2><h10>'),
  () => assert.equal(demoteH1(null), ''),
  () => assert.equal(cleanArticleHtml('<h1>T</h1><p>x</p>'), '<h2>T</h2><p>x</p>'), // without a DOM (the build): stored HTML as is, h1 demoted
  () => {
    const c = articleChecks(body)
    assert.equal(c.h1, 1)
    assert.equal(c.h2, 2)
    assert.equal(c.h3, 1)
    assert.equal(c.internalLinks, 2)
    assert.equal(c.externalLinks, 1)
    assert.equal(c.images, 2)
    assert.equal(c.imagesWithoutAlt, 1)
    assert.equal(c.words, 13) // "out." splits off its full stop: punctuation counts as a word, which is fine for a length hint
  },
  () => assert.deepEqual(articleChecks(''), { words: 0, h1: 0, h2: 0, h3: 0, internalLinks: 0, externalLinks: 0, images: 0, imagesWithoutAlt: 0 }),
  () => {
    const advice = articleAdvice({ content: body, title: 'A title that is long enough to count', seo_description: 'x'.repeat(150) })
    assert.equal(advice.length, 7)
    assert.equal(advice.find((a) => /Search description/.test(a.text)).ok, true)
    assert.equal(advice.find((a) => /words/.test(a.text)).ok, false)
    assert.equal(advice.find((a) => /h1/i.test(a.text)).ok, false)
  },
]

let failed = 0
cases.forEach((run, i) => {
  try { run() } catch (err) { failed++; console.log(`  FAIL #${i + 1}: ${err.message.split('\n').slice(0, 4).join(' | ')}`) }
})
console.log(`${cases.length - failed}/${cases.length} passed`)
process.exit(failed ? 1 : 0)
