create table public.trade_sync_runs (
 id uuid primary key default gen_random_uuid(),
 trigger text not null check(trigger in ('cron','manual')),
 status text not null default 'running' check(status in ('running','success','partial','failed')),
 started_at timestamptz not null default now(),
 finished_at timestamptz,
 property_count integer not null default 0 check(property_count >= 0),
 completed_count integer not null default 0 check(completed_count >= 0),
 saved_records integer not null default 0 check(saved_records >= 0),
 failure_count integer not null default 0 check(failure_count >= 0),
 failures jsonb not null default '[]'::jsonb check(jsonb_typeof(failures)='array'),
 request_id uuid not null default gen_random_uuid()
);

create index trade_sync_runs_started_at on public.trade_sync_runs(started_at desc);
create unique index trade_sync_runs_single_running on public.trade_sync_runs((true)) where status='running';
alter table public.trade_sync_runs enable row level security;
revoke all on public.trade_sync_runs from public, anon, authenticated;
grant select, insert, update on public.trade_sync_runs to service_role;
