import { Fragment } from 'react'

// Mise en forme minimale des textes de synthèse : **gras** et lignes « - » en liste à puces.
// Tout est rendu en éléments React, aucun HTML n'est interprété.

const BULLET = /^\s*[-•*]\s+/

export function Inline({ text }: { text: string }) {
  const parts = text.split(/\*\*(.+?)\*\*/g)
  return (
    <>
      {parts.map((p, i) => (i % 2 ? <strong key={i} className="font-semibold">{p}</strong> : <Fragment key={i}>{p}</Fragment>))}
    </>
  )
}

export default function RichText({ text, className }: { text: string; className?: string }) {
  const blocks: { list: boolean; lines: string[] }[] = []
  for (const raw of text.split('\n')) {
    const line = raw.trimEnd()
    if (!line.trim()) { blocks.push({ list: false, lines: [] }); continue }
    const list = BULLET.test(line)
    const last = blocks[blocks.length - 1]
    if (last && last.list === list && last.lines.length) last.lines.push(list ? line.replace(BULLET, '') : line)
    else blocks.push({ list, lines: [list ? line.replace(BULLET, '') : line] })
  }
  return (
    <div className={`space-y-2 ${className || ''}`}>
      {blocks.filter((b) => b.lines.length).map((b, i) =>
        b.list ? (
          <ul key={i} className="list-disc space-y-1 pl-5">
            {b.lines.map((l, j) => <li key={j}><Inline text={l} /></li>)}
          </ul>
        ) : (
          <p key={i}>
            {b.lines.map((l, j) => <Fragment key={j}>{j > 0 && <br />}<Inline text={l} /></Fragment>)}
          </p>
        ),
      )}
    </div>
  )
}
