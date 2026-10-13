'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { supabase } from '@/lib/supabase';
import { startSync } from '@/lib/sync';

const cleanDomain = (s: string) =>
  s.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '');
const norm = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

export async function addClient(formData: FormData) {
  const name = String(formData.get('client_name') || '').trim();
  const domain = cleanDomain(String(formData.get('domain') || ''));
  const type = String(formData.get('gsc_type') || 'url');
  const custom = String(formData.get('gsc_custom') || '').trim();
  const ga4 = String(formData.get('ga4') || '').replace(/\D/g, '');
  const brand = [...new Set(String(formData.get('brand') || '').split(/[\n,]/).map(norm).filter(Boolean))];

  if (!name || !domain) redirect('/clients?error=' + encodeURIComponent('Le nom et le domaine sont obligatoires.'));

  const gsc = custom || (type === 'domain' ? `sc-domain:${domain}` : `https://www.${domain}/`);
  const { error } = await supabase.from('rpt_sites').insert({
    client_name: name, domain, gsc_site_url: gsc, ga4_property_id: ga4 || null, brand_terms: brand,
  });
  if (error) {
    console.error('[clients] ERREUR SUPABASE :', error.message);
    redirect('/clients?error=' + encodeURIComponent(error.message));
  }
  revalidatePath('/clients');
  redirect('/clients?added=' + encodeURIComponent(domain));
}

export async function syncNow(siteId: string, months: number, _fd: FormData) {
  await supabase.from('rpt_sites').update({ sync_status: 'running', sync_message: 'Démarrage…' }).eq('id', siteId);
  startSync(siteId, months);
  revalidatePath('/clients');
  redirect('/clients');
}

export async function saveBrand(siteId: string, formData: FormData) {
  const brand = [...new Set(String(formData.get('brand') || '').split(/[\n,]/).map(norm).filter(Boolean))];
  const { error } = await supabase.from('rpt_sites').update({ brand_terms: brand }).eq('id', siteId);
  if (error) {
    console.error('[clients] ERREUR SUPABASE :', error.message);
    redirect('/clients?error=' + encodeURIComponent(error.message));
  }
  revalidatePath('/clients');
  revalidatePath('/');
  redirect('/clients');
}

export async function saveGa4(siteId: string, formData: FormData) {
  const raw = String(formData.get('ga4') || '').replace(/properties\//i, '').replace(/\D/g, '');
  const { error } = await supabase.from('rpt_sites').update({ ga4_property_id: raw || null }).eq('id', siteId);
  if (error) {
    console.error('[clients] ERREUR SUPABASE :', error.message);
    redirect('/clients?error=' + encodeURIComponent(error.message));
  }
  revalidatePath('/clients');
  revalidatePath('/');
  redirect('/clients');
}

export async function deleteClient(siteId: string, _fd: FormData) {
  const { error } = await supabase.from('rpt_sites').delete().eq('id', siteId);
  if (error) {
    console.error('[clients] ERREUR SUPABASE :', error.message);
    redirect('/clients?error=' + encodeURIComponent(error.message));
  }
  revalidatePath('/clients');
  redirect('/clients');
}
