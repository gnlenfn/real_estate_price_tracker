alter table public.support_tickets drop constraint if exists support_tickets_github_status_check;
alter table public.support_tickets add constraint support_tickets_github_status_check check(github_status in ('pending','sending','sent','failed'));
