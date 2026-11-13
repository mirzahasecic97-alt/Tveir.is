# Vinnusvæði Tveir

Lokað svæði á `tveir.is/vinnusvaedi/` þar sem viðskiptavinur sér verkefnin sín,
sendir okkur taska og verkefni, og við hökum í lokið.

Núna keyrir það í **prufustillingu**. Gögnin eru sýnidæmi sem lifa í vafranum
þínum og fara ekki út á netið. Þú getur smellt á allt án þess að hafa áhyggjur.

Prufuaðgangar:

| Netfang | Sér |
| --- | --- |
| `anna@steinvik.is` | Vinnusvæði viðskiptavinar |
| `tveir@tveir.is` | Stjórnborðið okkar |
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
  okkar.html         okkar eigin listi, taskar milli okkar tveggja
  harvey.html        spjallið við Harvey
  fyrirspurnir.html  allt sem kemur inn um formin á tveir.is og hvaðan
  bokhald.html       tekjur, gjöld og VSK uppgjör
  manifest.webmanifest  gerir þetta að appi á heimaskjá
  sw.js                 þjónustustarfi, geymir bara sambandsleysissíðuna
  ekkert-samband.html   það sem sést þegar netið dettur út
  gagnagrunnur.sql   allar töflur og réttindi, keyrist einu sinni
  assets/
    stillingar.js    eina skráin sem þarf að breyta
    gogn.js          sækir gögnin, úr Supabase eða úr prufudæmum
    portal.js        sameiginlegt, haus, taskar, spjöld, viðhengi
    tillogur.js      samþykktarsíðan
    okkar.js         okkar eigin listi
    harvey.js        spjallið við Harvey
    fyrirspurnir.js  fyrirspurnasíðan
    bokhald.js       bókhaldssíðan
    portal.css       stíll ofan á styles.css

api/
  harvey.js          fallið sem talar við Claude. Lykillinn liggur þar.
package.json         bara fyrir fallið. Vefurinn sjálfur er áfram kyrrar skrár.
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

Ekkert að gera. `gagnagrunnur.sql` býr til báðar geymslurnar, `vidhengi`
lokaða og `merki` opna, og setur réttindin á þær.

### 6. Fyrsti aðgangur

**Authentication → Users → Invite user** fyrir `tveir@tveir.is` og
`oskar@tveir.is`. Svo í SQL Editor:

```sql
update notendur set hlutverk = 'admin', nafn = 'Mirza Hasecic'
where netfang = 'tveir@tveir.is';

update notendur set hlutverk = 'admin', nafn = 'Óskar Hákonar'
where netfang = 'oskar@tveir.is';
```

Eftir það býrðu til fyrirtæki á stjórnborðinu, býður viðskiptavini á sama hátt
og tengir hann við fyrirtækið sitt þar.

---

## Fyrirspurnir

Öll form á tveir.is senda áfram á Formspree eins og áður, svo pósturinn kemur
enn. Um leið skrifar vefurinn línu í töfluna `fyrirspurnir`, og hún birtist
undir **Fyrirspurnir** í hausnum.

Rakningin er í `assets/js/rakning.js` á vefnum sjálfum. Hún man fyrstu og
síðustu heimsókn gestsins í 90 daga: utm merkin í slóðinni, Facebook og
Google auglýsingasmelli (`fbclid`, `gclid`), og af hvaða vef hann kom. Engar
vafrakökur. Uppruninn fer líka sem ein lína í Formspree póstinn.

Til að auglýsing sjáist rétt þarf slóðin í henni utm merki, til dæmis
`https://tveir.is/herferd.html?utm_source=facebook&utm_medium=paid&utm_campaign=uttekt-nov`.
Facebook bætir `fbclid` sjálft við, svo hún telst af Facebook þótt merkin vanti,
en þá vantar nafnið á herferðinni.

Vefurinn notar anon lykilinn. Stefnan `fyrirspurnir_vefur` leyfir honum bara að
bæta við nýrri línu með stöðuna `ny`. Hann getur ekki lesið neitt til baka.

Stigin eru: Ný, Haft samband, Fundur, Tilboð sent, Unnið, Tapað. Virðið er
án VSK og telst í „Virði í ferli“ meðan fyrirspurnin er opin.

Yfirlitið `fyrirspurnir_osvaradar` bíður fyrir Make ef við viljum póst um það
sem enginn hefur svarað í sólarhring.

---

## Bókhald

**Bókhald** í hausnum er gamla Yfirlit síðan komin inn í vinnusvæðið: þrjár
töflur, `samningar`, `aukaverkefni` og `taxtar`, bara fyrir admin.

- **Efst:** hvað greiðist næstu tvö mánaðamót, fast á mánuði og hvað er komið
  inn á árinu með spá. Vinna í mánuði greiðist 1. dag næsta mánaðar, svo
  nóvembervinna greiðist í desember.
- **Súlurit:** tekjur eftir vinnumánuðum, samningar og aukaverkefni hvort í
  sínum lit. Framtíðarmánuðir eru daufir.
- **Samningar:** fastar mánaðartekjur með upphafs- og lokamánuði.
- **Aukaverkefni:** allt utan samninga. Staðfest eða kannski. Kannski telst
  ekki með í tölunum efst nema sem athugasemd. Smellt á Greitt/Ógreitt breytir.
- **Taxtar:** fast verð á einingu. Skrá spyr um fjölda og býr til aukaverkefni.

