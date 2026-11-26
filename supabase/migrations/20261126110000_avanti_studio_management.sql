
create or replace function public.avanti_manage_studio(p_salon uuid,p_action text,p_data jsonb)
returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare
 st uuid; old_entry public.calendar_entries%rowtype; d date; until_d date; a int; b int; dur int; start_at timestamptz; end_at timestamptz; nm text; ph text; note_text text; shifts jsonb; shift jsonb; cnt int; target text; today date:=(now() at time zone 'Europe/Berlin')::date;
begin
 if not exists(select 1 from public.salons where id=p_salon and slug='avanti') then raise exception 'forbidden'; end if;
 -- Same staff-row locks as booking creation; deterministic order also serializes team closures.
 perform id from public.staff where salon_id=p_salon and active order by id for update;
 target:=p_data->>'staffCode';
 if target is not null and target<>'all' then select id into st from public.staff where salon_id=p_salon and code=target and active; if st is null then raise exception 'staff_unavailable'; end if; end if;
 if p_action='edit-profile' then
   nm:=trim(coalesce(p_data->>'name',''));
   if st is null or length(nm) not between 1 and 80 or length(coalesce(p_data->>'specialty',''))>100 then raise exception 'invalid_profile'; end if;
   update public.staff set display_name=nm,specialty=trim(coalesce(p_data->>'specialty','')) where id=st and salon_id=p_salon;
 elsif p_action='edit-shifts' then
   shifts:=p_data->'shifts';
   if st is null or jsonb_typeof(shifts) is distinct from 'array' or jsonb_array_length(shifts)>21 then raise exception 'invalid_shifts'; end if;
   for shift in select value from jsonb_array_elements(shifts) loop
     a:=(shift->>'start_minute')::int; b:=(shift->>'end_minute')::int;
     if a is null or b is null or a<0 or b>1440 or a>=b or a%15<>0 or b%15<>0 or (shift->>'weekday')::int is null or (shift->>'weekday')::int not between 0 and 6 then raise exception 'invalid_shifts'; end if;
   end loop;
   if exists(select 1 from public.calendar_entries e where e.salon_id=p_salon and e.staff_id=st and e.kind='appointment' and e.status='confirmed' and e.ends_at>now()
     and not exists(select 1 from jsonb_array_elements(shifts) s where (s->>'weekday')::int=extract(dow from e.starts_at at time zone 'Europe/Berlin')::int
       and (s->>'start_minute')::int<=extract(hour from e.starts_at at time zone 'Europe/Berlin')::int*60+extract(minute from e.starts_at at time zone 'Europe/Berlin')::int
       and (s->>'end_minute')::int>=extract(hour from e.ends_at at time zone 'Europe/Berlin')::int*60+extract(minute from e.ends_at at time zone 'Europe/Berlin')::int+case when (e.ends_at at time zone 'Europe/Berlin')::date>(e.starts_at at time zone 'Europe/Berlin')::date then 1440 else 0 end)) then raise exception 'existing_appointments'; end if;
   delete from public.weekly_shifts where salon_id=p_salon and staff_id=st;
   insert into public.weekly_shifts(salon_id,staff_id,weekday,start_minute,end_minute)
   select p_salon,st,(s->>'weekday')::smallint,(s->>'start_minute')::int,(s->>'end_minute')::int from jsonb_array_elements(shifts) s;
 elsif p_action='absence-range' then
   d:=(p_data->>'day')::date; until_d:=(p_data->>'until')::date;
   if d is null or until_d is null or d<today or until_d<d or until_d>today+365 or until_d-d>60 or (st is null and target is distinct from 'all') then raise exception 'invalid_day'; end if;
   note_text:=left(coalesce(nullif(trim(p_data->>'note'),''),'Abwesend'),100);
   start_at:=d::timestamp at time zone 'Europe/Berlin'; end_at:=(until_d+1)::timestamp at time zone 'Europe/Berlin';
   -- Reject any overlap rather than silently cancelling appointments or overwriting blocks.
   insert into public.calendar_entries(salon_id,staff_id,kind,status,starts_at,ends_at,source,note)
   select p_salon,id,'absence','confirmed',start_at,end_at,'system',note_text from public.staff where salon_id=p_salon and active and (target='all' or id=st);
   get diagnostics cnt=row_count; if cnt=0 then raise exception 'staff_unavailable'; end if;
 elsif p_action='edit-entry' then
   select * into old_entry from public.calendar_entries where id=(p_data->>'id')::uuid and salon_id=p_salon and status='confirmed' and kind='appointment' for update;
   if not found then raise exception 'entry_missing'; end if;
   nm:=trim(coalesce(p_data->>'name','')); ph:=nullif(trim(coalesce(p_data->>'phone','')),'');
   if length(nm) not between 1 and 100 or length(coalesce(ph,''))>40 then raise exception 'invalid_customer_name'; end if;
   if p_data->>'day' is not null then
     d:=(p_data->>'day')::date; a:=(p_data->>'start')::int; dur:=(p_data->>'duration')::int;
     if st is null or d is null or d<today or d>today+365 or a is null or dur is null or a<0 or a%15<>0 or dur not between 15 and 480 or dur%15<>0 or a+dur>1440 then raise exception 'invalid_booking'; end if;
     start_at:=(d::timestamp+make_interval(mins=>a)) at time zone 'Europe/Berlin'; end_at:=(d::timestamp+make_interval(mins=>a+dur)) at time zone 'Europe/Berlin';
     if (st,start_at,end_at) is distinct from (old_entry.staff_id,old_entry.starts_at,old_entry.ends_at) then
       if start_at<=now() then raise exception 'time_in_past'; end if;
       if not exists(select 1 from public.weekly_shifts where salon_id=p_salon and staff_id=st and weekday=extract(dow from d)::int and start_minute<=a and end_minute>=a+dur) then raise exception 'outside_working_hours'; end if;
       if not exists(select 1 from public.services v where v.id=old_entry.service_id and v.salon_id=p_salon and (v.code='manual' or exists(select 1 from public.staff_services ss where ss.salon_id=p_salon and ss.staff_id=st and ss.service_id=v.id))) then raise exception 'service_unavailable'; end if;
     end if;
     update public.calendar_entries set staff_id=st,starts_at=start_at,ends_at=end_at,customer_name=nm,customer_phone=ph where id=old_entry.id;
   else
     update public.calendar_entries set customer_name=nm,customer_phone=ph where id=old_entry.id;
   end if;
 else raise exception 'unknown_action'; end if;
 return jsonb_build_object('confirmed',true);
end $$;
revoke all on function public.avanti_manage_studio(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.avanti_manage_studio(uuid,text,jsonb) to service_role;
