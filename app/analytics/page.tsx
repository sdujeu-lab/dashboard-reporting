import PrintButton from '../../components/PrintButton'
import { getSites } from '@/lib/data'
import { ga4Client, ga4Run, mergeRows, Range, Row } from '@/lib/ga4'

export const dynamic = 'force-dynamic'

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,700&family=Young+Serif&display=swap');
.an{--accent:#D4007F;--ink:#1B1722;--muted:#6B6270;--line:#EFE7E3;--line2:#F1EBE8;min-height:100vh;background:#FBF8F6;color:var(--ink);font-family:'DM Sans',system-ui,sans-serif;font-size:15px;line-height:1.45;padding:28px 32px 48px;box-sizing:border-box}
.an *{box-sizing:border-box}
.an a{color:inherit}
.an-wrap{max-width:1216px;margin:0 auto;display:flex;flex-direction:column;gap:24px}
.an h1,.an h2{font-family:'Young Serif',Georgia,serif;font-weight:400;margin:0}
.an h1{font-size:44px;line-height:1.1}
.an h2{font-size:22px}
.an-top{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:16px 32px}
.an-logo{height:72px;width:auto;display:block}
.an-select,.an-date{height:44px;padding:0 12px;border:1px solid #DDD3D8;border-radius:10px;background:#fff;color:var(--ink);font:500 15px 'DM Sans',system-ui,sans-serif}
.an-btn{height:44px;padding:0 22px;border:0;border-radius:10px;background:var(--accent);color:#fff;font:700 15px 'DM Sans',system-ui,sans-serif;cursor:pointer}
.an-bar{display:flex;height:5px;border-radius:3px;overflow:hidden}
.an-bar div{flex:1}
.an-title{display:flex;flex-wrap:wrap;align-items:baseline;gap:4px 16px}
.an-sub{color:var(--muted);font-size:14px}
.an-ctl{background:#fff;border:1px solid var(--line);border-radius:16px;padding:16px 20px;display:flex;flex-direction:column;gap:12px}
.an-chips{display:flex;flex-wrap:wrap;gap:8px}
.an-chip{padding:6px 14px;border:1px solid #DDD3D8;border-radius:999px;font-size:14px;text-decoration:none;background:#fff}
.an-chip.on{background:var(--accent);border-color:var(--accent);color:#fff}
.an-fields{display:flex;flex-wrap:wrap;align-items:flex-end;gap:12px 16px}
.an-fields label{display:flex;flex-direction:column;gap:4px;font-size:13px;color:var(--muted)}
.an-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(200px,100%),1fr));gap:16px}
.an-kpi{background:#fff;border:1px solid var(--line);border-radius:16px;padding:20px;display:flex;flex-direction:column;gap:6px}
.an-kpi-l{color:var(--muted);font-size:14px;font-weight:500}
.an-kpi-v{font-family:'Young Serif',Georgia,serif;font-size:38px;line-height:1.1;font-variant-numeric:tabular-nums}
.an-kpi-n{display:flex;flex-wrap:wrap;align-items:center;gap:4px 8px;font-size:13px;color:var(--muted)}
.chip{padding:2px 8px;border-radius:999px;font-weight:700;font-size:13px;white-space:nowrap}
.chip-good{background:#E3F6EA;color:#0B6B3A}.chip-bad{background:#FDE7E5;color:#B3261E}.chip-flat{background:#F1EEF2;color:#5A5160}
.an-card{background:#fff;border:1px solid var(--line);border-radius:16px;padding:24px;display:flex;flex-direction:column;gap:16px;min-width:0}
.an-card-t{display:flex;flex-wrap:wrap;align-items:baseline;gap:4px 12px}
.an-grid2{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(480px,100%),1fr));gap:16px}
.an-table{width:100%;border-collapse:collapse;font-size:14px}
.an-table th{text-align:left;font-size:13px;color:var(--muted);padding-bottom:6px;border-bottom:1px solid var(--line2);font-weight:500}
.an-table td{padding:7px 0;border-top:1px solid var(--line2)}
.an-table .n{text-align:right;font-variant-numeric:tabular-nums;padding-left:10px}
.an-table .p{max-width:300px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding-right:12px}
.an-empty{display:flex;align-items:center;justify-content:center;text-align:center;min-height:90px;border:1px dashed #DDD3D8;border-radius:12px;padding:16px;color:var(--muted);font-size:14px}
.an-err{background:#FDE7E5;color:#7A1A14;border-radius:12px;padding:16px;font-size:14px;display:flex;flex-direction:column;gap:6px}
.an-legend{display:flex;flex-wrap:wrap;gap:6px 20px;font-size:13px;color:var(--muted)}
.an-legend i{display:inline-block;width:18px;height:0;border-top:2px solid;vertical-align:middle;margin-right:6px}
.an-note{margin:0;font-size:13px;color:var(--muted)}
@media print{.an{padding:0;background:#fff}.an-ctl,.an-top form{display:none}.an *{-webkit-print-color-adjust:exact;print-color-adjust:exact}.an-card,.an-kpi{break-inside:avoid}}
`

const iso = (d: Date) => d.toISOString().slice(0, 10)
const addDays = (s: string, n: number) => { const d = new Date(s + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return iso(d) }
const diffDays = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000)
const yearBefore = (s: string) => { const d = new Date(s + 'T00:00:00Z'); d.setUTCFullYear(d.getUTCFullYear() - 1); return iso(d) }
const okDate = (s?: string) => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s)
const fd = (s: string) => s.split('-').reverse().join('/')
const fmt = (n: number) => new Intl.NumberFormat('fr-FR').format(Math.round(n || 0))
const dur = (s: number) => Math.floor((s || 0) / 60) + ' min ' + String(Math.round((s || 0) % 60)).padStart(2, '0') + ' s'
const dpct = (a: number, b: number): number | null => (b ? ((a - b) / b) * 100 : null)

function Delta({ value }: { value: number | null }) {
  if (value === null || !isFinite(value)) return <span className="chip chip-flat">n/d</span>
  const cls = Math.abs(value) < 0.05 ? 'chip-flat' : value > 0 ? 'chip-good' : 'chip-bad'
  const arrow = value > 0 ? '▲' : value < 0 ? '▼' : '='
  return <span className={'chip ' + cls}>{arrow} {Math.abs(value).toFixed(1).replace('.', ',')} %</span>
}

function CmpTable({ title, col, rows, idx, showCmp, path }: { title: string; col: string; rows: Row[]; idx: number; showCmp: boolean; path?: boolean }) {
  const list = rows.filter((r) => r.cur[idx] > 0 || r.cmp[idx] > 0).sort((a, b) => b.cur[idx] - a.cur[idx]).slice(0, 12)
  return (
    <section className="an-card">
      <h2>{title}</h2>
      {list.length ? (
        <table className="an-table">
          <thead>
            <tr>
              <th>{col}</th>
              <th className="n">Période</th>
              {showCmp && <><th className="n">Comparaison</th><th className="n">Écart</th></>}
            </tr>
          </thead>
          <tbody>
            {list.map((r) => (
              <tr key={r.key}>
                <td className={path ? 'p' : ''} title={r.key}>{r.key || '(non défini)'}</td>
                <td className="n">{fmt(r.cur[idx])}</td>
                {showCmp && <><td className="n">{fmt(r.cmp[idx])}</td><td className="n"><Delta value={dpct(r.cur[idx], r.cmp[idx])} /></td></>}
              </tr>
            ))}
          </tbody>
        </table>
      ) : <div className="an-empty">Pas de données sur cette période.</div>}
    </section>
  )
}

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams
  const sites: any[] = await getSites()
  const site: any = sites.find((s) => s.domain === sp.d) || sites[0]
  if (!site) return <main className="p-8">Aucun site.</main>

  // Période
  const today = iso(new Date())
  const yest = addDays(today, -1)
  let from = addDays(yest, -27), to = yest
  if (okDate(sp.from) && okDate(sp.to) && sp.from! <= sp.to!) { from = sp.from!; to = sp.to! }
  const cur: Range = { from, to }

  // Comparaison
  const cmpMode = ['none', 'prev', 'year', 'custom'].includes(sp.cmp || '') ? sp.cmp! : 'prev'
  let cmp: Range | null = null
  if (cmpMode === 'prev') {
    const len = diffDays(from, to) + 1
    const cto = addDays(from, -1)
    cmp = { from: addDays(cto, -(len - 1)), to: cto }
  } else if (cmpMode === 'year') {
    cmp = { from: yearBefore(from), to: yearBefore(to) }
  } else if (cmpMode === 'custom' && okDate(sp.cfrom) && okDate(sp.cto) && sp.cfrom! <= sp.cto!) {
    cmp = { from: sp.cfrom!, to: sp.cto! }
  }

  // Raccourcis
  const mStart = today.slice(0, 8) + '01'
  const lmEnd = addDays(mStart, -1)
  const lmStart = lmEnd.slice(0, 8) + '01'
  const presets: [string, string, string][] = [
    ['7 jours', addDays(yest, -6), yest],
    ['28 jours', addDays(yest, -27), yest],
    ['3 mois', addDays(yest, -89), yest],
    ['12 mois', addDays(yest, -364), yest],
    ['Ce mois', mStart, mStart > yest ? mStart : yest],
    ['Mois dernier', lmStart, lmEnd],
  ]
  const presetHref = (f: string, t: string) => {
    const q: Record<string, string> = { d: site.domain, from: f, to: t, cmp: cmpMode }
    if (cmpMode === 'custom' && okDate(sp.cfrom) && okDate(sp.cto)) { q.cfrom = sp.cfrom!; q.cto = sp.cto! }
    return '/analytics?' + new URLSearchParams(q).toString()
  }

  // Données GA4 en direct
  let err = ''
  let totals: Row | null = null
  let dailyCur: { k: string; v: number }[] = []
  let dailyCmp: { k: string; v: number }[] = []
  let channels: Row[] = [], sources: Row[] = [], pages: Row[] = [], devices: Row[] = [], countries: Row[] = []
  if (site.ga4_property_id) {
    try {
      const client = ga4Client()
      const p = String(site.ga4_property_id)
      const [t, d, ch, so, pg, dv, co] = await Promise.all([
        ga4Run(client, p, cur, cmp, [], ['sessions', 'engagedSessions', 'totalUsers', 'newUsers', 'screenPageViews', 'keyEvents', 'averageSessionDuration']),
        ga4Run(client, p, cur, cmp, ['date'], ['sessions']),
        ga4Run(client, p, cur, cmp, ['sessionDefaultChannelGroup'], ['sessions', 'engagedSessions', 'keyEvents'], 20),
        ga4Run(client, p, cur, cmp, ['sessionSourceMedium'], ['sessions', 'keyEvents'], 30),
        ga4Run(client, p, cur, cmp, ['pagePath'], ['screenPageViews', 'totalUsers'], 40),
        ga4Run(client, p, cur, cmp, ['deviceCategory'], ['sessions']),
        ga4Run(client, p, cur, cmp, ['country'], ['sessions'], 20),
      ])
      totals = mergeRows(t, 7)[0] || { key: '', cur: new Array(7).fill(0), cmp: new Array(7).fill(0) }
      const sortD = (a: any, b: any) => (a.k < b.k ? -1 : 1)
      dailyCur = d.filter((r) => r.range === 'cur').map((r) => ({ k: r.dv[0], v: r.m[0] })).sort(sortD)
      dailyCmp = d.filter((r) => r.range === 'cmp').map((r) => ({ k: r.dv[0], v: r.m[0] })).sort(sortD)
      channels = mergeRows(ch, 3); sources = mergeRows(so, 2); pages = mergeRows(pg, 2)
      devices = mergeRows(dv, 1); countries = mergeRows(co, 1)
    } catch (e: any) {
      err = String(e?.message || e)
    }
  }

  const showCmp = !!cmp
  const head = (
    <header style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div className="an-top">
        <img src="/logo-lfdw.png" alt="La Fille du Web" className="an-logo" />
        <form className="an-fields" method="get">
          <input type="hidden" name="from" value={from} />
          <input type="hidden" name="to" value={to} />
          <input type="hidden" name="cmp" value={cmpMode} />
          <select name="d" defaultValue={site.domain} className="an-select" aria-label="Site">
            {sites.map((s) => <option key={s.id} value={s.domain}>{s.client_name}</option>)}
          </select>
          <button className="an-btn">Voir</button>
          <PrintButton />
        </form>
      </div>
      <div className="an-bar" aria-hidden="true" style={{ display: 'flex', height: 5, borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ flex: 1, background: '#4285F4' }} /><div style={{ flex: 1, background: '#EA4335' }} /><div style={{ flex: 1, background: '#FBBC05' }} /><div style={{ flex: 1, background: '#34A853' }} />
      </div>
      <div className="an-title">
        <h1>Analytics · {site.client_name}</h1>
        <span className="an-sub" style={{ fontSize: 16 }}>
          {site.domain} · {fd(from)} → {fd(to)}{cmp ? ' · comparé à ' + fd(cmp.from) + ' → ' + fd(cmp.to) : ''}
        </span>
      </div>
      <form method="get" className="an-ctl">
        <input type="hidden" name="d" value={site.domain} />
        <div className="an-chips">
          {presets.map(([l, f, t]) => (
            <a key={l} href={presetHref(f, t)} className={'an-chip' + (f === from && t === to ? ' on' : '')}>{l}</a>
          ))}
        </div>
        <div className="an-fields">
          <label>Du<input type="date" name="from" defaultValue={from} className="an-date" /></label>
          <label>Au<input type="date" name="to" defaultValue={to} className="an-date" /></label>
          <label>Comparer
            <select name="cmp" defaultValue={cmpMode} className="an-select">
              <option value="none">Aucune comparaison</option>
              <option value="prev">Période précédente</option>
              <option value="year">Même période l’an dernier</option>
              <option value="custom">Dates personnalisées</option>
            </select>
          </label>
          <label>Comparaison du<input type="date" name="cfrom" defaultValue={cmp ? cmp.from : ''} className="an-date" /></label>
          <label>au<input type="date" name="cto" defaultValue={cmp ? cmp.to : ''} className="an-date" /></label>
          <button className="an-btn">Appliquer</button>
        </div>
        <p className="an-note">Les dates de comparaison ne sont prises en compte que si « Dates personnalisées » est choisi. GA4 affiche les données avec un jour de décalage.</p>
      </form>
    </header>
  )

  if (!site.ga4_property_id || err || !totals) {
    return (
      <main className="an">
        <style dangerouslySetInnerHTML={{ __html: CSS }} />
        <div className="an-wrap">
          {head}
          {!site.ga4_property_id ? (
            <div className="an-empty">Renseigne l’ID de propriété GA4 de ce client dans la page Clients.</div>
          ) : (
            <div className="an-err">
              <strong>Google Analytics a répondu avec une erreur :</strong>
              <span>{err}</span>
              <span>Vérifie : l’ID de propriété ({String(site.ga4_property_id)}), l’accès « Lecteur » de reporting-clients@lfdw-reporting.iam.gserviceaccount.com sur la propriété, et que l’API « Google Analytics Data » est activée dans le projet Google Cloud.</span>
            </div>
          )}
        </div>
      </main>
    )
  }

  const t = totals
  const rate = (a: number[]) => (a[0] ? (a[1] / a[0]) * 100 : 0)
  const kpis = [
    { l: 'Utilisateurs', v: fmt(t.cur[2]), c: fmt(t.cmp[2]), d: dpct(t.cur[2], t.cmp[2]) },
    { l: 'Sessions', v: fmt(t.cur[0]), c: fmt(t.cmp[0]), d: dpct(t.cur[0], t.cmp[0]) },
    { l: 'Taux d’engagement', v: rate(t.cur).toFixed(1).replace('.', ',') + ' %', c: rate(t.cmp).toFixed(1).replace('.', ',') + ' %', d: dpct(rate(t.cur), rate(t.cmp)) },
    { l: 'Durée moyenne', v: dur(t.cur[6]), c: dur(t.cmp[6]), d: dpct(t.cur[6], t.cmp[6]) },
    { l: 'Pages vues', v: fmt(t.cur[4]), c: fmt(t.cmp[4]), d: dpct(t.cur[4], t.cmp[4]) },
    { l: 'Événements clés', v: fmt(t.cur[5]), c: fmt(t.cmp[5]), d: dpct(t.cur[5], t.cmp[5]) },
  ]

  const W = 600, H = 120
  const maxS = Math.max(1, ...dailyCur.map((x) => x.v), ...dailyCmp.map((x) => x.v))
  const line = (arr: { v: number }[]) => arr.map((x, i) => (arr.length > 1 ? (i / (arr.length - 1)) * W : 0) + ',' + (H - 4 - (x.v / maxS) * (H - 12))).join(' ')
  const dk = (k: string) => k.slice(6, 8) + '/' + k.slice(4, 6) + '/' + k.slice(0, 4)

  return (
    <main className="an">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="an-wrap">
        {head}

        <section className="an-kpis" aria-label="Indicateurs clés">
          {kpis.map((k) => (
            <div key={k.l} className="an-kpi">
              <div className="an-kpi-l">{k.l}</div>
              <div className="an-kpi-v">{k.v}</div>
              {showCmp && <div className="an-kpi-n"><Delta value={k.d} /> <span>vs {k.c}</span></div>}
            </div>
          ))}
        </section>

        <section className="an-card">
          <div className="an-card-t"><h2>Sessions par jour</h2><span className="an-sub">pic : {fmt(maxS)}</span></div>
          {dailyCur.length > 1 ? (
            <>
              <svg viewBox={'0 0 ' + W + ' ' + H} preserveAspectRatio="none" role="img" aria-label="Sessions par jour" style={{ width: '100%', height: 150 }}>
                {dailyCmp.length > 1 && <polyline points={line(dailyCmp)} fill="none" stroke="#B9B1BD" strokeWidth="2" strokeDasharray="5 4" vectorEffect="non-scaling-stroke" />}
                <polyline points={line(dailyCur)} fill="none" stroke="#D4007F" strokeWidth="2" vectorEffect="non-scaling-stroke" />
              </svg>
              <div className="an-legend">
                <span><i style={{ borderColor: '#D4007F' }} />{fd(from)} → {fd(to)}</span>
                {cmp && dailyCmp.length > 1 && <span><i style={{ borderColor: '#B9B1BD', borderTopStyle: 'dashed' }} />{fd(cmp.from)} → {fd(cmp.to)}</span>}
                <span style={{ marginLeft: 'auto' }}>{dk(dailyCur[0].k)} → {dk(dailyCur[dailyCur.length - 1].k)}</span>
              </div>
            </>
          ) : <div className="an-empty">Pas assez de jours pour tracer une courbe.</div>}
        </section>

        <div className="an-grid2">
          <CmpTable title="Canaux d’acquisition" col="Canal" rows={channels} idx={0} showCmp={showCmp} />
          <CmpTable title="Sources / supports" col="Source / support" rows={sources} idx={0} showCmp={showCmp} path />
        </div>
        <CmpTable title="Pages les plus vues" col="Page (vues)" rows={pages} idx={0} showCmp={showCmp} path />
        <div className="an-grid2">
          <CmpTable title="Appareils" col="Appareil" rows={devices} idx={0} showCmp={showCmp} />
          <CmpTable title="Pays" col="Pays" rows={countries} idx={0} showCmp={showCmp} />
        </div>

        <p className="an-note">Source : Google Analytics 4, données interrogées en direct. Le taux d’engagement et la durée moyenne sont calculés sur la période choisie.</p>
      </div>
    </main>
  )
}
