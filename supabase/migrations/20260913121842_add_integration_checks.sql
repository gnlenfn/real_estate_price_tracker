create table public.integration_checks (
 id uuid primary key default gen_random_uuid(),
 service text not null check(service in ('supabase','molit','kakao','github')),
 status text not null check(status in ('success','failed','unconfigured')),
 request_id uuid not null,
 checked_at timestamptz not null default now()
);
create index integration_checks_service_time on public.integration_checks(service,checked_at desc);
alter table public.integration_checks enable row level security;
revoke all on public.integration_checks from public,anon,authenticated;
grant select,insert on public.integration_checks to service_role;
