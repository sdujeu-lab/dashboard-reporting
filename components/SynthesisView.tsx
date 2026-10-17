import type { Synthesis } from '@/lib/synthesis'
import RichText, { Inline } from './RichText'

// Synthèse rédigée, affichée dans le rapport client et dans sa version PDF
export default function SynthesisView({ syn, className }: { syn: Synthesis; className?: string }) {
  return (
    <section className={className}>
      <h2 className="text-lg font-semibold text-slate-900">Synthèse du mois</h2>
      <RichText text={syn.resume} className="text-slate-900" />

      {syn.kpis.length > 0 && (
        <dl className="grid gap-3 md:grid-cols-2 print:grid-cols-2">
          {syn.kpis.map((k, i) => (
            <div key={i} className="break-inside-avoid rounded-lg border border-slate-200 p-3">
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-600">{k.label}</dt>
              <dd className="mt-1 text-lg font-semibold tabular-nums text-slate-900">{k.valeur}</dd>
              <dd className="mt-1 text-sm text-slate-600"><Inline text={k.commentaire} /></dd>
            </div>
          ))}
        </dl>
      )}

      {syn.faits_marquants.length > 0 && (
        <div>
          <h3 className="mb-2 font-semibold text-slate-900">Faits marquants</h3>
          <ul className="list-disc space-y-1 pl-5 text-slate-900">
            {syn.faits_marquants.map((f, i) => <li key={i}><Inline text={f} /></li>)}
          </ul>
        </div>
      )}

      {syn.positions_ia_indexation && (
        <div>
          <h3 className="mb-2 font-semibold text-slate-900">Positions, IA et indexation</h3>
          <RichText text={syn.positions_ia_indexation} className="text-slate-900" />
        </div>
      )}

      {syn.recommandations.length > 0 && (
        <div>
          <h3 className="mb-2 font-semibold text-slate-900">Recommandations</h3>
          <ol className="space-y-3">
            {syn.recommandations.map((r, i) => (
              <li key={i} className="break-inside-avoid">
                <p className="font-medium text-slate-900">
                  <Inline text={r.titre} />{' '}
                  <span className="text-xs font-normal text-slate-600">· priorité {r.priorite}</span>
                </p>
                <RichText text={r.detail} className="text-sm text-slate-700" />
              </li>
            ))}
          </ol>
        </div>
      )}
    </section>
  )
}
