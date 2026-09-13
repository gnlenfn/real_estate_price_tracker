create table public.user_activity_summary (
 user_id uuid primary key references auth.users(id) on delete cascade,
 last_activity_at timestamptz not null
);
alter table public.user_activity_summary enable row level security;
revoke all on public.user_activity_summary from public,anon,authenticated;
grant select,insert,update on public.user_activity_summary to service_role;

create or replace function public.touch_user_activity() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare v_user_id uuid;
begin
 v_user_id:=case when tg_table_name='support_messages' then new.author_id else new.user_id end;
 if tg_table_name='support_messages' and new.author_role<>'user' then return new; end if;
 insert into public.user_activity_summary(user_id,last_activity_at) values(v_user_id,now()) on conflict(user_id) do update set last_activity_at=excluded.last_activity_at;
 return new;
end $$;
create trigger properties_touch_activity after insert or update on public.properties for each row execute function public.touch_user_activity();
create trigger records_touch_activity after insert or update on public.records for each row execute function public.touch_user_activity();
create trigger support_tickets_touch_activity after insert on public.support_tickets for each row execute function public.touch_user_activity();
create trigger support_messages_touch_activity after insert on public.support_messages for each row execute function public.touch_user_activity();

create or replace function public.admin_list_users(p_search text default '',p_before_joined_at timestamptz default null,p_before_id uuid default null,p_limit integer default 50)
returns table(id uuid,nickname text,joined_at timestamptz,property_count bigint,ticket_count bigint,last_activity_at timestamptz)
language sql stable security definer set search_path=public,auth,pg_temp as $$
 select u.id,coalesce(p.nickname,'집 사용자'),u.created_at,
  (select count(*) from public.properties x where x.user_id=u.id),
  (select count(*) from public.support_tickets t where t.user_id=u.id),a.last_activity_at
 from auth.users u left join public.profiles p on p.user_id=u.id left join public.user_activity_summary a on a.user_id=u.id
 where (btrim(p_search)='' or p.nickname ilike '%'||replace(replace(btrim(p_search),'%','\%'),'_','\_')||'%' escape '\')
 and (p_before_joined_at is null or (u.created_at,u.id)<(p_before_joined_at,p_before_id))
 order by u.created_at desc,u.id desc limit least(greatest(p_limit,1),50)
$$;
revoke all on function public.admin_list_users(text,timestamptz,uuid,integer) from public,anon,authenticated;
grant execute on function public.admin_list_users(text,timestamptz,uuid,integer) to service_role;
