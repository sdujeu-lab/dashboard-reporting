import { supabase } from '@/lib/supabase'
import { getSites } from '@/lib/data'
import { importLiens } from './actions'
import { setReview } from './review'
import { hostOf, suspicion } from '@/lib/linkcheck'
import { sitemapPages, keyOf } from '@/lib/sitemap'

export const dynamic = 'force-dynamic'

const nf = (n: number) => n.toLocaleString('fr-FR')
const fd = (d: string | null) => (d ? d.split('-').reverse().join('/') : '')

const TABS: [string, string][] = [
  ['apercu', 'Aperçu'],
  ['recents', 'Derniers liens'],
  ['verifier', 'À vérifier'],
  ['pages', 'Pages sans lien'],
  ['historique', 'Historique'],
  ['detail', 'Détails'],
  ['import', 'Import'],
]

function Box({ title, children }: { title?: string; children: any }) {
  return (
    <div className="space-y-3 rounded-xl border bg-white p-4">
      {title && <h2 className="font-semibold">{title}</h2>}
      {children}
    </div>
  )
}

function Kpi({ label, value, tone }: { label: string; value: any; tone?: string }) {
  return (
    <div className="rounded-xl border bg-white p-4">
      <div className={'text-3xl font-bold ' + (tone || '')}>{value}</div>
      <div className="text-xs text-gray-500">{label}</div>
    </div>
  )
}

