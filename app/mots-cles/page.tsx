import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { getSites } from '@/lib/data';

export const dynamic = 'force-dynamic';

const MOIS = ['janv.','févr.','mars','avr.','mai','juin','juil.','août','sept.','oct.','nov.','déc.'];
const lab = (m: string) => { const [y, mo] = m.split('-').map(Number); return `${MOIS[mo - 1]} ${String(y).slice(2)}`; };

async function fetchAll(build: (from: number, to: number) => any): Promise<any[]> {
  const out: any[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await build(from, from + 999);
    if (error) throw new Error(error.message);
    out.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  return out;
}

export default async function Page({ searchParams }: { searchParams: Promise<{ d?: string; c?: string; n?: string }> }) {
  const sp = await searchParams;
  const sites = await getSites();
  const site: any = sites.find((s: any) => s.domain === sp.d) || sites[0];
  if (!site) return <main className="p-8">Aucun site.</main>;

  const kws = await fetchAll((a, b) => supabase.from('rpt_keywords').select('*').eq('site_id', site.id).range(a, b));
  const ids: string[] = kws.map((k) => k.id);
  const data: any[] = [];
  for (let i = 0; i < ids.length; i += 100) {
    const part = await fetchAll((a, b) =>
      supabase.from('rpt_keyword_monthly').select('*').in('keyword_id', ids.slice(i, i + 100)).range(a, b));
    data.push(...part);
  }

  const months = [...new Set(data.map((r) => r.month.slice(0, 7)))].sort().reverse().slice(0, 6).reverse();
  const cell = new Map<string, any>();
  for (const r of data) cell.set(`${r.keyword_id}|${r.month.slice(0, 7)}`, r);

  const cats = [...new Set(kws.map((k) => k.category))];
  const cat = sp.c && cats.includes(sp.c) ? sp.c : '';
  const showAll = sp.n === '1';

  const rows = kws
    .filter((k) => !cat || k.category === cat)
    .map((k) => {
      const cur = months.length ? cell.get(`${k.id}|${months[months.length - 1]}`) : null;
      const has = months.some((m) => cell.has(`${k.id}|${m}`));
      return { k, cur, has };
    })
    .filter((r) => showAll || r.has)
    .sort((a, b) => (b.cur?.clicks ?? -1) - (a.cur?.clicks ?? -1) || (b.cur?.impressions ?? -1) - (a.cur?.impressions ?? -1));

  const href = (o: Record<string, string>) => `/mots-cles?${new URLSearchParams({ d: site.domain, c: cat, n: showAll ? '1' : '', ...o })}`;

  return (
    <main className="min-h-screen bg-slate-50 p-6 text-slate-900">
      <div className="mx-auto max-w-6xl space-y-4">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Suivi des mots-clés · {site.client_name}</h1>
            <p className="text-sm text-slate-500">Position moyenne GSC par mois · {rows.length} mots-clés affichés sur {kws.length} suivis · {data.length} mesures en base</p>
          </div>
          <Link href={`/?d=${site.domain}`} className="text-sm text-blue-700">← Tableau de bord</Link>
        </header>

        <form className="flex gap-2 text-sm">
          <select key={site.domain} name="d" defaultValue={site.domain} className="rounded-lg border bg-white px-3 py-1.5">
            {sites.map((s: any) => <option key={s.id} value={s.domain}>{s.client_name}</option>)}
          </select>
          <button className="rounded-lg border bg-white px-3 py-1.5">Changer de client</button>
        </form>

        <div className="flex flex-wrap gap-2 text-sm">
          <Link href={href({ c: '' })} className={`rounded-full border px-3 py-1 ${!cat ? 'bg-slate-900 text-white' : 'bg-white'}`}>Toutes</Link>
          {cats.map((c) => (
            <Link key={c} href={href({ c })} className={`rounded-full border px-3 py-1 ${cat === c ? 'bg-slate-900 text-white' : 'bg-white'}`}>{c}</Link>
          ))}
          <Link href={href({ n: showAll ? '' : '1' })} className="ml-auto rounded-full border bg-white px-3 py-1">
            {showAll ? 'Masquer les non positionnés' : 'Afficher les non positionnés'}
          </Link>
        </div>

        <div className="overflow-x-auto rounded-2xl bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs text-slate-500">
              <tr>
                <th className="px-4 py-3 font-normal">Mot-clé</th>
                {months.map((m) => <th key={m} className="px-3 py-3 text-right font-normal">{lab(m)}</th>)}
                <th className="px-3 py-3 text-right font-normal">Clics</th>
                <th className="px-3 py-3 text-right font-normal">Impr.</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map(({ k, cur }) => (
                <tr key={k.id}>
                  <td className="px-4 py-2"><div>{k.keyword}</div><div className="text-xs text-slate-400">{k.category}</div></td>
                  {months.map((m, i) => {
                    const c = cell.get(`${k.id}|${m}`);
                    const p = i > 0 ? cell.get(`${k.id}|${months[i - 1]}`) : null;
                    if (!c) return <td key={m} className="px-3 py-2 text-right text-slate-300">–</td>;
                    const diff = p ? p.position - c.position : 0;
                    return (
                      <td key={m} className="px-3 py-2 text-right">
                        {c.position.toFixed(1).replace('.', ',')}
                        {p && Math.abs(diff) >= 0.1 && (
                          <span className={`ml-1 text-xs ${diff > 0 ? 'text-emerald-600' : 'text-red-600'}`}>{diff > 0 ? '▲' : '▼'}</span>
                        )}
                      </td>
                    );
                  })}
                  <td className="px-3 py-2 text-right font-medium">{cur ? cur.clicks : '–'}</td>
                  <td className="px-3 py-2 text-right text-slate-500">{cur ? cur.impressions : '–'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!rows.length && <p className="p-6 text-sm text-slate-400">Aucun mot-clé avec des données.</p>}
        </div>
        <p className="text-xs text-slate-400">▲ = la position s'améliore (le chiffre baisse) · – = pas d'impression ce mois-là · correspondance exacte avec la requête Google.</p>
      </div>
    </main>
  );
}
