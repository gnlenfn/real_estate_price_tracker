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
 apt_seq text check(apt_seq is null or length(apt_seq) between 1 and 100),
 kakao_place_id text check(kakao_place_id is null or length(kakao_place_id) between 1 and 40),
 road_address text not null default '' check(length(road_address) <= 200),
 jibun_address text not null default '' check(length(jibun_address) <= 200),
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
create policy own_properties on public.properties for all to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create policy own_records on public.records for all to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
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

create table public.profiles (
 user_id uuid primary key references auth.users(id) on delete cascade,
 nickname text not null,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 constraint profiles_nickname_format check (nickname=btrim(nickname) and nickname !~ '  +' and char_length(nickname) between 2 and 30 and nickname ~ '^[가-힣A-Za-z0-9 ]+$')
);
create unique index profiles_nickname_unique on public.profiles (lower(btrim(nickname)));
alter table public.profiles enable row level security;
create policy own_profile_select on public.profiles for select to authenticated using(user_id=(select auth.uid()));
create policy own_profile_update on public.profiles for update to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
grant select, update on public.profiles to authenticated;

create or replace function public.ensure_profile()
returns public.profiles language plpgsql security definer set search_path = public, pg_temp as $$
declare
 result public.profiles; candidate text;
 adjectives text[] := array['고요한','명랑한','용감한','다정한','기민한','느긋한','든든한','반짝이는','슬기로운','씩씩한','온화한','유쾌한','재빠른','차분한','총명한','친절한','푸근한','활기찬','꾸준한','당당한','부지런한','신중한','산뜻한','따뜻한','정직한','재치있는','호기심많은','자유로운','침착한','상냥한','쾌활한','담대한','포근한','성실한','영리한','평온한','멋진','행복한','밝은','귀여운'];
 animals text[] := array['사막여우','붉은여우','북극여우','회색늑대','붉은늑대','눈표범','구름표범','아무르표범','재규어','퓨마','카라칼','서벌','스라소니','레서판다','자이언트판다','쿼카','웜뱃','코알라','미어캣','카피바라','친칠라','알파카','라마','순록','아이벡스','가젤','오카피','테이퍼','해달','유럽수달','바다수달','오소리','라쿤','너구리','몽구스','페넥여우','황제펭귄','아델리펭귄','왕관펭귄','큰부리새','퍼핀','홍학','두루미','황새','수리부엉이','흰올빼미','검독수리','송골매','물총새','벌새','큰고니','혹고니','바다오리','돌고래','범고래','흰돌고래','듀공','매너티','일각고래','혹등고래','고래상어','만타가오리','해마','문어','앵무조개','바다거북','육지거북','아홀로틀','청개구리','도롱뇽','코모도왕도마뱀','이구아나','카멜레온','비어디드래곤','왕도마뱀','코주부원숭이','황금들창코원숭이','긴팔원숭이','마모셋','타마린','여우원숭이'];
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 select * into result from public.profiles where user_id=auth.uid();
 if found then return result; end if;
 for attempt in 1..100 loop
  candidate := adjectives[(floor(random()*array_length(adjectives,1))+1)::integer] || ' ' || animals[(floor(random()*array_length(animals,1))+1)::integer];
  begin insert into public.profiles(user_id,nickname) values(auth.uid(),candidate) returning * into result; return result;
  exception when unique_violation then null; end;
 end loop;
 raise exception 'Unable to allocate nickname';
end;
$$;
revoke all on function public.ensure_profile() from public, anon;
grant execute on function public.ensure_profile() to authenticated;

create table public.app_admins (
 user_id uuid primary key references auth.users(id) on delete cascade,
 created_at timestamptz not null default now()
);
alter table public.app_admins enable row level security;

create or replace function public.is_support_admin() returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select auth.uid() is not null and exists(select 1 from public.app_admins where user_id=auth.uid());
$$;
revoke all on function public.is_support_admin() from public,anon;
grant execute on function public.is_support_admin() to authenticated;

