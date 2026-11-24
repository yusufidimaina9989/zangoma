-- Collector profile photo (private bucket path).
alter table public.profiles add column if not exists photo_path text;

grant all on all tables in schema public to anon, authenticated, service_role;
grant all on all routines in schema public to anon, authenticated, service_role;

-- Admins may delete transactions (also present in 0008).
drop policy if exists "admin delete transactions" on public.transactions;
create policy "admin delete transactions"
  on public.transactions for delete
  using (public.is_admin());
