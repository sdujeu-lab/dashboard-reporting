import PrintButton from "../components/PrintButton";
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import {
  getSites, getMonths, getSummary, getTrend, getQueries, getPages,
  getCountries, getChannels, shiftMonth, pct, brandSplit, movers,
} from '@/lib/data';

export const dynamic = 'force-dynamic';

const MOIS = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
const label = (m: string) => { const [y, mo] = m.split('-').map(Number); return `${MOIS[mo - 1]} ${y}`; };
const fmt = (n: number) => new Intl.NumberFormat('fr-FR').format(Math.round(n));
const A3: Record<string, string> = { fra:'FR', bel:'BE', che:'CH', usa:'US', gbr:'GB', deu:'DE', esp:'ES', ita:'IT', can:'CA', nld:'NL', prt:'PT', lux:'LU', mar:'MA', dza:'DZ', tun:'TN' };
const country = (c: string) => {
  const a2 = A3[c.toLowerCase()];
  return a2 ? new Intl.DisplayNames(['fr'], { type: 'region' }).of(a2) || c : c.toUpperCase();
};
const path = (u: string) => { try { const p = new URL(u); return (p.pathname + p.search) || '/'; } catch { return u; } };

function Delta({ value, invert = false, unit = '%' }: { value: number | null; invert?: boolean; unit?: string }) {
  if (value === null || !isFinite(value)) return <span className="text-slate-400">n/d</span>;
  const good = invert ? value < 0 : value > 0;
  const color = Math.abs(value) < 0.05 ? 'text-slate-400' : good ? 'text-emerald-600' : 'text-red-600';
  const arrow = value > 0 ? '▲' : value < 0 ? '▼' : '=';
  return <span className={color}>{arrow} {Math.abs(value).toFixed(1).replace('.', ',')} {unit}</span>;
}

function Spark({ values, color }: { values: number[]; color: string }) {
  if (values.length < 2) return null;
  const w = 120, h = 32, max = Math.max(...values), min = Math.min(...values);
  const pts = values.map((v, i) =>
    `${(i / (values.length - 1)) * w},${h - 2 - ((v - min) / (max - min || 1)) * (h - 4)}`).join(' ');
  return <svg width={w} height={h}><polyline points={pts} fill="none" stroke={color} strokeWidth="2" /></svg>;
}

function Card(p: { title: string; value: string; vsPrev: number | null; vsYoy: number | null; invert?: boolean; unit?: string; values?: number[]; color?: string; yoyLabel: string }) {
  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm">
      <div className="text-sm text-slate-500">{p.title}</div>
      <div className="mt-1 flex items-end justify-between">
        <div className="text-3xl font-semibold">{p.value}</div>
        {p.values && <Spark values={p.values} color={p.color || '#2563eb'} />}
      </div>
      <div className="mt-3 space-y-1 text-xs text-slate-500">
        <div>vs mois précédent : <Delta value={p.vsPrev} invert={p.invert} unit={p.unit} /></div>
        <div>vs {p.yoyLabel} : <Delta value={p.vsYoy} invert={p.invert} unit={p.unit} /></div>
      </div>
    </div>
  );
}

