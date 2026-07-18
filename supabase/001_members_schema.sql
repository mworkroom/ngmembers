-- Phase 1: members schema
-- Supabase SQL Editor에서 새 project 또는 검증된 공용 project에 실행합니다.

create extension if not exists pgcrypto;

create table if not exists public.members (
  id uuid primary key default gen_random_uuid(),
  member_number text null,
  name text null,
  nickname text null,
  is_anchor_member boolean not null default false,
  is_favorite boolean not null default false,
  sponsor_name_raw text null,
  affiliation_id uuid null,
  side text null,
  direct_parent_id uuid null,
  direct_parent_side text null,
  birth_date date null,
  phone text null,
  country_code text null,
  cpf text null,
  notes text null,
  member_status text not null default 'active',
  is_hidden boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint members_member_number_not_blank
    check (member_number is null or btrim(member_number) <> ''),
  constraint members_member_number_trimmed
    check (member_number is null or member_number = btrim(member_number)),
  constraint members_side_allowed
    check (side is null or side in ('left', 'right')),
  constraint members_direct_parent_side_allowed
    check (direct_parent_side is null or direct_parent_side in ('left', 'right')),
  constraint members_country_code_format
    check (country_code is null or country_code ~ '^[A-Z]{2}$'),
  constraint members_status_allowed
    check (member_status in ('active', 'withdrawn', 'review')),
  constraint members_affiliation_not_self
    check (affiliation_id is null or affiliation_id <> id),
  constraint members_direct_parent_not_self
    check (direct_parent_id is null or direct_parent_id <> id),
  constraint members_affiliation_fk
    foreign key (affiliation_id) references public.members(id) on delete restrict,
  constraint members_direct_parent_fk
    foreign key (direct_parent_id) references public.members(id) on delete restrict
);

create unique index if not exists members_member_number_unique
  on public.members (member_number)
  where member_number is not null;

create index if not exists members_affiliation_id_index
  on public.members (affiliation_id);

create index if not exists members_direct_parent_id_index
  on public.members (direct_parent_id);

create or replace function public.set_members_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists members_set_updated_at on public.members;
create trigger members_set_updated_at
before update on public.members
for each row execute function public.set_members_updated_at();

comment on table public.members is
  'ngmembers 회원 데이터. Phase 1에서는 실제 회원 CSV를 입력하지 않는다.';
