
create table public.avanti_holiday_overrides(
 salon_id uuid not null references public.salons(id), day date not null, primary key(salon_id,day)
);
create table public.avanti_salon_closures(
 id uuid primary key default gen_random_uuid(), salon_id uuid not null references public.salons(id),
 first_day date not null,last_day date not null,name text not null check(length(name) between 1 and 100),
 check(last_day>=first_day)
);
alter table public.avanti_holiday_overrides enable row level security;
alter table public.avanti_salon_closures enable row level security;
revoke all on public.avanti_holiday_overrides,public.avanti_salon_closures from public,anon,authenticated;
grant select,insert,delete on public.avanti_holiday_overrides,public.avanti_salon_closures to service_role;

create function public.avanti_bw_holidays(y integer)
returns table(day date,name text) language plpgsql immutable security invoker set search_path=public,pg_temp as $$
declare a int; b int; c int; d int; e int; f int; g int; h int; i int; k int; l int; m int; n int; easter date;
begin
 a:=y%19;b:=y/100;c:=y%100;d:=b/4;e:=b%4;f:=(b+8)/25;g:=(b-f+1)/3;
 h:=(19*a+b-d-g+15)%30;i:=c/4;k:=c%4;l:=(32+2*e+2*i-h-k)%7;m:=(a+11*h+22*l)/451;n:=h+l-7*m+114;
 easter:=make_date(y,n/31,n%31+1);
 return query select v.dt,v.nm from (values
 (make_date(y,1,1),'Neujahr'),(make_date(y,1,6),'Heilige Drei Könige'),
 (easter-2,'Karfreitag'),(easter+1,'Ostermontag'),(make_date(y,5,1),'Tag der Arbeit'),
 (easter+39,'Christi Himmelfahrt'),(easter+50,'Pfingstmontag'),(easter+60,'Fronleichnam'),
 (make_date(y,10,3),'Tag der Deutschen Einheit'),(make_date(y,11,1),'Allerheiligen'),
 (make_date(y,12,25),'1. Weihnachtsfeiertag'),(make_date(y,12,26),'2. Weihnachtsfeiertag')) v(dt,nm) order by v.dt;
end $$;
create function public.avanti_day_closure(p_salon uuid,p_day date)
returns jsonb language plpgsql stable security invoker set search_path=public,pg_temp as $$
declare nm text; holiday text; opened boolean;
begin
 select h.name into holiday from public.avanti_bw_holidays(extract(year from p_day)::int) h where h.day=p_day;
 select exists(select 1 from public.avanti_holiday_overrides o where o.salon_id=p_salon and o.day=p_day) into opened;
 select c.name into nm from public.avanti_salon_closures c where c.salon_id=p_salon and p_day between c.first_day and c.last_day order by c.first_day,c.id limit 1;
 if nm is not null then return jsonb_build_object('closed',true,'name',nm,'kind','custom','holiday',holiday,'holidayOpen',opened);end if;
 return jsonb_build_object('closed',holiday is not null and not opened,'name',case when not opened then holiday end,'kind',case when holiday is not null and not opened then 'holiday' end,'holiday',holiday,'holidayOpen',opened);
end $$;
create function public.avanti_closure_settings(p_salon uuid)
returns jsonb language sql stable security invoker set search_path=public,pg_temp as $$
 with bounds as (select (now() at time zone 'Europe/Berlin')::date as t),
 holidays as (select h.day,h.name,exists(select 1 from public.avanti_holiday_overrides o where o.salon_id=p_salon and o.day=h.day) as open from bounds b cross join lateral generate_series(extract(year from b.t)::int,extract(year from b.t+365)::int) y cross join lateral public.avanti_bw_holidays(y) h where h.day between b.t and b.t+365)
 select jsonb_build_object('holidays',coalesce((select jsonb_agg(to_jsonb(h) order by h.day) from holidays h),'[]'::jsonb),'closures',coalesce((select jsonb_agg(to_jsonb(c) order by c.first_day) from public.avanti_salon_closures c,bounds b where c.salon_id=p_salon and c.last_day>=b.t),'[]'::jsonb));
