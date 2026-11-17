-- ==========================================================================
-- 20. Listi án merkja verður mörg verk
--     Viðskiptavinur sem skrifar
--         hanna logo
--         laga vefsíðu
--         finna bolta
--     fær þrjú verk, ekki eitt. Áður þurfti - eða 1. fremst í hverja línu.
-- ==========================================================================

create or replace function taskur_ur_posti(p_lykill text, p_fra text, p_efni text, p_texti text, p_thradur text default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  n       record;
  lina    text;
  lidir   text[] := '{}';
  efni    text := left(coalesce(nullif(trim(p_efni), ''), 'Verk úr tölvupósti'), 200);
  texti   text := nullif(left(trim(coalesce(p_texti, '')), 5000), '');
  fjoldi  int := 0;
  lidur   text;
  linur   text[];
  stuttar boolean;
  fyrri   text;
  fj      int;
  undirskrift boolean;
begin
  if p_lykill is null
     or p_lykill is distinct from (select gildi from stillingar_innri where lykill = 'postur_lykill') then
    return jsonb_build_object('ok', false, 'villa', 'lykill');
  end if;

  select id, fyrirtaeki_id, nafn into n
    from notendur
   where lower(netfang) = lower(trim(p_fra))
     and hlutverk = 'vidskiptavinur'
     and fyrirtaeki_id is not null
   limit 1;
  if n.id is null then
    return jsonb_build_object('ok', false, 'villa', 'othekktur');
  end if;

  /* Listi í póstinum (línur sem byrja á -, *, • eða 1. / 1)) verður einn
     taskur á hvern lið. */
  foreach lina in array regexp_split_to_array(coalesce(texti, ''), '\r?\n') loop
    if lina ~ '^\s*([-*•–]|\d{1,2}[.)])\s+\S' then
      lidir := lidir || left(trim(regexp_replace(lina, '^\s*([-*•–]|\d{1,2}[.)])\s+', '')), 200);
    end if;
  end loop;

  /* Enginn listi með merkjum? Þá telst hver lína eitt verk, ef pósturinn er
     bara stuttar línur (til dæmis "hanna logo / laga vefsíðu / finna bolta").
     Kveðja efst, inngangslína sem endar á tvípunkti og undirskrift neðst
     sleppa. Venjulegur póstur með heilum setningum verður áfram eitt verk. */
  if coalesce(array_length(lidir, 1), 0) < 2 then
    linur := '{}';
    stuttar := true;
    undirskrift := false;
    fyrri := '';
    foreach lina in array regexp_split_to_array(coalesce(texti, ''), '\r?\n') loop
      lina := trim(regexp_replace(lina, '[\s\u00a0\u2007\u202f\u200b\ufeff]+', ' ', 'g'));
      continue when lina !~ '[[:alnum:]]';   -- auðar línur og skil eins og ____ eða ---
      fj := coalesce(array_length(linur, 1), 0);

      -- Kveðja eða þakkir: þar byrjar undirskriftin. Efst í póstinum er þeim sleppt.
      if lina ~* '^(kveðja|kveðjur|kv\.?|kær kveðja|kær kv\.?|kærar kveðjur|bestu kveðjur|bestu kv\.?|með kveðju|með bestu kveðju|með bestu kveðjum|mbk\.?|bkv\.?|regards|best regards|kind regards|cheers)([\s,]+[^\s,]+){0,3}[\s,!.]*$'
         or lina ~* '^(takk|takk takk|takk fyrir|takk fyrir mig|takk kærlega|takk kærlega fyrir|kærar þakkir|fyrirfram þakkir|þakka þér fyrir|þakka ykkur fyrir|thanks|thank you)[\s,!.]*$' then
        exit when fj >= 1;
        continue;
      end if;
      exit when lina ~* '^(sent (from|úr|frá) |sendur (úr|frá) |get outlook|sækja outlook)';

      -- Kveðja efst: "Hæ", "Hæ Jón,", "Sæl Anna", "Góðan daginn"
      continue when fj = 0 and (
            lina ~* '^(hæ|hæhæ|hæ hæ|halló|hallo|hi|hello|hey|sæl|sæll|sælir|sælar|sæl öll|sæl og blessuð|sæll og blessaður|góðan dag|góðan daginn|gott kvöld|dear|kæri|kæra|kæru)[\s,!.]*$'
         or lina ~* '^(hæ|hæhæ|halló|hallo|hi|hello|hey|sæl|sæll|sælir|sælar|sæl og blessuð|sæll og blessaður|góðan dag|góðan daginn|dear|kæri|kæra|kæru)(\s+[^\s,!.]+){1,3}\s*[,!]$'
         or lina ~ '^([Hh]æ|[Hh]alló|[Hh]i|[Hh]ello|[Hh]ey|[Ss]æl|[Ss]æll|[Ss]ælir|[Ss]ælar|[Kk]æri|[Kk]æra|[Kk]æru|[Dd]ear)\s+([[:upper:]]|[ÁÐÉÍÓÚÝÞÆÖ])[^\s,!.]*(\s+([[:upper:]]|[ÁÐÉÍÓÚÝÞÆÖ])[^\s,!.]*)?[.]?$');

      -- Inngangur eins og "Hér eru verkin:"
      continue when lina ~ ':$';

      -- Undirskrift án kveðju: sími, netfang, vefur eða fyrirtæki ein á línu
      if fj >= 1 and (
            lina ~* '^(s\.|sími|gsm|tel\.?|farsími|mobile|m\.)\s*:?\s*\+?[0-9 ()-]{7,}$'
         or lina ~ '^\+?[0-9 ()-]{7,}$'
         or lina ~ '^\S+@\S+$'
         or lina ~* '^(www\.|https?://)\S+$'
         or lina ~ '^\[image'
         or lina ~* '\s(ehf|hf|slf|sf)\.?$') then
        undirskrift := true;
        exit;
      end if;

      -- Setningar, spurningar eða framhald línu: þetta er venjulegur póstur, ekki listi
      if length(lina) > 150
         or lina ~ '[[:alpha:]]{3,}[.]\s+([[:upper:]]|[ÁÐÉÍÓÚÝÞÆÖ])'
         or lina ~ '[!?]\s+[[:alpha:]]'
         or lina ~ '[?]$'
         or lina ~* '^(ég|mér|mig|okkur|við (erum|vorum|viljum|þurfum|ætlum|værum)|það|þetta|hér er|svo|en|og|því|af því|ef|getið|gætuð|gætir|geturðu|getur þú|væri|viljið|vonandi)(\s|,|$)'
         or (lina ~ '^[[:lower:]]' and length(fyrri) >= 60) then
        stuttar := false;
        exit;
      end if;

      linur := linur || left(lina, 200);
      fyrri := lina;
    end loop;

    -- Nafn neðst án kveðju: "Jón Jónsson", eða "Anna" á eftir einni beiðni
    fj := coalesce(array_length(linur, 1), 0);
    -- Fyrir ofan síma eða netfang standa nafn og starfsheiti: þeim er sleppt líka
    if undirskrift then
      while fj >= 1 and linur[fj] ~ '^([[:upper:]]|[ÁÐÉÍÓÚÝÞÆÖ])[^\s0-9]*(\s+([[:upper:]]|[ÁÐÉÍÓÚÝÞÆÖ])[^\s0-9]*){0,2}$' loop
        linur := linur[1:fj - 1];
        fj := fj - 1;
      end loop;
    end if;
    if fj >= 2
       and linur[fj] ~ '^([[:upper:]]|[ÁÐÉÍÓÚÝÞÆÖ])[^\s0-9]*(\s+([[:upper:]]|[ÁÐÉÍÓÚÝÞÆÖ])[^\s0-9]*){0,2}$'
       and (fj = 2 or linur[fj] ~ '\s') then
      linur := linur[1:fj - 1];
      fj := fj - 1;
    end if;

    -- Bara 2 til 15 stuttar línur teljast listi, annað verður eitt verk
    if stuttar and fj between 2 and 15 then
      lidir := linur;
    end if;
  end if;

  if array_length(lidir, 1) >= 2 then
    foreach lidur in array lidir[1:30] loop
      insert into taskar (fyrirtaeki_id, titill, lysing, hofundur, stada, postur_thradur)
      values (n.fyrirtaeki_id, lidur, 'Úr tölvupósti: ' || efni || coalesce(E'\n\n' || texti, ''), n.id, 'nytt', p_thradur);
      fjoldi := fjoldi + 1;
    end loop;
  else
    insert into taskar (fyrirtaeki_id, titill, lysing, hofundur, stada, postur_thradur)
    values (n.fyrirtaeki_id, efni, texti, n.id, 'nytt', p_thradur);
    fjoldi := 1;
  end if;

  return jsonb_build_object('ok', true, 'fjoldi', fjoldi, 'nafn', n.nafn,
    'titlar', case when fjoldi > 1 then to_jsonb(lidir[1:30]) else to_jsonb(array[efni]) end,
    'fyrirtaeki', (select nafn from fyrirtaeki where id = n.fyrirtaeki_id));
end;
$$;
