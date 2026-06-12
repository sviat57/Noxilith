-- Noxilith cloud sync schema (applied to the "noxilith" Supabase project)
create table public.notes (
  id text not null,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null default '',
  content text not null default '',
  pinned boolean not null default false,
  created_at bigint not null,
  updated_at bigint not null,
  deleted_at bigint,
  primary key (user_id, id)
);
alter table public.notes enable row level security;
create policy "notes_select_own" on public.notes for select using (auth.uid() = user_id);
create policy "notes_insert_own" on public.notes for insert with check (auth.uid() = user_id);
create policy "notes_update_own" on public.notes for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "notes_delete_own" on public.notes for delete using (auth.uid() = user_id);

create table public.tasks (
  id text not null,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  text text not null default '',
  due text not null,
  done boolean not null default false,
  created_at bigint not null,
  completed_at bigint,
  deleted_at bigint,
  primary key (user_id, id)
);
alter table public.tasks enable row level security;
create policy "tasks_select_own" on public.tasks for select using (auth.uid() = user_id);
create policy "tasks_insert_own" on public.tasks for insert with check (auth.uid() = user_id);
create policy "tasks_update_own" on public.tasks for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "tasks_delete_own" on public.tasks for delete using (auth.uid() = user_id);