function Count({ title, rows, max }: { title: string; rows: any[]; max?: number }) {
  if (!rows.length) return null
  return (
    <Box title={title}>
      <table className="w-full text-sm">
        <tbody>
          {rows.slice(0, max || 25).map((r) => (
            <tr key={r.label} className="border-t">
              <td className="py-1.5 pr-3 break-all">{r.label}</td>
              <td className="py-1.5 text-right tabular-nums">{nf(r.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Box>
  )
}

export default async function Page({ searchParams }: { searchParams: any }) {
  const sp: any = await searchParams
  const list: any[] = await getSites()
  const site = list.find((s) => s.domain === sp?.d) || list[0]
  const dq = encodeURIComponent(site?.domain || '')

  // Données : tout l'historique, puis dernier import de chaque type
  let rows: any[] = []
  let hist: any[] = []
  let reviews: any[] = []
  if (site) {
    for (let from = 0; from < 20000; from += 1000) {
      const r = await supabase
        .from('rpt_links_import')
        .select('kind, label, value, seen, snap')
        .eq('site_id', String(site.id))
        .order('id')
        .range(from, from + 999)
      const part = r.data || []
      hist = hist.concat(part)
      if (part.length < 1000) break
    }
    const mx: any = {}
    hist.forEach((x) => {
      const sn = x.snap || ''
      if (mx[x.kind] === undefined || sn > mx[x.kind]) mx[x.kind] = sn
    })
    rows = hist.filter((x) => (x.snap || '') === mx[x.kind])
    const rv = await supabase.from('rpt_links_review').select('domain, status').eq('site_id', String(site.id))
    reviews = rv.data || []
  }
  const of = (k: string) => rows.filter((r) => r.kind === k)
  const byVal = (a: any, b: any) => b.value - a.value
  const latest = of('latest').sort((a, b) => ((a.seen || '') < (b.seen || '') ? 1 : -1))
  const sources = of('source').sort(byVal)
  const targets = of('target').sort(byVal)
  const anchors = of('anchor').sort(byVal)
  const bingS = of('bing_source').sort(byVal)
  const bingT = of('bing_target').sort(byVal)
  const bingA = of('bing_anchor').sort(byVal)

  // Revue des domaines
  const rmap: any = {}
  reviews.forEach((x) => { rmap[x.domain] = x.status })
  const own = hostOf(site?.domain || '')
  const doms = new Set<string>()
  rows.forEach((x) => {
    if (x.kind === 'source' || x.kind === 'bing_source' || x.kind === 'latest') doms.add(hostOf(x.label))
  })
  doms.delete(own)
  const toExamine = Array.from(doms).filter((d) => !rmap[d] && suspicion(d).length > 0).sort()
  const disavow = reviews.filter((x) => x.status === 'disavow').map((x) => x.domain).sort()
  const okCount = reviews.filter((x) => x.status === 'ok').length

  // Chiffres clés
  const srcRows = sources.length ? sources : bingS
  const refDomains = new Set(srcRows.map((x) => hostOf(x.label))).size
  const totalLinks = srcRows.reduce((t, x) => t + x.value, 0)

  // Historique
  const snaps = Array.from(new Set(hist.map((x) => x.snap || ''))).sort()
  const srcOf = (sn: string) => hist.filter((x) => (x.snap || '') === sn && (x.kind === 'source' || x.kind === 'bing_source'))
  const histRows = snaps
    .map((sn, i) => {
      const cur = srcOf(sn)
      const curSet = new Set(cur.map((x) => hostOf(x.label)))
      const prevSet = i > 0 ? new Set(srcOf(snaps[i - 1]).map((x) => hostOf(x.label))) : null
      const hasPrev = !!(prevSet && prevSet.size)
      const nw = hasPrev ? Array.from(curSet).filter((d) => !prevSet!.has(d)) : []
      const lost = hasPrev ? Array.from(prevSet!).filter((d) => !curSet.has(d)) : []
      return {
        sn,
        domains: curSet.size,
        links: cur.reduce((t, x) => t + x.value, 0),
        latest: hist.filter((x) => (x.snap || '') === sn && x.kind === 'latest').length,
        nw,
        lost,
        hasPrev,
      }
    })
    .reverse()
  const lastDiff = histRows.find((h) => h.hasPrev && h.domains > 0)

  const tab = TABS.some((t) => t[0] === sp?.t) ? sp.t : rows.length ? 'apercu' : 'import'

  // Pages sans lien : le sitemap n'est lu que dans cet onglet
  const hasTargets = targets.length > 0 || bingT.length > 0
  let pagesList: string[] = []
  let weak: { url: string; n: number }[] = []
  if (site && tab === 'pages' && hasTargets) {
    pagesList = await sitemapPages(site.domain)
    const cnt: any = {}
    targets.concat(bingT).forEach((x) => {
      const k = keyOf(x.label)
      cnt[k] = Math.max(cnt[k] || 0, x.value)
    })
    weak = pagesList
      .map((u) => ({ url: u, n: cnt[keyOf(u)] || 0 }))
      .filter((x) => x.n <= 2)
      .sort((a, b) => a.n - b.n || (a.url < b.url ? -1 : 1))
  }
  const weakZero = weak.filter((x) => x.n === 0).length

  const rv = setReview.bind(null, String(site?.id), site?.domain || '')

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Liens et netlinking</h1>
        <form method="get" className="flex gap-2">
          <input type="hidden" name="t" value={tab} />
          <select name="d" defaultValue={site?.domain} className="rounded border px-3 py-1.5 text-sm">
            {list.map((s) => (
              <option key={s.id} value={s.domain}>{s.client_name || s.name || s.domain}</option>
            ))}
          </select>
          <button className="rounded border px-3 py-1.5 text-sm">Afficher</button>
        </form>
      </div>

      {sp?.m && <div className="rounded-lg bg-green-50 p-3 text-sm text-green-800">{sp.m}</div>}

      <nav className="flex gap-1 overflow-x-auto border-b">
        {TABS.map(([k, label]) => (
          <a
            key={k}
            href={'/liens?d=' + dq + '&t=' + k}
            className={
              'whitespace-nowrap px-3 py-2 text-sm ' +
              (tab === k ? 'border-b-2 border-black font-semibold' : 'text-gray-500 hover:text-black')
            }
          >
            {label}
            {k === 'verifier' && toExamine.length > 0 && (
              <span className="ml-1.5 rounded-full bg-amber-500 px-1.5 py-0.5 text-xs text-white">{toExamine.length}</span>
            )}
          </a>
        ))}
      </nav>

      {tab === 'apercu' && (
        rows.length === 0 ? (
          <p className="text-sm text-gray-600">Aucune donnée importée. Va dans l’onglet Import.</p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Kpi label="domaines référents" value={nf(refDomains)} />
              <Kpi label="liens" value={nf(totalLinks)} />
              <Kpi label="domaines à vérifier" value={toExamine.length} tone={toExamine.length ? 'text-amber-600' : ''} />
              <Kpi label="à désavouer" value={disavow.length} tone={disavow.length ? 'text-red-600' : ''} />
            </div>
            {toExamine.length > 0 && (
              <a href={'/liens?d=' + dq + '&t=verifier'} className="block rounded-lg bg-amber-50 p-3 text-sm text-amber-900 underline">
                {toExamine.length} domaine(s) suspect(s) à examiner
              </a>
            )}
            <div className="grid gap-4 md:grid-cols-2">
              {latest.length > 0 && (
                <Box title="Liens les plus récents">
                  <table className="w-full text-sm">
                    <tbody>
                      {latest.slice(0, 10).map((r) => (
                        <tr key={r.label} className="border-t">
                          <td className="py-1.5 pr-3 break-all">
                            <a href={r.label} target="_blank" rel="noreferrer" className="underline">{hostOf(r.label)}</a>
                          </td>
                          <td className="py-1.5 text-right tabular-nums">{fd(r.seen)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <a href={'/liens?d=' + dq + '&t=recents'} className="text-xs text-gray-500 underline">Tout voir</a>
                </Box>
              )}
              <Count title="Domaines qui font le plus de liens" rows={srcRows} max={10} />
            </div>
          </>
        )
      )}

      {tab === 'recents' && (
        <Box title={'Derniers liens détectés (' + nf(latest.length) + ')'}>
          {latest.length === 0 ? (
            <p className="text-sm text-gray-500">Importe le fichier « Latest links » de Search Console.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-gray-400">
                  <th className="pb-1">Page d’origine</th>
                  <th className="pb-1 text-right">Dernière exploration</th>
                </tr>
              </thead>
              <tbody>
                {latest.slice(0, 200).map((r) => (
                  <tr key={r.label} className="border-t">
                    <td className="py-1.5 pr-3 break-all">
                      <a href={r.label} target="_blank" rel="noreferrer" className="underline">{r.label}</a>
                    </td>
                    <td className="py-1.5 text-right tabular-nums">{fd(r.seen)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Box>
      )}

      {tab === 'verifier' && site && (
        <Box title="Liens à vérifier et à désavouer">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="max-w-2xl text-xs text-gray-500">
              Repérage automatique d’après le nom de domaine (extension, mots, structure) : c’est un indice, pas un verdict.
              Ouvre le site avant de désavouer.{okCount > 0 ? ' ' + okCount + ' domaine(s) déjà validé(s).' : ''}
            </p>
            {disavow.length > 0 && (
              <a href={'/liens/disavow?d=' + dq} className="rounded bg-black px-3 py-1.5 text-sm text-white">
                Télécharger le fichier de désaveu ({disavow.length})
              </a>
            )}
          </div>
          {toExamine.length > 0 ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-gray-400">
                  <th className="pb-1">Domaine</th>
                  <th className="pb-1">Pourquoi</th>
                  <th className="pb-1 text-right">Décision</th>
                </tr>
              </thead>
              <tbody>
                {toExamine.map((d) => (
                  <tr key={d} className="border-t">
                    <td className="py-1.5 pr-3 break-all">
                      <a href={'https://' + d} target="_blank" rel="noreferrer" className="underline">{d}</a>
                    </td>
                    <td className="py-1.5 pr-3 text-gray-600">{suspicion(d).join(', ')}</td>
                    <td className="py-1.5 text-right">
                      <form action={rv} className="inline-flex gap-1">
                        <input type="hidden" name="domain" value={d} />
                        <button name="status" value="ok" className="rounded border px-2 py-1 text-xs">Légitime</button>
                        <button name="status" value="disavow" className="rounded bg-red-600 px-2 py-1 text-xs text-white">Désavouer</button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-sm text-gray-500">Aucun domaine suspect repéré (ou tous déjà traités).</p>
          )}
          {disavow.length > 0 && (
            <div>
              <div className="mb-1 text-xs font-medium uppercase text-gray-400">À désavouer</div>
              <ul className="text-sm">
                {disavow.map((d) => (
                  <li key={d} className="flex items-center justify-between border-t py-1">
                    <span className="break-all">{d}</span>
                    <form action={rv}>
                      <input type="hidden" name="domain" value={d} />
                      <button name="status" value="reset" className="text-xs text-gray-500 underline">Retirer</button>
                    </form>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <form action={rv} className="flex flex-wrap gap-2 border-t pt-3">
            <input name="domain" placeholder="Signaler un domaine (ex. site-douteux.xyz)" className="min-w-[240px] flex-1 rounded border px-3 py-1.5 text-sm" />
            <button name="status" value="disavow" className="rounded bg-red-600 px-3 py-1.5 text-sm text-white">À désavouer</button>
          </form>
        </Box>
      )}

      {tab === 'pages' && (
        <Box title="Pages du site sans lien ou avec 1 à 2 liens">
          {!hasTargets ? (
            <p className="text-sm text-gray-500">
              Importe le fichier « pages cibles » (liens externes, pages les plus liées) de Search Console pour voir cette liste.
            </p>
          ) : !pagesList.length ? (
            <p className="text-sm text-gray-500">Sitemap introuvable ou vide pour {site?.domain}.</p>
          ) : (
            <>
              <p className="text-sm text-gray-600">
                {pagesList.length} pages dans le sitemap : <b>{weakZero}</b> sans aucun lien, <b>{weak.length - weakZero}</b> avec 1 ou 2 liens.
                Search Console ne donne que les pages les plus liées : une page absente de son export compte pour 0.
              </p>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase text-gray-400">
                    <th className="pb-1">Page</th>
                    <th className="pb-1 text-right">Liens</th>
                  </tr>
                </thead>
                <tbody>
                  {weak.slice(0, 300).map((x) => (
                    <tr key={x.url} className="border-t">
                      <td className="py-1.5 pr-3 break-all">
                        <a href={x.url} target="_blank" rel="noreferrer" className="underline">{x.url.replace(/^https?:\/\/[^/]+/, '') || '/'}</a>
                      </td>
                      <td className={'py-1.5 text-right tabular-nums ' + (x.n === 0 ? 'text-red-700' : 'text-amber-700')}>{x.n}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </Box>
      )}

      {tab === 'historique' && (
        <Box title="Historique des imports">
          {snaps.length === 0 ? (
            <p className="text-sm text-gray-500">Aucun import pour l’instant.</p>
          ) : (
            <>
              {snaps.length < 2 && (
                <p className="text-xs text-gray-500">
                  Un seul import pour l’instant. Réimporte les fichiers chaque mois : l’évolution (nouveaux et perdus) apparaîtra ici.
                </p>
              )}
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase text-gray-400">
                    <th className="pb-1">Import</th>
                    <th className="pb-1 text-right">Domaines réf.</th>
                    <th className="pb-1 text-right">Liens</th>
                    <th className="pb-1 text-right">Liens récents</th>
                    <th className="pb-1 text-right">Nouveaux</th>
                    <th className="pb-1 text-right">Perdus</th>
                  </tr>
                </thead>
                <tbody>
                  {histRows.map((h) => (
                    <tr key={h.sn} className="border-t">
                      <td className="py-1.5">{fd(h.sn)}</td>
                      <td className="py-1.5 text-right tabular-nums">{h.domains || '—'}</td>
                      <td className="py-1.5 text-right tabular-nums">{h.links || '—'}</td>
                      <td className="py-1.5 text-right tabular-nums">{h.latest || '—'}</td>
                      <td className="py-1.5 text-right tabular-nums text-green-700">{h.hasPrev ? '+' + h.nw.length : '—'}</td>
                      <td className="py-1.5 text-right tabular-nums text-red-700">{h.hasPrev ? '-' + h.lost.length : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {lastDiff && (lastDiff.nw.length > 0 || lastDiff.lost.length > 0) && (
                <div className="grid gap-4 text-sm sm:grid-cols-2">
                  <div>
                    <div className="mb-1 text-xs font-medium uppercase text-green-700">Nouveaux domaines ({fd(lastDiff.sn)})</div>
                    <ul>{lastDiff.nw.slice(0, 30).map((d) => <li key={d} className="break-all">{d}</li>)}</ul>
                  </div>
                  <div>
                    <div className="mb-1 text-xs font-medium uppercase text-red-700">Domaines perdus</div>
                    <ul>{lastDiff.lost.slice(0, 30).map((d) => <li key={d} className="break-all">{d}</li>)}</ul>
                  </div>
                </div>
              )}
            </>
          )}
        </Box>
      )}

      {tab === 'detail' && (
        rows.length === 0 ? (
          <p className="text-sm text-gray-600">Aucune donnée importée.</p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            <Count title="Search Console : sites sources" rows={sources} />
            <Count title="Search Console : pages les plus liées" rows={targets} />
            <Count title="Search Console : textes d’ancre" rows={anchors} />
            <Count title="Bing : sites qui font des liens" rows={bingS} />
            <Count title="Bing : pages les plus liées" rows={bingT} />
            <Count title="Bing : textes d’ancre" rows={bingA} />
          </div>
        )
      )}

      {tab === 'import' && site && (
        <Box title="Importer les liens">
          <form action={importLiens.bind(null, String(site.id), site.domain)} className="space-y-3">
            <p className="text-sm text-gray-600">
              <b>Search Console</b> : Liens, Exporter, Télécharger .csv (dézippe). <b>Bing Webmaster Tools</b> :
              Backlinks, Exporter. Sélectionne tous les CSV d’un coup. Chaque import est daté et conservé
              dans l’historique. Les liens internes sont ignorés.
            </p>
            <input type="file" name="files" accept=".csv" multiple required className="block text-sm" />
            <button className="rounded bg-black px-4 py-2 text-sm text-white">Importer</button>
          </form>
        </Box>
      )}
    </div>
  )
}
