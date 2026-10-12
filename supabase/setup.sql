-- Rak Baca: run once in Supabase → SQL Editor → New query → Run.
-- Creates the tables, the private file bucket, and the rules that keep every account's books to itself.

create table if not exists public.books (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users on delete cascade,
  kind        text not null default 'pdf' check (kind in ('pdf', 'epub')),
  title       text not null,
  author      text,
  file_path   text not null,
  cover_path  text,
  pages       integer,
  size_bytes  bigint,
  added_at    bigint not null,
  added_from  text
);

create table if not exists public.progress (
  user_id     uuid not null default auth.uid() references auth.users on delete cascade,
  book_id     uuid not null references public.books on delete cascade,
  page        integer not null,
  total       integer not null,
  loc         jsonb,
  device      text,
  session     text,
  updated_at  bigint not null,
  primary key (user_id, book_id)
);

alter table public.books enable row level security;
alter table public.progress enable row level security;

drop policy if exists "own books" on public.books;
create policy "own books" on public.books for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "own progress" on public.progress;
create policy "own progress" on public.progress for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Private bucket; files live under <user id>/<book id>/. 50 MB is the free plan's per-file limit.
insert into storage.buckets (id, name, public, file_size_limit)
values ('books', 'books', false, 52428800)
on conflict (id) do update set public = false, file_size_limit = 52428800;

drop policy if exists "own files: read" on storage.objects;
create policy "own files: read" on storage.objects for select
  using (bucket_id = 'books' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "own files: add" on storage.objects;
create policy "own files: add" on storage.objects for insert
  with check (bucket_id = 'books' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "own files: change" on storage.objects;
create policy "own files: change" on storage.objects for update
  using (bucket_id = 'books' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "own files: remove" on storage.objects;
create policy "own files: remove" on storage.objects for delete
  using (bucket_id = 'books' and (storage.foldername(name))[1] = auth.uid()::text);

-- Live updates: a book added on the laptop appears on the phone without reloading.
do $$
begin
  begin alter publication supabase_realtime add table public.books; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.progress; exception when duplicate_object then null; end;
end $$;
