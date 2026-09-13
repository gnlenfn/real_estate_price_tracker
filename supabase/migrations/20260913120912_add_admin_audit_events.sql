create table public.admin_audit_events (
 id uuid primary key default gen_random_uuid(),
 actor_id uuid references auth.users(id) on delete set null,
 action text not null check(action in ('support.reply','support.note','support.status','github.transfer','sync.start','sync.finish')),
 target_id text not null check(char_length(target_id) between 1 and 200),
 request_id uuid not null,
 outcome text not null check(outcome in ('success','failed','unknown')),
 before_status text,
 after_status text,
 created_at timestamptz not null default now()
);
create index admin_audit_events_created_at on public.admin_audit_events(created_at desc,id desc);
create index admin_audit_events_target on public.admin_audit_events(target_id,created_at desc);
alter table public.admin_audit_events enable row level security;
revoke all on public.admin_audit_events from public,anon,authenticated;
grant select,insert on public.admin_audit_events to service_role;
