import { Fragment } from 'react'
import { Link } from 'react-router-dom'
import { introParts } from '../lib/introLinks'

// One paragraph of a hand-written intro, with its [words](/path) links (src/lib/introLinks.js).
export default function IntroText({ text, className }) {
  return (
    <p className={className}>
      {introParts(text).map((part, i) => (part.to ? <Link key={i} to={part.to}>{part.text}</Link> : <Fragment key={i}>{part.text}</Fragment>))}
    </p>
  )
}
