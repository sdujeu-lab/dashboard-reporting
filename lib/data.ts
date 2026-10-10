import { supabase } from './supabase';

export const shiftMonth = (m: string, n: number) => {
  const [y, mo] = m.split('-').map(Number);
  return new Date(Date.UTC(y, mo - 1 - n, 1)).toISOString().slice(0, 7);
};
const d = (m: string) => `${m}-01`;

export async function getSites() {
  const { data } = await supabase.from('rpt_sites').select('*').order('client_name');
  return data || [];
}

export async function getMonths(siteId: string): Promise<string[]> {
  const { data } = await supabase
    .from('rpt_gsc_monthly_summary').select('month')
    .eq('site_id', siteId).order('month', { ascending: false });
  return (data || []).map((r: any) => r.month.slice(0, 7));
}

export async function getSummary(siteId: string, m: string): Promise<any> {
  const { data } = await supabase
    .from('rpt_gsc_monthly_summary').select('*')
    .eq('site_id', siteId).eq('month', d(m)).maybeSingle();
  return data;
}

export async function getTrend(siteId: string, m: string): Promise<any[]> {
  const { data } = await supabase
    .from('rpt_gsc_monthly_summary').select('month,clicks,impressions')
    .eq('site_id', siteId).lte('month', d(m))
    .order('month', { ascending: false }).limit(13);
  return (data || []).reverse();
}

async function getRows(table: string, siteId: string, m: string, order: string): Promise<any[]> {
  const { data } = await supabase
    .from(table).select('*')
    .eq('site_id', siteId).eq('month', d(m))
    .order(order, { ascending: false }).limit(1000);
  return data || [];
}
export const getQueries = (s: string, m: string) => getRows('rpt_gsc_monthly_queries', s, m, 'clicks');
export const getPages = (s: string, m: string) => getRows('rpt_gsc_monthly_pages', s, m, 'clicks');
export const getCountries = (s: string, m: string) => getRows('rpt_gsc_monthly_countries', s, m, 'clicks');
export const getChannels = (s: string, m: string) => getRows('rpt_ga4_monthly_channels', s, m, 'sessions');

export const pct = (cur: number, prev?: number | null) =>
  prev ? ((cur - prev) / prev) * 100 : null;

export const norm = (s: string) =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

export function brandSplit(queries: any[], terms: string[]) {
  const t = terms.map(norm);
  let brand = 0, other = 0;
  for (const q of queries) {
    if (t.some((x) => norm(q.query).includes(x))) brand += q.clicks;
    else other += q.clicks;
  }
  return { brand, other };
}

export function movers(cur: any[], prev: any[], key: string) {
  const map = new Map<string, any>();
  for (const r of prev) map.set(r[key], { key: r[key], clicks: 0, prevClicks: r.clicks });
  for (const r of cur) {
    const e = map.get(r[key]);
    if (e) e.clicks = r.clicks;
    else map.set(r[key], { key: r[key], clicks: r.clicks, prevClicks: 0 });
  }
  return [...map.values()].map((e) => ({ ...e, delta: e.clicks - e.prevClicks }));
}
