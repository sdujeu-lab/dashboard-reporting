import Link from 'next/link';
import { getSites, getMonths } from '@/lib/data';
import { getSynthesis } from '@/lib/synthesis';
import { generate, save, setPublished } from './actions';
import SubmitButton from './SubmitButton';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const OK: Record<string, string> = {
  generated: 'Brouillon généré. Relisez-le avant de le publier.',
  saved: 'Modifications enregistrées.',
  published: 'Synthèse publiée : elle apparaît dans le rapport client.',
  unpublished: 'Synthèse retirée du rapport client.',
};

const label = (m: string) => {
  const l = new Date(`${m}-01T12:00:00Z`).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  return l.charAt(0).toUpperCase() + l.slice(1);
};

const input = 'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm';
const card = 'rounded-2xl bg-white p-5 shadow-sm space-y-3';

export default async function Page({ searchParams }: { searchParams: Promise<{ d?: string; m?: string; ok?: string; error?: string }> }) {
  const sp = await searchParams;
  const sites = await getSites();
  const site: any = sites.find((s: any) => s.domain === sp.d) || sites[0];
  if (!site) return <main className="p-8">Aucun client.</main>;
  const months = await getMonths(site.id);
  const m = sp.m && months.includes(sp.m) ? sp.m : months[0];
  const syn = m ? await getSynthesis(site.id, m) : null;
  const c = syn?.content;
  const args = [site.id, site.domain, m] as const;

  return (
    <main className="min-h-screen bg-slate-50 p-6 text-slate-900">
      <div className="mx-auto max-w-4xl space-y-6">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Synthèse client</h1>
            <p className="text-sm text-slate-500">Rédigée par Claude à partir de Search Console et Analytics, relue avant publication.</p>
          </div>
          <form method="get" className="flex flex-wrap items-center gap-2">
            <select name="d" defaultValue={site.domain} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" aria-label="Client">
              {sites.map((s: any) => <option key={s.id} value={s.domain}>{s.client_name}</option>)}
            </select>
            <select name="m" defaultValue={m} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" aria-label="Mois">
              {months.map((x) => <option key={x} value={x}>{label(x)}</option>)}
            </select>
            <button className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm">Afficher</button>
          </form>
        </header>

        {sp.error && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">Échec : {sp.error}</div>}
        {sp.ok && OK[sp.ok] && <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">{OK[sp.ok]}</div>}

        {!m ? (
          <p className="text-sm text-slate-600">Aucune donnée synchronisée pour {site.client_name}.</p>
        ) : (
          <>
            <section className={card + ' flex flex-wrap items-center justify-between gap-3'}>
              <div className="text-sm">
                <div className="font-medium">{site.client_name} · {label(m)}</div>
                <div className="text-slate-500">
                  {syn
                    ? <>{syn.status === 'published' ? <span className="text-emerald-700">● Publiée</span> : <span className="text-amber-700">● Brouillon</span>} · générée le {new Date(syn.generated_at).toLocaleString('fr-FR')} ({syn.model})</>
                    : 'Pas encore de synthèse pour ce mois.'}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <form action={generate.bind(null, ...args)}>
                  <SubmitButton pending="Rédaction en cours (jusqu'à 1 min)…">{syn ? 'Régénérer' : 'Générer la synthèse'}</SubmitButton>
                </form>
                {syn && (
                  <a
                    href={`/synthese/pdf?${new URLSearchParams({ d: site.domain, m })}`}
                    target="_blank"
                    className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm"
                  >
                    Télécharger en PDF
                  </a>
                )}
                {syn && (
                  <form action={setPublished.bind(null, ...args, syn.status !== 'published')}>
                    <SubmitButton pending="…" className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm">
                      {syn.status === 'published' ? 'Dépublier' : 'Publier'}
                    </SubmitButton>
                  </form>
                )}
              </div>
            </section>
            {syn && <p className="text-xs text-slate-500">Régénérer remplace le texte actuel et repasse la synthèse en brouillon.</p>}

            {c && (
              <form action={save.bind(null, ...args)} className="space-y-6">
                <input type="hidden" name="n_kpis" value={c.kpis.length + 1} />
                <input type="hidden" name="n_recos" value={c.recommandations.length + 1} />

                <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
                  <p className="font-medium">Mise en forme</p>
                  <p>Gras : entourez le texte de deux astérisques, par exemple <code className="rounded bg-white px-1">**spa aubagne**</code>.</p>
                  <p>Liste à puces : une ligne par élément, qui commence par <code className="rounded bg-white px-1">- </code> (résumé, positions et détail des recommandations).</p>
                  <p>Le bouton « Télécharger en PDF » montre le rendu final après enregistrement.</p>
                </div>

                <section className={card}>
                  <h2 className="font-semibold">Résumé</h2>
                  <textarea name="resume" defaultValue={c.resume} rows={5} className={input} />
                </section>

                <section className={card}>
                  <h2 className="font-semibold">Indicateurs clés</h2>
                  <p className="text-xs text-slate-500">Laissez le libellé vide pour supprimer une ligne. La dernière ligne vide permet d’en ajouter une.</p>
                  {[...c.kpis, { label: '', valeur: '', commentaire: '' }].map((k, i) => (
                    <div key={i} className="grid gap-2 md:grid-cols-[1fr_1fr_2fr]">
                      <input name={`kpi_label_${i}`} defaultValue={k.label} placeholder="Libellé" className={input} />
                      <input name={`kpi_valeur_${i}`} defaultValue={k.valeur} placeholder="Valeur" className={input} />
                      <input name={`kpi_commentaire_${i}`} defaultValue={k.commentaire} placeholder="Commentaire" className={input} />
                    </div>
                  ))}
                </section>

                <section className={card}>
                  <h2 className="font-semibold">Faits marquants</h2>
                  <p className="text-xs text-slate-500">Un fait par ligne.</p>
                  <textarea name="faits" defaultValue={c.faits_marquants.join('\n')} rows={7} className={input} />
                </section>

                <section className={card}>
                  <h2 className="font-semibold">Positions, IA et indexation</h2>
                  <textarea name="positions" defaultValue={c.positions_ia_indexation} rows={5} className={input} />
                </section>

                <section className={card}>
                  <h2 className="font-semibold">Recommandations</h2>
                  <p className="text-xs text-slate-500">Laissez le titre vide pour supprimer une recommandation.</p>
                  {[...c.recommandations, { titre: '', detail: '', priorite: 'moyenne' as const }].map((r, i) => (
                    <div key={i} className="space-y-2 border-t pt-3 first:border-0 first:pt-0">
                      <div className="grid gap-2 md:grid-cols-[3fr_1fr]">
                        <input name={`reco_titre_${i}`} defaultValue={r.titre} placeholder="Titre" className={input} />
                        <select name={`reco_priorite_${i}`} defaultValue={r.priorite} className={input} aria-label="Priorité">
                          <option value="haute">Priorité haute</option>
                          <option value="moyenne">Priorité moyenne</option>
                          <option value="basse">Priorité basse</option>
                        </select>
                      </div>
                      <textarea name={`reco_detail_${i}`} defaultValue={r.detail} placeholder="Détail" rows={2} className={input} />
                    </div>
                  ))}
                </section>

                <SubmitButton pending="Enregistrement…">Enregistrer les modifications</SubmitButton>
              </form>
            )}

            {syn && (
              <details className={card}>
                <summary className="cursor-pointer text-sm font-medium">Chiffres transmis à Claude</summary>
                <pre className="overflow-x-auto text-xs">{JSON.stringify(syn.facts, null, 2)}</pre>
              </details>
            )}
          </>
        )}
        <Link href="/" className="text-sm text-blue-700">← Tableau de bord</Link>
      </div>
    </main>
  );
}
