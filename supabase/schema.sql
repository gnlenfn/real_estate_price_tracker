-- Run once in the Supabase SQL editor. Create your personal user in Authentication.
create table public.properties (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 name text not null check(length(name) between 1 and 100),
 district text not null check(district ~ '^[0-9]{5}$'),
 dong text not null check(length(dong) between 1 and 100),
 area numeric not null check(area > 0 and area < 1000),
 owned boolean not null default false,
 color text not null default '#285ee8',
 unique(id,user_id)
);
create table public.records (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 property_id uuid not null,
 date date not null check(date <= current_date),
 price numeric not null check(price > 0 and price < 100000000),
 kind text not null check(kind in ('trade','estimate','asking')),
 source text not null,
 note text not null default '',
 foreign key(property_id,user_id) references public.properties(id,user_id) on delete cascade
);
create index records_history on public.records(user_id,property_id,date);
alter table public.properties enable row level security;
alter table public.records enable row level security;
create policy own_properties on public.properties for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy own_records on public.records for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
grant select, insert, update, delete on public.properties, public.records to authenticated;
-- Transactional month replacement includes cancellation corrections on a later refresh.
create or replace function public.replace_molit_month(p_id uuid,p_month text,p_rows jsonb)
returns void language plpgsql security invoker set search_path = public as $$
begin
 if p_month !~ '^[0-9]{4}-(0[1-9]|1[0-2])$' then raise exception 'Invalid month'; end if;
 perform 1 from public.properties where id=p_id and user_id=auth.uid() for update;
 if not found then raise exception 'Property not found'; end if;
 delete from public.records where property_id=p_id and user_id=auth.uid() and source='국토교통부 API' and to_char(date,'YYYY-MM')=p_month;
 insert into public.records(property_id,date,price,kind,source,note)
 select p_id,(r->>'date')::date,(r->>'price')::numeric,'trade','국토교통부 API',coalesce(r->>'note','')
 from jsonb_array_elements(p_rows) r where left(r->>'date',7)=p_month;
end $$;
revoke all on function public.replace_molit_month(uuid,text,jsonb) from public;
grant execute on function public.replace_molit_month(uuid,text,jsonb) to authenticated;

-- Server-only replacement used by the authenticated Vercel Cron route.
create or replace function public.replace_molit_month_scheduled(p_id uuid,p_user_id uuid,p_month text,p_rows jsonb)
returns void language plpgsql security invoker set search_path = public as $$
begin
 if p_month !~ '^[0-9]{4}-(0[1-9]|1[0-2])$' then raise exception 'Invalid month'; end if;
 perform 1 from public.properties where id=p_id and user_id=p_user_id for update;
 if not found then raise exception 'Property not found'; end if;
 delete from public.records where property_id=p_id and user_id=p_user_id and source='국토교통부 API' and to_char(date,'YYYY-MM')=p_month;
 insert into public.records(user_id,property_id,date,price,kind,source,note)
 select p_user_id,p_id,(r->>'date')::date,(r->>'price')::numeric,'trade','국토교통부 API',coalesce(r->>'note','')
 from jsonb_array_elements(p_rows) r where left(r->>'date',7)=p_month;
end $$;
revoke all on function public.replace_molit_month_scheduled(uuid,uuid,text,jsonb) from public, anon, authenticated;
grant execute on function public.replace_molit_month_scheduled(uuid,uuid,text,jsonb) to service_role;
