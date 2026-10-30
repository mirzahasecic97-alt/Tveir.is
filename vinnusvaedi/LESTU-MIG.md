# Vinnusvæði Tveir

Lokað svæði á `tveir.is/vinnusvaedi/` þar sem viðskiptavinur sér verkefnin sín,
sendir okkur taska og verkefni, og við hökum í lokið.

Núna keyrir það í **prufustillingu**. Gögnin eru sýnidæmi sem lifa í vafranum
þínum og fara ekki út á netið. Þú getur smellt á allt án þess að hafa áhyggjur.

Prufuaðgangar:

| Netfang | Sér |
| --- | --- |
| `anna@hafvitamin.is` | Vinnusvæði viðskiptavinar |
| `mirza@tveir.is` | Stjórnborðið okkar |
| `oskar@tveir.is` | Stjórnborðið okkar |

---

## Budget reglan

Viðskiptavinur getur ekki sent verkefnatillögu án þess að setja budget.

Eina undantekningin er fyrirtæki sem er merkt **í áskrift**. Það velur hvort
verkefnið rúmist innan samningsins eða sé sér verkefni. Velji það sér verkefni
birtist budget reiturinn og hann er skylda.

Þetta er ekki bara í forminu. Stefnan `verk_tillaga` í `gagnagrunnur.sql` hafnar
línu án budgets, og hafnar línu sem er merkt innan áskriftar frá fyrirtæki sem
er ekki í áskrift. Enginn kemst framhjá þessu með því að opna Developer Tools.

Tillögurnar eiga sína eigin síðu, **Tillögur** í hausnum, með tölu á því sem
bíður. Á stjórnborðinu er bara ein lína sem bendir þangað.

Á þeirri síðu sjáið þið hvað þau sendu og megið breyta öðru hvoru. Ef Krónan
merkir verðmerkingu á sendibíla sem innan áskriftar og þið eruð ósammala, flettið þið
reitnum í Sér verkefni, setjið verð og skrifið ástæðuna í svarið. Viðskiptavinurinn
sér verðið og ástæðuna á verkefnasíðunni sinni.

Fyrirtæki er merkt í áskrift þegar það er stofnað á stjórnborðinu.

---

## Skrárnar

```
vinnusvaedi/
  index.html         innskráning
  yfirlit.html       það sem viðskiptavinurinn sér
  verk.html          eitt verkefni, tímalína, tímar og rukkun
  stjornbord.html    það sem við sjáum daglega
  tillogur.html      verkefnatillögur sem bíða svars
  gagnagrunnur.sql   allar töflur og réttindi, keyrist einu sinni
  assets/
    stillingar.js    eina skráin sem þarf að breyta
    gogn.js          sækir gögnin, úr Supabase eða úr prufudæmum
    portal.js        sameiginlegt, haus, taskar, spjöld, viðhengi
    tillogur.js      samþykktarsíðan
    portal.css       stíll ofan á styles.css
```

---

## Að tengja það við alvöru gögn

### 1. Supabase verkefni

