
-- Avanti v0.22: pilot bookings, 15-minute grid, backend-enforced conflicts.
alter table public.staff add column if not exists code text;
alter table public.services add column if not exists code text;
create unique index if not exists avanti_staff_code_idx on public.staff(salon_id,code) where code is not null;
create unique index if not exists avanti_service_code_idx on public.services(salon_id,code) where code is not null;

insert into public.staff(salon_id,code,display_name,specialty)
select s.id,x.code,x.name,x.specialty from public.salons s
cross join (values
 ('s0','Daniela','Salonleitung'),('s1','Sofia','Schnitt & Styling'),
 ('s2','Melina','Farbe & Styling'),('s3','Vanessa','Schnitt & Pflege'),
 ('s4','Jennifer','Styling & Beauty')
) x(code,name,specialty) where s.slug='avanti'
on conflict do nothing;

insert into public.services(salon_id,code,name,duration_minutes,price_cents,active)
select s.id,x.code,x.name,x.mins,x.cents,true from public.salons s
cross join (values
 ('cut','Herrenhaarschnitt',30,1900),('dry','Damen-Trockenhaarschnitt',45,3000),
 ('child3','Kinder bis 3 Jahre',30,1000),('child','Kinder bis 16 Jahre',30,1500),
 ('brow','Augenbrauen zupfen',15,600),('lash','Wimpern färben',30,1000)
) x(code,name,mins,cents) where s.slug='avanti'
on conflict do nothing;

insert into public.staff_services(salon_id,staff_id,service_id)
select st.salon_id,st.id,sv.id from public.staff st
join public.services sv on sv.salon_id=st.salon_id
join public.salons s on s.id=st.salon_id
where s.slug='avanti' and st.code in ('s0','s1','s2','s3','s4')
and sv.code in ('cut','dry','child3','child','brow','lash')
on conflict do nothing;

-- demo hours are deliberately provisional, and can be edited before live launch.
insert into public.weekly_shifts(salon_id,staff_id,weekday,start_minute,end_minute)
select st.salon_id,st.id,d.dow,span.a,span.b
from public.staff st join public.salons s on s.id=st.salon_id
cross join generate_series(1,6) d(dow)
cross join (values (540,780),(825,1080)) span(a,b)
where s.slug='avanti' and st.code in ('s0','s2','s3','s4')
and not exists(select 1 from public.weekly_shifts w where w.staff_id=st.id and w.weekday=d.dow)
on conflict do nothing;

insert into public.weekly_shifts(salon_id,staff_id,weekday,start_minute,end_minute)
select st.salon_id,st.id,d.dow,span.a,span.b
from public.staff st join public.salons s on s.id=st.salon_id
cross join generate_series(1,5) d(dow)
cross join (values (570,780),(825,1080)) span(a,b)
where s.slug='avanti' and st.code='s1'
and not exists(select 1 from public.weekly_shifts w where w.staff_id=st.id and w.weekday=d.dow)
on conflict do nothing;

alter table public.calendar_entries add column if not exists note text;
create table if not exists public.avanti_public_booking_limits(
 id bigserial primary key,
 key_digest text not null,
 created_at timestamptz not null default now()
);
create index if not exists avanti_public_booking_limits_lookup on public.avanti_public_booking_limits(key_digest,created_at desc);
alter table public.avanti_public_booking_limits enable row level security;
revoke all on public.avanti_public_booking_limits from public,anon,authenticated;
grant select,insert on public.avanti_public_booking_limits to service_role;

-- Only the trusted server calls these functions with the service role.
-- No user-defined SECURITY DEFINER functions are exposed.
create or replace function public.avanti_create_booking(
 p_staff_code text,p_service_code text,p_day date,p_start_minute int,
 p_customer_name text,p_customer_email text,p_customer_phone text,
 p_source text default 'online',p_duration_minutes int default null,
 p_rate_digest text default null
) returns uuid
language plpgsql security invoker set search_path=public,pg_temp
as $$
declare
 v_salon uuid;v_staff uuid;v_service uuid;v_name text;v_price int;
 v_duration int;v_start timestamptz;v_end timestamptz;v_id uuid;
