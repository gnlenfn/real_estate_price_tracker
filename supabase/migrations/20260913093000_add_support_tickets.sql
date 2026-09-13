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