export default async function Page({ searchParams }: { searchParams: Promise<{ d?: string; m?: string; tq?: string; tp?: string }> }) {
  const sp = await searchParams;
  const sites = await getSites();
  const site: any = sites.find((s: any) => s.domain === sp.d) || sites[0];
  if (!site) return <main className="p-8">Aucun site dans rpt_sites.</main>;

  const months = await getMonths(site.id);
  const m = sp.m && months.includes(sp.m) ? sp.m : months[0];
  if (!m) return <main className="p-8">Aucune donnée pour {site.client_name}. Lance d'abord sync.js.</main>;

  const tq = ['hausse', 'baisse'].includes(sp.tq || '') ? sp.tq! : 'top';
  const tp = ['hausse', 'baisse'].includes(sp.tp || '') ? sp.tp! : 'top';
  const pm = shiftMonth(m, 1), ym = shiftMonth(m, 12);

  const [cur, prev, yoy, trend, queries, prevQueries, pages, prevPages, countries, channels] = await Promise.all([
    getSummary(site.id, m), getSummary(site.id, pm), getSummary(site.id, ym), getTrend(site.id, m),
    getQueries(site.id, m), getQueries(site.id, pm), getPages(site.id, m), getPages(site.id, pm),
    getCountries(site.id, m), getChannels(site.id, m),
  ]);
  if (!cur) return <main className="p-8">Pas de données pour {label(m)}.</main>;

  const href = (o: Record<string, string>) =>
    `/?${new URLSearchParams({ d: site.domain, m, tq, tp, ...o }).toString()}`;

  const pick = (rows: any[], tab: string) => {
    const r = rows.filter((x) => (tab === 'top' ? x.clicks > 0 : tab === 'hausse' ? x.delta > 0 : x.delta < 0));
    if (tab === 'top') r.sort((a, b) => b.clicks - a.clicks);
    else if (tab === 'hausse') r.sort((a, b) => b.delta - a.delta);
    else r.sort((a, b) => a.delta - b.delta);
    return r.slice(0, 10);
  };
  const qRows = pick(movers(queries, prevQueries, 'query'), tq);
  const pRows = pick(movers(pages, prevPages, 'page'), tp);

  const tabs = (param: 'tq' | 'tp', current: string) => (
    <div className="mb-2 flex gap-4 border-b text-sm">
      {[['top', 'Haut de page'], ['hausse', 'Tendance haussière'], ['baisse', 'Tendance baissière']].map(([k, l]) => (
        <Link key={k} href={href({ [param]: k })}
          className={`pb-2 ${current === k ? 'border-b-2 border-blue-600 font-medium text-blue-700' : 'text-slate-500'}`}>{l}</Link>
      ))}
    </div>
  );

  const row = (r: any, fn: (k: string) => string) => (
    <li key={r.key} className="flex items-center justify-between gap-4 py-2 text-sm">
      <span className="truncate" title={r.key}>{fn(r.key)}</span>
      <span className="flex shrink-0 items-center gap-3">
        <span className={r.delta > 0 ? 'text-emerald-600' : r.delta < 0 ? 'text-red-600' : 'text-slate-400'}>
          {r.delta > 0 ? '+' : ''}{r.delta}
        </span>
        <span className="w-12 text-right font-medium">{fmt(r.clicks)}</span>
      </span>
    </li>
  );

  const brand = brandSplit(queries, site.brand_terms || []);
  const btotal = brand.brand + brand.other || 1;
  const chTotal = channels.reduce((a: number, c: any) => a + c.sessions, 0) || 1;
  const cTotal = countries.reduce((a: number, c: any) => a + c.clicks, 0) || 1;
  const yoyLabel = label(ym);
  const { data: kwR } = await supabase.from('rpt_keywords').select('id, keyword').eq('site_id', site.id).limit(10000)
  const kwMap = new Map((kwR || []).map((k: any) => [String(k.id), k.keyword as string] as [string, string]))
  const kIds = [...kwMap.keys()]
  const rk: any[] = []
  for (let i = 0; i < kIds.length; i += 100) {
    const { data } = await supabase.from('rpt_keyword_rank').select('keyword_id, month, rank, url').in('keyword_id', kIds.slice(i, i + 100))
    rk.push(...(data || []))
  }
  const rkMonths = [...new Set(rk.map((r) => String(r.month).slice(0, 7)))].sort()
  const rkCur = rkMonths[rkMonths.length - 1]
  const rkPrev = rkMonths[rkMonths.length - 2]
  const rkBy = new Map<string, any>()
  for (const r of rk) rkBy.set(`${r.keyword_id}|${String(r.month).slice(0, 7)}`, r)
  const rkRows = rkCur ? kIds.map((id) => ({ kw: kwMap.get(id) as string, c: rkBy.get(`${id}|${rkCur}`), p: rkPrev ? rkBy.get(`${id}|${rkPrev}`) : null })).filter((x) => x.c) : []
  rkRows.sort((a, b) => (a.c.rank ?? 999) - (b.c.rank ?? 999))
  const n3 = rkRows.filter((x) => x.c.rank !== null && x.c.rank <= 3).length
  const n10 = rkRows.filter((x) => x.c.rank !== null && x.c.rank <= 10).length
  const { data: ix } = await supabase.from('rpt_index_monthly').select('month, total_sitemap, indexed_sitemap').eq('site_id', site.id).order('month', { ascending: false }).limit(2)
  const ixCur: any = ix?.[0]
  const ixPrev: any = ix?.[1]
  const aiR: any[] = []
  for (let i = 0; i < kIds.length; i += 100) {
    const { data } = await supabase.from('rpt_keyword_ai').select('keyword_id, month, has_ai, cited, sources').in('keyword_id', kIds.slice(i, i + 100))
    aiR.push(...(data || []))
  }
  const aiMonths = [...new Set(aiR.map((r) => String(r.month).slice(0, 7)))].sort()
  const aiCur = aiMonths[aiMonths.length - 1]
  const aiCurRows = aiR.filter((r) => String(r.month).slice(0, 7) === aiCur)
  const aiHas = aiCurRows.filter((r) => r.has_ai).length
  const aiCited = aiCurRows.filter((r) => r.cited).length
  const srcCount = new Map<string, number>()
  for (const r of aiCurRows) for (const h of r.sources || []) srcCount.set(h, (srcCount.get(h) || 0) + 1)
  const topSrc = [...srcCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)

  return (
    <main className="min-h-screen bg-slate-50 p-6 text-slate-900">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">{site.client_name}</h1>
            <p className="text-sm text-slate-500">{site.domain} · {label(m)}</p>
          </div>
          <form className="flex gap-2">
            <select key={site.domain} name="d" defaultValue={site.domain} className="rounded-lg border bg-white px-3 py-1.5 text-sm">
              {sites.map((s: any) => <option key={s.id} value={s.domain}>{s.client_name}</option>)}
            </select>
            <select key={m} name="m" defaultValue={m} className="rounded-lg border bg-white px-3 py-1.5 text-sm">
              {months.map((x) => <option key={x} value={x}>{label(x)}</option>)}
            </select>
            <button className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm text-white">Voir</button>
          <PrintButton />
          </form>
        </header>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card title="Clics" value={fmt(cur.clicks)} yoyLabel={yoyLabel}
            vsPrev={pct(cur.clicks, prev?.clicks)} vsYoy={pct(cur.clicks, yoy?.clicks)}
            values={trend.map((t) => t.clicks)} color="#2563eb" />
          <Card title="Impressions" value={fmt(cur.impressions)} yoyLabel={yoyLabel}
            vsPrev={pct(cur.impressions, prev?.impressions)} vsYoy={pct(cur.impressions, yoy?.impressions)}
            values={trend.map((t) => t.impressions)} color="#7c3aed" />
          <Card title="CTR moyen" value={`${(cur.ctr * 100).toFixed(1).replace('.', ',')} %`} yoyLabel={yoyLabel}
            vsPrev={pct(cur.ctr, prev?.ctr)} vsYoy={pct(cur.ctr, yoy?.ctr)} />
          <Card title="Position moyenne" value={cur.position.toFixed(1).replace('.', ',')} yoyLabel={yoyLabel} invert unit="pos."
            vsPrev={prev ? cur.position - prev.position : null} vsYoy={yoy ? cur.position - yoy.position : null} />
        </section>

        <section className="grid gap-6 lg:grid-cols-3">
          <div className="rounded-2xl bg-white p-5 shadow-sm lg:col-span-2">
            <h2 className="mb-3 flex items-baseline justify-between font-semibold">
              <span>Rang réel Google <span className="text-xs font-normal text-slate-400">{rkCur ? `mesuré en ${label(rkCur)}` : ''}</span></span>
              <Link href={`/rang?d=${site.domain}`} className="text-xs font-normal text-blue-700 print:hidden">Voir tout →</Link>
            </h2>
            {rkRows.length ? (<>
              <p className="mb-2 text-xs text-slate-500">{rkRows.length} mots-clés suivis · {n3} dans le top 3 · {n10} dans le top 10</p>
              <ul className="divide-y">
                {rkRows.slice(0, 10).map((x) => {
                  const diff = x.p && x.p.rank !== null && x.c.rank !== null ? x.p.rank - x.c.rank : 0;
                  return (
                    <li key={x.kw} className="flex items-center justify-between gap-4 py-2 text-sm">
                      <span className="truncate">{x.kw}</span>
                      <span className="flex shrink-0 items-center gap-3">
                        {diff !== 0 && <span className={diff > 0 ? 'text-emerald-600' : 'text-red-600'}>{diff > 0 ? '▲' : '▼'} {Math.abs(diff)}</span>}
                        <span className="w-14 text-right font-medium">{x.c.rank === null ? '> 50' : `#${x.c.rank}`}</span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            </>) : <p className="py-4 text-sm text-slate-400">Aucun rang mesuré pour l'instant.</p>}
          </div>
          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <h2 className="mb-3 flex items-baseline justify-between font-semibold">
              <span>Indexation Google</span>
              <Link href={`/indexation?d=${site.domain}&vue=client`} className="text-xs font-normal text-blue-700 print:hidden">Détail →</Link>
            </h2>
            {ixCur && ixCur.total_sitemap ? (
              <div>
                <div className="text-3xl font-semibold">{ixCur.indexed_sitemap} <span className="text-base font-normal text-slate-500">/ {ixCur.total_sitemap} pages</span></div>
                <div className="mt-2 h-2 rounded bg-slate-100"><div className="h-2 rounded bg-emerald-500" style={{ width: `${(ixCur.indexed_sitemap / ixCur.total_sitemap) * 100}%` }} /></div>
                <p className="mt-2 text-sm text-slate-500">{((ixCur.indexed_sitemap / ixCur.total_sitemap) * 100).toFixed(0)} % des pages du sitemap sont indexées</p>
                {ixPrev && ixPrev.total_sitemap ? <p className="mt-1 text-xs text-slate-400">Mois précédent : {ixPrev.indexed_sitemap} / {ixPrev.total_sitemap}</p> : null}
                <p className="mt-1 text-xs text-slate-400">Contrôlé en {label(String(ixCur.month).slice(0, 7))}</p>
              </div>
            ) : <p className="py-4 text-sm text-slate-400">Contrôle d'indexation pas encore lancé.</p>}
          </div>
        </section>

        <section className="rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="mb-3 font-semibold">Visibilité dans les réponses IA de Google <span className="text-xs font-normal text-slate-400">{aiCur ? `AI Overviews · mesuré en ${label(aiCur)}` : ''}</span></h2>
          {aiCurRows.length ? (
            <div className="grid gap-6 sm:grid-cols-3">
              <div>
                <div className="text-3xl font-semibold">{aiHas} <span className="text-base font-normal text-slate-500">/ {aiCurRows.length}</span></div>
                <p className="mt-1 text-sm text-slate-500">mots-clés avec un AI Overview</p>
              </div>
              <div>
                <div className="text-3xl font-semibold text-emerald-600">{aiCited} <span className="text-base font-normal text-slate-500">/ {aiHas}</span></div>
                <p className="mt-1 text-sm text-slate-500">où votre site est cité comme source</p>
              </div>
              <div>
                <p className="mb-1 text-sm font-medium">Sites les plus cités</p>
                <ul className="space-y-1 text-sm text-slate-600">{topSrc.map(([h, n]) => <li key={h} className="flex justify-between"><span className="truncate">{h}</span><span>{n}×</span></li>)}</ul>
              </div>
            </div>
          ) : <p className="py-4 text-sm text-slate-400">Pas encore de mesure des AI Overviews. Elle se fait avec la mesure du rang réel.</p>}
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <h2 className="mb-3 font-semibold">Votre contenu <span className="text-xs font-normal text-slate-400">clics · écart vs {label(pm)}</span></h2>
            {tabs('tp', tp)}
            <ul className="divide-y">{pRows.map((r) => row(r, path))}</ul>
            {!pRows.length && <p className="py-4 text-sm text-slate-400">Rien à afficher.</p>}
          </div>
          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <h2 className="mb-3 font-semibold">Requêtes menant à votre site <span className="text-xs font-normal text-slate-400">clics · écart vs {label(pm)}</span></h2>
            {tabs('tq', tq)}
            <ul className="divide-y">{qRows.map((r) => row(r, (k) => k))}</ul>
            {!qRows.length && <p className="py-4 text-sm text-slate-400">Rien à afficher.</p>}
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-3">
          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <h2 className="mb-3 font-semibold">Top des pays</h2>
            <ul className="space-y-2 text-sm">
              {countries.slice(0, 5).map((c: any) => (
                <li key={c.country}>
                  <div className="flex justify-between"><span>{A3[c.country.toLowerCase()] ? country(c.country) : c.country}</span><span>{((c.clicks / cTotal) * 100).toFixed(0)} %</span></div>
                  <div className="h-1.5 rounded bg-slate-100"><div className="h-1.5 rounded bg-blue-600" style={{ width: `${(c.clicks / cTotal) * 100}%` }} /></div>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <h2 className="mb-3 font-semibold">Trafic de marque</h2>
            {(site.brand_terms || []).length ? (
              <div className="space-y-3 text-sm">
                {[['Incluant la marque', brand.brand, 'bg-blue-600'], ['Hors marque', brand.other, 'bg-emerald-500']].map(([l, v, c]) => (
                  <div key={l as string}>
                    <div className="flex justify-between"><span>{l}</span><span>{fmt(v as number)} clics · {(((v as number) / btotal) * 100).toFixed(0)} %</span></div>
                    <div className="h-2 rounded bg-slate-100"><div className={`h-2 rounded ${c}`} style={{ width: `${((v as number) / btotal) * 100}%` }} /></div>
                  </div>
                ))}
                <p className="text-xs text-slate-400">Calculé sur les 1 000 premières requêtes du mois.</p>
              </div>
            ) : <p className="text-sm text-slate-400">Aucun terme de marque renseigné pour ce site.</p>}
          </div>

          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <h2 className="mb-3 font-semibold">Trafic GA4 par canal</h2>
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-slate-400">
                <tr><th className="pb-1 font-normal">Canal</th><th className="pb-1 text-right font-normal">Sessions</th><th className="pb-1 text-right font-normal">Part</th></tr>
              </thead>
              <tbody className="divide-y">
                {channels.map((c: any) => (
                  <tr key={c.channel}>
                    <td className="py-1.5">{c.channel}</td>
                    <td className="py-1.5 text-right">{fmt(c.sessions)}</td>
                    <td className="py-1.5 text-right text-slate-500">{((c.sessions / chTotal) * 100).toFixed(0)} %</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
