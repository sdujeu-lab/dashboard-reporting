import { getSites, getMonths, getSummary, getQueries, getPages, getChannels, shiftMonth } from '../../lib/data'
import PrintButton from '../../components/PrintButton'

export const dynamic = 'force-dynamic'

const fmt = (n: number) => new Intl.NumberFormat('fr-FR').format(Math.round(n))
const fmt1 = (n: number) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(n)
const inRange = (m: string, a: string, b: string) => m >= a && m <= b
const MOIS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."]
const ml = (m: string) => MOIS[Number(m.slice(5, 7)) - 1] + " " + m.slice(0, 4)
const rng = (a: string, b: string) => (a === b ? ml(a) : ml(a) + " → " + ml(b))

async function aggregate(siteId: string, months: string[]) {
  const sums = await Promise.all(months.map((m) => getSummary(siteId, m)))
  let clicks = 0, impressions = 0, posW = 0
  for (const s of sums) {
    if (!s) continue
    clicks += s.clicks || 0
    impressions += s.impressions || 0
    posW += (s.position || 0) * (s.impressions || 0)
  }
  const chans = await Promise.all(months.map((m) => getChannels(siteId, m)))
  const sessions = chans.flat().reduce((t: number, r: any) => t + (r.sessions || 0), 0)
  return {
    clicks,
    impressions,
    ctr: impressions ? (clicks / impressions) * 100 : 0,
    position: impressions ? posW / impressions : 0,
    sessions,
  }
}

async function aggRows(siteId: string, months: string[], kind: 'q' | 'p') {
  const all = await Promise.all(months.map((m) => (kind === 'q' ? getQueries(siteId, m) : getPages(siteId, m))))
  const map = new Map<string, number>()
  for (const r of all.flat() as any[]) {
    const k = r.query ?? r.page ?? r.url ?? r.keys?.[0] ?? ''
    map.set(k, (map.get(k) || 0) + (r.clicks || 0))
  }
  return map
}

