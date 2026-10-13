import { getSites } from '../../lib/data'
import { getRankStatus } from '../../lib/rank'
import { launchRank, syncGsc } from './actions'
import { saveManualRank } from './manual'
import { setCity } from './city'
import RankRefresh from './RankRefresh'
import { supabase } from '../../lib/supabase'

export const dynamic = 'force-dynamic'

export default async function Page({ searchParams }: { searchParams: Promise<{ d?: string; e?: string; ok?: string }> }) {
  const sp = await searchParams
  const sites: any[] = await getSites()
  const site = sites.find((s) => s.domain === sp.d) || sites[0]
  if (!site) return <main className="p-8">Aucun client.</main>
  const st = getRankStatus(site.id)
  const sel = 'rounded-lg border bg-white px-3 py-1.5 text-sm'
  const month = new Date().toISOString().slice(0, 7) + '-01'
  const { data: kw } = await supabase.from('rpt_keywords').select('id, keyword').eq('site_id', site.id).limit(10000)
  const kwName = new Map((kw || []).map((k: any) => [String(k.id), k.keyword] as [string, string]))
  const kids = [...kwName.keys()]
  const errRows: any[] = []
  for (let i = 0; i < kids.length; i += 100) {
    const { data } = await supabase.from('rpt_rank_errors').select('keyword_id, error').eq('month', month).in('keyword_id', kids.slice(i, i + 100))
    errRows.push(...(data || []))
  }
  const nErr = errRows.length
  const { data: stCity } = await supabase.from('rpt_sites').select('rank_location, sync_status, sync_message').eq('id', site.id).maybeSingle()
  const city: string = (stCity as any)?.rank_location || 'Marseille (par défaut)'
  const sy: any = stCity
  const scopes = (nErr > 0 ? ['errors', 'priority'] : ['priority']) as ('errors' | 'priority')[]
  const suffix = nErr > 0 ? ' (erreurs en premier)' : ''
  const label = (s: string) => s === 'errors' ? 'Relancer seulement les ' + nErr + ' erreur(s)' : s === 'priority' ? 'Mesurer les mots-clés en rang réel' + suffix : 'Mesurer tous les mots-clés' + suffix

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
      <form action={setCity} className="mt-4 flex flex-wrap items-center gap-2 text-sm">
        <input type="hidden" name="domain" value={site.domain} />
        <span className="text-gray-500">Recherche depuis :</span>
        <b>{city.split(',').join(', ')}</b>
        <input name="city" placeholder="Ville, département ou région" className="w-64 rounded-lg border bg-white px-3 py-1.5" />
        <button className={sel}>Changer</button>
      </form>
      {sp.e && <p className="mt-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">{sp.e}</p>}
      {sp.ok && <p className="mt-2 rounded-lg bg-green-50 p-3 text-sm text-green-700">✓ Recherche désormais depuis : {sp.ok}</p>}
      {(st?.running || sy?.sync_status === 'running') && <RankRefresh />}
      {st && (
        <div className="mt-6 rounded-lg border bg-white p-4 text-sm">
          <p>{st.msg}</p>
          {st.running && <p className="mt-1 text-gray-500">{st.done} / {st.total} mots-clés</p>}
          <p className="mt-1 text-gray-500">Coût : {st.cost.toFixed(3)} $</p>
        </div>
      )}
      {nErr > 0 && !st?.running && (
        <div className="mt-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <p className="font-medium">⚠ {nErr} mot(s)-clé(s) en erreur ce mois-ci</p>
          <div className="mt-2 space-y-2">{errRows.map((e: any) => (
            <form key={e.keyword_id} action={saveManualRank} className="flex flex-wrap items-center gap-2 rounded border border-red-200 bg-white p-2 text-gray-800">
              <input type="hidden" name="keyword_id" value={e.keyword_id} />
              <input type="hidden" name="domain" value={site.domain} />
              <span className="min-w-[10rem] flex-1"><b>{kwName.get(String(e.keyword_id)) || e.keyword_id}</b> <span className="text-xs text-red-600">{e.error}</span></span>
              <input name="rank" type="number" min="1" max="50" placeholder="Position (vide = hors top 50)" className="w-52 rounded border px-2 py-1 text-sm" />
              <input name="url" placeholder="Page positionnée (facultatif)" className="w-64 rounded border px-2 py-1 text-sm" />
              <button className="rounded bg-gray-900 px-3 py-1 text-sm text-white">Enregistrer à la main</button>
            </form>
          ))}</div>
          <p className="mt-2">Relance d'abord les erreurs, puis choisis si tu veux aussi mesurer les autres.</p>
        </div>
      )}
      <div className="mt-6 flex flex-wrap gap-3">
        {scopes.map((scope) => (
          <form key={scope} action={launchRank}>
            <input type="hidden" name="site_id" value={site.id} />
            <input type="hidden" name="domain" value={site.domain} />
            <input type="hidden" name="scope" value={scope} />
            <button disabled={st?.running} className="rounded-lg bg-gray-900 px-4 py-2 text-sm text-white disabled:opacity-40">
              {label(scope)}
            </button>
          </form>
        ))}
      </div>
      <div className="mt-6 rounded-lg border bg-white p-4 text-sm">
        <p className="mb-2 text-gray-600">Les mots-clés hors rang réel prennent leur position dans Search Console (gratuit, sans DataForSEO).</p>
        {sy?.sync_message && <p className="mb-2 text-xs text-gray-500">{sy.sync_status === 'running' ? '⏳ ' : sy.sync_status === 'error' ? '✗ ' : '✓ '}{sy.sync_message}</p>}
        <div className="flex flex-wrap gap-2">
          <form action={syncGsc.bind(null, site.id, site.domain, 1)}><button className="rounded-lg bg-gray-900 px-4 py-2 text-white">Mettre à jour les positions GSC (dernier mois)</button></form>
          <form action={syncGsc.bind(null, site.id, site.domain, 16)}><button className={sel}>Recalculer sur 16 mois</button></form>
        </div>
      </div>
      <p className="mt-4 text-xs text-gray-500">Chaque mot-clé est mesuré {Math.min(3, Math.max(1, Number(process.env.RANK_RUNS) || 2))} fois, depuis {city.split(',')[0]}, pour environ {(Math.min(3, Math.max(1, Number(process.env.RANK_RUNS) || 2)) * 0.01).toFixed(2).replace('.', ',')} $ par mot-clé.</p>
    </main>
  )
}
