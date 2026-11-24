-- نفّذ هذا الملف في Supabase > SQL Editor.
create extension if not exists pgcrypto;

create table if not exists public.applications (
  id uuid primary key default gen_random_uuid(),
  full_name text not null check (char_length(full_name) between 2 and 120),
  date_of_birth date not null,
  email text not null check (char_length(email) <= 160),
  phone text not null,
  self_introduction text not null check (char_length(self_introduction) between 30 and 1200),
  governorate text not null,
  school text not null,
  school_year text not null check (school_year in ('الأول الثانوي','الثاني الثانوي','الثالث الثانوي')),
  motivation text not null check (char_length(motivation) between 30 and 1500),
  interests text not null check (char_length(interests) between 10 and 1000),
  initiative_example text,
  weekly_availability text not null,
  status text not null default 'pending' check (status in ('pending','interview','accepted','waitlist','rejected')),
  score_total integer check (score_total between 0 and 100),
  score_motivation integer check (score_motivation between 0 and 25),
  score_thinking integer check (score_thinking between 0 and 20),
  score_curiosity integer check (score_curiosity between 0 and 20),
  score_initiative integer check (score_initiative between 0 and 15),
  score_commitment integer check (score_commitment between 0 and 10),
  score_values integer check (score_values between 0 and 10),
  reviewer_notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.applications enable row level security;
alter table public.admins enable row level security;

drop policy if exists "Anyone can submit an application" on public.applications;
create policy "Anyone can submit an application"
on public.applications for insert to anon, authenticated
with check (status = 'pending');

drop policy if exists "Admins can read applications" on public.applications;
create policy "Admins can read applications"
on public.applications for select to authenticated
using (exists (select 1 from public.admins a where a.user_id = auth.uid()));

drop policy if exists "Admins can update applications" on public.applications;
create policy "Admins can update applications"
on public.applications for update to authenticated
using (exists (select 1 from public.admins a where a.user_id = auth.uid()))
with check (exists (select 1 from public.admins a where a.user_id = auth.uid()));

-- بعد إنشاء حساب المسؤول من Authentication > Users، أضف UUID الخاص به:
-- insert into public.admins(user_id) values ('PASTE-AUTH-USER-UUID-HERE');
