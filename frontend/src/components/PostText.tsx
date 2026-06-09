import { Link } from 'react-router-dom'

/** Renders post text with @mention links like legacy createPostHTML. */
export function PostText({ text }: { text: string }) {
  const parts = String(text).split(/(@[a-zA-Z0-9_]+)/g)
  return (
    <>
      {parts.map((part, i) => {
        const m = part.match(/^@([a-zA-Z0-9_]+)$/)
        if (m) {
          return (
            <Link key={i} to={`/profile/${encodeURIComponent(m[1])}`} className="mention">
              @{m[1]}
            </Link>
          )
        }
        return <span key={i}>{part}</span>
      })}
    </>
  )
}
