-- ==========================================================================
-- 33. Persónulegt á Dagatalinu: fundir eða viðburðir sem eru bara fyrir þann
--     sem bjó þá til (t.d. tannlæknir eða ferð). Aðrir stjórnendur sjá þá ekki.
--     Má keyra aftur.
-- ==========================================================================

alter table fundir add column if not exists tegund text not null default 'fundur';
alter table fundir drop constraint if exists fundir_tegund_check;
alter table fundir add constraint fundir_tegund_check check (tegund in ('fundur', 'personulegt'));

drop policy if exists fundir_admin on fundir;
create policy fundir_admin on fundir for all to authenticated
  using (er_admin() and (tegund <> 'personulegt' or hofundur = auth.uid()))
  with check (er_admin() and (tegund <> 'personulegt' or hofundur = auth.uid()));
