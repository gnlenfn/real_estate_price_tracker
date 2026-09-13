alter table public.trade_sync_runs
 add column retry_of uuid references public.trade_sync_runs(id) on delete set null,
 add column actor_id uuid references auth.users(id) on delete set null,
 add column skipped_count integer not null default 0 check(skipped_count>=0),
 add column failure_scope text not null default 'targets' check(failure_scope in ('targets','run'));
create index trade_sync_runs_retry_of on public.trade_sync_runs(retry_of);
