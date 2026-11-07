-- CloudClip schema for Supabase.
-- Run once: Supabase Dashboard -> SQL Editor -> New query -> paste this file -> Run.
-- Safe to re-run.

-- ---------------------------------------------------------------- tables

create table if not exists public.rooms (
  name          text primary key check (name ~ '^[A-Za-z0-9_~-]{3,64}$'),
  password_hash text,                                  -- null = unlocked
  created_at    timestamptz not null default now()
);

-- Current text of each room (one row per room).
create table if not exists public.clips (
  room       text primary key references public.rooms(name) on delete cascade,
  body       text not null default '' check (char_length(body) <= 10000),
  one_time   boolean not null default false,
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days'
);

-- Previous versions of a room's text (last 5 kept).
create table if not exists public.clip_versions (
  id         bigint generated always as identity primary key,
  room       text not null references public.rooms(name) on delete cascade,
  body       text not null,
  created_at timestamptz not null default now()
);
create index if not exists clip_versions_room_idx on public.clip_versions (room, created_at desc);

create table if not exists public.files (
  id          uuid primary key default gen_random_uuid(),
  room        text not null references public.rooms(name) on delete cascade,
  path        text not null unique,                    -- object path inside the "clips" bucket
  name        text not null,
  size        bigint not null check (size > 0 and size <= 10485760),
  mime        text not null default 'application/octet-stream',
  one_time    boolean not null default false,
  uploaded    boolean not null default false,          -- true once the browser finished the upload
  consumed_at timestamptz,                             -- set when a one-time file is downloaded
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null default now() + interval '5 days'
);
create index if not exists files_room_idx on public.files (room, created_at desc);

-- ---------------------------------------------------------------- security
-- RLS on with NO policies: the public (anon/publishable) key can read or write nothing.
-- Only the server (secret / service_role key, used in Next.js API routes) can touch these tables.

alter table public.rooms         enable row level security;
alter table public.clips         enable row level security;
alter table public.clip_versions enable row level security;
alter table public.files         enable row level security;

-- ---------------------------------------------------------------- storage
-- Private bucket, 10 MB per-file limit enforced by Supabase itself.

insert into storage.buckets (id, name, public, file_size_limit)
values ('clips', 'clips', false, 10485760)
on conflict (id) do update set public = false, file_size_limit = 10485760;

-- ---------------------------------------------------------------- functions

-- Atomically read-and-delete a one-time text. Only one caller can ever get it.
create or replace function public.reveal_one_time_text(p_room text)
returns text
language sql
security definer
set search_path = public
as $$
  delete from public.clips
  where room = p_room and one_time and expires_at > now()
  returning body;
$$;

-- Atomically claim a one-time file. Returns its path/name to exactly one caller.
create or replace function public.claim_one_time_file(p_room text, p_id uuid)
returns table (path text, name text)
language sql
security definer
set search_path = public
as $$
  update public.files
  set consumed_at = now()
  where id = p_id and room = p_room and one_time and uploaded
    and consumed_at is null and expires_at > now()
  returning files.path, files.name;
$$;

-- Save text: archives the previous (non one-time) text into clip_versions, keeps the last 5.
create or replace function public.save_text(p_room text, p_body text, p_one_time boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  prev record;
begin
  insert into public.rooms (name) values (p_room) on conflict do nothing;

  select body, one_time into prev
  from public.clips
  where room = p_room and expires_at > now()
  for update;

  if found and not prev.one_time and prev.body <> '' and prev.body is distinct from p_body then
    insert into public.clip_versions (room, body) values (p_room, prev.body);
    delete from public.clip_versions
    where room = p_room and id not in (
      select id from public.clip_versions where room = p_room order by created_at desc limit 5
    );
  end if;

  insert into public.clips (room, body, one_time, updated_at, expires_at)
  values (p_room, p_body, p_one_time, now(), now() + interval '7 days')
  on conflict (room) do update
    set body = excluded.body, one_time = excluded.one_time,
        updated_at = excluded.updated_at, expires_at = excluded.expires_at;
end;
$$;

-- Daily cleanup of database rows (storage objects are removed by /api/cron/cleanup first).
create or replace function public.cleanup_expired_rows()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.clips         where expires_at < now();
  delete from public.clip_versions where created_at < now() - interval '7 days';
  delete from public.rooms r
  where r.created_at < now() - interval '7 days'
    and not exists (select 1 from public.clips c where c.room = r.name)
    and not exists (select 1 from public.files f where f.room = r.name);
$$;

-- These functions are for the server only.
revoke execute on function public.reveal_one_time_text(text)               from public, anon, authenticated;
revoke execute on function public.claim_one_time_file(text, uuid)          from public, anon, authenticated;
revoke execute on function public.save_text(text, text, boolean)          from public, anon, authenticated;
revoke execute on function public.cleanup_expired_rows()                  from public, anon, authenticated;
grant  execute on function public.reveal_one_time_text(text)               to service_role;
grant  execute on function public.claim_one_time_file(text, uuid)          to service_role;
grant  execute on function public.save_text(text, text, boolean)          to service_role;
grant  execute on function public.cleanup_expired_rows()                  to service_role;
