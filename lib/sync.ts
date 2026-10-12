import path from 'path';
import { google } from 'googleapis';
import { BetaAnalyticsDataClient } from '@google-analytics/data';
import { supabase } from './supabase';

const KEY = path.join(process.cwd(), process.env.GOOGLE_KEY_FILE || 'service-account.json');
const g = globalThis as any;
g.__rptRunning = g.__rptRunning || new Set<string>();
const running: Set<string> = g.__rptRunning;

const monthRange = (month: string) => {
  const [y, m] = month.split('-').map(Number);
  return { startDate: `${month}-01`, endDate: new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10) };
};

async function upsert(table: string, rows: any[], onConflict: string) {
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await supabase.from(table).upsert(rows.slice(i, i + 500), { onConflict });
    if (error) throw new Error(`${table} : ${error.message}`);
  }
}

const searchConsole = () =>
  google.searchconsole({
    version: 'v1',
    auth: new google.auth.GoogleAuth({ keyFile: KEY, scopes: ['https://www.googleapis.com/auth/webmasters.readonly'] }),
  });

const metrics = (r: any) => ({ clicks: r.clicks, impressions: r.impressions, ctr: r.ctr, position: r.position });

async function syncGsc(site: any, month: string) {
  const { startDate, endDate } = monthRange(month);
  const sc = searchConsole();
  const query = async (dimensions: string[], rowLimit: number): Promise<any[]> =>
    (await sc.searchanalytics.query({
      siteUrl: site.gsc_site_url,
      requestBody: { startDate, endDate, dimensions, rowLimit },
    })).data.rows || [];
  const base = { site_id: site.id, month: startDate };

  await upsert('rpt_gsc_monthly_summary', (await query([], 1)).map((r) => ({ ...base, ...metrics(r) })), 'site_id,month');
  await upsert('rpt_gsc_monthly_queries', (await query(['query'], 1000)).map((r) => ({ ...base, query: r.keys[0], ...metrics(r) })), 'site_id,month,query');
  await upsert('rpt_gsc_monthly_pages', (await query(['page'], 1000)).map((r) => ({ ...base, page: r.keys[0], ...metrics(r) })), 'site_id,month,page');
  await upsert('rpt_gsc_monthly_countries', (await query(['country'], 50)).map((r) => ({ ...base, country: r.keys[0], ...metrics(r) })), 'site_id,month,country');
}

async function syncGa4(site: any, month: string) {
  const { startDate, endDate } = monthRange(month);
  const client = new BetaAnalyticsDataClient({ keyFilename: KEY });
  const [report] = await client.runReport({
    property: `properties/${site.ga4_property_id}`,
    dateRanges: [{ startDate, endDate }],
    dimensions: [{ name: 'sessionDefaultChannelGroup' }],
    metrics: [{ name: 'sessions' }, { name: 'engagedSessions' }, { name: 'totalUsers' }, { name: 'keyEvents' }],
  });
  const rows = (report.rows || []).map((r: any) => ({
    site_id: site.id, month: startDate,
    channel: r.dimensionValues[0].value,
    sessions: Number(r.metricValues[0].value),
    engaged_sessions: Number(r.metricValues[1].value),
    users: Number(r.metricValues[2].value),
    key_events: Number(r.metricValues[3].value),
  }));
  await upsert('rpt_ga4_monthly_channels', rows, 'site_id,month,channel');
}

async function getKeywords(siteId: string): Promise<any[]> {
  const out: any[] = [];
  for (let from = 0; ; from += 1000) {
    const { data } = await supabase.from('rpt_keywords').select('id,keyword').eq('site_id', siteId).range(from, from + 999);
    out.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  return out;
}

async function syncKeywords(site: any, month: string, kwMap: Map<string, string>) {
  const { startDate, endDate } = monthRange(month);
  const sc = searchConsole();
  const all: any[] = [];
  for (let startRow = 0; ; startRow += 25000) {
    const rows = (await sc.searchanalytics.query({
      siteUrl: site.gsc_site_url,
      requestBody: { startDate, endDate, dimensions: ['query'], rowLimit: 25000, startRow },
    })).data.rows || [];
    all.push(...rows);
    if (rows.length < 25000) break;
  }
  const out = all
    .filter((r) => kwMap.has(r.keys[0].toLowerCase()))
    .map((r) => ({ keyword_id: kwMap.get(r.keys[0].toLowerCase()), month: startDate, ...metrics(r) }));
  await upsert('rpt_keyword_monthly', out, 'keyword_id,month');
}

async function setStatus(siteId: string, status: string, message: string, done = false) {
  await supabase.from('rpt_sites')
    .update({ sync_status: status, sync_message: message, ...(done ? { synced_at: new Date().toISOString() } : {}) })
    .eq('id', siteId);
}

async function run(siteId: string, n: number) {
  const { data: site } = await supabase.from('rpt_sites').select('*').eq('id', siteId).single();
  if (!site) return;
  if (site.manual_import) { await setStatus(site.id, 'ok', 'Import manuel (pas de synchro automatique)', true); return; }

  const now = new Date();
  const months: string[] = [];
  for (let i = n; i >= 1; i--) {
    months.push(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1)).toISOString().slice(0, 7));
  }
  const kwMap = new Map<string, string>((await getKeywords(site.id)).map((k) => [k.keyword, k.id]));
  const failed: string[] = [];
  let ga4Note = '';

  for (let i = 0; i < months.length; i++) {
    const m = months[i];
    await setStatus(site.id, 'running', `Mois ${i + 1}/${months.length} (${m})…`);
    try {
      await syncGsc(site, m);
    } catch (e: any) {
      if (/permission|forbidden|not found|403|404/i.test(e.message)) {
        await setStatus(site.id, 'error', `Search Console : ${e.message}. Vérifie l'accès du compte de service et l'adresse de la propriété.`);
        return;
      }
      failed.push(m);
      continue;
    }
    if (site.ga4_property_id) {
      try { await syncGa4(site, m); } catch (e: any) { if (!ga4Note) ga4Note = `GA4 : ${e.message}`; }
    }
    if (kwMap.size) {
      try { await syncKeywords(site, m, kwMap); } catch { failed.push(`${m} (mots-clés)`); }
    }
  }

  const msg = [
    `${months.length - failed.length} mois synchronisés`,
    failed.length ? `échecs : ${failed.join(', ')}` : '',
    ga4Note,
  ].filter(Boolean).join(' · ');
  await setStatus(site.id, failed.length || ga4Note ? 'partial' : 'ok', msg, true);
}

export function startSync(siteId: string, nMonths: number) {
  if (running.has(siteId)) return;
  running.add(siteId);
  run(siteId, Math.min(Math.max(nMonths, 1), 16))
    .catch((e) => setStatus(siteId, 'error', String(e && e.message ? e.message : e)))
    .finally(() => running.delete(siteId));
}
