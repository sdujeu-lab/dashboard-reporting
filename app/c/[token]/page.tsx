import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { supabase } from '../../../lib/supabase'
import {
  getMonths,
  getSummary,
  getTrend,
  getQueries,
  getPages,
  getChannels,
  shiftMonth,
  pct,
  brandSplit,
  brandTermsOf,
} from '../../../lib/data'
import ThemeToggle from '../../../components/ThemeToggle'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = {
  title: 'Reporting',
  robots: { index: false, follow: false },
}

// 32 octets en base64url = 43 caractères
const TOKEN_RE = /^[A-Za-z0-9_-]{43}$/
const SKIP = new Set(['id', 'site_id', 'month', 'created_at', 'updated_at'])

const nf = (n: unknown) => Number(n || 0).toLocaleString('fr-FR')

// Première valeur texte "utile" d'une ligne, pour ne pas dépendre du nom exact des colonnes
function labelOf(row: any, prefer: string[]) {
  for (const k of prefer) if (typeof row?.[k] === 'string' && row[k]) return row[k] as string
  for (const [k, v] of Object.entries(row || {})) {
    if (!SKIP.has(k) && typeof v === 'string' && v) return v
  }
  return '—'
}

function shortUrl(u: string) {
  try {
    const x = new URL(u)
    return (x.pathname + x.search) || '/'
  } catch {
    return u
  }
}

function monthLabel(m: string) {
  const l = new Date(`${m}-01T12:00:00Z`).toLocaleDateString('fr-FR', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })
  return l.charAt(0).toUpperCase() + l.slice(1)
}

function Delta({ value }: { value: number | null }) {
  if (value === null) return <span className="text-slate-500">—</span>
  const up = value >= 0
  return (
    <span className={up ? 'text-green-700' : 'text-red-700'}>
      {up ? '▲' : '▼'} {Math.abs(value).toFixed(0)} % vs mois précédent
    </span>
  )
}

