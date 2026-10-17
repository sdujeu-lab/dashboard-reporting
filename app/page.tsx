import PrintButton from "../components/PrintButton";
import { LinksBlock } from '@/components/LinksBlock'
import { AiImportBlock } from '@/components/AiImportBlock'
import Link from 'next/link';
import {
  getSites, getMonths, getSummary, getTrend, getQueries, getPages,
  getCountries, getChannels, shiftMonth, pct, brandSplit, brandTermsOf, movers,
  getIndexSnapshot, getRankSnapshot, getAiSnapshot,
} from '@/lib/data';

export const dynamic = 'force-dynamic';

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,700&family=Young+Serif&display=swap');
.db{min-height:100vh;background:var(--canvas);color:var(--ink);font-family:'DM Sans',system-ui,sans-serif;font-size:15px;line-height:1.45;padding:28px 32px 48px;box-sizing:border-box}
.db *{box-sizing:border-box}
.db a{color:inherit}
.db-wrap{max-width:1216px;margin:0 auto;display:flex;flex-direction:column;gap:24px}
.db h1,.db h2{font-family:'Young Serif',Georgia,serif;font-weight:400;margin:0}
.db h1{font-size:44px;line-height:1.1}
.db h2{font-size:22px}
.db-head{display:flex;flex-direction:column;gap:18px}
.db-top{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:16px 32px}
.db-logo{height:72px;width:auto;display:block}
.db-form{display:flex;flex-wrap:wrap;align-items:center;gap:10px}
.db-select{height:44px;padding:0 36px 0 14px;border:1px solid var(--line-strong);border-radius:10px;background:var(--surface);color:var(--ink);font:500 15px 'DM Sans',system-ui,sans-serif}
.db-btn{height:44px;padding:0 22px;border:0;border-radius:10px;background:var(--accent-bg);color:var(--on-accent);font:700 15px 'DM Sans',system-ui,sans-serif;cursor:pointer}
.db select:focus-visible,.db button:focus-visible,.db a:focus-visible{outline:3px solid var(--focus);outline-offset:2px}
.db-bar{display:flex;height:5px;border-radius:3px;overflow:hidden}
.db-bar div{flex:1}
.db-title{display:flex;flex-wrap:wrap;align-items:baseline;gap:4px 16px}
.db-sub{color:var(--muted);font-size:14px}
.db-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(200px,100%),1fr));gap:16px}
.db-kpi{background:var(--surface);border:1px solid var(--line);border-radius:16px;padding:20px;display:flex;flex-direction:column;gap:6px}
.db-kpi-l{color:var(--muted);font-size:14px;font-weight:500}
.db-kpi-v{display:flex;align-items:flex-end;justify-content:space-between;gap:8px;font-family:'Young Serif',Georgia,serif;font-size:40px;line-height:1.1;font-variant-numeric:tabular-nums}
.db-kpi-n{display:flex;flex-direction:column;gap:6px;font-size:13px;color:var(--muted);margin-top:4px}
.db-kpi-n div{display:flex;flex-wrap:wrap;align-items:center;gap:4px 8px}
.chip{padding:2px 8px;border-radius:999px;font-weight:700}
.chip-good{background:var(--good-bg);color:var(--good)}
.chip-bad{background:var(--bad-bg);color:var(--bad)}
.chip-flat{background:var(--flat-bg);color:var(--flat)}
.db-card{background:var(--surface);border:1px solid var(--line);border-radius:16px;padding:24px;display:flex;flex-direction:column;gap:16px;min-width:0}
.db-card-t{display:flex;flex-wrap:wrap;align-items:baseline;gap:4px 12px}
.db-card-t a{margin-left:auto;font-size:13px;color:var(--accent);text-decoration:none}
.db-dist{display:flex;gap:3px;height:14px}
.db-dist>div{border-radius:4px}
.db-legend{display:flex;flex-wrap:wrap;gap:6px 22px;font-size:13px;color:var(--ink-2)}
.db-legend i{display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:7px}
.db-kw{columns:2 340px;column-gap:48px}
.db-kwrow{break-inside:avoid;display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:44px;border-bottom:1px solid var(--line2)}
.db-kwrow>span:first-child{min-width:0}
.db-kwrow .r{display:flex;align-items:center;gap:10px;flex:none}
.db-badge{min-width:56px;text-align:center;padding:3px 10px;border-radius:8px;font-weight:700;font-size:14px;font-variant-numeric:tabular-nums}
.b0{background:var(--good-bg);color:var(--good)}
.b1{background:var(--info-bg);color:var(--info)}
.b2{background:var(--warn-bg);color:var(--warn)}
.b3{background:var(--flat-bg);color:var(--flat)}
.pos{color:var(--good)}.neg{color:var(--bad)}.nul{color:var(--muted)}
.db-note{margin:0;font-size:13px;color:var(--muted)}
.db-grid2{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(480px,100%),1fr));gap:16px}
.db-grid3{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(300px,100%),1fr));gap:16px}
.db-ai{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(240px,100%),1fr));gap:24px 40px;align-items:start}
.db-big{font-family:'Young Serif',Georgia,serif;font-size:40px;line-height:1.1}
.db-big small{font-family:'DM Sans',system-ui,sans-serif;font-size:20px;color:var(--muted)}
.db-tabs{display:flex;flex-wrap:wrap;gap:4px 18px;border-bottom:1px solid var(--line2);font-size:14px}
.db-tabs a{padding:8px 0;color:var(--muted);text-decoration:none}
.db-tabs a.on{color:var(--accent);font-weight:700;border-bottom:2px solid var(--accent)}
.db-row{display:flex;align-items:center;gap:12px;min-height:40px;border-top:1px solid var(--line2);font-size:14px}
.db-row .k{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.db-row .d{min-width:36px;text-align:right;font-weight:700;font-variant-numeric:tabular-nums}
.db-row .c{width:44px;text-align:right;font-weight:700;font-variant-numeric:tabular-nums}
.db-meter{height:8px;background:var(--meter);border-radius:4px;overflow:hidden}
.db-meter>div{height:100%;border-radius:4px}
.db-line{display:flex;justify-content:space-between;gap:12px;font-size:14px}
.db-empty{display:flex;align-items:center;justify-content:center;text-align:center;min-height:90px;border:1px dashed var(--line-strong);border-radius:12px;padding:16px;color:var(--muted);font-size:14px}
.db-table{width:100%;border-collapse:collapse;font-size:14px}
.db-table th{text-align:left;font-size:13px;color:var(--muted);padding-bottom:6px;border-bottom:1px solid var(--line2)}
.db-table td{padding:7px 0;border-top:1px solid var(--line2)}
.db-table .n{text-align:right;font-variant-numeric:tabular-nums}
.db-foot{display:flex;flex-wrap:wrap;justify-content:center;gap:6px 14px;padding-top:8px;font-size:13px;color:var(--muted);text-align:center}
.db section.rounded-2xl{background:var(--surface);border:1px solid var(--line);border-radius:16px;box-shadow:none;padding:24px}
.db section.rounded-2xl h2{font-family:'Young Serif',Georgia,serif;font-weight:400;font-size:22px}
.db-print{display:none}
@media print{.db{padding:0;background:var(--surface)}.db-form{display:none}.db *{-webkit-print-color-adjust:exact;print-color-adjust:exact}.db-screen{display:none}.db-print{display:block}.db-card,.db-kpi{break-inside:avoid}}
`;

const MOIS = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
const label = (m: string) => { const [y, mo] = m.split('-').map(Number); return `${MOIS[mo - 1]} ${y}`; };
const fmt = (n: number) => new Intl.NumberFormat('fr-FR').format(Math.round(n));
const A3: Record<string, string> = { fra:'FR', bel:'BE', che:'CH', usa:'US', gbr:'GB', deu:'DE', esp:'ES', ita:'IT', can:'CA', nld:'NL', prt:'PT', lux:'LU', mar:'MA', dza:'DZ', tun:'TN' };
const country = (c: string) => {
  const a2 = A3[c.toLowerCase()];
  return a2 ? new Intl.DisplayNames(['fr'], { type: 'region' }).of(a2) || c : c.toUpperCase();
};
const path = (u: string) => { try { const p = new URL(u); return (p.pathname + p.search) || '/'; } catch { return u; } };

const BUCKETS = [
  { label: 'Top 3', color: '#34A853' },
  { label: 'Places 4 à 10', color: '#4285F4' },
  { label: 'Places 11 à 50', color: '#FBBC05' },
  { label: 'Hors top 50', color: 'var(--bucket-off)' },
];

function Delta({ value, invert = false, unit = '%' }: { value: number | null; invert?: boolean; unit?: string }) {
  if (value === null || !isFinite(value)) return <span className="chip chip-flat">n/d</span>;
  const good = invert ? value < 0 : value > 0;
  const cls = Math.abs(value) < 0.05 ? 'chip-flat' : good ? 'chip-good' : 'chip-bad';
  const arrow = value > 0 ? '▲' : value < 0 ? '▼' : '=';
  return <span className={`chip ${cls}`}>{arrow} {Math.abs(value).toFixed(1).replace('.', ',')} {unit}</span>;
}

function Spark({ values, color }: { values: number[]; color: string }) {
  if (values.length < 2) return null;
  const w = 110, h = 32, max = Math.max(...values), min = Math.min(...values);
  const pts = values.map((v, i) =>
    `${(i / (values.length - 1)) * w},${h - 2 - ((v - min) / (max - min || 1)) * (h - 4)}`).join(' ');
  return <svg width={w} height={h} aria-hidden="true"><polyline points={pts} fill="none" style={{ stroke: color }} strokeWidth="2" /></svg>;
}

function Card(p: { title: string; value: string; vsPrev: number | null; vsYoy: number | null; invert?: boolean; unit?: string; values?: number[]; color?: string; yoyLabel: string }) {
  return (
    <div className="db-kpi">
      <div className="db-kpi-l">{p.title}</div>
      <div className="db-kpi-v">
        <span>{p.value}</span>
        {p.values && <Spark values={p.values} color={p.color || 'var(--accent)'} />}
      </div>
      <div className="db-kpi-n">
        <div><Delta value={p.vsPrev} invert={p.invert} unit={p.unit} /> vs mois précédent</div>
        <div><Delta value={p.vsYoy} invert={p.invert} unit={p.unit} /> vs {p.yoyLabel}</div>
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
  const qAll = movers(queries, prevQueries, 'query');
  const qRows = pick(qAll, tq);
  const pAll = movers(pages, prevPages, 'page');
  const pRows = pick(pAll, tp);

  const tabs = (param: 'tq' | 'tp', current: string) => (
    <div className="db-tabs">
      {[['top', 'Haut de page'], ['hausse', 'Tendance haussière'], ['baisse', 'Tendance baissière']].map(([k, l]) => (
        <Link key={k} href={href({ [param]: k })} className={current === k ? 'on' : ''}>{l}</Link>
      ))}
    </div>
  );

  const row = (r: any, fn: (k: string) => string) => (
    <div key={r.key} className="db-row">
      <span className="k" title={r.key}>{fn(r.key)}</span>
      <span className={`d ${r.delta > 0 ? 'pos' : r.delta < 0 ? 'neg' : 'nul'}`}>{r.delta > 0 ? '+' : ''}{r.delta}</span>
      <span className="c">{fmt(r.clicks)}</span>
    </div>
  );

  const printLists = (all: any[], fn: (k: string) => string) => (
    <>
      {[['top', 'Haut de page'], ['hausse', 'Tendance haussière'], ['baisse', 'Tendance baissière']].map(([k, l]) => {
        const rs = pick(all, k);
        return (
          <div key={k} style={{ marginBottom: 14, breakInside: 'avoid' }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--accent)', paddingBottom: 4 }}>{l}</div>
            {rs.length ? rs.map((r) => row(r, fn)) : <p className="db-sub">Rien à afficher.</p>}
          </div>
        );
      })}
    </>
  );

  const brand = brandSplit(queries, brandTermsOf(site));
  const btotal = brand.brand + brand.other || 1;
  const chTotal = channels.reduce((a: number, c: any) => a + c.sessions, 0) || 1;
  const cTotal = countries.reduce((a: number, c: any) => a + c.clicks, 0) || 1;
  const yoyLabel = label(ym);
  const [ixCur, { rkCur, gscKMonth, effRows, bk, n3, n10 }, { aiCur, aiCurRows, aiHas, aiCited, topSrc }] = await Promise.all([
    getIndexSnapshot(site.id), getRankSnapshot(site.id), getAiSnapshot(site.id),
  ]);

  return (
    <main className="db">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="db-wrap">
        <header className="db-head">
          <div className="db-top">
            <img src="/logo-lfdw.png" alt="La Fille du Web, l'agence qui vous rend visible !" className="db-logo" />
            <form className="db-form">
              <label htmlFor="d" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>Site</label>
              <select id="d" key={site.domain} name="d" defaultValue={site.domain} className="db-select">
                {sites.map((s: any) => <option key={s.id} value={s.domain}>{s.client_name}</option>)}
              </select>
              <label htmlFor="m" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>Mois</label>
              <select id="m" key={m} name="m" defaultValue={m} className="db-select">
                {months.map((x) => <option key={x} value={x}>{label(x)}</option>)}
              </select>
              <button className="db-btn">Voir</button>
              <PrintButton />
            </form>
          </div>
          <div className="db-bar" aria-hidden="true">
            <div style={{ background: '#4285F4' }} /><div style={{ background: '#EA4335' }} /><div style={{ background: '#FBBC05' }} /><div style={{ background: '#34A853' }} />
          </div>
          <div className="db-title">
            <h1>{site.client_name}</h1>
            <span className="db-sub" style={{ fontSize: 16 }}>{site.domain} · {label(m)}</span>
          </div>
        </header>

        <section aria-label="Indicateurs clés" className="db-kpis">
          <Card title="Clics" value={fmt(cur.clicks)} yoyLabel={yoyLabel}
            vsPrev={pct(cur.clicks, prev?.clicks)} vsYoy={pct(cur.clicks, yoy?.clicks)}
            values={trend.map((t) => t.clicks)} color="#4285F4" />
          <Card title="Impressions" value={fmt(cur.impressions)} yoyLabel={yoyLabel}
            vsPrev={pct(cur.impressions, prev?.impressions)} vsYoy={pct(cur.impressions, yoy?.impressions)}
            values={trend.map((t) => t.impressions)} color="var(--accent)" />
          <Card title="CTR moyen" value={`${(cur.ctr * 100).toFixed(1).replace('.', ',')} %`} yoyLabel={yoyLabel}
            vsPrev={pct(cur.ctr, prev?.ctr)} vsYoy={pct(cur.ctr, yoy?.ctr)} />
          <Card title="Position moyenne" value={cur.position.toFixed(1).replace('.', ',')} yoyLabel={yoyLabel} invert unit="pos."
            vsPrev={prev ? cur.position - prev.position : null} vsYoy={yoy ? cur.position - yoy.position : null} />
          <div className="db-kpi">
            <div className="db-kpi-l">Pages indexées</div>
            <div className="db-kpi-v"><span>{ixCur && ixCur.total_sitemap ? fmt(ixCur.indexed_sitemap) : '–'}</span></div>
            <div className="db-kpi-n"><div>pages du sitemap</div></div>
          </div>
        </section>

        <section className="db-card">
          <div className="db-card-t">
            <h2>Rang réel Google</h2>
            <span className="db-sub">{rkCur ? `mesuré en ${label(rkCur)}` : ''}</span>
            <Link href={`/rang?d=${site.domain}`}>Voir tout →</Link>
          </div>
          {effRows.length ? (<>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div><strong>{effRows.length} mots-clés suivis</strong> · {n3} dans le top 3 · {n10} dans le top 10</div>
              <div role="img" className="db-dist" aria-label={`Répartition des ${effRows.length} mots-clés : ${bk[0]} dans le top 3, ${bk[1]} entre la 4e et la 10e place, ${bk[2]} entre la 11e et la 50e, ${bk[3]} hors du top 50`}>
                {BUCKETS.map((b, i) => bk[i] > 0 ? <div key={b.label} style={{ flex: `${bk[i]} 1 0`, background: b.color }} /> : null)}
              </div>
              <div className="db-legend">
                {BUCKETS.map((b, i) => (
                  <span key={b.label}><i style={{ background: b.color }} />{b.label} · <strong>{bk[i]}</strong></span>
                ))}
              </div>
            </div>
            <div className="db-kw">
              {effRows.map((x) => (
                <div key={x.kw} className="db-kwrow">
                  <span>{x.kw}</span>
                  <span className="r">
                    {x.diff !== 0 && <span className={x.diff > 0 ? 'pos' : 'neg'} style={{ fontSize: 13 }}>{x.diff > 0 ? '▲' : '▼'} {String(Math.abs(x.diff)).replace('.', ',')}</span>}
                    <span className={`db-badge b${x.bucket}`}>{x.text}</span>
                  </span>
                </div>
              ))}
            </div>
            <p className="db-note">Avec # (par exemple #5) : rang réel mesuré dans Google, top 50 (&gt; 50 = hors du top 50). Sans # (par exemple 4,2) : position moyenne du mois dans Search Console{gscKMonth ? ' (' + label(gscKMonth) + ')' : ''}. La position Search Console remplace le rang réel quand elle existe.</p>
          </>) : <p className="db-sub">Aucun rang mesuré pour l'instant.</p>}
        </section>

        {await LinksBlock({ siteId: site.id, domain: site.domain })}

        {await AiImportBlock({ siteId: site.id, domain: site.domain })}

        <section className="db-card">
          <div className="db-card-t">
            <h2>Visibilité dans les réponses IA de Google</h2>
            <span className="db-sub">{aiCur ? `AI Overviews · mesuré en ${label(aiCur)}` : ''}</span>
          </div>
          {aiCurRows.length ? (
            <div className="db-ai">
              <div>
                <div className="db-big">{aiHas} <small>/ {aiCurRows.length}</small></div>
                <div className="db-sub">mots-clés avec un AI Overview</div>
              </div>
              <div>
                <div className="db-big" style={{ color: aiCited ? 'var(--good)' : 'var(--bad)' }}>{aiCited} <small>/ {aiHas}</small></div>
                <div className="db-sub">où votre site est cité comme source</div>
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14, paddingBottom: 6 }}>Sites les plus cités</div>
                {topSrc.map(([h, n]) => (
                  <div key={h} className="db-row" style={{ minHeight: 34 }}>
                    <span className="k">{h}</span><span className="nul">{n}×</span>
                  </div>
                ))}
              </div>
            </div>
          ) : <p className="db-sub">Pas encore de mesure des AI Overviews. Elle se fait avec la mesure du rang réel.</p>}
        </section>

        <div className="db-grid2">
          <section className="db-card">
            <div className="db-card-t"><h2>Votre contenu</h2><span className="db-sub">clics · écart vs {label(pm)}</span></div>
            <div className="db-screen">
              {tabs('tp', tp)}
              <div>{pRows.map((r) => row(r, path))}</div>
              {!pRows.length && <p className="db-sub">Rien à afficher.</p>}
            </div>
            <div className="db-print">{printLists(pAll, path)}</div>
          </section>
          <section className="db-card">
            <div className="db-card-t"><h2>Requêtes menant à votre site</h2><span className="db-sub">clics · écart vs {label(pm)}</span></div>
            <div className="db-screen">
              {tabs('tq', tq)}
              <div>{qRows.map((r) => row(r, (k) => k))}</div>
              {!qRows.length && <p className="db-sub">Rien à afficher.</p>}
            </div>
            <div className="db-print">{printLists(qAll, (k) => k)}</div>
          </section>
        </div>

        <div className="db-grid3">
          <section className="db-card">
            <h2>Top des pays</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {countries.slice(0, 5).map((c: any) => (
                <div key={c.country} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div className="db-line"><span>{A3[c.country.toLowerCase()] ? country(c.country) : c.country}</span><strong>{((c.clicks / cTotal) * 100).toFixed(0)} %</strong></div>
                  <div className="db-meter"><div style={{ width: `${(c.clicks / cTotal) * 100}%`, background: 'var(--accent)' }} /></div>
                </div>
              ))}
            </div>
          </section>

          <section className="db-card">
            <h2>Trafic de marque</h2>
            {brandTermsOf(site).length ? (<>
              <div className="db-dist" role="img" aria-label={`${((brand.brand / btotal) * 100).toFixed(0)} % des clics incluent la marque`}>
                {brand.brand > 0 && <div style={{ flex: `${brand.brand} 1 0`, background: 'var(--accent)' }} />}
                {brand.other > 0 && <div style={{ flex: `${brand.other} 1 0`, background: '#4285F4' }} />}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[['Incluant la marque', brand.brand, 'var(--accent)'], ['Hors marque', brand.other, '#4285F4']].map(([l, v, c]) => (
                  <div key={l as string} className="db-line">
                    <span><i style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 3, background: c as string, marginRight: 8 }} />{l}</span>
                    <strong>{fmt(v as number)} clics · {(((v as number) / btotal) * 100).toFixed(0)} %</strong>
                  </div>
                ))}
              </div>
              <p className="db-note">Calculé sur les 1 000 premières requêtes du mois. Termes : {brandTermsOf(site).join(', ')}{(site.brand_terms || []).length ? '' : ' (automatiques, modifiables dans Clients)'}</p>
            </>) : <div className="db-empty">Aucun terme de marque renseigné pour ce site.</div>}
          </section>

          <section className="db-card">
            <h2>Trafic GA4 par canal</h2>
            {channels.length ? (
              <table className="db-table">
                <thead><tr><th>Canal</th><th className="n">Sessions</th><th className="n">Part</th></tr></thead>
                <tbody>
                  {channels.map((c: any) => (
                    <tr key={c.channel}>
                      <td>{c.channel}</td>
                      <td className="n">{fmt(c.sessions)}</td>
                      <td className="n nul">{((c.sessions / chTotal) * 100).toFixed(0)} %</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : <div className="db-empty">Aucune donnée GA4 reçue pour cette période.</div>}
          </section>
        </div>

        <footer className="db-foot">
          <span>Rapport réalisé par La Fille du Web</span><span aria-hidden="true">·</span><span>L'agence qui vous rend visible !</span>
        </footer>
      </div>
    </main>
  );
}
