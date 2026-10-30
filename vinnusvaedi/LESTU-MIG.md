# Vinnusvæði Tveir

Lokað svæði á `tveir.is/vinnusvaedi/` þar sem viðskiptavinur sér verkefnin sín,
sendir okkur taska og verkefni, og við hökum í lokið.

Núna keyrir það í **prufustillingu**. Gögnin eru sýnidæmi sem lifa í vafranum
þínum og fara ekki út á netið. Þú getur smellt á allt án þess að hafa áhyggjur.

Prufuaðgangar:

| Netfang | Sér |
| --- | --- |
| `anna@steinvik.is` | Vinnusvæði viðskiptavinar |
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

Á þeirri síðu sjáið þið hvað þau sendu og megið breyta öðru hvoru. Ef Hlíðarkaup
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
  manifest.webmanifest  gerir þetta að appi á heimaskjá
  sw.js                 þjónustustarfi, geymir bara sambandsleysissíðuna
  ekkert-samband.html   það sem sést þegar netið dettur út
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

## Merki viðskiptavinarins

Viðskiptavinur setur sitt eigið merki inn sjálfur á yfirlitinu, undir
**Merkið þitt**. Það **kemur í stað okkar merkis** uppi í horninu á öllum
síðum vinnusvæðisins. Tvö merki í sama haus eru einu of mikil, og þetta er
hans vinnusvæði. Hámark 1 MB, og PNG með gegnsæjum bakgrunni kemur best út.

Í Supabase fer merkið í **opna geymslu sem heitir `merki`**. Hún er opin
viljandi: merki fyrirtækis er hvort eð er á vef þess, og þá þarf ekki að
sækja undirritaða slóð í hvert sinn sem hausinn teiknast. `gagnagrunnur.sql`
býr geymsluna til.

Viðskiptavinurinn fær rétt til að uppfæra sína eigin línu í `fyrirtaeki`,
en **trigger passar að hann breyti bara merkinu**. Nafn, áskrift og
áskriftarverð standa óhreyfð, því `er_askrift` ræður því hvort budget sé
skylda á verkefnatillögum og það má enginn stilla sjálfur.

Í prufustillingu er myndin geymd sem data-slóð í localStorage, svo hún
lifir endurhleðslu en fylgir ekki á milli tækja.

---

## Appið í símanum

Vinnusvæðið er uppsetjanlegt á heimaskjá. Það þarf ekkert úr App Store
eða Play, þetta er síðan sjálf í heilum skjá með tákni.

Leiðbeiningarnar birtast **bara í síma og bara ef það er ekki þegar gert**.
Borði rennur upp að neðan tveimur sekúndubrotum eftir að síðan opnast, á öllum
síðum vinnusvæðisins. Hann má loka og þá kemur hann ekki aftur í þeim vafra.
Þegar honum hefur verið lokað birtist rólegt spjald á yfirliti viðskiptavinarins
í staðinn, svo leiðin sé enn til.
Skrefin breytast eftir tæki: iPhone fær Safari skrefin, Android fær
annaðhvort alvöru uppsetningarhnapp eða valmyndarskrefin.

Orðmerkið TVEIR er áfram efst á innskráningarsíðunni, líka í appinu.
Tvisturinn er táknið á heimaskjánum, ekki merki inni í síðunni.

Táknið er tvisturinn úr `favicon.svg`, hvítur á navy. Nafnið á heimaskjánum er
**Tveir**, sett í `short_name` í `manifest.webmanifest`. Ef þið viljið annað
nafn seinna er það ein lína þar og ein í `apple-mobile-web-app-title` á
síðunum fimm.

**Á iPhone heldur appið sinni eigin innskráningu.** Safari og heimaskjásappið
deila ekki gögnum, svo viðskiptavinurinn slær netfangið inn einu sinni í
viðbót þegar hann opnar appið í fyrsta sinn. Þetta stendur í leiðbeiningunum.

Þjónustustarfinn geymir ekkert nema sambandsleysissíðuna. Það er viljandi:
ef hann geymdi kóðann sjálfan gætu viðskiptavinir setið uppi með gamla útgáfu
eftir að við breytum einhverju.

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
