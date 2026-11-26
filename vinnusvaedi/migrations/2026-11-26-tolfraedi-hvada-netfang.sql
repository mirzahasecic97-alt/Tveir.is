-- ==========================================================================
-- 26. nóv 2026: tölfræði má senda á hvaða netfang sem er
--
-- Áður mátti bara senda á viðskiptavini fyrirtækisins og stjórnendur
-- stofunnar. Mirza vill geta skrifað inn hvaða netfang sem er (til dæmis
-- styrktaraðila eða þjálfara sem er ekki notandi í kerfinu).
-- Óbreytt: bara stjórnendur, bara fyrirtæki í eigin stofu, 1 til 10
-- viðtakendur. Nýtt: netföngin eru hreinsuð (lágstafir, bil burt, engin
-- tvítekning) og þurfa bara að vera gild netföng.
-- Keyra í SQL Editor. Má keyra oftar en einu sinni.
-- ==========================================================================

create or replace function stilla_tolfraedi_sendingu() returns trigger
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare n text; v_stofa uuid; hrein text[];
begin
  if not er_admin() then
    raise exception 'Bara stjórnendur senda tölfræði';
  end if;
  v_stofa := (select f.stofa_id from fyrirtaeki f where f.id = new.fyrirtaeki_id);
  if v_stofa is null or v_stofa is distinct from min_stofa() then
    raise exception 'Fyrirtækið er ekki í þinni stofu' using errcode = '42501';
  end if;
  new.sendandi  := auth.uid();
  new.stada     := 'bidur';
  new.villa     := null;
  new.sent_dags := null;
  new.stofnad   := now();
  select coalesce(array_agg(distinct x), '{}') into hrein
    from (select lower(btrim(y)) x from unnest(coalesce(new.netfong, '{}')) y) z
   where x <> '';
  if coalesce(array_length(hrein, 1), 0) = 0 or array_length(hrein, 1) > 10 then
    raise exception 'Veldu 1 til 10 viðtakendur';
  end if;
  foreach n in array hrein loop
    if length(n) > 254 or n !~ '^[^\s@,;<>"'']+@[^\s@,;<>"'']+\.[^\s@,;<>"'']+$' then
      raise exception 'Netfangið % er ekki gilt', n;
    end if;
  end loop;
  new.netfong := hrein;
  return new;
end $$;
revoke all on function stilla_tolfraedi_sendingu() from public, anon, authenticated;

-- Staðan
select 'RES ' || (pg_get_functiondef('public.stilla_tolfraedi_sendingu()'::regprocedure) like '%er ekki gilt%')::text as k;
