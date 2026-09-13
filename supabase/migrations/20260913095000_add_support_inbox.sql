create table public.app_admins (
 user_id uuid primary key references auth.users(id) on delete cascade,
 created_at timestamptz not null default now()
);

alter table public.app_admins enable row level security;

create or replace function public.is_support_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
 select auth.uid() is not null
    and exists (select 1 from public.app_admins where user_id=auth.uid());
$$;

revoke all on function public.is_support_admin() from public, anon;
grant execute on function public.is_support_admin() to authenticated;

alter table public.support_tickets
 drop constraint if exists support_tickets_status_check;

update public.support_tickets
set status='open'
where status in ('pending','sent','failed');

alter table public.support_tickets
 alter column status set default 'open',
 add column if not exists last_activity_at timestamptz not null default now(),
 add column if not exists github_status text not null default 'pending' check(github_status in ('pending','sent','failed')),
 add constraint support_tickets_status_check check(status in ('open','answered','closed'));

update public.support_tickets
set last_activity_at=greatest(created_at,updated_at);

create index support_tickets_activity on public.support_tickets(user_id,last_activity_at desc);

drop policy if exists own_support_tickets_select on public.support_tickets;
create policy support_tickets_select on public.support_tickets for select to authenticated
 using(user_id=(select auth.uid()) or (select public.is_support_admin()));

create policy support_tickets_admin_update on public.support_tickets for update to authenticated
 using((select public.is_support_admin()))
 with check((select public.is_support_admin()));

create table public.support_messages (
 id uuid primary key default gen_random_uuid(),
 ticket_id uuid not null references public.support_tickets(id) on delete cascade,
 author_id uuid not null references auth.users(id) on delete cascade,
 author_role text not null check(author_role in ('user','admin')),
 body text not null check(char_length(body) between 1 and 4000),
 created_at timestamptz not null default now()
);

create index support_messages_ticket_created on public.support_messages(ticket_id,created_at);
alter table public.support_messages enable row level security;

create policy support_messages_select on public.support_messages for select to authenticated
 using(
  (select public.is_support_admin())
  or exists (
   select 1 from public.support_tickets ticket
   where ticket.id=ticket_id and ticket.user_id=(select auth.uid())
  )
 );

create policy support_messages_owner_insert on public.support_messages for insert to authenticated
 with check(
  author_id=(select auth.uid())
  and author_role='user'
  and exists (
   select 1 from public.support_tickets ticket
   where ticket.id=ticket_id and ticket.user_id=(select auth.uid()) and ticket.status<>'closed'
  )
 );

create policy support_messages_admin_insert on public.support_messages for insert to authenticated
 with check(
  author_id=(select auth.uid())
  and author_role='admin'
  and (select public.is_support_admin())
 );

create table public.support_attachments (
 id uuid primary key default gen_random_uuid(),
 ticket_id uuid not null references public.support_tickets(id) on delete cascade,
 message_id uuid references public.support_messages(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 storage_path text not null unique check(char_length(storage_path) between 1 and 500),
 file_name text not null check(char_length(file_name) between 1 and 200),
 mime_type text not null check(mime_type in ('image/png','image/jpeg','image/webp')),
 byte_size integer not null check(byte_size between 1 and 5242880),
 created_at timestamptz not null default now()
);

create index support_attachments_ticket on public.support_attachments(ticket_id,created_at);
alter table public.support_attachments enable row level security;

create policy support_attachments_select on public.support_attachments for select to authenticated
 using(
  (select public.is_support_admin())
  or exists (
   select 1 from public.support_tickets ticket
   where ticket.id=ticket_id and ticket.user_id=(select auth.uid())
  )
 );

create policy support_attachments_owner_insert on public.support_attachments for insert to authenticated
 with check(
  user_id=(select auth.uid())
  and exists (
   select 1 from public.support_tickets ticket
   where ticket.id=ticket_id and ticket.user_id=(select auth.uid()) and ticket.status<>'closed'
  )
 );

create policy support_attachments_admin_insert on public.support_attachments for insert to authenticated
 with check(
  user_id=(select auth.uid()) and (select public.is_support_admin())
 );

grant select, insert on public.support_messages, public.support_attachments to authenticated;
grant select, update on public.support_tickets to authenticated;

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('support-attachments','support-attachments',false,5242880,array['image/png','image/jpeg','image/webp'])
on conflict (id) do update set public=false,file_size_limit=5242880,allowed_mime_types=array['image/png','image/jpeg','image/webp'];

create policy support_attachment_objects_select on storage.objects for select to authenticated
 using(
  bucket_id='support-attachments'
  and (
   (select public.is_support_admin())
   or owner_id=(select auth.uid()::text)
  )
 );

create policy support_attachment_objects_insert on storage.objects for insert to authenticated
 with check(
  bucket_id='support-attachments'
  and owner_id=(select auth.uid()::text)
  and (storage.foldername(name))[1]=(select auth.uid()::text)
  and exists (
   select 1 from public.support_tickets ticket
   where ticket.id::text=(storage.foldername(name))[2]
   and ticket.user_id=(select auth.uid())
   and ticket.status<>'closed'
  )
 );

create policy support_attachment_objects_delete on storage.objects for delete to authenticated
 using(
  bucket_id='support-attachments'
  and ((select public.is_support_admin()) or owner_id=(select auth.uid()::text))
 );
