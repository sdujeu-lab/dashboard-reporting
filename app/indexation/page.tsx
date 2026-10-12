import { createClient } from '@supabase/supabase-js'
import { getSites } from '../../lib/data'
import { getIdxStatus } from '../../lib/indexcheck'
import { launchIndex } from './actions'
import RankRefresh from '../mesurer/RankRefresh'
import PrintButton from '../../components/PrintButton'

export const dynamic = 'force-dynamic'

const db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!, {
  auth: { persistSession: false },
})

export default async function Page({ searchParams }: { searchParams: Promise<{ d?: string; vue?: string }> }) {
  const sp = await searchParams
  const sites: any[] = await getSites()
  const site = sites.find((s) => s.domain === sp.d) || sites[0]
  if (!site) return <main className="p-8">Aucun client.</main>
  const st = getIdxStatus(site.id)
  const client = sp.vue === "client"
  const { data: hist } = await db
    .from('rpt_index_monthly').select('*').eq('site_id', site.id)
    .order('month', { ascending: false }).limit(12)
  const { data: bad } = await db
    .from('rpt_index_urls').select('url,state').eq('site_id', site.id)
    .or('indexed.is.null,indexed.eq.false').in('in_sitemap', client ? [true] : [true, false]).order('state').limit(300)
  const histV = (hist || []).map((h: any) => ({ month: h.month, total: client ? h.total_sitemap : h.total, indexed: client ? h.indexed_sitemap : h.indexed }))
  const byState = new Map<string, number>()
  for (const r of bad || []) byState.set(r.state, (byState.get(r.state) || 0) + 1)

  return (
    <main className="mx-auto max-w-4xl p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">{client ? "Pages du sitemap indexées" : "Indexation (contrôle)"} · {site.client_name}</h1>
        <PrintButton />
      </div>
      <div className="mt-3 flex gap-2 text-sm print:hidden">
        <a href={"/indexation?d=" + site.domain} className={"rounded-full border px-3 py-1 " + (client ? "" : "bg-gray-900 text-white")}>Vue contrôle</a>
        <a href={"/indexation?d=" + site.domain + "&vue=client"} className={"rounded-full border px-3 py-1 " + (client ? "bg-gray-900 text-white" : "")}>Vue client (sitemap)</a>
      </div>
      <form className="mt-4 flex gap-2 print:hidden">
        <input type="hidden" name="vue" value={sp.vue ?? ""} />        <select key={site.domain} name="d" defaultValue={site.domain} className="rounded-lg border bg-white px-3 py-1.5 text-sm">
          {sites.map((s) => <option key={s.id} value={s.domain}>{s.client_name}</option>)}
        </select>
        <button className="rounded-lg border bg-white px-3 py-1.5 text-sm">Changer de client</button>
      </form>
      {st?.running && <RankRefresh />}
      {st && (
        <div className="mt-4 rounded-lg border bg-white p-4 text-sm">
          <p>{st.msg}</p>
          {st.running && st.total > 0 && <p className="mt-1 text-gray-500">{st.done} / {st.total} pages</p>}
        </div>
      )}
      <form action={launchIndex} className={"mt-4 print:hidden" + (client ? " hidden" : "")}>
        <input type="hidden" name="site_id" value={site.id} />
        <input type="hidden" name="domain" value={site.domain} />
        <input type="hidden" name="site_url" value={site.gsc_site_url} />
        <button disabled={st?.running} className="rounded-lg bg-gray-900 px-4 py-2 text-sm text-white disabled:opacity-40">
          Vérifier l'indexation (sitemap + pages vues dans Google)
        </button>
      </form>

      {histV.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-2 font-semibold">Historique</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-gray-500">
                <th className="py-1">Mois</th>
                <th className="text-right">Pages inspectées</th>
                <th className="text-right">Indexées</th>
                <th className="text-right">Taux</th>
              </tr>
            </thead>
            <tbody>
              {histV.map((h: any) => (
                <tr key={h.month} className="border-b">
                  <td className="py-1">{String(h.month).slice(0, 7)}</td>
                  <td className="text-right">{h.total}</td>
                  <td className="text-right">{h.indexed}</td>
                  <td className="text-right">{h.total ? Math.round((h.indexed / h.total) * 100) + ' %' : '–'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {(bad || []).length > 0 && (
        <section className="mt-8">
          <h2 className="mb-2 font-semibold">Pages non indexées ({(bad || []).length})</h2>
          <ul className="mb-3 text-sm text-gray-600">
            {[...byState.entries()].map(([s, n]) => <li key={s}>{n} × {s}</li>)}
          </ul>
          <table className="w-full text-sm">
            <tbody>
              {(bad || []).map((r: any) => (
                <tr key={r.url} className="border-b align-top">
                  <td className="max-w-[24rem] truncate py-1" title={r.url}>{r.url.replace(/^https?:\/\/[^/]+/, '') || r.url}</td>
                  <td className="py-1 text-gray-600">{r.state}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </main>
  )
}
