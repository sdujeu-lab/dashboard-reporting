import path from 'path'
import { BetaAnalyticsDataClient } from '@google-analytics/data'

const KEY = path.join(process.cwd(), process.env.GOOGLE_KEY_FILE || 'service-account.json')

export type Range = { from: string; to: string }
export type Raw = { dv: string[]; range: 'cur' | 'cmp'; m: number[] }
export type Row = { key: string; cur: number[]; cmp: number[] }

export function ga4Client(): any {
  return new BetaAnalyticsDataClient({ keyFilename: KEY })
}

export async function ga4Run(
  client: any, property: string, cur: Range, cmp: Range | null,
  dimensions: string[], metrics: string[], limit?: number,
): Promise<Raw[]> {
  const dateRanges: any[] = [{ startDate: cur.from, endDate: cur.to, name: 'cur' }]
  if (cmp) dateRanges.push({ startDate: cmp.from, endDate: cmp.to, name: 'cmp' })
  const req: any = {
    property: 'properties/' + property,
    dateRanges,
    dimensions: dimensions.map((name) => ({ name })),
    metrics: metrics.map((name) => ({ name })),
  }
  if (limit) { req.limit = limit; req.orderBys = [{ metric: { metricName: metrics[0] }, desc: true }] }
  const [rep] = await client.runReport(req)
  return (rep.rows || []).map((r: any) => {
    const dv: string[] = (r.dimensionValues || []).map((x: any) => String(x.value ?? ''))
    // avec deux périodes, GA4 ajoute la dimension « dateRange » en dernier
    const range = (cmp ? dv.pop() : 'cur') === 'cmp' ? 'cmp' : 'cur'
    return { dv, range, m: (r.metricValues || []).map((x: any) => Number(x.value)) } as Raw
  })
}

export function mergeRows(raw: Raw[], nm: number): Row[] {
  const map = new Map<string, Row>()
  for (const r of raw) {
    const key = r.dv.join(' / ')
    let row = map.get(key)
    if (!row) { row = { key, cur: new Array(nm).fill(0), cmp: new Array(nm).fill(0) }; map.set(key, row) }
    if (r.range === 'cmp') row.cmp = r.m
    else row.cur = r.m
  }
  return Array.from(map.values())
}