begin
 if p_source not in ('online','manual') or p_day is null
 or p_start_minute is null or p_start_minute < 0 or p_start_minute > 1439
 or p_start_minute % 15 <> 0 then raise exception 'invalid_booking' using errcode='22023';end if;
 if p_day < (now() at time zone 'Europe/Berlin')::date
 or p_day > ((now() at time zone 'Europe/Berlin')::date + 90)
 then raise exception 'invalid_day' using errcode='22023';end if;
 if char_length(trim(coalesce(p_customer_name,''))) < 2
 or char_length(trim(coalesce(p_customer_name,''))) > 100
 then raise exception 'invalid_customer_name' using errcode='22023';end if;
 if p_customer_email is not null and (char_length(p_customer_email)>254 or p_customer_email !~* '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$')
 then raise exception 'invalid_customer_email' using errcode='22023';end if;
 if char_length(coalesce(p_customer_phone,''))>40 then raise exception 'invalid_customer_phone' using errcode='22023';end if;
 if p_source='online' and p_customer_email is null then raise exception 'email_required' using errcode='22023';end if;
 select id into v_salon from public.salons where slug='avanti';
 select id into v_staff from public.staff where salon_id=v_salon and code=p_staff_code and active for update;
 if v_staff is null then raise exception 'staff_unavailable' using errcode='22023';end if;
 if p_service_code is not null then
   select id,name,price_cents,duration_minutes into v_service,v_name,v_price,v_duration
   from public.services where salon_id=v_salon and code=p_service_code and active;
   if v_service is null or not exists (select 1 from public.staff_services ss where ss.salon_id=v_salon and ss.staff_id=v_staff and ss.service_id=v_service)
   then raise exception 'service_unavailable' using errcode='22023';end if;
 elsif p_source='manual' then
   -- A manual booking without a treatment is mapped to the technical default service.
   select id,name,price_cents,duration_minutes into v_service,v_name,v_price,v_duration
   from public.services where salon_id=v_salon and code='manual';
 else raise exception 'service_required' using errcode='22023';end if;
 if v_service is null then raise exception 'service_unavailable' using errcode='22023';end if;
 if p_source='manual' and p_duration_minutes is not null then v_duration:=p_duration_minutes;end if;
 if v_duration < 15 or v_duration > 480 or v_duration % 15<>0
 or p_start_minute+v_duration>1440
 then raise exception 'invalid_duration' using errcode='22023';end if;
 if not exists(select 1 from public.weekly_shifts w where w.salon_id=v_salon and w.staff_id=v_staff
    and w.weekday=extract(dow from p_day)::integer and w.start_minute<=p_start_minute
    and w.end_minute>=p_start_minute+v_duration)
 then raise exception 'outside_working_hours' using errcode='22023';end if;
 v_start:= (p_day::timestamp + make_interval(mins=>p_start_minute)) at time zone 'Europe/Berlin';
 v_end:= (p_day::timestamp + make_interval(mins=>p_start_minute+v_duration)) at time zone 'Europe/Berlin';
 if v_start<=now() then raise exception 'time_in_past' using errcode='22023';end if;
 if p_source='online' then
   if p_rate_digest is null or length(p_rate_digest)<>64 then raise exception 'rate_key_required' using errcode='22023';end if;
   perform pg_advisory_xact_lock(hashtext(p_rate_digest));
   if (select count(*) from public.avanti_public_booking_limits where key_digest=p_rate_digest and created_at>now()-interval '1 hour')>=3
   then raise exception 'rate_limited' using errcode='22023';end if;
 end if;
 insert into public.calendar_entries(salon_id,staff_id,service_id,kind,status,starts_at,ends_at,
  customer_name,customer_email,customer_phone,service_name_snapshot,price_cents_snapshot,source)
 values(v_salon,v_staff,v_service,'appointment','confirmed',v_start,v_end,
 trim(p_customer_name),nullif(trim(coalesce(p_customer_email,'')),''),nullif(trim(coalesce(p_customer_phone,'')),''),
 v_name,v_price,p_source) returning id into v_id;
 if p_source='online' then insert into public.avanti_public_booking_limits(key_digest) values(p_rate_digest);end if;
 return v_id;
end $$;

create or replace function public.avanti_create_block(p_staff_code text,p_day date,p_start_minute int,p_end_minute int,p_note text default '')
returns uuid language plpgsql security invoker set search_path=public,pg_temp
as $$
declare v_salon uuid;v_staff uuid;v_id uuid;v_start timestamptz;v_end timestamptz;
begin
 if p_day is null or p_day < (now() at time zone 'Europe/Berlin')::date or p_day > (now() at time zone 'Europe/Berlin')::date+365
 or p_start_minute<0 or p_end_minute>1440 or p_end_minute<=p_start_minute
 or p_start_minute%15<>0 or p_end_minute%15<>0 then raise exception 'invalid_block' using errcode='22023';end if;
 select id into v_salon from public.salons where slug='avanti';
 select id into v_staff from public.staff where salon_id=v_salon and code=p_staff_code and active for update;
 if v_staff is null then raise exception 'staff_unavailable' using errcode='22023';end if;
 v_start:=(p_day::timestamp+make_interval(mins=>p_start_minute)) at time zone 'Europe/Berlin';
 v_end:=(p_day::timestamp+make_interval(mins=>p_end_minute)) at time zone 'Europe/Berlin';
 insert into public.calendar_entries(salon_id,staff_id,kind,status,starts_at,ends_at,source,note)
 values(v_salon,v_staff,'absence','confirmed',v_start,v_end,'system',left(coalesce(p_note,''),100))
 returning id into v_id;
 return v_id;
end $$;

revoke all on function public.avanti_create_booking(text,text,date,int,text,text,text,text,int,text) from public,anon,authenticated;
revoke all on function public.avanti_create_block(text,date,int,int,text) from public,anon,authenticated;
grant execute on function public.avanti_create_booking(text,text,date,int,text,text,text,text,int,text) to service_role;
grant execute on function public.avanti_create_block(text,date,int,int,text) to service_role;

-- The required manual entry service is never shown in public booking.
insert into public.services(salon_id,code,name,duration_minutes,price_cents,active)
select id,'manual','Telefontermin',30,0,false from public.salons where slug='avanti'
on conflict do nothing;
