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

export function brandTermsOf(site: any): string[] {
  const own = (site?.brand_terms || []).map((t: string) => norm(String(t))).filter(Boolean);
  if (own.length) return own;
  const parts = String(site?.domain || '').replace(/^www\./, '').split('.');
  const root = norm(parts.length > 1 ? parts[parts.length - 2] : parts[0]);
  const name = norm(String(site?.client_name || ''));
  const set = new Set<string>([name, name.replace(/\s+/g, ''), root, root.replace(/-/g, ''), root.replace(/-/g, ' ')]);
  return [...set].filter((t) => t.length >= 3);
}

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

// Dernier état d'indexation connu (sitemap)
export async function getIndexSnapshot(siteId: string): Promise<any> {
  const { data } = await supabase
    .from('rpt_index_monthly').select('month, total_sitemap, indexed_sitemap')
    .eq('site_id', siteId).order('month', { ascending: false }).limit(1);
  return data?.[0];
}

async function getTrackedKeywords(siteId: string) {
  const { data } = await supabase.from('rpt_keywords').select('id, keyword').eq('site_id', siteId).limit(10000);
  const kwMap = new Map((data || []).map((k: any) => [String(k.id), k.keyword as string] as [string, string]));
  return { kwMap, kIds: [...kwMap.keys()] };
}

async function rowsByKeyword(table: string, cols: string, kIds: string[]) {
  const out: any[] = [];
  for (let i = 0; i < kIds.length; i += 100) {
    const { data } = await supabase.from(table).select(cols).in('keyword_id', kIds.slice(i, i + 100));
    out.push(...(data || []));
  }
  return out;
}

// Positions des mots-clés suivis : la position Search Console remplace le rang réel quand elle existe
export async function getRankSnapshot(siteId: string) {
  const { kwMap, kIds } = await getTrackedKeywords(siteId);
  const rk = await rowsByKeyword('rpt_keyword_rank', 'keyword_id, month, rank, url', kIds);
  const rkMonths = [...new Set(rk.map((r) => String(r.month).slice(0, 7)))].sort();
  const rkCur = rkMonths[rkMonths.length - 1];
  const rkPrev = rkMonths[rkMonths.length - 2];
  const rkBy = new Map<string, any>();
  for (const r of rk) rkBy.set(`${r.keyword_id}|${String(r.month).slice(0, 7)}`, r);
  const rkRows = rkCur ? kIds.map((id) => ({ id, kw: kwMap.get(id) as string, c: rkBy.get(`${id}|${rkCur}`), p: rkPrev ? rkBy.get(`${id}|${rkPrev}`) : null })).filter((x) => x.c) : [];
  const gscK = await rowsByKeyword('rpt_keyword_monthly', 'keyword_id, month, position', kIds);
  const gscKMonths = [...new Set(gscK.map((r) => String(r.month).slice(0, 7)))].sort();
  const gscKMonth = gscKMonths[gscKMonths.length - 1] || '';
  const gscKPrev = gscKMonths[gscKMonths.length - 2] || '';
  const gscKBy = new Map<string, number>();
  const gscKPrevBy = new Map<string, number>();
  for (const r of gscK) {
    const mo = String(r.month).slice(0, 7);
    if (mo === gscKMonth) gscKBy.set(String(r.keyword_id), r.position);
    if (gscKPrev && mo === gscKPrev) gscKPrevBy.set(String(r.keyword_id), r.position);
  }
  rkRows.sort((a, b) => (gscKBy.get(a.id) ?? a.c.rank ?? 999) - (gscKBy.get(b.id) ?? b.c.rank ?? 999));

  const effRows = rkRows.map((x) => {
    const g = gscKBy.get(x.id);
    const gp = gscKPrevBy.get(x.id);
    const diff = g !== undefined
      ? (gp !== undefined ? Math.round((gp - g) * 10) / 10 : 0)
      : (x.p && x.p.rank !== null && x.c.rank !== null ? x.p.rank - x.c.rank : 0);
    const v: number | null = g !== undefined ? Math.round(g) : x.c.rank;
    const bucket = v === null || v > 50 ? 3 : v <= 3 ? 0 : v <= 10 ? 1 : 2;
    const text = g !== undefined ? g.toFixed(1).replace('.', ',') : x.c.rank === null ? '> 50' : '#' + x.c.rank;
    return { kw: x.kw, diff, bucket, text };
  });
  const bk = [0, 0, 0, 0];
  for (const r of effRows) bk[r.bucket]++;
  return { rkCur, gscKMonth, effRows, bk, n3: bk[0], n10: bk[0] + bk[1] };
}

// Présence dans les AI Overviews sur le dernier mois mesuré
export async function getAiSnapshot(siteId: string) {
  const { kIds } = await getTrackedKeywords(siteId);
  const aiR = await rowsByKeyword('rpt_keyword_ai', 'keyword_id, month, has_ai, cited, sources', kIds);
  const aiMonths = [...new Set(aiR.map((r) => String(r.month).slice(0, 7)))].sort();
  const aiCur = aiMonths[aiMonths.length - 1];
  const aiCurRows = aiR.filter((r) => String(r.month).slice(0, 7) === aiCur);
  const aiHas = aiCurRows.filter((r) => r.has_ai).length;
  const aiCited = aiCurRows.filter((r) => r.cited).length;
  const srcCount = new Map<string, number>();
  for (const r of aiCurRows) for (const h of r.sources || []) srcCount.set(h, (srcCount.get(h) || 0) + 1);
  const topSrc = [...srcCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  return { aiCur, aiCurRows, aiHas, aiCited, topSrc };
}
