create table public.support_internal_notes (
 id uuid primary key default gen_random_uuid(),
 ticket_id uuid not null references public.support_tickets(id) on delete cascade,
 author_id uuid references auth.users(id) on delete set null,
 body text not null check(char_length(body) between 1 and 4000),
 created_at timestamptz not null default now()
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
