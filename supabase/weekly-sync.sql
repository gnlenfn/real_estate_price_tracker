-- Run once after schema.sql to allow the server-only weekly job to replace API rows.
create or replace function public.replace_molit_month_scheduled(
 p_id uuid,
 p_user_id uuid,
 p_month text,
 p_rows jsonb
)
returns void language plpgsql security invoker set search_path = public as $$
begin
 if p_month !~ '^[0-9]{4}-(0[1-9]|1[0-2])$' then raise exception 'Invalid month'; end if;
 perform 1 from public.properties where id=p_id and user_id=p_user_id for update;
 if not found then raise exception 'Property not found'; end if;
 delete from public.records
 where property_id=p_id and user_id=p_user_id and source='국토교통부 API' and to_char(date,'YYYY-MM')=p_month;
 insert into public.records(user_id,property_id,date,price,kind,source,note)
 select p_user_id,p_id,(r->>'date')::date,(r->>'price')::numeric,'trade','국토교통부 API',coalesce(r->>'note','')
 from jsonb_array_elements(p_rows) r where left(r->>'date',7)=p_month;
end $$;
revoke all on function public.replace_molit_month_scheduled(uuid,uuid,text,jsonb) from public, anon, authenticated;
grant execute on function public.replace_molit_month_scheduled(uuid,uuid,text,jsonb) to service_role;
