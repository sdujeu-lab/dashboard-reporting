import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getSites } from '@/lib/data';
import { getSynthesis } from '@/lib/synthesis';
import SynthesisView from '@/components/SynthesisView';
import PrintButton from '@/components/PrintButton';

export const dynamic = 'force-dynamic';

const label = (m: string) => {
  const l = new Date(`${m}-01T12:00:00Z`).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  return l.charAt(0).toUpperCase() + l.slice(1);
};

export async function generateMetadata({ searchParams }: { searchParams: Promise<{ d?: string; m?: string }> }): Promise<Metadata> {
  const sp = await searchParams;
  const site: any = (await getSites()).find((s: any) => s.domain === sp.d);
  // Le titre sert de nom de fichier proposé à l'enregistrement en PDF
  return { title: site && sp.m ? `Synthèse SEO ${site.client_name} ${sp.m}` : 'Synthèse SEO', robots: { index: false, follow: false } };
}

// Version imprimable de la synthèse seule, à enregistrer en PDF depuis le navigateur
export default async function Page({ searchParams }: { searchParams: Promise<{ d?: string; m?: string }> }) {
  const sp = await searchParams;
  const site: any = (await getSites()).find((s: any) => s.domain === sp.d);
  if (!site || !sp.m || !/^\d{4}-\d{2}$/.test(sp.m)) notFound();
  const syn = await getSynthesis(site.id, sp.m);
  if (!syn) notFound();

  return (
    <main className="mx-auto w-full max-w-3xl space-y-6 bg-white p-8 text-slate-900 print:max-w-none print:p-0">
      <div className="flex items-center justify-between gap-4 print:hidden">
        <p className="text-sm text-slate-600">
          {syn.status === 'published' ? 'Synthèse publiée.' : 'Brouillon : pensez à le relire avant de l’envoyer.'}
        </p>
        <PrintButton label="Télécharger en PDF" />
      </div>
      <header className="flex items-center justify-between gap-6 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-bold">{site.client_name}</h1>
          <p className="text-sm text-slate-600">Synthèse SEO · {label(sp.m)} · {site.domain}</p>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-lfdw.png" alt="La Fille du Web" className="h-14 w-auto" />
      </header>
      <SynthesisView syn={syn.content} className="space-y-5" />
      <p className="border-t border-slate-200 pt-3 text-xs text-slate-600">
        Données Google Search Console et Google Analytics 4 · La Fille du Web
      </p>
    </main>
  );
}
