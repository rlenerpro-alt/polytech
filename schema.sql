-- À exécuter une fois dans Supabase : SQL Editor → New query → coller → Run.
-- Une ligne par élève, contenant ses devoirs, notes, groupes et plan de révision (JSON).
create table if not exists public.user_state (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  app        jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.user_state enable row level security;

-- Chaque élève ne voit et ne modifie que sa propre ligne.
drop policy if exists "lecture perso" on public.user_state;
drop policy if exists "creation perso" on public.user_state;
drop policy if exists "modif perso" on public.user_state;
drop policy if exists "suppression perso" on public.user_state;
create policy "lecture perso"     on public.user_state for select using (auth.uid() = user_id);
create policy "creation perso"    on public.user_state for insert with check (auth.uid() = user_id);
create policy "modif perso"       on public.user_state for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "suppression perso" on public.user_state for delete using (auth.uid() = user_id);
