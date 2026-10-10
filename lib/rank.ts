import { createClient } from '@supabase/supabase-js'

const db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!, {
  auth: { persistSession: false },
})

const LOCATION = "Marseille,Provence-Alpes-Cote d'Azur,France"
const RUNS = 3
const NOT_FOUND = 51

export type RankSt = { running: boolean; done: number; total: number; msg: string; cost: number }
const g = globalThis as any
if (!g.__rankStatus) g.__rankStatus = new Map<string, RankSt>()

export const getRankStatus = (siteId: string): RankSt | undefined => g.__rankStatus.get(String(siteId))
const setSt = (siteId: string, st: RankSt) => g.__rankStatus.set(String(siteId), st)

async function serp(keyword: string, domain: string) {
  const auth = Buffer.from(
    `${process.env.DATAFORSEO_LOGIN}:${process.env.DATAFORSEO_PASSWORD}`
  ).toString('base64')
  const res = await fetch('https://api.dataforseo.com/v3/serp/google/organic/live/regular', {
    method: 'POST',
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
    body: JSON.stringify([
      { keyword, location_name: LOCATION, language_code: 'fr', device: 'desktop', depth: 50 },
    ]),
  })
  const j: any = await res.json()
  const task = j.tasks?.[0]
  if (!task || task.status_code !== 20000) {
    throw new Error(task?.status_message || 'Erreur DataForSEO')
  }
  const items: any[] = task.result?.[0]?.items || []
  const hit = items.find(
    (i) => i.type === 'organic' && (i.domain || '').replace(/^www\./, '').endsWith(domain)
  )
  return {
    rank: hit ? (hit.rank_group as number) : NOT_FOUND,
    url: hit ? (hit.url as string) : null,
    cost: (task.cost as number) || 0,
  }
}

export function startRank(siteId: string, domain: string, scope: 'priority' | 'all') {
  const key = String(siteId)
  if (getRankStatus(key)?.running) return
  setSt(key, { running: true, done: 0, total: 0, msg: 'Démarrage…', cost: 0 })

  ;(async () => {
    let done = 0
    let cost = 0
    const failed: string[] = []
    try {
      let q = db.from('rpt_keywords').select('id, keyword').eq('site_id', siteId).order('keyword')
      if (scope === 'priority') q = q.eq('priority', true)
      const { data: kws, error } = await q.range(0, 999)
      if (error) throw new Error(error.message)
      const list = kws || []
      if (!list.length) throw new Error('Aucun mot-clé à mesurer (coche prioritaire dans Gérer).')
      const total = list.length
      const month = new Date().toISOString().slice(0, 7) + '-01'

      for (const k of list) {
        setSt(key, { running: true, done, total, msg: `Mesure : ${k.keyword}`, cost })
        const settled = await Promise.allSettled(Array.from({ length: RUNS }, () => serpRetry(k.keyword, domain)))
        const runs: any[] = settled.filter((x) => x.status === 'fulfilled').map((x: any) => x.value)
        if (runs.length === 0) {
          const why = (settled[0] as any).reason?.message || "inconnu"
          failed.push(k.keyword + " (" + why + ")")
          continue
        }
        cost += runs.reduce((s, r) => s + r.cost, 0)
        runs.sort((a, b) => a.rank - b.rank)
        const med = runs[Math.floor(runs.length / 2)]
        const rank = med.rank === NOT_FOUND ? null : med.rank
        const row = { keyword_id: k.id, month, rank, url: med.url, location: LOCATION, checked_at: new Date().toISOString() }
        const { error: e2 } = await db.from('rpt_keyword_rank').upsert(row, { onConflict: 'keyword_id,month' })
        if (e2) throw new Error(e2.message)
        done++
      }
      setSt(key, { running: false, done, total, msg: (failed.length ? "Terminé : " + done + " mesurés, " + failed.length + " échec(s) : " + failed.join(" ; ") : "✓ " + done + " mots-clés mesurés"), cost })
    } catch (e: any) {
      console.error('[rank]', e)
      setSt(key, { running: false, done, total: done, msg: `✗ ${e.message || e}`, cost })
    }
  })()
}

async function serpRetry(keyword: string, domain: string) {
  let err: any
  for (let i = 0; i < 3; i++) {
    try {
      return await serp(keyword, domain)
    } catch (e) {
      err = e
      await new Promise((r) => setTimeout(r, 1500))
    }
  }
  throw err
}
