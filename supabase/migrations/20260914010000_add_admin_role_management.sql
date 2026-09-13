begin;

alter table admin.admins add column role text not null default 'admin' check (role in ('super_admin', 'admin'));
alter table admin.admins add column created_by uuid references auth.users(id) on delete set null;
update admin.admins set role='super_admin' where user_id=(select user_id from admin.admins order by created_at limit 1) and not exists(select 1 from admin.admins where role='super_admin');
create unique index admins_one_super_admin on admin.admins((role)) where role = 'super_admin';

alter table admin.audit_events drop constraint if exists audit_events_action_check;
alter table admin.audit_events add constraint audit_events_action_check check(action in ('support.reply','support.note','support.status','github.transfer','sync.start','sync.finish','admin.grant','admin.revoke','admin.transfer'));

create or replace function admin.is_super_admin() returns boolean language sql stable security definer set search_path=admin,pg_temp as $$ select auth.uid() is not null and exists(select 1 from admin.admins where user_id=auth.uid() and role='super_admin') $$;
revoke all on function admin.is_super_admin() from public,anon;
grant execute on function admin.is_super_admin() to authenticated,service_role;

create or replace function admin.grant_admin(p_actor_id uuid,p_target_id uuid,p_request_id uuid) returns void language plpgsql security invoker set search_path=admin,pg_temp as $$
begin
 if not exists(select 1 from admin.admins where user_id=p_actor_id and role='super_admin') then raise exception 'FORBIDDEN'; end if;
 if exists(select 1 from admin.admins where user_id=p_target_id) then raise exception 'ALREADY_ADMIN'; end if;
 insert into admin.admins(user_id,role,created_by) values(p_target_id,'admin',p_actor_id);
 insert into admin.audit_events(actor_id,action,target_id,request_id,outcome) values(p_actor_id,'admin.grant',p_target_id::text,p_request_id,'success');
end $$;

create or replace function admin.revoke_admin(p_actor_id uuid,p_target_id uuid,p_request_id uuid) returns void language plpgsql security invoker set search_path=admin,pg_temp as $$
begin
 if not exists(select 1 from admin.admins where user_id=p_actor_id and role='super_admin') then raise exception 'FORBIDDEN'; end if;
 if not exists(select 1 from admin.admins where user_id=p_target_id and role='admin') then raise exception 'NOT_REMOVABLE'; end if;
 delete from admin.admins where user_id=p_target_id and role='admin';
 insert into admin.audit_events(actor_id,action,target_id,request_id,outcome) values(p_actor_id,'admin.revoke',p_target_id::text,p_request_id,'success');
end $$;

create or replace function admin.transfer_super_admin(p_actor_id uuid,p_target_id uuid,p_request_id uuid) returns void language plpgsql security invoker set search_path=admin,pg_temp as $$
begin
 if p_actor_id=p_target_id or not exists(select 1 from admin.admins where user_id=p_actor_id and role='super_admin') then raise exception 'FORBIDDEN'; end if;
 if not exists(select 1 from admin.admins where user_id=p_target_id and role='admin') then raise exception 'INVALID_TARGET'; end if;
 update admin.admins set role='admin' where user_id=p_actor_id and role='super_admin';
 update admin.admins set role='super_admin' where user_id=p_target_id and role='admin';
 insert into admin.audit_events(actor_id,action,target_id,request_id,outcome,before_status,after_status) values(p_actor_id,'admin.transfer',p_target_id::text,p_request_id,'success','admin','super_admin');
end $$;

revoke all on function admin.grant_admin(uuid,uuid,uuid),admin.revoke_admin(uuid,uuid,uuid),admin.transfer_super_admin(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function admin.grant_admin(uuid,uuid,uuid),admin.revoke_admin(uuid,uuid,uuid),admin.transfer_super_admin(uuid,uuid,uuid) to service_role;
commit;