Upphæðir eru geymdar án VSK. Sé hakað í **Ekkert VSK** er talan endanleg og
rofinn Án VSK / Með VSK bætir ekki 24% ofan á hana.

---

## Okkar eigin listi

**Okkar** í hausnum er listi sem bara við tvö sjáum. Þar liggja taskar á okkur
sjálfum: það sem Óskar á að gera, það sem Mirza á að gera og það sem enginn
hefur tekið að sér enn.

Efst er ein lína: skrifaðu hvað þarf að gera, veldu á hvorn og ýttu á enter.
Dagsetning er valkvæð. Undir henni eru flipar eftir manni og fellilisti sem
ræður hvort lokið sést.

Smellurðu á titilinn opnast spjald þar sem þú breytir öllu: titli, nótu, stöðu,
á hvorn, forgangi, skiladegi og hvaða fyrirtæki taskurinn tilheyrir. Fyrirtækið
er bara til að vita hverjum hann tengist, það er valkvætt. Eyðing tekur tvær
ýtingar, því hér er ekkert afturkalla.

Stöðurnar eru fjórar: **Ekki byrjað**, **Í vinnslu**, **Bíður annars** og
**Lokið**. Bíður annars er fyrir það sem liggur hjá þriðja aðila og við getum
ekkert gert í á meðan.

Þetta liggur í töflunni `innri_taskar`, sem er aðskilin frá `taskar`. Ástæðan
er sú að `taskar` er lesin af viðskiptavininum í hans fyrirtæki. Væru okkar
eigin taskar þar inni gæti hann lesið þá út úr API-inu, hvað sem síðan sýnir
honum. Stefnan á `innri_taskar` hleypir engum inn nema admin.

Á stjórnborðinu birtist lína sem bendir hingað, en bara þegar eitthvað á þér
er ósnert eða komið fram úr skiladegi. Talan í hausnum telur allt sem er opið
á þér.

Yfirlitið `okkar_a_eftir` bíður tilbúið fyrir Make, ef við viljum póst á
morgnana um það sem er komið fram úr skiladegi.

---

## Harvey

**Harvey** í hausnum er spjall við aðstoðarmann sem sér verkefnin, taskana,
tímana og reikningsstöðuna. Hann er bara okkar megin, viðskiptavinur kemst
aldrei inn á síðuna.

Hann má leggja til þrennt: stofna task (á okkar lista eða hjá viðskiptavini),
breyta task sem er til, og skrá tíma á verkefni. **Hann framkvæmir ekkert
sjálfur.** Tillagan birtist sem spjald í spjallinu og þú ýtir á já. Þá fer
breytingin inn um venjulega gagnalagið með þínum réttindum, svo Row Level
Security heldur alveg eins og annars staðar.

Vafrinn safnar stöðunni og sendir hana með hverri spurningu. Fallið á Vercel
hefur því engin réttindi inn í gagnagrunninn og þarf ekki service_role
lykilinn. Hann á áfram hvergi heima nema í Supabase sjálfu.

### Lyklarnir í Vercel

Settu þá undir Project -> Settings -> Environment Variables og veldu öll
umhverfin þrjú.

| Breyta | Skylda | Hvað |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | já | Lykill af console.anthropic.com. Copilot áskrift dugar ekki, hún má ekki keyra okkar eigin forrit. |
| `SUPABASE_URL` | já, þegar Supabase er komið | Sama slóð og í `stillingar.js` |
| `SUPABASE_ANON_KEY` | já, þegar Supabase er komið | Sami anon lykill og í `stillingar.js` |
| `HARVEY_KODI` | nei | Kóði sem þú býrð til sjálfur og slærð inn á síðunni. Leyfir þér að prófa Harvey áður en Supabase er komið upp. Taktu hann út eftir á. |
| `HARVEY_LIKAN` | nei | Sjálfgefið `claude-opus-5-5`. `claude-sonnet-5-5` er helmingi ódýrari og dugar í flestar spurningar. |
| `HARVEY_LEYFI` | nei | Sjálfgefið `@tveir.is`. Hver má tala við hann. |

Fallið hleypir engum að nema hann sé innskráður á vinnusvæðið og netfangið
endi á `@tveir.is`. Það spyr Supabase sjálft hvort aðgangstáknið sé gilt, svo
enginn kemst framhjá því með því að kalla á slóðina beint.

### Hvað þetta kostar

Hver spurning sendir stöðuna á vinnusvæðinu með sér. Eins og staðan er núna
er það um þrjú bandarísk sent á spurningu á Opus, minna á Sonnet. Langt samtal
kostar meira því öll fyrri skilaboð fylgja með. Harvey man ekkert milli
heimsókna, hvert samtal byrjar hreint þegar síðan er opnuð.

---

## Tímar og rukkun

Á verkefnasíðu sjáið þið spjald sem heitir **Tímar og rukkun**. Hnapparnir
+1, +2, +4 og +8 skrá tíma þegar þið standið upp frá verkinu. Engin klukka
sem þarf að muna eftir að stoppa.

Undir tölunni stendur hvað þið eruð að fá á tímann. Sú tala verður rauð ef
hún fer undir `timagjald` í `assets/stillingar.js`, sem er 15.500 kr. í dag, lægsti taxtinn í verðskránni.
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
- Reikningar eru merktir handvirkt, ekkert samband við bókhaldskerfi. Bókhaldssíðan
  heldur utan um tölurnar en býr ekki til reikninga
