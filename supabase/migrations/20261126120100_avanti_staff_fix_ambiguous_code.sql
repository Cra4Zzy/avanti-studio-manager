create or replace function public.avanti_manage_staff(p_salon uuid,p_action text,p_data jsonb)
returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare st uuid; nm text; spec text; portrait text; new_code text; was_active boolean;
begin
 if not exists(select 1 from public.salons where id=p_salon and slug='avanti') then raise exception 'forbidden'; end if;
 -- Serialize changes with bookings and other team mutations.
 perform id from public.salons where id=p_salon for update;
 perform id from public.staff where salon_id=p_salon order by id for update;
 if p_action in ('staff-save','staff-create') then
   nm:=trim(coalesce(p_data->>'name','')); spec:=trim(coalesce(p_data->>'specialty',''));
   if length(nm) not between 1 and 80 or length(spec)>100 then raise exception 'invalid_profile'; end if;
   if p_data ? 'photo' then
     portrait:=p_data->>'photo';
     if portrait is not null and (length(portrait)>100000 or portrait !~ '^data:image/jpeg;base64,/9j/[A-Za-z0-9+/]+={0,2}$') then raise exception 'invalid_photo'; end if;
   end if;
 end if;
 if p_action='staff-create' then
   new_code:='s'||substr(replace(gen_random_uuid()::text,'-',''),1,16);
   insert into public.staff(salon_id,code,display_name,specialty,active)
   values(p_salon,new_code,nm,spec,true) returning id into st;
   -- No invented working hours; new profiles are not bookable until shifts are entered.
   insert into public.staff_services(salon_id,staff_id,service_id)
   select p_salon,st,v.id from public.services v where v.salon_id=p_salon and v.active and v.code is not null and v.code<>'manual'
   on conflict do nothing;
 else
   select id,active into st,was_active from public.staff where salon_id=p_salon and staff.code=p_data->>'staffCode';
   if st is null then raise exception 'staff_unavailable'; end if;
   if p_action='staff-save' then
     update public.staff set display_name=nm,specialty=spec where id=st and salon_id=p_salon;
   elsif p_action='staff-archive' then
     if not was_active then return jsonb_build_object('confirmed',true); end if;
     if exists(select 1 from public.calendar_entries where salon_id=p_salon and staff_id=st and kind='appointment' and status='confirmed' and ends_at>now()) then raise exception 'staff_has_appointments'; end if;
     update public.staff set active=false where id=st and salon_id=p_salon;
   elsif p_action='staff-restore' then
     update public.staff set active=true where id=st and salon_id=p_salon;
   else raise exception 'unknown_action'; end if;
 end if;
 if p_action in ('staff-save','staff-create') and p_data ? 'photo' then
   if portrait is null then delete from public.avanti_staff_portraits where staff_id=st;
   else insert into public.avanti_staff_portraits(staff_id,photo) values(st,portrait)
   on conflict(staff_id) do update set photo=excluded.photo; end if;
 end if;
 return jsonb_build_object('confirmed',true,'staffId',st);
end $$;
revoke all on function public.avanti_manage_staff(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.avanti_manage_staff(uuid,text,jsonb) to service_role;