function diffRows(a: Map<string, number>, b: Map<string, number>) {
  const keys = new Set([...a.keys(), ...b.keys()])
  return [...keys].map((k) => ({ k, a: a.get(k) || 0, b: b.get(k) || 0, d: (a.get(k) || 0) - (b.get(k) || 0) }))
}

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams
  const sites: any[] = await getSites()
  const site = sites.find((s) => s.domain === sp.d) || sites[0]
  if (!site) return <main className="p-8">Aucun client.</main>
  const months = (await getMonths(site.id)).slice().sort()
  if (months.length < 2) return <main className="p-8"><p>Pas assez de mois synchronisés pour ce client. Choisis-en un autre :</p><div className="mt-2 flex flex-wrap gap-3">{sites.map((s) => <a key={s.id} href={"/comparer?d=" + s.domain} className="underline">{s.client_name}</a>)}</div></main>
  const last = months[months.length - 1]
  const pick = (v: string | undefined, def: string) =>
    v && months.includes(v) ? v : months.includes(def) ? def : months[0]

  const a2 = pick(sp.a2, last)
  const a1 = pick(sp.a1, shiftMonth(a2, 2))
  const b2 = pick(sp.b2, shiftMonth(a1, 1))
  const b1 = pick(sp.b1, shiftMonth(b2, 2))
  const mA = months.filter((m) => inRange(m, a1, a2))
  const mB = months.filter((m) => inRange(m, b1, b2))

  const [A, B, qa, qb, pa, pb] = await Promise.all([
    aggregate(site.id, mA), aggregate(site.id, mB),
    aggRows(site.id, mA, 'q'), aggRows(site.id, mB, 'q'),
    aggRows(site.id, mA, 'p'), aggRows(site.id, mB, 'p'),
  ])
  const link = (o: Record<string, string>) =>
    `/comparer?${new URLSearchParams({ d: site.domain, ...o }).toString()}`

  const rows = [
    { label: 'Clics', a: A.clicks, b: B.clicks, f: fmt, low: false },
    { label: 'Impressions', a: A.impressions, b: B.impressions, f: fmt, low: false },
    { label: 'CTR', a: A.ctr, b: B.ctr, f: (n: number) => fmt1(n) + ' %', low: false },
    { label: 'Position moyenne', a: A.position, b: B.position, f: fmt1, low: true },
    { label: 'Sessions GA4', a: A.sessions, b: B.sessions, f: fmt, low: false },
    { label: "Pages visibles dans Google", a: pa.size, b: pb.size, f: fmt, low: false },
  ]
  const presets: [string, Record<string, string>][] = [
    ['3 derniers mois vs 3 précédents', { a1: shiftMonth(last, 2), a2: last, b1: shiftMonth(last, 5), b2: shiftMonth(last, 3) }],
    ['3 derniers mois vs N-1', { a1: shiftMonth(last, 2), a2: last, b1: shiftMonth(last, 14), b2: shiftMonth(last, 12) }],
    ['Dernier mois vs précédent', { a1: last, a2: last, b1: shiftMonth(last, 1), b2: shiftMonth(last, 1) }],
    ['Dernier mois vs N-1', { a1: last, a2: last, b1: shiftMonth(last, 12), b2: shiftMonth(last, 12) }],
  ]

  return (
    <main className="mx-auto max-w-5xl p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Comparer deux périodes · {site.client_name}</h1>
        <PrintButton />
      </div>
      <div className="mt-3 flex flex-wrap gap-2 text-sm print:hidden">
        {presets.map(([t, o]) => (
          <a key={t} href={link(o)} className="rounded-full border px-3 py-1 hover:bg-gray-100">{t}</a>
        ))}
      </div>

      <form className="mt-4 flex flex-wrap items-end gap-3 rounded-lg border bg-white p-3 text-sm print:hidden">
        <label className="flex flex-col gap-1">Client
          <select key={site.domain} name="d" defaultValue={site.domain} className="rounded-lg border bg-white px-2 py-1">
            {sites.map((s) => <option key={s.id} value={s.domain}>{s.client_name}</option>)}
          </select>
        </label>
        <Sel name="a1" value={a1} months={months} label="Période affichée : de" />
        <Sel name="a2" value={a2} months={months} label="à" />
        <Sel name="b1" value={b1} months={months} label="Comparée à : de" />
        <Sel name="b2" value={b2} months={months} label="à" />
        <button className="rounded-lg bg-gray-900 px-4 py-1.5 text-white">Comparer</button>
      </form>

      <p className="mt-4 text-sm text-gray-600">
        {rng(a1, a2)} comparé à {rng(b1, b2)}
      </p>
      <table className="mt-2 w-full text-sm">
        <thead>
          <tr className="border-b text-left text-gray-500">
            <th className="py-2">Indicateur</th>
            <th className="text-right">{rng(a1, a2)}</th>
            <th className="text-right">{rng(b1, b2)}</th>
            <th className="text-right">Écart</th>
            <th className="text-right">%</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const d = r.a - r.b
            const good = r.low ? d < 0 : d > 0
            const cls = d === 0 ? 'text-gray-500' : good ? 'text-green-600' : 'text-red-600'
            const p = r.b ? (d > 0 ? '+' : '') + fmt1((d / r.b) * 100) + ' %' : '–'
            return (
              <tr key={r.label} className="border-b">
                <td className="py-2">{r.label}</td>
                <td className="text-right">{r.f(r.a)}</td>
                <td className="text-right">{r.f(r.b)}</td>
                <td className={'text-right ' + cls}>{d > 0 ? '+' : ''}{fmt1(d)}</td>
                <td className={'text-right ' + cls}>{p}</td>
              </tr>
            )
          })}
        </tbody>
      </table>

      <div className="mt-8 grid gap-6 md:grid-cols-2">
        <DiffTable title="Requêtes en hausse" rows={top(diffRows(qa, qb), true)} la={rng(a1, a2)} lb={rng(b1, b2)} />
        <DiffTable title="Requêtes en baisse" rows={top(diffRows(qa, qb), false)} la={rng(a1, a2)} lb={rng(b1, b2)} />
        <DiffTable title="Pages en hausse" rows={top(diffRows(pa, pb), true)} la={rng(a1, a2)} lb={rng(b1, b2)} />
        <DiffTable title="Pages en baisse" rows={top(diffRows(pa, pb), false)} la={rng(a1, a2)} lb={rng(b1, b2)} />
      </div>
    </main>
  )
}

function Sel({ name, value, months, label }: { name: string; value: string; months: string[]; label: string }) {
  return (
    <label className="flex flex-col gap-1">{label}
      <select key={value} name={name} defaultValue={value} className="rounded-lg border bg-white px-2 py-1">
        {months.map((m) => <option key={m} value={m}>{m}</option>)}
      </select>
    </label>
  )
}

type Diff = { k: string; a: number; b: number; d: number }
function top(rows: Diff[], up: boolean) {
  return rows
    .filter((r) => (up ? r.d > 0 : r.d < 0))
    .sort((x, y) => (up ? y.d - x.d : x.d - y.d))
    .slice(0, 15)
}

function DiffTable({ title, rows, la, lb }: { title: string; rows: Diff[]; la: string; lb: string }) {
  return (
    <section>
      <h2 className="mb-2 font-semibold">{title}</h2>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-gray-500">
            <th className="py-1">Élément</th>
            <th className="text-right">{la}</th>
            <th className="text-right">{lb}</th>
            <th className="text-right">Écart</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.k} className="border-b">
              <td className="max-w-[16rem] truncate py-1" title={r.k}>{r.k.replace(/^https?:\/\/[^/]+/, '') || r.k}</td>
              <td className="text-right">{fmt(r.a)}</td>
              <td className="text-right">{fmt(r.b)}</td>
              <td className={'text-right ' + (r.d > 0 ? 'text-green-600' : 'text-red-600')}>{r.d > 0 ? '+' : ''}{fmt(r.d)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}
