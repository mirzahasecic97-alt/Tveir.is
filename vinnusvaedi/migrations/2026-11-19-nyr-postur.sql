-- ==========================================================================
-- 26. Nýr póstur úr pósthólfinu
--
-- Sama biðröð og svörin (postholf_svor): lína án þráðar er nýr póstur með
-- viðtakendum og efni. Apps Script sendir hann frá tveir@tveir.is.
-- Mest 10 viðtakendur, hvert netfang athugað. Bara stjórnendur.
-- Má keyra aftur.
-- ==========================================================================

alter table postholf_svor alter column thradur_id drop not null;
alter table postholf_svor add column if not exists til text check (til is null or length(til) <= 2000);
alter table postholf_svor add column if not exists efni text check (efni is null or length(efni) between 1 and 200);
alter table postholf_svor drop constraint if exists postholf_svor_tegund;
alter table postholf_svor add constraint postholf_svor_tegund
  check (thradur_id is not null or (til is not null and efni is not null));

create or replace function stilla_postholf_svari() returns trigger
language plpgsql security definer set search_path = public as $$
declare n text; fjoldi int := 0;
begin
  if not er_admin() then
    raise exception 'Bara stjórnendur senda póst';
  end if;
  new.sendandi  := auth.uid();
  new.stada     := 'bidur';
  new.villa     := null;
  new.sent_dags := null;
  new.stofnad   := now();
  if new.thradur_id is null then
    new.efni := btrim(regexp_replace(coalesce(new.efni, ''), '[\r\n]+', ' ', 'g'));
    if new.efni = '' then raise exception 'Efnið vantar'; end if;
    new.til := lower(regexp_replace(coalesce(new.til, ''), '\s+', '', 'g'));
    foreach n in array string_to_array(new.til, ',') loop
      continue when n = '';
      if n !~ '^[^@\s<>",;]+@[^@\s<>",;]+\.[a-z]{2,}$' then
        raise exception 'Netfangið % er ekki rétt', n;
      end if;
      fjoldi := fjoldi + 1;
    end loop;
    if fjoldi = 0 or fjoldi > 10 then raise exception 'Settu inn 1 til 10 viðtakendur'; end if;
  end if;
  return new;
end;
$$;
revoke all on function stilla_postholf_svari() from public, anon, authenticated;

create or replace function postholf_svor_til(p_lykill text) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if not postholf_lykill_ok(p_lykill) then return '[]'::jsonb; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'thradur_id', s.thradur_id, 'texti', s.texti, 'html', s.html,
                                                       'til', s.til, 'efni', s.efni) order by s.stofnad)
    from (select * from postholf_svor where stada = 'bidur' order by stofnad limit 20) s), '[]'::jsonb);
end;
$$;
revoke all on function postholf_svor_til(text) from public;
grant execute on function postholf_svor_til(text) to anon;