$$;
create function public.avanti_manage_closures(p_salon uuid,p_action text,p_data jsonb)
returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare a date;b date;nm text;cid uuid;today date:=(now() at time zone 'Europe/Berlin')::date;opening boolean;
begin
 if not exists(select 1 from public.salons where id=p_salon and slug='avanti') then raise exception 'forbidden'; end if;
 perform id from public.salons where id=p_salon for update;
 perform id from public.staff where salon_id=p_salon order by id for update;
 if p_action='closure-remove' then
  delete from public.avanti_salon_closures where salon_id=p_salon and id=(p_data->>'id')::uuid returning id into cid;
  if cid is null then raise exception 'entry_missing';end if;
 elsif p_action in ('closure-add','holiday-toggle') then
  a:=(p_data->>'day')::date;b:=case when p_action='holiday-toggle' then a else (p_data->>'until')::date end;
  if a is null or b is null or a<today or b<a or b>today+365 then raise exception 'invalid_day';end if;
  opening:=p_action='holiday-toggle' and coalesce((p_data->>'open')::boolean,false);
  if p_action='holiday-toggle' and not exists(select 1 from public.avanti_bw_holidays(extract(year from a)::int) h where h.day=a) then raise exception 'invalid_day';end if;
  if not opening and exists(select 1 from public.calendar_entries e where e.salon_id=p_salon and e.kind='appointment' and e.status='confirmed' and e.ends_at>now() and e.starts_at<((b+1)::timestamp at time zone 'Europe/Berlin') and e.ends_at>(a::timestamp at time zone 'Europe/Berlin')) then raise exception 'existing_appointments';end if;
  if p_action='holiday-toggle' then
   if opening then insert into public.avanti_holiday_overrides(salon_id,day) values(p_salon,a) on conflict do nothing;
   else delete from public.avanti_holiday_overrides where salon_id=p_salon and day=a;end if;
  else
   nm:=left(coalesce(nullif(trim(p_data->>'name'),''),'Betriebsurlaub'),100);
   if exists(select 1 from public.avanti_salon_closures c where c.salon_id=p_salon and c.first_day<=b and c.last_day>=a) then raise exception 'closure_overlap';end if;
   insert into public.avanti_salon_closures(salon_id,first_day,last_day,name) values(p_salon,a,b,nm);
  end if;
 else raise exception 'unknown_action';end if;
 return jsonb_build_object('confirmed',true);
end $$;
-- Enforce closure rules even if a client bypasses the availability UI.
create function public.avanti_guard_closed_days()
returns trigger language plpgsql security invoker set search_path=public,pg_temp as $$
declare a date;b date;d date;
begin
 if new.kind<>'appointment' or new.status<>'confirmed' then return new;end if;
 if tg_op='UPDATE' then
  if old.status='confirmed' and old.starts_at=new.starts_at and old.ends_at=new.ends_at and old.staff_id=new.staff_id and old.salon_id=new.salon_id then return new;end if;
 end if;
 perform id from public.staff where id=new.staff_id and salon_id=new.salon_id for update;
 a:=(new.starts_at at time zone 'Europe/Berlin')::date;
 b:=((new.ends_at-interval '1 microsecond') at time zone 'Europe/Berlin')::date;
 for d in select a+x from generate_series(0,b-a) x loop
  if coalesce((public.avanti_day_closure(new.salon_id,d)->>'closed')::boolean,false) then raise exception 'salon_closed' using errcode='22023';end if;
 end loop;
 return new;
end $$;
create trigger avanti_guard_closed_days before insert or update of starts_at,ends_at,staff_id,salon_id,status on public.calendar_entries for each row execute function public.avanti_guard_closed_days();
revoke all on function public.avanti_bw_holidays(integer),public.avanti_day_closure(uuid,date),public.avanti_closure_settings(uuid),public.avanti_manage_closures(uuid,text,jsonb),public.avanti_guard_closed_days() from public,anon,authenticated;
grant execute on function public.avanti_bw_holidays(integer),public.avanti_day_closure(uuid,date),public.avanti_closure_settings(uuid),public.avanti_manage_closures(uuid,text,jsonb),public.avanti_guard_closed_days() to service_role;
