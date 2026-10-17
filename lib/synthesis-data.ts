import {
  getSummary, getTrend, getQueries, getPages, getChannels, shiftMonth, pct,
  brandSplit, brandTermsOf, movers, getIndexSnapshot, getRankSnapshot, getAiSnapshot,
} from './data';

const r1 = (n: number | null | undefined) => (n === null || n === undefined ? null : Math.round(n * 10) / 10);

function kpi(cur: any, prev: any, yoy: any) {
  const clicks = Number(cur?.clicks || 0);
  const impressions = Number(cur?.impressions || 0);
  const ctr = impressions ? (clicks / impressions) * 100 : 0;
  const pCtr = prev?.impressions ? (prev.clicks / prev.impressions) * 100 : null;
  const yCtr = yoy?.impressions ? (yoy.clicks / yoy.impressions) * 100 : null;
  return {
    clics: { valeur: clicks, vs_mois_precedent_pct: r1(pct(clicks, prev?.clicks)), vs_annee_precedente_pct: r1(pct(clicks, yoy?.clicks)) },
    impressions: { valeur: impressions, vs_mois_precedent_pct: r1(pct(impressions, prev?.impressions)), vs_annee_precedente_pct: r1(pct(impressions, yoy?.impressions)) },
    taux_de_clic_pct: { valeur: r1(ctr), mois_precedent: r1(pCtr), annee_precedente: r1(yCtr) },
    position_moyenne: { valeur: r1(cur?.position), mois_precedent: r1(prev?.position), annee_precedente: r1(yoy?.position) },
  };
}

function topMovers(cur: any[], prev: any[], key: string) {
  const all = movers(cur, prev, key);
  const pick = (rows: any[]) => rows.slice(0, 8).map((x) => ({ [key]: x.key, clics: x.clicks, clics_mois_precedent: x.prevClicks, ecart: x.delta }));
  return {
    en_hausse: pick(all.filter((x) => x.delta > 0).sort((a, b) => b.delta - a.delta)),
    en_baisse: pick(all.filter((x) => x.delta < 0).sort((a, b) => a.delta - b.delta)),
  };
}

function channelsFacts(cur: any[], prev: any[]) {
  if (!cur.length) return null;
  const prevBy = new Map(prev.map((c: any) => [c.channel, c]));
  const sum = (rows: any[], k: string) => rows.reduce((a, c) => a + Number(c[k] || 0), 0);
  return {
    total: {
      sessions: sum(cur, 'sessions'), sessions_engagees: sum(cur, 'engaged_sessions'),
      utilisateurs: sum(cur, 'users'), conversions: sum(cur, 'key_events'),
      sessions_vs_mois_precedent_pct: r1(pct(sum(cur, 'sessions'), sum(prev, 'sessions'))),
      conversions_vs_mois_precedent_pct: r1(pct(sum(cur, 'key_events'), sum(prev, 'key_events'))),
    },
    par_canal: cur.map((c: any) => ({
      canal: c.channel, sessions: c.sessions, sessions_engagees: c.engaged_sessions,
      utilisateurs: c.users, conversions: c.key_events,
      sessions_vs_mois_precedent_pct: r1(pct(c.sessions, prevBy.get(c.channel)?.sessions)),
    })),
  };
}

// Chiffres du mois, déjà calculés, transmis tels quels à Claude
export async function buildFacts(site: any, month: string) {
  const pm = shiftMonth(month, 1), ym = shiftMonth(month, 12);
  const [cur, prev, yoy, trend, queries, prevQueries, pages, prevPages, channels, prevChannels, ix, rank, ai] = await Promise.all([
    getSummary(site.id, month), getSummary(site.id, pm), getSummary(site.id, ym), getTrend(site.id, month),
    getQueries(site.id, month), getQueries(site.id, pm), getPages(site.id, month), getPages(site.id, pm),
    getChannels(site.id, month), getChannels(site.id, pm),
    getIndexSnapshot(site.id), getRankSnapshot(site.id), getAiSnapshot(site.id),
  ]);
  const brand = brandSplit(queries, brandTermsOf(site));

  return {
    client: site.client_name,
    site: site.domain,
    mois: month,
    search_console: {
      kpi: kpi(cur, prev, yoy),
      tendance_13_mois: trend.map((t: any) => ({ mois: String(t.month).slice(0, 7), clics: t.clicks, impressions: t.impressions })),
      clics_marque: brand.brand,
      clics_hors_marque: brand.other,
      top_requetes: queries.slice(0, 10).map((q: any) => ({ requete: q.query, clics: q.clicks, impressions: q.impressions, position: r1(q.position) })),
      top_pages: pages.slice(0, 10).map((p: any) => ({ page: p.page, clics: p.clicks, impressions: p.impressions, position: r1(p.position) })),
      requetes: topMovers(queries, prevQueries, 'query'),
      pages: topMovers(pages, prevPages, 'page'),
    },
    google_analytics: channelsFacts(channels, prevChannels) ?? 'non disponible',
    positions_mots_cles: rank.effRows.length
      ? {
          mesure: rank.gscKMonth || rank.rkCur,
          suivis: rank.effRows.length,
          top_3: rank.bk[0], de_4_a_10: rank.bk[1], de_11_a_50: rank.bk[2], hors_top_50: rank.bk[3],
          plus_fortes_progressions: [...rank.effRows].filter((x) => x.diff > 0).sort((a, b) => b.diff - a.diff).slice(0, 5).map((x) => ({ mot_cle: x.kw, position: x.text, gain: x.diff })),
          plus_fortes_baisses: [...rank.effRows].filter((x) => x.diff < 0).sort((a, b) => a.diff - b.diff).slice(0, 5).map((x) => ({ mot_cle: x.kw, position: x.text, perte: -x.diff })),
        }
      : 'non disponible',
    ai_overviews: ai.aiCurRows.length
      ? { mesure: ai.aiCur, mots_cles_mesures: ai.aiCurRows.length, avec_ai_overview: ai.aiHas, site_cite: ai.aiCited, sources_principales: ai.topSrc.map(([h, n]) => ({ source: h, citations: n })) }
      : 'non disponible',
    indexation: ix?.total_sitemap
      ? { mesure: String(ix.month).slice(0, 7), pages_sitemap: ix.total_sitemap, pages_indexees: ix.indexed_sitemap }
      : 'non disponible',
  };
}

export type Facts = Awaited<ReturnType<typeof buildFacts>>;
