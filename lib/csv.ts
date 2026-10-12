export function parseCsv(text: string): string[][] {
  const t = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter((l) => !l.startsWith('#')).join('\n')
  const first = t.split('\n').find((l) => l.trim() !== '') || ''
  const d = first.includes('\t') ? '\t' : (first.match(/;/g) || []).length > (first.match(/,/g) || []).length ? ';' : ','
  const rows: string[][] = []
  let row: string[] = []
  let cur = ''
  let q = false
  for (let i = 0; i < t.length; i++) {
    const c = t[i]
    if (q) {
      if (c === '"') { if (t[i + 1] === '"') { cur += '"'; i++ } else q = false } else cur += c
    } else if (c === '"') q = true
    else if (c === d) { row.push(cur); cur = '' }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && t[i + 1] === '\n') i++
      row.push(cur); cur = ''
      if (row.some((x) => x.trim() !== '')) rows.push(row)
      row = []
    } else cur += c
  }
  row.push(cur)
  if (row.some((x) => x.trim() !== '')) rows.push(row)
  return rows
}

export const toInt = (v: any) => Number(String(v ?? '').replace(/[^\d]/g, '')) || 0
export const toFloat = (v: any) => { const n = parseFloat(String(v ?? '').replace(/[%\s\u00a0\u202f]/g, '').replace(',', '.')); return Number.isFinite(n) ? n : 0 }
export const toCtr = (v: any) => { const raw = String(v ?? ''); const n = toFloat(raw); return raw.includes('%') || n > 1 ? n / 100 : n }

export function idx(head: string[], test: RegExp | ((h: string) => boolean), fb: number) {
  const f = typeof test === 'function' ? test : (h: string) => test.test(h)
  const i = head.findIndex((h) => f(h.toLowerCase()))
  return i >= 0 ? i : fb
}

export function kindOfFile(head: string, name: string): string {
  const test = (s: string) => {
    const x = s.toLowerCase()
    if (/canal|channel/.test(x)) return 'ga4'
    if (/pays|countr/.test(x)) return 'countries'
    if (/appareil|device/.test(x)) return 'devices'
    if (/^date|jour|\bday\b/.test(x)) return 'dates'
    if (/page|url/.test(x)) return 'pages'
    if (/requ|quer/.test(x)) return 'queries'
    return ''
  }
  return test(head) || test(name) || (/graph|chart/i.test(name) ? 'dates' : '')
}
