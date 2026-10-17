-- Synthèse mensuelle rédigée par Claude puis relue par l'agence.
-- À exécuter une fois dans l'éditeur SQL de Supabase.
create table if not exists rpt_syntheses (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references rpt_sites(id) on delete cascade,
  month date not null,
  content jsonb not null,
  facts jsonb not null,
  status text not null default 'draft' check (status in ('draft', 'published')),
  model text,
  generated_at timestamptz not null default now(),
  published_at timestamptz,
  unique (site_id, month)
);

-- L'app passe par la clé service, qui ignore RLS : aucune policy n'est nécessaire.
alter table rpt_syntheses enable row level security;
