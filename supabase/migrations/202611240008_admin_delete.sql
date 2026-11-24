-- Allow administrators to delete transactions.
-- Collectors remain unable to delete anything (no DELETE policy for them).
-- The tenant still keeps an audit copy of the deleted row.

drop policy if exists "admin delete transactions" on public.transactions;
create policy "admin delete transactions"
  on public.transactions for delete
  using (public.is_admin());
