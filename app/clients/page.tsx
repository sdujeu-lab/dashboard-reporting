import Link from 'next/link';
import { getSites } from '@/lib/data';
import { addClient, syncNow, deleteClient, saveBrand, saveGa4 } from './actions';
import DeleteClientButton from './DeleteClientButton';
import AutoRefresh from './AutoRefresh';

export const dynamic = 'force-dynamic';

const SERVICE_ACCOUNT = 'reporting-clients@lfdw-reporting.iam.gserviceaccount.com';

function Status({ s }: { s: any }) {
  const st = s.sync_status;
  const when = s.synced_at ? new Date(s.synced_at).toLocaleString('fr-FR') : '';
  if (st === 'running') return <span className="text-amber-600">⏳ {s.sync_message}</span>;
  if (st === 'error') return <span className="text-red-600">✗ {s.sync_message}</span>;
  if (st === 'partial') return <span className="text-amber-700">⚠ {s.sync_message} · {when}</span>;
  if (st === 'ok') return <span className="text-emerald-600">✓ {s.sync_message} · {when}</span>;
  return <span className="text-slate-400">Pas encore synchronisé</span>;
}

export default async function Page({ searchParams }: { searchParams: Promise<{ added?: string; error?: string }> }) {
  const sp = await searchParams;
  const sites = await getSites();
  const anyRunning = sites.some((s: any) => s.sync_status === 'running');

  return (
    <main className="min-h-screen bg-slate-50 p-6 text-slate-900">
      <AutoRefresh active={anyRunning} />
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Clients</h1>
            <p className="text-sm text-slate-500">{sites.length} client{sites.length > 1 ? 's' : ''} suivi{sites.length > 1 ? 's' : ''}</p>
          </div>
          <Link href="/" className="text-sm text-blue-700">← Tableau de bord</Link>
        </header>

        {sp.error && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">Échec : {sp.error}</div>}
        {sp.added && (
          <div className="space-y-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
            <p><b>{sp.added}</b> est ajouté. Étapes suivantes :</p>
            <p>1. Ajoute <code className="rounded bg-white px-1">{SERVICE_ACCOUNT}</code> dans sa Search Console (autorisation Restreinte) et dans son GA4 (rôle Lecteur).</p>
            <p>2. Clique sur « Synchroniser 16 mois » sur sa ligne ci-dessous.</p>
          </div>
        )}

        <section className="rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="mb-3 font-semibold">Mes clients</h2>
          <ul className="divide-y">
            {sites.map((s: any) => (
              <li key={s.id} className="space-y-2 py-4 text-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="font-medium">{s.client_name}</div>
                    <div className="text-xs text-slate-400">{s.domain} · GSC : {s.gsc_site_url} · GA4 : {s.ga4_property_id || '—'}</div>
                  </div>
                  <div className="flex gap-2">
                    <form action={syncNow.bind(null, s.id, 16)}>
                      <button className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs text-white">Synchroniser 16 mois</button>
                    </form>
                    <form action={syncNow.bind(null, s.id, 1)}>
                      <button className="rounded-lg border px-3 py-1.5 text-xs">Mettre à jour (dernier mois)</button>
                    </form>
                  </div>
                </div>
                <div className="text-xs"><Status s={s} /></div>
                <form action={saveBrand.bind(null, s.id)} className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="text-slate-500">Termes de marque :</span>
                  <input name="brand" defaultValue={(s.brand_terms || []).join(', ')} placeholder="vide = nom du client et domaine" className="min-w-[16rem] flex-1 rounded-lg border px-2 py-1" />
                  <button className="rounded-lg border px-3 py-1">Enregistrer</button>
                </form>
                <form action={saveGa4.bind(null, s.id)} className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="text-slate-500">ID propriété GA4 :</span>
                  <input name="ga4" defaultValue={s.ga4_property_id || ''} placeholder="ex. 535901583 (vide = pas de GA4)" className="min-w-[16rem] flex-1 rounded-lg border px-2 py-1" />
                  <button className="rounded-lg border px-3 py-1">Enregistrer</button>
                </form>
                <div className="flex gap-4 text-blue-700">
                  <Link href={`/?d=${s.domain}`}>Tableau de bord</Link>
                  <Link href={`/mots-cles?d=${s.domain}`}>Positions GSC</Link>
                  <Link href={`/rang?d=${s.domain}`}>Rang réel</Link>
                  <Link href={`/gerer?d=${s.domain}`}>Gérer les mots-clés</Link>
                  <form action={deleteClient.bind(null, s.id)} className="ml-auto"><DeleteClientButton name={s.client_name} /></form>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="mb-3 font-semibold">Ajouter un client</h2>
          <form action={addClient} className="grid gap-4 text-sm sm:grid-cols-2">
            <label className="space-y-1">
              <span className="text-slate-500">Nom du client</span>
              <input name="client_name" required placeholder="Le Dôme Bleu" className="w-full rounded-lg border px-3 py-2" />
            </label>
            <label className="space-y-1">
              <span className="text-slate-500">Domaine (sans https ni www)</span>
              <input name="domain" required placeholder="spa-ledomebleu.fr" className="w-full rounded-lg border px-3 py-2" />
            </label>
            <fieldset className="space-y-1 sm:col-span-2">
              <legend className="text-slate-500">Type de propriété dans sa Search Console</legend>
              <label className="mr-6"><input type="radio" name="gsc_type" value="url" defaultChecked /> Préfixe d'URL (https://www.domaine/)</label>
              <label><input type="radio" name="gsc_type" value="domain" /> Domaine (sc-domain:domaine)</label>
            </fieldset>
            <label className="space-y-1 sm:col-span-2">
              <span className="text-slate-500">…ou adresse exacte de la propriété (si elle est différente, par exemple http://domaine.fr/)</span>
              <input name="gsc_custom" placeholder="http://domaine.fr/" className="w-full rounded-lg border px-3 py-2" />
            </label>
            <label className="space-y-1">
              <span className="text-slate-500">ID de propriété GA4 (facultatif)</span>
              <input name="ga4" placeholder="535901583" className="w-full rounded-lg border px-3 py-2" />
            </label>
            <label className="space-y-1">
              <span className="text-slate-500">Termes de marque (séparés par des virgules)</span>
              <input name="brand" placeholder="dome bleu, ledomebleu" className="w-full rounded-lg border px-3 py-2" />
            </label>
            <div className="sm:col-span-2">
              <button className="rounded-lg bg-slate-900 px-5 py-2 text-white">Ajouter ce client</button>
            </div>
          </form>
        </section>
      </div>
    </main>
  );
}
