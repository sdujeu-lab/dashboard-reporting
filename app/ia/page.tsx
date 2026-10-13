import { supabase } from '@/lib/supabase'
import { importIa } from './actions'
import { getSites } from '@/lib/data'

export const dynamic = 'force-dynamic'

const nf = (n: number) => n.toLocaleString('fr-FR')

function Table({ title, rows, total }: { title: string; rows: any[]; total: number }) {
  if (!rows.length) return null
  return (
    <div className="rounded-xl border bg-white p-4">
      <h3 className="mb-3 font-semibold">{title}</h3>
      <table className="w-full text-sm">
        <tbody>
          {rows.slice(0, 15).map((r) => (
            <tr key={r.label} className="border-t">
              <td className="py-1.5 pr-3 break-all">{r.label}</td>
              <td className="py-1.5 text-right tabular-nums">{nf(r.impressions)}</td>
              <td className="py-1.5 pl-3 text-right text-gray-500 tabular-nums">
                {total ? Math.round((r.impressions / total) * 100) + ' %' : ''}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default async function Page({ searchParams }: { searchParams: any }) {
  const sp: any = await searchParams
  const sites: any[] = await getSites()
  const list: any[] = sites || []
  const site = list.find((s) => s.domain === sp?.d) || list[0]

  let rows: any[] = []
  if (site) {
    const r = await supabase.from('rpt_ai_import').select('kind, label, impressions').eq('site_id', String(site.id))
    rows = r.data || []
  }
  const of = (k: string) => rows.filter((r) => r.kind === k)
  const byImp = (a: any, b: any) => b.impressions - a.impressions
  const days = of('day').sort((a, b) => (a.label < b.label ? -1 : 1))
  const pages = of('page').sort(byImp)
  const countries = of('country').sort(byImp)
  const devices = of('device').sort(byImp)
  const queries = of('query').sort(byImp)
  const period = of('period')[0]?.label

  const sum = (a: any[]) => a.reduce((s, r) => s + r.impressions, 0)
  const total = sum(days) || sum(devices) || sum(countries) || sum(pages)
  const maxDay = Math.max(1, ...days.map((d) => d.impressions))

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Visibilité IA</h1>
        <form method="get" className="flex gap-2">
          <select name="d" defaultValue={site?.domain} className="rounded border px-3 py-1.5 text-sm">
            {list.map((s) => (
              <option key={s.id} value={s.domain}>{s.client_name || s.name || s.domain}</option>
            ))}
          </select>
          <button className="rounded border px-3 py-1.5 text-sm">Afficher</button>
        </form>
      </div>

      {sp?.m && <div className="rounded-lg bg-green-50 p-3 text-sm text-green-800">{sp.m}</div>}

      {site && (
        <form
          action={importIa.bind(null, String(site.id), site.domain)}
          className="space-y-3 rounded-xl border bg-white p-4"
        >
          <h2 className="font-semibold">Importer le rapport « IA générative » de Search Console</h2>
          <p className="text-sm text-gray-600">
            Dézippe l’export, puis sélectionne tous les CSV d’un coup (Graphique, Pages, Pays, Appareils, Filtres,
            et Requêtes s’il existe). Un nouvel import remplace l’ancien pour chaque type de fichier.
          </p>
          <input type="file" name="files" accept=".csv" multiple required className="block text-sm" />
          <button className="rounded bg-black px-4 py-2 text-sm text-white">Importer</button>
        </form>
      )}

      {rows.length === 0 ? (
        <p className="text-sm text-gray-600">Aucune donnée importée pour ce client.</p>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border bg-white p-4">
              <div className="text-sm text-gray-500">Impressions dans les fonctionnalités d’IA générative</div>
              <div className="text-3xl font-bold">{nf(total)}</div>
              {period && <div className="text-xs text-gray-500">Période : {period}</div>}
            </div>
            <div className="rounded-xl border bg-white p-4 text-sm text-gray-600">
              Ce rapport ne contient que des impressions (pas de clics ni de CTR). Le suivi des citations par
              mot-clé reste visible sur le tableau de bord.
            </div>
          </div>

          {days.length > 0 && (
            <div className="rounded-xl border bg-white p-4">
              <h3 className="mb-3 font-semibold">Impressions par jour</h3>
              <div className="flex h-32 items-end gap-px">
                {days.map((d) => (
                  <div
                    key={d.label}
                    title={d.label + ' : ' + d.impressions}
                    className="flex-1 bg-indigo-500"
                    style={{ height: Math.max(2, (d.impressions / maxDay) * 100) + '%' }}
                  />
                ))}
              </div>
              <div className="mt-1 flex justify-between text-xs text-gray-500">
                <span>{days[0].label}</span>
                <span>{days[days.length - 1].label}</span>
              </div>
            </div>
          )}

          <Table title="Pages les plus visibles" rows={pages} total={total} />
          {queries.length > 0 && <Table title="Requêtes" rows={queries} total={total} />}
          <div className="grid gap-4 md:grid-cols-2">
            <Table title="Pays" rows={countries} total={total} />
            <Table title="Appareils" rows={devices} total={total} />
          </div>
        </>
      )}
    </div>
  )
}