create table public.support_tickets (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 category text not null check(category in ('bug','feature','question')),
 title text not null check(char_length(title) between 3 and 100),
 body text not null check(char_length(body) between 10 and 4000),
 screen text not null default '' check(char_length(screen) <= 200),
 browser text not null default '' check(char_length(browser) <= 500),
 status text not null default 'open' check(status in ('open','answered','closed')),
 last_activity_at timestamptz not null default now(),
 github_status text not null default 'pending' check(github_status in ('pending','sending','sent','failed','unknown')),
 github_issue_number integer,
 github_issue_url text check(github_issue_url is null or char_length(github_issue_url) <= 500),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index support_tickets_rate_limit on public.support_tickets(user_id,created_at desc);
create index support_tickets_activity on public.support_tickets(user_id,last_activity_at desc);
alter table public.support_tickets enable row level security;
create policy support_tickets_select on public.support_tickets for select to authenticated using(user_id=(select auth.uid()) or (select public.is_support_admin()));
create policy support_tickets_admin_update on public.support_tickets for update to authenticated using((select public.is_support_admin())) with check((select public.is_support_admin()));
grant select,update on public.support_tickets to authenticated;

create table public.support_messages (
 id uuid primary key default gen_random_uuid(), ticket_id uuid not null references public.support_tickets(id) on delete cascade,
 author_id uuid not null references auth.users(id) on delete cascade, author_role text not null check(author_role in ('user','admin')),
 body text not null check(char_length(body) between 1 and 4000), created_at timestamptz not null default now()
);
create index support_messages_ticket_created on public.support_messages(ticket_id,created_at);
alter table public.support_messages enable row level security;
create policy support_messages_select on public.support_messages for select to authenticated using((select public.is_support_admin()) or exists(select 1 from public.support_tickets ticket where ticket.id=ticket_id and ticket.user_id=(select auth.uid())));
create policy support_messages_owner_insert on public.support_messages for insert to authenticated with check(author_id=(select auth.uid()) and author_role='user' and exists(select 1 from public.support_tickets ticket where ticket.id=ticket_id and ticket.user_id=(select auth.uid()) and ticket.status<>'closed'));
create policy support_messages_admin_insert on public.support_messages for insert to authenticated with check(author_id=(select auth.uid()) and author_role='admin' and (select public.is_support_admin()));

create table public.support_attachments (
 id uuid primary key default gen_random_uuid(), ticket_id uuid not null references public.support_tickets(id) on delete cascade,
 message_id uuid references public.support_messages(id) on delete cascade, user_id uuid not null references auth.users(id) on delete cascade,
 storage_path text not null unique check(char_length(storage_path) between 1 and 500), file_name text not null check(char_length(file_name) between 1 and 200),
 mime_type text not null check(mime_type in ('image/png','image/jpeg','image/webp')), byte_size integer not null check(byte_size between 1 and 5242880), created_at timestamptz not null default now()
);
create index support_attachments_ticket on public.support_attachments(ticket_id,created_at);
alter table public.support_attachments enable row level security;
create policy support_attachments_select on public.support_attachments for select to authenticated using((select public.is_support_admin()) or exists(select 1 from public.support_tickets ticket where ticket.id=ticket_id and ticket.user_id=(select auth.uid())));
create policy support_attachments_owner_insert on public.support_attachments for insert to authenticated with check(user_id=(select auth.uid()) and exists(select 1 from public.support_tickets ticket where ticket.id=ticket_id and ticket.user_id=(select auth.uid()) and ticket.status<>'closed'));
create policy support_attachments_admin_insert on public.support_attachments for insert to authenticated with check(user_id=(select auth.uid()) and (select public.is_support_admin()));
grant select,insert on public.support_messages,public.support_attachments to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('support-attachments','support-attachments',false,5242880,array['image/png','image/jpeg','image/webp']) on conflict(id) do update set public=false,file_size_limit=5242880,allowed_mime_types=array['image/png','image/jpeg','image/webp'];
create policy support_attachment_objects_select on storage.objects for select to authenticated using(bucket_id='support-attachments' and ((select public.is_support_admin()) or owner_id=(select auth.uid()::text)));
create policy support_attachment_objects_insert on storage.objects for insert to authenticated with check(bucket_id='support-attachments' and owner_id=(select auth.uid()::text) and (storage.foldername(name))[1]=(select auth.uid()::text) and exists(select 1 from public.support_tickets ticket where ticket.id::text=(storage.foldername(name))[2] and ticket.user_id=(select auth.uid()) and ticket.status<>'closed'));
create policy support_attachment_objects_delete on storage.objects for delete to authenticated using(bucket_id='support-attachments' and ((select public.is_support_admin()) or owner_id=(select auth.uid()::text)));

create table public.trade_sync_runs (
 id uuid primary key default gen_random_uuid(), trigger text not null check(trigger in ('cron','manual')),
 status text not null default 'running' check(status in ('running','success','partial','failed')), started_at timestamptz not null default now(), finished_at timestamptz,
 property_count integer not null default 0 check(property_count>=0), completed_count integer not null default 0 check(completed_count>=0), saved_records integer not null default 0 check(saved_records>=0),
 failure_count integer not null default 0 check(failure_count>=0), failures jsonb not null default '[]'::jsonb check(jsonb_typeof(failures)='array'), request_id uuid not null default gen_random_uuid(),
 retry_of uuid references public.trade_sync_runs(id) on delete set null, actor_id uuid references auth.users(id) on delete set null,
 skipped_count integer not null default 0 check(skipped_count>=0), failure_scope text not null default 'targets' check(failure_scope in ('targets','run'))
);
create index trade_sync_runs_started_at on public.trade_sync_runs(started_at desc);
create unique index trade_sync_runs_single_running on public.trade_sync_runs((true)) where status='running';
alter table public.trade_sync_runs enable row level security;
revoke all on public.trade_sync_runs from public,anon,authenticated;
grant select,insert,update on public.trade_sync_runs to service_role;

create table public.admin_audit_events (
 id uuid primary key default gen_random_uuid(), actor_id uuid references auth.users(id) on delete set null,
 action text not null check(action in ('support.reply','support.note','support.status','github.transfer','sync.start','sync.finish')),
 target_id text not null check(char_length(target_id) between 1 and 200), request_id uuid not null,
 outcome text not null check(outcome in ('success','failed','unknown')), before_status text, after_status text, created_at timestamptz not null default now()
);
create index admin_audit_events_created_at on public.admin_audit_events(created_at desc,id desc);
create index admin_audit_events_target on public.admin_audit_events(target_id,created_at desc);
alter table public.admin_audit_events enable row level security;
revoke all on public.admin_audit_events from public,anon,authenticated;
grant select,insert on public.admin_audit_events to service_role;

create table public.support_internal_notes (
 id uuid primary key default gen_random_uuid(), ticket_id uuid not null references public.support_tickets(id) on delete cascade,
 author_id uuid references auth.users(id) on delete set null, body text not null check(char_length(body) between 1 and 4000), created_at timestamptz not null default now()
);
create index support_internal_notes_ticket on public.support_internal_notes(ticket_id,created_at,id);
alter table public.support_internal_notes enable row level security;
revoke all on public.support_internal_notes from public,anon,authenticated;
grant select,insert on public.support_internal_notes to service_role;

create or replace function public.add_support_internal_note(p_ticket_id uuid,p_author_id uuid,p_body text,p_request_id uuid)
returns table(id uuid,created_at timestamptz) language plpgsql security invoker set search_path=public as $$
declare v_id uuid;v_created_at timestamptz;
begin
 if char_length(btrim(p_body)) not between 1 and 4000 then raise exception 'Invalid note'; end if;
 if not exists(select 1 from public.support_tickets where support_tickets.id=p_ticket_id) then raise exception 'Ticket not found'; end if;
 insert into public.support_internal_notes(ticket_id,author_id,body) values(p_ticket_id,p_author_id,btrim(p_body)) returning support_internal_notes.id,support_internal_notes.created_at into v_id,v_created_at;
 insert into public.admin_audit_events(actor_id,action,target_id,request_id,outcome) values(p_author_id,'support.note',p_ticket_id::text,p_request_id,'success');
 return query select v_id,v_created_at;
end $$;
revoke all on function public.add_support_internal_note(uuid,uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.add_support_internal_note(uuid,uuid,text,uuid) to service_role;
+
create table public.user_activity_summary (
 user_id uuid primary key references auth.users(id) on delete cascade, last_activity_at timestamptz not null
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

create table public.integration_checks (
 id uuid primary key default gen_random_uuid(), service text not null check(service in ('supabase','molit','kakao','github')),
 status text not null check(status in ('success','failed','unconfigured')), request_id uuid not null, checked_at timestamptz not null default now()
);
create index integration_checks_service_time on public.integration_checks(service,checked_at desc);
alter table public.integration_checks enable row level security;
revoke all on public.integration_checks from public,anon,authenticated;
grant select,insert on public.integration_checks to service_role;

create table public.support_github_message_exports (
 message_id uuid primary key references public.support_messages(id) on delete cascade,
 ticket_id uuid not null references public.support_tickets(id) on delete cascade,
 status text not null check(status in ('sending','sent','failed','unknown')), github_comment_id bigint,
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
