-- ==========================================================================
-- 30. Dagatal: undirverk fá dag (til dæmis Myndband 1 til 4, eitt í viku).
--     Dagatalið sýnir þau og það má draga þau á milli daga. Autt: enginn
--     dagur, eins og áður. Má keyra aftur.
-- ==========================================================================

alter table undirverk add column if not exists dags date;
create index if not exists undirverk_dags_idx on undirverk (dags) where dags is not null;
