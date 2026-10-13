import { supabase } from '@/lib/supabase'

const nf = (n: number) => n.toLocaleString('fr-FR')

function Mini({ title, rows, total }: { title: string; rows: any[]; total: number }) {
  if (!rows.length) return null
  return (
    <div>
      <div className="mb-2 text-xs font-medium uppercase text-slate-400">{title}</div>
      <table className="w-full text-sm">
        <tbody>
          {rows.slice(0, 5).map((r) => (
            <tr key={r.label} className="border-t border-slate-100">
              <td className="py-1 pr-2 break-all">{r.label.replace(/^https?:\/\/[^/]+/, '') || '/'}</td>
              <td className="py-1 text-right tabular-nums">{nf(r.impressions)}</td>
              <td className="py-1 pl-2 text-right text-xs text-slate-400 tabular-nums">
                {total ? Math.round((r.impressions / total) * 100) + ' %' : ''}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export async function AiImportBlock({ siteId, domain }: { siteId: any; domain: string }) {
  const r = await supabase.from('rpt_ai_import').select('kind, label, impressions').eq('site_id', String(siteId))
  const rows: any[] = r.data || []
  if (!rows.length) return null
  const of = (k: string) => rows.filter((x) => x.kind === k)
  const byImp = (a: any, b: any) => b.impressions - a.impressions
  const days = of('day').sort((a, b) => (a.label < b.label ? -1 : 1))
  const pages = of('page').sort(byImp)
  const countries = of('country').sort(byImp)
  const devices = of('device').sort(byImp)
  const period = of('period')[0]?.label
  const sum = (a: any[]) => a.reduce((s, x) => s + x.impressions, 0)
  const total = sum(days) || sum(devices) || sum(countries) || sum(pages)
  const maxDay = Math.max(1, ...days.map((d) => d.impressions))

  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-semibold">
          Apparitions dans les fonctionnalités d’IA générative{' '}
          <span className="text-xs font-normal text-slate-400">Search Console{period ? ' · ' + period : ''}</span>
        </h2>
        <a href={'/ia?d=' + encodeURIComponent(domain)} className="text-xs text-slate-500 underline">Voir le détail</a>
      </div>
      <div className="mb-4 flex flex-wrap items-end gap-6">
        <div>
          <div className="text-3xl font-bold">{nf(total)}</div>
          <div className="text-xs text-slate-400">impressions</div>
        </div>
        {days.length > 0 && (
          <div className="flex h-14 min-w-[200px] flex-1 items-end gap-px">
            {days.map((d) => (
              <div
                key={d.label}
                title={d.label + ' : ' + d.impressions}
                className="flex-1 bg-indigo-500"
                style={{ height: Math.max(3, (d.impressions / maxDay) * 100) + '%' }}
              />
            ))}
          </div>
        )}
      </div>
      <div className="grid gap-6 sm:grid-cols-3">
        <Mini title="Pages" rows={pages} total={total} />
        <Mini title="Pays" rows={countries} total={total} />
        <Mini title="Appareils" rows={devices} total={total} />
      </div>
    </section>
  )
}