export default async function ClientReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>
  searchParams: Promise<{ month?: string }>
}) {
  const { token } = await params
  const { month: monthParam } = await searchParams

  if (!TOKEN_RE.test(token)) notFound()

  // Le site affiché vient de la base (via le jeton), jamais de l'adresse
  const { data: client } = await supabase
    .from('clients')
    .select('name, reporting_site_id')
    .eq('reporting_token', token)
    .maybeSingle()
  if (!client?.reporting_site_id) notFound()

  const { data: site } = await supabase
    .from('rpt_sites')
    .select('*')
    .eq('id', client.reporting_site_id)
    .maybeSingle()
  if (!site) notFound()

  const months = await getMonths(site.id)
  const month = monthParam && months.includes(monthParam) ? monthParam : months[0]

  if (!month) {
    return (
      <main className="mx-auto max-w-4xl space-y-4 p-6">
        <div className="flex items-start justify-between gap-4">
          <h1 className="text-2xl font-bold text-slate-900">{client.name}</h1>
          <ThemeToggle />
        </div>
        <p className="text-slate-600">
          Les premières données arriveront bientôt.
        </p>
      </main>
    )
  }

  const prevMonth = shiftMonth(month, 1)
  const [summary, prev, trend, queries, pages, channels] = await Promise.all([
    getSummary(site.id, month),
    getSummary(site.id, prevMonth),
    getTrend(site.id, month),
    getQueries(site.id, month),
    getPages(site.id, month),
    getChannels(site.id, month),
  ])

  const clicks = Number(summary?.clicks || 0)
  const impressions = Number(summary?.impressions || 0)
  const ctr = impressions ? (clicks / impressions) * 100 : 0
  const split = brandSplit(queries, brandTermsOf(site))
  const maxClicks = Math.max(1, ...trend.map((t: any) => Number(t.clicks || 0)))

  const card = 'rounded-xl bg-white p-5 shadow'
  const th = 'p-3 text-xs font-semibold uppercase tracking-wide text-slate-600'

  return (
    <main className="mx-auto max-w-4xl space-y-8 p-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{client.name}</h1>
          <p className="text-sm text-slate-600">
            Reporting · {monthLabel(month)}
          </p>
        </div>
        <form method="get" className="flex items-center gap-2">
          <label htmlFor="month" className="sr-only">
            Mois
          </label>
          <select
            id="month"
            name="month"
            defaultValue={month}
            className="rounded-lg border border-slate-400 px-3 py-2"
          >
            {months.map((m) => (
              <option key={m} value={m}>
                {monthLabel(m)}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white"
          >
            Afficher
          </button>
          <ThemeToggle />
        </form>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className={card}>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
            Clics
          </p>
          <p className="mt-1 text-3xl font-semibold tabular-nums text-slate-900">
            {nf(clicks)}
          </p>
          <p className="mt-1 text-sm">
            <Delta value={pct(clicks, prev?.clicks)} />
          </p>
        </div>
        <div className={card}>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
            Impressions
          </p>
          <p className="mt-1 text-3xl font-semibold tabular-nums text-slate-900">
            {nf(impressions)}
          </p>
          <p className="mt-1 text-sm">
            <Delta value={pct(impressions, prev?.impressions)} />
          </p>
        </div>
        <div className={card}>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
            Taux de clic
          </p>
          <p className="mt-1 text-3xl font-semibold tabular-nums text-slate-900">
            {ctr.toFixed(1).replace('.', ',')} %
          </p>
          <p className="mt-1 text-sm text-slate-600">
            Marque : {nf(split.brand)} clics · Hors marque : {nf(split.other)}
          </p>
        </div>
      </div>

      <section className={card}>
        <h2 className="mb-4 font-semibold text-slate-900">
          Clics sur 13 mois
        </h2>
        <div className="flex h-40 items-end gap-1">
          {trend.map((t: any) => {
            const c = Number(t.clicks || 0)
            const m = String(t.month).slice(0, 7)
            return (
              <div
                key={m}
                className="flex h-full flex-1 flex-col items-center justify-end gap-1"
              >
                <div
                  title={`${monthLabel(m)} : ${nf(c)} clics`}
                  className={m === month ? 'w-full rounded-t bg-blue-700' : 'w-full rounded-t bg-slate-400'}
                  style={{ height: `${Math.max(2, (c / maxClicks) * 100)}%` }}
                />
                <span className="text-[10px] text-slate-600">
                  {m.slice(5)}/{m.slice(2, 4)}
                </span>
              </div>
            )
          })}
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        <section className={card}>
          <h2 className="mb-3 font-semibold text-slate-900">
            Requêtes principales
          </h2>
          {queries.length > 0 ? (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b">
                  <th className={th}>Requête</th>
                  <th className={`${th} text-right`}>Clics</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {queries.slice(0, 10).map((q: any, i: number) => (
                  <tr key={i}>
                    <td className="p-3 text-slate-900">
                      {labelOf(q, ['query'])}
                    </td>
                    <td className="p-3 text-right tabular-nums text-slate-900">
                      {nf(q.clicks)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-sm text-slate-600">Pas de données ce mois-ci.</p>
          )}
        </section>

        <section className={card}>
          <h2 className="mb-3 font-semibold text-slate-900">Pages principales</h2>
          {pages.length > 0 ? (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b">
                  <th className={th}>Page</th>
                  <th className={`${th} text-right`}>Clics</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {pages.slice(0, 10).map((p: any, i: number) => (
                  <tr key={i}>
                    <td className="break-all p-3 text-slate-900">
                      {shortUrl(labelOf(p, ['page', 'url']))}
                    </td>
                    <td className="p-3 text-right tabular-nums text-slate-900">
                      {nf(p.clicks)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-sm text-slate-600">Pas de données ce mois-ci.</p>
          )}
        </section>
      </div>

      <section className={card}>
        <h2 className="mb-3 font-semibold text-slate-900">
          Visites par canal (Google Analytics)
        </h2>
        {channels.length > 0 ? (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b">
                <th className={th}>Canal</th>
                <th className={`${th} text-right`}>Sessions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {channels.map((c: any, i: number) => (
                <tr key={i}>
                  <td className="p-3 text-slate-900">
                    {labelOf(c, ['channel', 'channel_group', 'default_channel_group'])}
                  </td>
                  <td className="p-3 text-right tabular-nums text-slate-900">
                    {nf(c.sessions)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-sm text-slate-600">Pas de données ce mois-ci.</p>
        )}
      </section>

      <p className="text-xs text-slate-600">
        Données Google Search Console et Google Analytics 4 · La Fille du Web
      </p>
    </main>
  )
}