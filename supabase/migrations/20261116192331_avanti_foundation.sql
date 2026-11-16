-- Avanti foundation. No public booking API or direct client writes yet.
create extension if not exists btree_gist with schema extensions;
set local search_path = public, extensions, pg_catalog;

create table public.salons (
 id uuid primary key default gen_random_uuid(),
 slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
 name text not null check (char_length(name) between 1 and 120),
 timezone text not null default 'Europe/Berlin' check (timezone='Europe/Berlin'),
 created_at timestamptz not null default now()
);
create table public.salon_members (
 salon_id uuid not null references public.salons(id),
 user_id uuid not null references auth.users(id) on delete cascade,
 role text not null check (role in ('owner','manager','staff')),
 active boolean not null default true,
 primary key(salon_id,user_id)
);
create index salon_members_user_idx on public.salon_members(user_id,salon_id) where active;
create table public.staff (
 id uuid primary key default gen_random_uuid(),
 salon_id uuid not null references public.salons(id),
 display_name text not null check (char_length(display_name) between 1 and 80),
 specialty text not null default '',
 photo_path text,
 active boolean not null default true,
 unique(salon_id,id)
);
create table public.services (
 id uuid primary key default gen_random_uuid(),
 salon_id uuid not null references public.salons(id),
 name text not null check (char_length(name) between 1 and 120),
 duration_minutes integer not null check (duration_minutes between 5 and 480),
 price_cents integer not null check (price_cents between 0 and 1000000),
 active boolean not null default true,
 unique(salon_id,id)
);
create table public.staff_services (
 salon_id uuid not null,
 staff_id uuid not null,
 service_id uuid not null,
 primary key(salon_id,staff_id,service_id),
 foreign key(salon_id,staff_id) references public.staff(salon_id,id),
 foreign key(salon_id,service_id) references public.services(salon_id,id)
);
-- A pause splits a day into two shift rows.
create table public.weekly_shifts (
 id uuid primary key default gen_random_uuid(),
 salon_id uuid not null,
 staff_id uuid not null,
 weekday smallint not null check (weekday between 0 and 6),
 start_minute integer not null check (start_minute between 0 and 1439),
 end_minute integer not null check (end_minute between 1 and 1440 and end_minute>start_minute),
 foreign key(salon_id,staff_id) references public.staff(salon_id,id),
 exclude using gist (salon_id with =, staff_id with =, weekday with =, int4range(start_minute,end_minute,'[)') with &&)
);
-- One calendar for bookings and absences: simultaneous conflicting writes fail
-- even when they originate from different devices or API requests.
create table public.calendar_entries (
 id uuid primary key default gen_random_uuid(),
 salon_id uuid not null,
 staff_id uuid not null,
 service_id uuid,
 kind text not null check (kind in ('appointment','absence')),
 status text not null default 'confirmed' check (status in ('confirmed','cancelled')),
 starts_at timestamptz not null,
 ends_at timestamptz not null check (ends_at>starts_at),
 customer_name text check (char_length(customer_name) between 1 and 100),
 customer_email text check (char_length(customer_email)<=254),
 customer_phone text check (char_length(customer_phone)<=40),
 service_name_snapshot text,
 price_cents_snapshot integer check (price_cents_snapshot>=0),
 source text not null check (source in ('online','manual','system')),
 created_at timestamptz not null default now(),
 foreign key(salon_id,staff_id) references public.staff(salon_id,id),
 foreign key(salon_id,service_id) references public.services(salon_id,id),
 check ((kind='appointment' and service_id is not null and customer_name is not null and service_name_snapshot is not null and price_cents_snapshot is not null and source in ('online','manual')) or
        (kind='absence' and service_id is null and customer_name is null and customer_email is null and customer_phone is null and service_name_snapshot is null and price_cents_snapshot is null and source='system')),
 exclude using gist(salon_id with =,staff_id with =,tstzrange(starts_at,ends_at,'[)') with &&) where (status='confirmed')
);
create index calendar_entries_salon_time_idx on public.calendar_entries(salon_id,starts_at);
create index calendar_entries_service_idx on public.calendar_entries(salon_id,service_id);
create index staff_services_service_idx on public.staff_services(salon_id,service_id);
alter table public.salons enable row level security;
alter table public.salon_members enable row level security;
alter table public.staff enable row level security;
alter table public.services enable row level security;
alter table public.staff_services enable row level security;
alter table public.weekly_shifts enable row level security;
alter table public.calendar_entries enable row level security;
revoke all on public.salons, public.salon_members, public.staff, public.services, public.staff_services, public.weekly_shifts, public.calendar_entries from public, anon, authenticated;
grant select on public.salons, public.salon_members, public.staff, public.services, public.staff_services, public.weekly_shifts, public.calendar_entries to authenticated;
grant select,insert,update,delete on public.salons, public.salon_members, public.staff, public.services, public.staff_services, public.weekly_shifts, public.calendar_entries to service_role;
create policy own_active_membership on public.salon_members for select to authenticated using (user_id=(select auth.uid()) and active);
create policy member_read_salon on public.salons for select to authenticated using (id in (select salon_id from public.salon_members where user_id=(select auth.uid()) and active));
create policy member_read_staff on public.staff for select to authenticated using (salon_id in (select salon_id from public.salon_members where user_id=(select auth.uid()) and active));
create policy member_read_services on public.services for select to authenticated using (salon_id in (select salon_id from public.salon_members where user_id=(select auth.uid()) and active));
create policy member_read_staff_services on public.staff_services for select to authenticated using (salon_id in (select salon_id from public.salon_members where user_id=(select auth.uid()) and active));
create policy member_read_weekly_shifts on public.weekly_shifts for select to authenticated using (salon_id in (select salon_id from public.salon_members where user_id=(select auth.uid()) and active));
create policy member_read_calendar_entries on public.calendar_entries for select to authenticated using (salon_id in (select salon_id from public.salon_members where user_id=(select auth.uid()) and active));
insert into public.salons(slug,name) values ('avanti','Haarstudio Avanti');
