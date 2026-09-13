-- DANGER: This permanently deletes every login account and all JIPGAP app data.
-- Run only in the production Supabase project before public launch.
begin;

delete from auth.users;

drop function if exists public.ensure_profile();
drop function if exists public.replace_molit_month(uuid,text,jsonb);
drop function if exists public.replace_molit_month_scheduled(uuid,uuid,text,jsonb);
drop table if exists public.support_tickets;
drop table if exists public.records;
drop table if exists public.properties;
drop table if exists public.profiles;


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

create table public.support_tickets (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 category text not null check(category in ('bug','feature','question')),
 title text not null check(char_length(title) between 3 and 100),
 body text not null check(char_length(body) between 10 and 4000),
 screen text not null default '' check(char_length(screen) <= 200),
 browser text not null default '' check(char_length(browser) <= 500),
 status text not null default 'pending' check(status in ('pending','sent','failed')),
 github_issue_number integer,
 github_issue_url text check(github_issue_url is null or char_length(github_issue_url) <= 500),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index support_tickets_rate_limit on public.support_tickets(user_id,created_at desc);
alter table public.support_tickets enable row level security;
create policy own_support_tickets_select on public.support_tickets for select to authenticated using(user_id=(select auth.uid()));
grant select on public.support_tickets to authenticated;

commit;
