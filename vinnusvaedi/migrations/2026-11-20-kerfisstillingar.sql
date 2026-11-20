-- ==========================================================================
-- 34. Kerfisstillingar: gjaldmiðill kerfisins (ISK, EUR eða USD). Allir
--     innskráðir lesa (viðskiptavinir sjá upphæðir í sama gjaldmiðli),
--     bara stjórnendur breyta. Tungumálið er stillt á hvern notanda í vafranum.
--     Má keyra aftur.
-- ==========================================================================

create table if not exists kerfisstillingar (
  lykill   text primary key check (lykill in ('gjaldmidill')),
  gildi    text not null check (length(gildi) <= 20),
  uppfaert timestamptz not null default now(),
  check (lykill <> 'gjaldmidill' or gildi in ('ISK', 'EUR', 'USD'))
);
alter table kerfisstillingar enable row level security;
drop policy if exists kerfisstillingar_les on kerfisstillingar;
create policy kerfisstillingar_les on kerfisstillingar for select to authenticated using (true);
drop policy if exists kerfisstillingar_admin on kerfisstillingar;
create policy kerfisstillingar_admin on kerfisstillingar for all to authenticated
  using (er_admin()) with check (er_admin());
