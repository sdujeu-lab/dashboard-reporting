import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod';
import { supabase } from './supabase';
import { buildFacts } from './synthesis-data';

export const MODEL = 'claude-opus-5-5';

export const SynthesisSchema = z.object({
  resume: z.string(),
  kpis: z.array(z.object({ label: z.string(), valeur: z.string(), commentaire: z.string() })),
  faits_marquants: z.array(z.string()),
  positions_ia_indexation: z.string(),
  recommandations: z.array(z.object({
    titre: z.string(),
    detail: z.string(),
    priorite: z.enum(['haute', 'moyenne', 'basse']),
  })),
});
export type Synthesis = z.infer<typeof SynthesisSchema>;

const SYSTEM = `Tu rédiges la synthèse mensuelle SEO d'un client de La Fille du Web, une agence de référencement.
Le lecteur est le client : un dirigeant ou une petite équipe, pas un expert SEO. Écris en français, avec des phrases claires et concrètes. Explique brièvement les termes techniques quand c'est utile.
La synthèse est signée par la consultante qui suit le client : pour les actions et les recommandations, écris à la première personne du singulier (« je vais retravailler », « je recommande ») et jamais « nous » ni « l'agence ».
Garde un ton neutre envers le client : ne t'adresse pas à lui. N'utilise ni « vous », ni « votre », ni « vos ». Parle du « site », de « la page d'accueil », ou cite le client par son nom réel (champ "client" des données), par exemple « le site a obtenu N clics » ou « les recherches contenant le nom <nom réel> ». N'écris jamais l'expression « le client » ou « le nom du client ».

Mise en forme (le texte est affiché tel quel, sans autre balise) :
- Mets en gras avec **double astérisque** les mots-clés et requêtes cités (par exemple **spa aubagne**) et, au plus, un chiffre clé par phrase.
- Dans "positions_ia_indexation" et dans le "detail" des recommandations, tu peux faire une liste à puces : une ligne par élément, commençant par "- ".
- N'utilise pas d'autre syntaxe (pas de titres, pas de liens, pas d'italique).

Règles :
- N'utilise que les chiffres présents dans les données fournies. N'invente, n'extrapole et n'arrondis différemment aucun chiffre.
- Quand une source vaut "non disponible", dis-le simplement dans la section concernée, sans deviner.
- Les pourcentages "vs_mois_precedent_pct" et "vs_annee_precedente_pct" sont des variations en %. Une position moyenne qui baisse est une amélioration.
- Distingue les variations saisonnières (comparaison sur un an) des variations ponctuelles (comparaison au mois précédent).

Contenu attendu :
- resume : 3 à 5 phrases qui donnent l'essentiel du mois.
- kpis : 4 à 6 indicateurs clés (clics, impressions, taux de clic, position moyenne, sessions et conversions si Google Analytics est disponible). "valeur" est la valeur formatée en français, "commentaire" est une phrase.
- faits_marquants : 3 à 6 points (requêtes ou pages en hausse ou en baisse, part de la marque, canaux).
- positions_ia_indexation : un paragraphe sur les positions des mots-clés suivis, la présence dans les AI Overviews de Google et l'indexation.
- recommandations : 3 à 5 actions concrètes pour le mois suivant, chacune justifiée par les données.`;

export async function generateSynthesis(site: any, month: string) {
  const facts = await buildFacts(site, month);
  // Une clé non rattachée à un workspace doit préciser lequel utiliser
  const ws = process.env.ANTHROPIC_WORKSPACE_ID;
  const client = new Anthropic(ws ? { defaultHeaders: { 'anthropic-workspace-id': ws } } : {});

  const response = await client.beta.messages.parse({
    model: MODEL,
    max_tokens: 16000,
    system: SYSTEM,
    output_config: { effort: 'medium', format: betaZodOutputFormat(SynthesisSchema) },
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    messages: [{
      role: 'user',
      content: `Données du mois (JSON) :\n\n${JSON.stringify(facts, null, 2)}`,
    }],
  });

  if (response.stop_reason === 'refusal') throw new Error('Claude a refusé de rédiger cette synthèse.');
  if (response.stop_reason === 'max_tokens') throw new Error('La synthèse a été coupée (limite de longueur atteinte).');
  const content = response.parsed_output;
  if (!content) throw new Error('La réponse de Claude ne respecte pas le format attendu.');

  const { error } = await supabase.from('rpt_syntheses').upsert({
    site_id: site.id,
    month: `${month}-01`,
    content,
    facts,
    status: 'draft',
    model: response.model,
    generated_at: new Date().toISOString(),
    published_at: null,
  }, { onConflict: 'site_id,month' });
  if (error) throw new Error(`rpt_syntheses : ${error.message}`);
}

export async function getSynthesis(siteId: string, month: string, publishedOnly = false) {
  let q = supabase.from('rpt_syntheses').select('*').eq('site_id', siteId).eq('month', `${month}-01`);
  if (publishedOnly) q = q.eq('status', 'published');
  const { data } = await q.maybeSingle();
  return data as null | { content: Synthesis; facts: any; status: 'draft' | 'published'; model: string; generated_at: string; published_at: string | null };
}

// Message lisible pour l'interface, selon le type d'erreur du SDK
export function errorMessage(e: unknown) {
  if (e instanceof Anthropic.AuthenticationError) return 'Clé API Anthropic absente ou invalide (ANTHROPIC_API_KEY).';
  if (e instanceof Anthropic.RateLimitError) return 'Trop de requêtes vers Claude, réessayez dans une minute.';
  if (e instanceof Anthropic.APIConnectionError) return 'Impossible de joindre l’API Anthropic.';
  if (e instanceof Anthropic.APIError) return `Erreur de l’API Anthropic (${e.status}) : ${e.message}`;
  return e instanceof Error ? e.message : String(e);
}
