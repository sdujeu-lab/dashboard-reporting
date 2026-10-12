import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { getSites } from '@/lib/data';
import { saveManualRank } from '../mesurer/manual';
import PrintButton from '@/components/PrintButton';

export const dynamic = 'force-dynamic';

const MOIS = ['janv.','févr.','mars','avr.','mai','juin','juil.','août','sept.','oct.','nov.','déc.'];
const lab = (m: string) => { const [y, mo] = m.split('-').map(Number); return `${MOIS[mo - 1]} ${String(y).slice(2)}`; };

export default async function Page({ searchParams }: { searchParams: Promise<{ d?: string }> }) {
  const sp = await searchParams;
  const sites = await getSites();
  const site: any = sites.find((s: any) => s.domain === sp.d) || sites[0];
  if (!site) return <main className="p-8">Aucun site.</main>;

  const { data: kws } = await supabase.from('rpt_keywords').select('*').eq('site_id', site.id).limit(10000);
  const ids = (kws || []).map((k: any) => k.id);
  const ranks: any[] = [];
  for (let i = 0; i < ids.length; i += 100) {
    const { data } = await supabase.from('rpt_keyword_rank').select('*').in('keyword_id', ids.slice(i, i + 100));
    ranks.push(...(data || []));
  }

  const errs: any[] = [];
  for (let i = 0; i < ids.length; i += 100) {
    const { data } = await supabase.from('rpt_rank_errors').select('*').in('keyword_id', ids.slice(i, i + 100).map(String));
    errs.push(...(data || []));
  }
  const errBy = new Map<string, any>();
  for (const e of errs) errBy.set(`${e.keyword_id}|${e.month.slice(0, 7)}`, e);
  const aiRows: any[] = [];
  for (let i = 0; i < ids.length; i += 100) {
    const { data } = await supabase.from('rpt_keyword_ai').select('*').in('keyword_id', ids.slice(i, i + 100).map(String));
    aiRows.push(...(data || []));
  }
  const aiBy = new Map<string, any>();
  for (const a of aiRows) aiBy.set(`${a.keyword_id}|${String(a.month).slice(0, 7)}`, a);
  const months = [...new Set([...ranks, ...errs].map((r) => r.month.slice(0, 7)))].sort().slice(-6);
  const cell = new Map<string, any>();
  for (const r of ranks) cell.set(`${r.keyword_id}|${r.month.slice(0, 7)}`, r);
  const withData = new Set([...ranks, ...errs].map((r) => String(r.keyword_id)));
  const rows = (kws || []).filter((k: any) => withData.has(String(k.id))).map((k: any) => {
    const last = months.length ? cell.get(`${k.id}|${months[months.length - 1]}`) : null;
    const err = months.length ? errBy.get(`${k.id}|${months[months.length - 1]}`) : null;
    return { k, last, err };
  }).sort((a: any, b: any) => (b.err ? 1 : 0) - (a.err ? 1 : 0) || (a.last?.rank ?? 999) - (b.last?.rank ?? 999));
  const location = ranks[0]?.location || '';

  return (
    <main className="min-h-screen bg-slate-50 p-6 text-slate-900">
      <div className="mx-auto max-w-6xl space-y-4">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Rang réel Google · {site.client_name}</h1>
            <p className="text-sm text-slate-500">{rows.length} mots-clés prioritaires · recherche depuis {location.split(',')[0] || '—'} · ordinateur</p>
          </div>
          <div className="flex items-center gap-4 text-sm print:hidden">
            <PrintButton />
            <Link href={`/mots-cles?d=${site.domain}`} className="text-blue-700">Positions GSC</Link>
            <Link href={`/?d=${site.domain}`} className="text-blue-700">← Tableau de bord</Link>
          </div>
        </header>
        {rows.some((r: any) => r.err) && (
          <div className="rounded-xl bg-red-50 p-4 text-sm text-red-700 print:hidden">
            ⚠ {rows.filter((r: any) => r.err).length} mot(s)-clé(s) en erreur de mesure ce mois-ci : {rows.filter((r: any) => r.err).map((r: any) => r.k.keyword).join(', ')}. Relance « Mesurer » : ils seront repris en premier.
          </div>
        )}

        <div className="overflow-x-auto rounded-2xl bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs text-slate-500">
              <tr>
                <th className="px-4 py-3 font-normal">Mot-clé</th>
                {months.map((m) => <th key={m} className="px-3 py-3 text-right font-normal">{lab(m)}</th>)}
                <th className="px-3 py-3 font-normal">Page positionnée</th>
                <th className="px-3 py-3 font-normal">Réponses IA</th>
                <th className="px-3 py-3 font-normal print:hidden">Corriger</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map(({ k, last }: any) => (
                <tr key={k.id}>
                  <td className="px-4 py-2">{k.keyword}</td>
                  {months.map((m, i) => {
                    const c = cell.get(`${k.id}|${m}`);
                    const p = i > 0 ? cell.get(`${k.id}|${months[i - 1]}`) : null;
                    const er = errBy.get(`${k.id}|${m}`);
                    if (!c && er) return <td key={m} className="px-3 py-2 text-right text-xs font-medium text-red-600 print:text-transparent" title={er.error}>⚠ erreur</td>;
                    if (!c) return <td key={m} className="px-3 py-2 text-right text-slate-300">–</td>;
                    if (c.rank === null) return <td key={m} className="px-3 py-2 text-right text-slate-400">&gt; 50{er && <span className="ml-1 text-xs text-red-600 print:hidden" title={er.error}>⚠</span>}</td>;
                    const diff = p && p.rank !== null ? p.rank - c.rank : 0;
                    return (
                      <td key={m} className="px-3 py-2 text-right font-medium">
                        #{c.rank}
                        {er && <span className="ml-1 text-xs text-red-600 print:hidden" title={er.error}>⚠</span>}
                        {diff !== 0 && <span className={`ml-1 text-xs ${diff > 0 ? 'text-emerald-600' : 'text-red-600'}`}>{diff > 0 ? '▲' : '▼'}{Math.abs(diff)}</span>}
                      </td>
                    );
                  })}
                  <td className="max-w-xs truncate px-3 py-2 text-xs text-slate-500" title={last?.url || ''}>
                    {last?.url ? new URL(last.url).pathname : '—'}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {(() => {
                      const a = months.length ? aiBy.get(`${k.id}|${months[months.length - 1]}`) : null;
                      if (!a) return <span className="text-slate-300">–</span>;
                      if (!a.has_ai) return <span className="text-slate-400">Pas d'AI Overview</span>;
                      return a.cited ? <span className="font-medium text-emerald-600">✓ Cité</span> : <span className="text-amber-600" title={(a.sources || []).join(', ')}>✗ Non cité</span>;
                    })()}
                  </td>
                  <td className="px-3 py-2 text-xs print:hidden">
                    <details>
                      <summary className="cursor-pointer text-blue-700">✎</summary>
                      <form action={saveManualRank} className="mt-2 flex flex-col gap-1">
                        <input type="hidden" name="keyword_id" value={k.id} />
                        <input type="hidden" name="domain" value={site.domain} />
                        <input type="hidden" name="back" value={`/rang?d=${site.domain}`} />
                        <input name="rank" type="number" min="1" max="50" placeholder="Position (vide = > 50)" className="w-44 rounded border px-2 py-1" />
                        <input name="url" placeholder="Page (facultatif)" className="w-44 rounded border px-2 py-1" />
                        <button className="rounded bg-slate-800 px-2 py-1 text-white">Enregistrer</button>
                      </form>
                    </details>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!rows.length && <p className="p-6 text-sm text-slate-400">Aucun rang mesuré. Lance d'abord rank-check.js.</p>}
        </div>
        <p className="text-xs text-slate-400">Rang mesuré dans les résultats Google (top 50, médiane de 3 mesures) · ▲ = gain de places · &gt; 50 = hors des 50 premiers résultats.</p>
      </div>
    </main>
  );
}
