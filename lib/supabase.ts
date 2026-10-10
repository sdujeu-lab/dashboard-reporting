import { createClient } from '@supabase/supabase-js';

// Clé secrète : utilisée côté serveur uniquement, jamais dans le navigateur
export const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!,
  { auth: { persistSession: false } }
);
