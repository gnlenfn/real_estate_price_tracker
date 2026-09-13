alter table public.support_tickets
 add column if not exists github_status text not null default 'pending'
 check(github_status in ('pending','sent','failed'));
