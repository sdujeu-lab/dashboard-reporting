import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { getSites } from '@/lib/data';

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

  const months = [...new Set(ranks.map((r) => r.month.slice(0, 7)))].sort().slice(-6);
  const cell = new Map<string, any>();
  for (const r of ranks) cell.set(`${r.keyword_id}|${r.month.slice(0, 7)}`, r);
  const withData = new Set(ranks.map((r) => r.keyword_id));
  const rows = (kws || []).filter((k: any) => withData.has(k.id)).map((k: any) => {
    const last = months.length ? cell.get(`${k.id}|${months[months.length - 1]}`) : null;
    return { k, last };
  }).sort((a: any, b: any) => (a.last?.rank ?? 999) - (b.last?.rank ?? 999));
  const location = ranks[0]?.location || '';

  return (
    <main className="min-h-screen bg-slate-50 p-6 text-slate-900">
      <div className="mx-auto max-w-6xl space-y-4">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Rang réel Google · {site.client_name}</h1>
            <p className="text-sm text-slate-500">{rows.length} mots-clés prioritaires · recherche depuis {location.split(',')[0] || '—'} · ordinateur</p>
          </div>
          <div className="flex gap-4 text-sm">
            <Link href={`/mots-cles?d=${site.domain}`} className="text-blue-700">Positions GSC</Link>
            <Link href={`/?d=${site.domain}`} className="text-blue-700">← Tableau de bord</Link>
          </div>
        </header>

        <div className="overflow-x-auto rounded-2xl bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs text-slate-500">
              <tr>
                <th className="px-4 py-3 font-normal">Mot-clé</th>
                {months.map((m) => <th key={m} className="px-3 py-3 text-right font-normal">{lab(m)}</th>)}
                <th className="px-3 py-3 font-normal">Page positionnée</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map(({ k, last }: any) => (
                <tr key={k.id}>
                  <td className="px-4 py-2">{k.keyword}</td>
                  {months.map((m, i) => {
                    const c = cell.get(`${k.id}|${m}`);
                    const p = i > 0 ? cell.get(`${k.id}|${months[i - 1]}`) : null;
                    if (!c) return <td key={m} className="px-3 py-2 text-right text-slate-300">–</td>;
                    if (c.rank === null) return <td key={m} className="px-3 py-2 text-right text-slate-400">&gt; 50</td>;
                    const diff = p && p.rank !== null ? p.rank - c.rank : 0;
                    return (
                      <td key={m} className="px-3 py-2 text-right font-medium">
                        #{c.rank}
                        {diff !== 0 && <span className={`ml-1 text-xs ${diff > 0 ? 'text-emerald-600' : 'text-red-600'}`}>{diff > 0 ? '▲' : '▼'}{Math.abs(diff)}</span>}
                      </td>
                    );
                  })}
                  <td className="max-w-xs truncate px-3 py-2 text-xs text-slate-500" title={last?.url || ''}>
                    {last?.url ? new URL(last.url).pathname : '—'}
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
