/** Renders post text with @mention links like legacy createPostHTML. */
export function PostText({ text }: { text: string }) {
  const parts = String(text).split(/(@[a-zA-Z0-9_]+)/g)
  return (
    <>
      {parts.map((part, i) => {
        const m = part.match(/^@([a-zA-Z0-9_]+)$/)
        if (m) {
          return (
            <a key={i} href={`#/profile/${encodeURIComponent(m[1])}`} className="mention">
              @{m[1]}
            </a>
          )
        }
        return <span key={i}>{part}</span>
      })}
    </>
  )
}
