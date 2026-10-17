'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { supabase } from '@/lib/supabase';
import { generateSynthesis, errorMessage, SynthesisSchema } from '@/lib/synthesis';

const back = (domain: string, month: string, extra: Record<string, string> = {}) =>
  '/synthese?' + new URLSearchParams({ d: domain, m: month, ...extra }).toString();

function refresh() {
  revalidatePath('/synthese');
  revalidatePath('/c/[token]', 'page');
}

export async function generate(siteId: string, domain: string, month: string, _fd: FormData) {
  const { data: site } = await supabase.from('rpt_sites').select('*').eq('id', siteId).maybeSingle();
  let err = '';
  try {
    if (!site) throw new Error('Client introuvable.');
    await generateSynthesis(site, month);
  } catch (e) {
    console.error('[synthese] ERREUR :', e);
    err = errorMessage(e);
  }
  refresh();
  redirect(back(domain, month, err ? { error: err } : { ok: 'generated' }));
}

const s = (fd: FormData, k: string) => String(fd.get(k) || '').trim();

export async function save(siteId: string, domain: string, month: string, fd: FormData) {
  const nK = Number(fd.get('n_kpis') || 0), nR = Number(fd.get('n_recos') || 0);
  const parsed = SynthesisSchema.safeParse({
    resume: s(fd, 'resume'),
    kpis: Array.from({ length: nK }, (_, i) => ({ label: s(fd, `kpi_label_${i}`), valeur: s(fd, `kpi_valeur_${i}`), commentaire: s(fd, `kpi_commentaire_${i}`) })).filter((k) => k.label),
    faits_marquants: s(fd, 'faits').split('\n').map((l) => l.trim().replace(/^[-•*]\s+/, '')).filter(Boolean),
    positions_ia_indexation: s(fd, 'positions'),
    recommandations: Array.from({ length: nR }, (_, i) => ({ titre: s(fd, `reco_titre_${i}`), detail: s(fd, `reco_detail_${i}`), priorite: s(fd, `reco_priorite_${i}`) })).filter((r) => r.titre),
  });
  if (!parsed.success) redirect(back(domain, month, { error: 'Contenu invalide : ' + parsed.error.issues[0]?.message }));
  const { error } = await supabase.from('rpt_syntheses').update({ content: parsed.data })
    .eq('site_id', siteId).eq('month', `${month}-01`);
  refresh();
  redirect(back(domain, month, error ? { error: error.message } : { ok: 'saved' }));
}

export async function setPublished(siteId: string, domain: string, month: string, published: boolean, _fd: FormData) {
  const { error } = await supabase.from('rpt_syntheses')
    .update({ status: published ? 'published' : 'draft', published_at: published ? new Date().toISOString() : null })
    .eq('site_id', siteId).eq('month', `${month}-01`);
  refresh();
  redirect(back(domain, month, error ? { error: error.message } : { ok: published ? 'published' : 'unpublished' }));
}
