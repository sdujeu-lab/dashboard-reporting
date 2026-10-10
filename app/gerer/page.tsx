import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { getSites } from '@/lib/data';
import { addKeywords, setPriority, removeKeyword } from './actions';
import DeleteButton from './DeleteButton';

export const dynamic = 'force-dynamic';

async function fetchAll(build: (a: number, b: number) => any): Promise<any[]> {
  const out: any[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await build(from, from + 999);
    if (error) throw new Error(error.message);
    out.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  return out;
}

export default async function Page({ searchParams }: { searchParams: Promise<{ d?: string; q?: string; c?: string; p?: string }> }) {
  const sp = await searchParams;
  const sites = await getSites();
  const site: any = sites.find((s: any) => s.domain === sp.d) || sites[0];
  if (!site) return <main className="p-8">Aucun site.</main>;

  const kws = await fetchAll((a, b) => supabase.from('rpt_keywords').select('*').eq('site_id', site.id).order('keyword').range(a, b));
  const cats = [...new Set(kws.map((k) => k.category))];
  const q = (sp.q || '').trim().toLowerCase();
  const c = sp.c && cats.includes(sp.c) ? sp.c : '';
  const onlyPrio = sp.p === '1';
  const prioCount = kws.filter((k) => k.priority).length;

  const filtered = kws.filter((k) => (!c || k.category === c) && (!q || k.keyword.includes(q)) && (!onlyPrio || k.priority));
  const shown = filtered.slice(0, 200);

  return (
    <main className="min-h-screen bg-slate-50 p-6 text-slate-900">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Gérer les mots-clés · {site.client_name}</h1>
            <p className="text-sm text-slate-500">
              {kws.length} mots-clés suivis dans la GSC · {prioCount} mesurés en rang réel Google
              (≈ {(prioCount * 3 * 0.01).toFixed(2).replace('.', ',')} $ par mesure mensuelle)
            </p>
          </div>
          <div className="flex gap-4 text-sm">
            <Link href={`/rang?d=${site.domain}`} className="text-blue-700">Rang réel</Link>
            <Link href={`/mots-cles?d=${site.domain}`} className="text-blue-700">Positions GSC</Link>
            <Link href={`/?d=${site.domain}`} className="text-blue-700">← Tableau de bord</Link>
          </div>
        </header>

        <section className="rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="mb-3 font-semibold">Ajouter des mots-clés</h2>
          <form action={addKeywords} className="space-y-3">
            <input type="hidden" name="site_id" value={site.id} />
            <textarea name="keywords" rows={5} placeholder={'Un mot-clé par ligne\nspa peypin\nmassage duo marseille'}
              className="w-full rounded-lg border p-3 text-sm" />
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <select name="category" defaultValue={cats[0]} className="rounded-lg border bg-white px-3 py-1.5">
                {cats.map((x) => <option key={x}>{x}</option>)}
              </select>
              <input name="new_category" placeholder="…ou nouvelle catégorie" className="rounded-lg border px-3 py-1.5" />
              <label className="flex items-center gap-2"><input type="checkbox" name="priority" /> Mesurer en rang réel Google</label>
              <button className="rounded-lg bg-slate-900 px-4 py-1.5 text-white">Ajouter</button>
            </div>
          </form>
        </section>

        <section className="rounded-2xl bg-white p-5 shadow-sm">
          <form className="mb-4 flex flex-wrap items-center gap-3 text-sm">
            <input type="hidden" name="d" value={site.domain} />
            <input name="q" defaultValue={q} placeholder="Rechercher…" className="rounded-lg border px-3 py-1.5" />
            <select name="c" defaultValue={c} className="rounded-lg border bg-white px-3 py-1.5">
              <option value="">Toutes les catégories</option>
              {cats.map((x) => <option key={x}>{x}</option>)}
            </select>
            <label className="flex items-center gap-2"><input type="checkbox" name="p" value="1" defaultChecked={onlyPrio} /> Rang réel seulement</label>
            <button className="rounded-lg border bg-white px-3 py-1.5">Filtrer</button>
            <span className="ml-auto text-slate-400">{filtered.length} résultats{filtered.length > 200 ? ' (200 affichés)' : ''}</span>
          </form>

          <ul className="divide-y">
            {shown.map((k) => (
              <li key={k.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <div>
                  <div>{k.keyword}</div>
                  <div className="text-xs text-slate-400">{k.category}</div>
                </div>
                <div className="flex shrink-0 items-center gap-4">
                  <form action={setPriority.bind(null, k.id, !k.priority)}>
                    <button className={`rounded-full border px-3 py-1 text-xs ${k.priority ? 'border-blue-600 bg-blue-50 text-blue-700' : 'text-slate-500'}`}>
                      {k.priority ? '★ Rang réel' : '☆ Suivre en rang réel'}
                    </button>
                  </form>
                  <form action={removeKeyword.bind(null, k.id)}>
                    <DeleteButton keyword={k.keyword} />
                  </form>
                </div>
              </li>
            ))}
          </ul>
          {!shown.length && <p className="py-4 text-sm text-slate-400">Aucun mot-clé.</p>}
        </section>
      </div>
    </main>
  );
}
