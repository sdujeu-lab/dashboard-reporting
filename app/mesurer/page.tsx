import { getSites } from '../../lib/data'
import { getRankStatus } from '../../lib/rank'
import { launchRank } from './actions'
import RankRefresh from './RankRefresh'

export const dynamic = 'force-dynamic'

export default async function Page({ searchParams }: { searchParams: Promise<{ d?: string }> }) {
  const sp = await searchParams
  const sites: any[] = await getSites()
  const site = sites.find((s) => s.domain === sp.d) || sites[0]
  if (!site) return <main className="p-8">Aucun client.</main>
  const st = getRankStatus(site.id)
  const sel = 'rounded-lg border bg-white px-3 py-1.5 text-sm'

  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="text-xl font-semibold">Mesurer le rang réel</h1>
      <form className="mt-4 flex gap-2">
        <select key={site.domain} name="d" defaultValue={site.domain} className={sel}>
          {sites.map((s) => (
            <option key={s.id} value={s.domain}>{s.client_name}</option>
          ))}
        </select>
        <button className={sel}>Changer de client</button>
      </form>
      {st?.running && <RankRefresh />}
      {st && (
        <div className="mt-6 rounded-lg border bg-white p-4 text-sm">
          <p>{st.msg}</p>
          {st.running && <p className="mt-1 text-gray-500">{st.done} / {st.total} mots-clés</p>}
          <p className="mt-1 text-gray-500">Coût : {st.cost.toFixed(3)} $</p>
        </div>
      )}
      <div className="mt-6 flex flex-wrap gap-3">
        {(['priority', 'all'] as const).map((scope) => (
          <form key={scope} action={launchRank}>
            <input type="hidden" name="site_id" value={site.id} />
            <input type="hidden" name="domain" value={site.domain} />
            <input type="hidden" name="scope" value={scope} />
            <button disabled={st?.running} className="rounded-lg bg-gray-900 px-4 py-2 text-sm text-white disabled:opacity-40">
              {scope === 'priority' ? 'Mesurer les mots-clés prioritaires' : 'Mesurer tous les mots-clés'}
            </button>
          </form>
        ))}
      </div>
      <p className="mt-4 text-xs text-gray-500">Chaque mot-clé est mesuré 3 fois (médiane), depuis Marseille, pour environ 0,03 $ par mot-clé.</p>
    </main>
  )
}