Búðu til frítt verkefni á [supabase.com](https://supabase.com). Veldu Frankfurt
sem svæði, þá eru gögnin innan EES og GDPR verður ekki vandamál.

### 2. Töflurnar

Opnaðu **SQL Editor**, límdu inn allt úr `gagnagrunnur.sql` og keyrðu.
Það býr til töflurnar og setur Row Level Security á þær allar.

Row Level Security þýðir að gagnagrunnurinn sjálfur hleypir hverju fyrirtæki
bara í sínar eigin línur. Þetta er ekki JavaScript í vafra sem einhver getur
farið framhjá með því að opna Developer Tools.

### 3. Innskráning

**Authentication → Providers → Email**: kveiktu á `Email`, slökktu á
`Confirm email` og kveiktu á `Magic Link`.

**Authentication → URL Configuration**:

- Site URL: `https://tveir.is/vinnusvaedi/`
- Redirect URLs: `https://tveir.is/vinnusvaedi/yfirlit.html`

**Authentication → Email Templates → Magic Link**: skrifaðu íslenskan texta.
Sjálfgefni textinn er enskur og lítur út eins og ruslpóstur.

### 4. Stillingar

Í `assets/stillingar.js`:

```js
prufa: false,
supabaseUrl: 'https://xxxxx.supabase.co',
supabaseAnonKey: 'eyJ...'
```

Báðir lyklarnir eru í **Project Settings → API**. `anon` lykillinn á að vera
opinber, það er í lagi að hann sjáist í kóðanum. `service_role` lykillinn fer
aldrei þangað inn, hann fer framhjá öllum réttindum.

### 5. Viðhengi

**Storage → New bucket**, nafn `vidhengi`, ekki public. Réttindin eru þegar
í `gagnagrunnur.sql`.

### 6. Fyrsti aðgangur

**Authentication → Users → Invite user** fyrir `mirza@tveir.is` og
`oskar@tveir.is`. Svo í SQL Editor:

```sql
update notendur set hlutverk = 'admin', nafn = 'Mirza Hasecic'
where netfang = 'mirza@tveir.is';

update notendur set hlutverk = 'admin', nafn = 'Óskar Hákonar'
where netfang = 'oskar@tveir.is';
```

Eftir það býrðu til fyrirtæki á stjórnborðinu, býður viðskiptavini á sama hátt
og tengir hann við fyrirtækið sitt þar.

---

## Tímar og rukkun

Á verkefnasíðu sjáið þið spjald sem heitir **Tímar og rukkun**. Hnapparnir
+1, +2, +4 og +8 skrá tíma þegar þið standið upp frá verkinu. Engin klukka
sem þarf að muna eftir að stoppa.

Undir tölunni stendur hvað þið eruð að fá á tímann. Sú tala verður rauð ef
hún fer undir `timagjald` í `assets/stillingar.js`, sem er 12.000 kr. í dag.
Breyttu henni í ykkar tölu.

Reikningsreiturinn hefur þrjár stöður: ekki rukkað, reikningur sendur og greitt.
Á stjórnborðinu er listi sem heitir **Bíður reiknings** með öllu sem er lokið
og órukkað, og tekjulínan efst telur það saman.

**Viðskiptavinur sér hvorki tímana né reikningsstöðuna.** Þau gögn eru í
sértöflunni `verkefni_innri` sem hefur sinn eigin aðgang. Ástæðan er að Row
Level Security virkar á línur en ekki dálka. Sætu tímarnir á `verkefni` gæti
viðskiptavinur lesið þá út úr API og reiknað framlegðina okkar.

---

## Tímalínan

Taskar innan verkefnis eru skref í röð, ekki listi. Á verkefnasíðunni sjást
þau sem tölusett tímalína. Hakið ofan í einu skrefi hækkar prósentuna á
verkefninu sjálfkrafa, bæði hjá ykkur og hjá viðskiptavininum.

**Prósentan er ekki stillt í höndunum lengur.** Hún er alltaf
lokið deilt með öllum skrefum. Níu skref og þrú klarar þrjú, þá stendur 33%.
Reikningurinn er í gagnagrunninum sjálfum (`stilla_framvindu` trigger á
`taskar`), svo talan er rétt sama hvaðan breytingin kemur.

Tvennt gerist sjálfkrafa í leiðinni:

- Fyrsta hakið á samþykktu verkefni setur það í vinnslu
- Þegar öll skref eru búin birtist hnappur til að loka verkefninu. Við
  lokum því ekki sjálfkrafa því lokið þýdir að senda reikning.

Örvarnar til hægri á hverju skrefi færa það til í röðinni. Nýtt skref fer aftast.

---

## Verkefnasnið

Ný vefsíða er alltaf sömu níu taskarnir. Á stjórnborðinu er hnappurinn
**Nýtt verkefni** þar sem þú velur snið og færð alla taskana með í einum
smelli. Taskar sem eru merktir viðskiptavin lenda strax í Bíður þín hjá honum.

Þrú snið fylgja: Ný vefsíða (níu skref), Efnispakki mánaðar (sex) og
Vörumerki (sex). Röðin í `snid_taskar.rod` verður að röðinni í tímalínunni.
Þú breytir þeim í töflunum `snid` og `snid_taskar`.

---

## Viðhengi

Smelltu á task og þú sérð **Bæta við skrá**. Hámark 25 MB á skrá.

Í prufustillingu lifa skrárnar bara meðan síðan er opin, því localStorage
þolir ekki myndir. Þegar Supabase er komið fara þær í Storage og haldast.

---

## Tilkynningar

Vinnusvæði sem enginn opnar er dautt. Pósturinn er það sem heldur því lifandi.

**Database → Webhooks → Create a new hook**

| | |
| --- | --- |
| Tafla | `taskar` |
| Atburðir | `INSERT`, `UPDATE` |
| Tegund | HTTP Request, POST |
| Slóð | webhook slóðin úr Make |

Í Make: *Custom webhook* sem gildra, *Router* sem skiptir eftir því hver
stofnaði, og Gmail eining á hvorri grein.

- Nýr taskur frá viðskiptavin → póstur á tveir@tveir.is
- Taskur fer í `lokid` → póstur á viðskiptavininn
- Ný verkefnatillaga → póstur á okkur báða

**Tvö yfirlit bíða í gagnagrunninum fyrir Make.** Make notar `service_role`
lykilinn og les þá beint:

| Yfirlit | Til hvers |
| --- | --- |
| `bidur_vidskiptavina` | Áminning: allt sem bíður viðskiptavinar, með netfangi hans |
| `olokid_rukkun` | Lokið en órukkað, til að minna okkur á að senda reikning |

Vikuleg áminning á mánudagsmorgni úr `bidur_vidskiptavina` er það sem heldur
þessu lifandi. Viðskiptavinur sem fær þann póst hættir ekki í áskrift í þögn.

---

## Hvað þetta kostar

| | |
| --- | --- |
| Supabase free | 0 kr. upp að 500 MB og 50.000 notendum á mánuði |
| Supabase Pro | um 3.500 kr. á mánuði þegar það vex |
| Vercel | þegar greitt, þetta eru bara fleiri statískar skrár |
| Make | þegar greitt |

---

## Það sem er ekki komið

- Enginn póstur fer út fyrr en Make flæðið er sett upp
- Engin leitarsía á gömlum verkefnum, það kemur þegar listinn verður langur
- Sniðum er breytt í SQL, ekki í viðmótinu
- Reikningar eru merktir handvirkt, ekkert samband við bókhaldskerfi
