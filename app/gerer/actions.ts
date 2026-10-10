'use server';

import { revalidatePath } from 'next/cache';
import { supabase } from '@/lib/supabase';

export async function addKeywords(formData: FormData) {
  const siteId = String(formData.get('site_id') || '');
  const raw = String(formData.get('keywords') || '');
  const newCat = String(formData.get('new_category') || '').trim();
  const category = newCat || String(formData.get('category') || 'Autres');
  const priority = formData.get('priority') === 'on';
  const list = [...new Set(raw.split('\n').map((s) => s.trim().toLowerCase()).filter(Boolean))];
  console.log(`[gerer] ajout : site=${siteId} · ${list.length} mots-clés · catégorie=${category} · rang réel=${priority}`);
  if (!siteId || !list.length) {
    console.error('[gerer] rien à ajouter (site vide ou zone de texte vide)');
    return;
  }

  const rows = list.map((keyword) => ({ site_id: siteId, keyword, category, priority }));
  const { error } = await supabase.from('rpt_keywords').upsert(rows, { onConflict: 'site_id,keyword', ignoreDuplicates: !priority });
  if (error) console.error('[gerer] ERREUR SUPABASE :', error.message);
  else console.log('[gerer] OK');
  revalidatePath('/gerer');
}

export async function setPriority(id: string, value: boolean, _fd: FormData) {
  const { error } = await supabase.from('rpt_keywords').update({ priority: value }).eq('id', id);
  if (error) console.error('[gerer] ERREUR SUPABASE :', error.message);
  revalidatePath('/gerer');
}

export async function removeKeyword(id: string, _fd: FormData) {
  const { error } = await supabase.from('rpt_keywords').delete().eq('id', id);
  if (error) console.error('[gerer] ERREUR SUPABASE :', error.message);
  revalidatePath('/gerer');
}
