drop policy if exists own_properties on public.properties;
create policy own_properties on public.properties for all to authenticated
 using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));

drop policy if exists own_records on public.records;
create policy own_records on public.records for all to authenticated
 using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
