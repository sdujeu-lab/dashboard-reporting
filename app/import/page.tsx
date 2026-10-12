import Link from 'next/link';
import { getSites, shiftMonth } from '@/lib/data';
import { importCsv, setManual } from './actions';

export const dynamic = 'force-dynamic';

type SP = { d?: string; m?: string; ok?: string; e?: string };

export default async function Page({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const sites: any[] = await getSites();
  const site = sites.find((s) => s.domain === sp.d) || sites[0];
  if (!site) return <main className="p-6">Aucun client.</main>;
  const now = new Date().toISOString().slice(0, 7);
  const months = Array.from({ length: 16 }, (_, i) => shiftMonth(now, i + 1));
  const month = sp.m && months.includes(sp.m) ? sp.m : months[0];
  const manual = !!site.manual_import;

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6">
      <h1 className="text-2xl font-bold">Import CSV</h1>
      <p className="text-sm text-gray-600">
        Pour les clients où tu ne peux pas ajouter le compte de service : exporte les fichiers
        depuis Search Console et GA4, puis envoie-les ici. Le tableau de bord se remplit comme avec la synchro.
      </p>

      <div className="flex flex-wrap gap-2">
        {sites.map((s) => (
          <Link key={s.id} href={'/import?d=' + encodeURIComponent(s.domain)}
            className={'rounded border px-3 py-1 text-sm ' + (s.id === site.id ? 'bg-black text-white' : 'bg-white')}>
            {s.client_name}{s.manual_import ? ' (CSV)' : ''}
          </Link>
        ))}
      </div>

      {sp.ok && <p className="rounded bg-green-50 p-3 text-sm text-green-800">{sp.ok}</p>}
      {sp.e && <p className="rounded bg-red-50 p-3 text-sm text-red-800">{sp.e}</p>}

      <form action={setManual} className="flex items-center gap-3 rounded border p-3 text-sm">
        <input type="hidden" name="site_id" value={site.id} />
        <input type="hidden" name="domain" value={site.domain} />
        <input type="hidden" name="value" value={manual ? '0' : '1'} />
        <span>{manual ? '✓ Ce client est en import CSV (pas de synchro automatique).' : 'Ce client est synchronisé automatiquement.'}</span>
        <button className="ml-auto rounded border px-3 py-1">
          {manual ? 'Repasser en automatique' : "Il n'a pas d'accès automatique"}
        </button>
      </form>

      <form action={importCsv} encType="multipart/form-data" className="space-y-4 rounded border p-4">
        <input type="hidden" name="site_id" value={site.id} />
        <input type="hidden" name="domain" value={site.domain} />
        <label className="block text-sm">Mois concerné
          <select name="month" defaultValue={month} className="mt-1 block rounded border p-2">
            {months.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </label>
        <label className="block text-sm">Fichiers CSV (tu peux en choisir plusieurs d'un coup)
          <input type="file" name="files" multiple accept=".csv,text/csv" className="mt-1 block w-full" />
        </label>
        <button className="rounded bg-black px-4 py-2 text-white">Importer</button>
      </form>

      <div className="space-y-2 rounded bg-gray-50 p-4 text-sm">
        <p className="font-semibold">Comment exporter</p>
        <p><b>Search Console</b> : Performances → choisis les dates du mois entier (du 1er au dernier jour) → onglets Requêtes, Pages, Pays, Appareils, Dates → « Exporter » → Télécharger CSV (un fichier par onglet).</p>
        <p><b>GA4</b> : Rapports → Acquisition → Acquisition de trafic → mois entier → Partager → Télécharger le fichier → CSV.</p>
        <p><b>Important</b> : le fichier « Appareils » (ou « Dates ») est nécessaire pour les totaux du mois : sans lui, le mois n'apparaît pas dans le tableau de bord.</p>
      </div>
    </main>
  );
}
