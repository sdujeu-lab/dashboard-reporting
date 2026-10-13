import { supabase } from '@/lib/supabase'
import { hostOf, suspicion } from '@/lib/linkcheck'

const nf = (n: number) => n.toLocaleString('fr-FR')
const fd = (d: string | null) => (d ? d.split('-').reverse().join('/') : '')
function host(u: string) {
  try { return new URL(u).hostname.replace(/^www\./, '') } catch (e) { return u }
}

export async function LinksBlock({ siteId, domain }: { siteId: any; domain: string }) {
  let all: any[] = []
  for (let from = 0; from < 20000; from += 1000) {
    const r = await supabase
      .from('rpt_links_import')
      .select('kind, label, value, seen, snap')
      .eq('site_id', String(siteId))
      .order('id')
      .range(from, from + 999)
    const part = r.data || []
    all = all.concat(part)
    if (part.length < 1000) break
  }
  const mx: any = {}
  all.forEach((x) => {
    const sn = x.snap || ''
    if (mx[x.kind] === undefined || sn > mx[x.kind]) mx[x.kind] = sn
  })
  const rows: any[] = all.filter((x) => (x.snap || '') === mx[x.kind])
  if (!rows.length) return null
  const latest = rows.filter((x) => x.kind === 'latest').sort((a, b) => ((a.seen || '') < (b.seen || '') ? 1 : -1))
  const gscS = rows.filter((x) => x.kind === 'source')
  const sources = (gscS.length ? gscS : rows.filter((x) => x.kind === 'bing_source')).sort((a, b) => b.value - a.value)
  const rv = await supabase.from('rpt_links_review').select('domain, status').eq('site_id', String(siteId))
  const reviews: any[] = rv.data || []
  const rmap: any = {}
  reviews.forEach((x) => { rmap[x.domain] = x.status })
  const own = hostOf(domain)
  const doms = new Set<string>()
  rows.forEach((x) => {
    if (x.kind === 'source' || x.kind === 'bing_source' || x.kind === 'latest') doms.add(hostOf(x.label))
  })
  doms.delete(own)
  const toCheck = Array.from(doms).filter((d) => !rmap[d] && suspicion(d).length > 0).sort()
  const nDis = reviews.filter((x) => x.status === 'disavow').length
  const totalLinks = sources.reduce((s, x) => s + x.value, 0)

  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-semibold">
          Liens entrants <span className="text-xs font-normal text-slate-400">Search Console</span>
        </h2>
        <a href={'/liens?d=' + encodeURIComponent(domain)} className="text-xs text-slate-500 underline">Voir le détail</a>
      </div>
      {sources.length > 0 && (
        <div className="mb-4 flex gap-8">
          <div>
            <div className="text-3xl font-bold">{nf(sources.length)}</div>
            <div className="text-xs text-slate-400">sites référents</div>
          </div>
          <div>
            <div className="text-3xl font-bold">{nf(totalLinks)}</div>
            <div className="text-xs text-slate-400">liens</div>
          </div>
        </div>
      )}
      <div className="grid gap-6 sm:grid-cols-2">
        {latest.length > 0 && (
          <div>
            <div className="mb-2 text-xs font-medium uppercase text-slate-400">Liens les plus récents</div>
            <table className="w-full text-sm">
              <tbody>
                {latest.slice(0, 5).map((l) => (
                  <tr key={l.label} className="border-t border-slate-100">
                    <td className="py-1 pr-2 break-all">
                      <a href={l.label} target="_blank" rel="noreferrer" className="underline">{host(l.label)}</a>
                    </td>
                    <td className="py-1 text-right text-xs text-slate-500 tabular-nums">{fd(l.seen)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {sources.length > 0 && (
          <div>
            <div className="mb-2 text-xs font-medium uppercase text-slate-400">Sites qui font le plus de liens</div>
            <table className="w-full text-sm">
              <tbody>
                {sources.slice(0, 5).map((l) => (
                  <tr key={l.label} className="border-t border-slate-100">
                    <td className="py-1 pr-2 break-all">{l.label}</td>
                    <td className="py-1 text-right tabular-nums">{nf(l.value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {(toCheck.length > 0 || nDis > 0) && (
        <div className="mt-4 rounded-lg bg-amber-50 p-3 text-sm">
          <div className="mb-1 font-medium text-amber-900">
            {toCheck.length} domaine(s) à vérifier · {nDis} à désavouer
          </div>
          <ul className="text-amber-900">
            {toCheck.slice(0, 5).map((d) => (
              <li key={d}>{d} <span className="text-xs text-amber-700">({suspicion(d).join(', ')})</span></li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
