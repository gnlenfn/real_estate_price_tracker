alter table public.support_tickets drop constraint if exists support_tickets_github_status_check;
alter table public.support_tickets add constraint support_tickets_github_status_check check(github_status in ('pending','sending','sent','failed','unknown'));

create table public.support_github_message_exports (
 message_id uuid primary key references public.support_messages(id) on delete cascade,
 ticket_id uuid not null references public.support_tickets(id) on delete cascade,
 status text not null check(status in ('sending','sent','failed','unknown')),
 github_comment_id bigint,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table public.support_github_message_exports enable row level security;
revoke all on public.support_github_message_exports from public,anon,authenticated;
grant select,insert,update on public.support_github_message_exports to service_role;

create or replace function public.admin_list_support_tickets(p_status text default '',p_category text default '',p_github text default '',p_search text default '',p_before_activity timestamptz default null,p_before_id uuid default null,p_limit integer default 50)
returns table(id uuid,user_id uuid,category text,title text,body text,status text,created_at timestamptz,last_activity_at timestamptz,github_status text,github_issue_number integer,github_issue_url text,nickname text)
language sql stable security definer set search_path=public,pg_temp as $$
 select t.id,t.user_id,t.category,t.title,t.body,t.status,t.created_at,t.last_activity_at,t.github_status,t.github_issue_number,t.github_issue_url,coalesce(p.nickname,'집 사용자')
 from public.support_tickets t left join public.profiles p on p.user_id=t.user_id
 where (p_status='' or t.status=p_status) and (p_category='' or t.category=p_category)
 and (p_github='' or (p_github='sent' and t.github_issue_number is not null) or (p_github='pending' and t.github_issue_number is null))
 and (btrim(p_search)='' or t.title ilike '%'||replace(replace(btrim(p_search),'%','\%'),'_','\_')||'%' escape '\' or p.nickname ilike '%'||replace(replace(btrim(p_search),'%','\%'),'_','\_')||'%' escape '\')
 and (p_before_activity is null or (t.last_activity_at,t.id)<(p_before_activity,p_before_id))
 order by t.last_activity_at desc,t.id desc limit least(greatest(p_limit,1),50)
$$;
revoke all on function public.admin_list_support_tickets(text,text,text,text,timestamptz,uuid,integer) from public,anon,authenticated;
grant execute on function public.admin_list_support_tickets(text,text,text,text,timestamptz,uuid,integer) to service_role;
