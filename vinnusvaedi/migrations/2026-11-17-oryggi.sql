-- Öryggi: nýr notandi ræður ekki sjálfur hlutverki sínu eða fyrirtæki
-- Áður las nyr_notandi() hlutverk og fyrirtaeki_id úr user metadata, sem
-- notandinn sjálfur getur sett við nýskráningu. Þá gat hver sem er gert sig
-- að admin. Nú fær hver nýr notandi hlutverkið vidskiptavinur og ekkert
-- fyrirtæki. Admin tengir hann við fyrirtæki á stjórnborðinu, og admin
-- hlutverk er aðeins sett í SQL Editor.

create or replace function nyr_notandi() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into notendur (id, netfang, nafn, fyrirtaeki_id, hlutverk)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(nullif(left(new.raw_user_meta_data ->> 'nafn', 120), ''), split_part(coalesce(new.email, ''), '@', 1)),
    null,
    'vidskiptavinur'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
