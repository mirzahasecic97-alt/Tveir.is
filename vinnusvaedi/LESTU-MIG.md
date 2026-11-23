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
  migrations/        viðbætur við gagnagrunn sem er þegar til, ein skrá í einu
  verk-postur.gs     Google skriftan: verk@tveir.is, lokið pósturinn og undirverkin
  assets/
    stillingar.js    eina skráin sem þarf að breyta
    gogn.js          sækir gögnin, úr Supabase eða úr prufudæmum
    portal.js        sameiginlegt, haus, taskar, spjöld, viðhengi
    undirverk.js     undirverk inni í taski: listinn, hakið og skilin
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
- Redirect URLs: `https://tveir.is/vinnusvaedi/yfirlit.html` og
  `https://tveir.is/vinnusvaedi/?endurstilla=1` (hlekkurinn fyrir gleymt lykilorð)

Lykilorðin sjálf eru útskýrð í kaflanum **Innskráning með lykilorði** neðar.

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

## Innskráning með lykilorði

Það eru tvær leiðir inn og báðar virka alltaf:

- **Lykilorð** (sjálfgefið): netfang og lykilorð, ýta á Skrá inn.
- **Senda mér hlekk**: hlekkur kemur í póstinum, eins og áður.

Fólk helst inni á sama tæki þar til það ýtir á **Út**. Það þarf ekki að skrá
sig inn í hvert sinn.

### Að velja lykilorð í fyrsta sinn

1. Farðu á `tveir.is/vinnusvaedi/`, veldu **Senda mér hlekk** og opnaðu hlekkinn
   úr póstinum.
2. Þegar þú kemur inn spyr vinnusvæðið hvort þú viljir velja lykilorð. Sláðu það
   inn tvisvar, minnst 10 stafir, og ýttu á **Vista lykilorð**.
3. Misstirðu af því? Ýttu á **lykiltáknið** efst, við hliðina á **Út**. Það
   heitir Breyta lykilorði og opnar sama spjald.

Næst velur þú **Lykilorð** á innskráningarsíðunni og þarft engan hlekk.
Viðskiptavinir gera þetta á sama hátt.

**Gleymt lykilorð?** Skrifaðu netfangið og ýttu á Gleymt lykilorð. Hlekkur
kemur í póstinum, hann opnar vinnusvæðið og biður um nýtt lykilorð strax.

### Stillingar í Supabase (einu sinni)

Í Supabase verkefninu **Tveir.is CRM**:

0. **Mikilvægast. Authentication → Sign In / Providers → User Signups →
   Allow new users to sign up**: slökkt. Annars getur hver sem er búið sér
   til aðgang með lykilorði og sett sjálfur hlutverkið sitt í leiðinni, því
   `nyr_notandi()` les hlutverk og fyrirtæki úr því sem notandinn sendir.
   Boð úr **Authentication → Users → Invite** virka áfram þó slökkt sé.
1. **Authentication → Sign In / Providers → Email**: kveikt á `Email` (það
   er þegar kveikt fyrir hlekkina). Lykilorð virka sjálfkrafa þegar Email er á.
   Ef þar er rofi fyrir lykilorð, hafðu hann á.
2. Á sama stað: **Minimum password length** = `10`. Undir **Password
   requirements** dugar sjálfgefið, lengdin skiptir mestu.
3. **Prevent use of leaked passwords**: kveiktu á því ef það er í boði. Það er
   bara á Pro áskrift og ofar. Á Free áskrift er það grátt og þá sleppum við því.
4. **Secure password change**: má vera slökkt. Ef kveikt er á því þarf fólk sem
   hefur verið inni lengur en sólarhring að skrá sig út og inn með hlekk áður
   en það breytir lykilorði. Vinnusvæðið segir þeim það ef svo er.
5. **Authentication → URL Configuration → Redirect URLs**: bættu við
   `https://tveir.is/vinnusvaedi/?endurstilla=1`. Án þess fer hlekkurinn fyrir
   gleymt lykilorð á forsíðu vinnusvæðisins og biður ekki um nýtt lykilorð.
6. **Authentication → Emails → Reset Password**: skrifaðu íslenskan texta,
   eins og í Magic Link. Til dæmis fyrirsögn `Nýtt lykilorð fyrir vinnusvæði
   Tveir` og hnappur `Velja nýtt lykilorð`. Hlekkurinn er `{{ .ConfirmationURL }}`.

Lykilorðin sjálf sjáum við aldrei. Supabase geymir þau dulkóðuð. Merkið
`lykilord_sett` í notandanum segir vinnusvæðinu bara hvort það eigi að bjóða
fólki að velja lykilorð, það stýrir engum réttindum.

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
deila ekki gögnum, svo viðskiptavinurinn skráir sig inn einu sinni í viðbót
þegar hann opnar appið í fyrsta sinn. Þar er lykilorðið best: hlekkur úr pósti
opnast í Safari en ekki í appinu. Þetta stendur í leiðbeiningunum.

Þjónustustarfinn geymir ekkert nema sambandsleysissíðuna. Það er viljandi:
ef hann geymdi kóðann sjálfan gætu viðskiptavinir setið uppi með gamla útgáfu
eftir að við breytum einhverju.

---

## Viðhengi

Smelltu á task og þú sérð **Bæta við skrá**. Hámark 25 MB á skrá.

Í prufustillingu lifa skrárnar bara meðan síðan er opin, því localStorage
þolir ekki myndir. Þegar Supabase er komið fara þær í Storage og haldast.

---

## Undirverk

Taskur getur haft undirverk. Dæmi: fjögur myndbönd fyrir sama viðskiptavin.
Hvert myndband er undirverk og þegar eitt er klárt fær viðskiptavinurinn
póst með því, án þess að bíða eftir hinum þremur.

### Svona notar þú það

1. **Nýr taskur með undirverkum:** á verkefnasíðu, ýttu á **Bæta við
   skrefi**. Í reitinn **Undirverk** skrifar þú eitt í línu, til dæmis
   Myndband 1 til Myndband 4.
2. **Á task sem er til:** opnaðu taskinn. Undir **Undirverk** skrifar þú
   nafn, til dæmis `Myndband`, og fjölda, til dæmis `4`, og ýtir á **Bæta
   við**. Þá verða til Myndband 1, 2, 3 og 4.
3. **Myndband klárt:** hakaðu í það. Þá opnast lítið spjald:
   - **Velja skrá** ef skráin er undir 50 MB, eða
   - límdu **hlekk** (WeTransfer, Google Drive, Dropbox), eða
   - hakaðu í **Senda án skrár eða hlekks** ef það á bara að segja þeim
     að þetta sé klárt.
   - **Senda viðskiptavininum póst** er hakað sjálfgefið. Taktu hakið af ef
     þú ert þegar búinn að senda það sjálfur.
   - Ýttu á **Merkja lokið**.
4. Innan 5 mínútna fer pósturinn. Á línunni stendur fyrst **Póstur fer
   innan 5 mín.** og svo **Sent** með dagsetningu.

Smelltu á nafnið til að breyta því. Örvarnar færa það ofar eða neðar.
**Eyða** þarf tvo smelli og eyðir skránni líka. **Skrá eða hlekkur** setur
skilin inn án þess að haka í lokið, til dæmis þegar skráin er tilbúin en
þú vilt ekki senda strax. Viltu senda aftur, taktu hakið af og hakaðu aftur.

Á spjaldinu stendur **2 af 4 lokið**, bæði hjá ykkur og hjá
viðskiptavininum. Þegar öll eru búin birtist hnappur til að merkja
taskinn sjálfan lokið. Það gerist ekki sjálfkrafa.

Viðskiptavinurinn sér listann og hakið, og hlekkinn eða skrána um leið og
undirverkið er lokið. Hann getur engu breytt. Það er í gagnagrunninum
sjálfum, ekki bara á síðunni.

### Hver fær póstinn

- Bað viðskiptavinur um taskinn fær hann póstinn. Kom taskurinn með pósti
  á verk@tveir.is fer svarið í sama póstþráð.
- Stofnuðum við taskinn fá allir notendur fyrirtækisins póstinn.
- Hafi fyrirtækið engan notanda fer enginn póstur. Hann fer þegar
  notandi er tengdur fyrirtækinu.

### Af hverju ekki WeTransfer sjálfkrafa

WeTransfer lokaði fyrir tengingar annarra forrita árið 2022. Vinnusvæðið
getur því ekki búið til WeTransfer hlekk sjálft. Þú setur myndbandið á
WeTransfer eins og venjulega og límir hlekkinn inn. Póstur með skránni
sjálfri í viðhengi gengur ekki heldur, Gmail tekur mest 25 MB.

### Stór myndbönd

Supabase Free leyfir mest **50 MB á skrá**. Stærri skrá er stöðvuð strax
með skilaboðum um að nota hlekk. Á Pro (um 25 dollarar á mánuði) má fara
miklu hærra. Þá þarf að hækka `undirverkHamarkMb` í `assets/stillingar.js`
og hámarkið í Supabase: **Storage -> Settings -> Upload file size limit**.
Það kostar peninga, svo það er ákvörðun sem þú tekur, ekki við.

### Að setja það upp (einu sinni)

**1. Gagnagrunnurinn.** Í Supabase verkefninu **Tveir.is CRM**: **SQL
Editor -> New query**, límdu inn allt úr
`migrations/2026-11-16-undirverk.sql` og ýttu á **Run**. Það á að enda á
`Success. No rows returned`. Það má keyra aftur án skaða.

Það býr til töfluna `undirverk` með Row Level Security, föllin
`undirverk_otilkynnt` og `merkja_undirverk_sent` fyrir skriftuna, og
stefnuna `vidhengi_afhending` á geymsluna. Sama efni er kafli 18 í
`gagnagrunnur.sql`.

Það herðir líka tvennt sem var til fyrir:

- **Stefnan `vidhengi_les` á geymslunni.** Viðskiptavinur sækir skrá
  undirverks bara þegar því er lokið, ekki drög sem bíða. Venjuleg
  viðhengi eru óbreytt.
- **Notandi breytir ekki eigin fyrirtæki, hlutverki eða netfangi.**
  Áður gat innskráður viðskiptavinur breytt sinni línu í `notendur`
  beint, sett á sig annað fyrirtæki og lesið gögn þess, eða sett annað
  netfang og fengið póstinn sendan þangað. Nafnið má hann áfram laga.
  Þið sem admin tengið áfram notendur við fyrirtæki á stjórnborðinu.

Gagnagrunnurinn hafnar líka skrá sem liggur ekki í möppu síns undirverks,
svo skrá eins fyrirtækis getur aldrei farið í póst til annars.

**Gerðu þetta áður en nýju skrárnar fara á vefinn.** Vinnusvæðið virkar
samt ef röðin snýst við, en undirverkin sjást ekki fyrr en taflan er til.

**2. Vefurinn.** Nýju og breyttu skrárnar fara á Vercel eins og venjulega:
`assets/undirverk.js` (ný), `assets/portal.js`, `assets/gogn.js`,
`assets/verk.js`, `assets/stillingar.js` og `assets/portal.css`.

**3. Google skriftan.** Á script.google.com, skráð inn sem tveir@tveir.is:

1. Opnaðu verkefnið með `verk-postur.gs`.
2. `ANON` og `LYKILL` eru ekki í kóðanum heldur í **Project Settings**
   (tannhjólið) > **Script Properties**. Séu þau ekki þar, settu þau inn
   FYRST: `ANON` (anon lykillinn úr `assets/stillingar.js`) og `LYKILL`
   (gildið í töflunni `stillingar_innri`, línan `postur_lykill`).
3. Afritaðu svo **allt** úr nýju `verk-postur.gs`, límdu yfir það sem er
   þar og keyrðu `profaLykil` einu sinni. Executions sýnir "Lykillinn
   virkar" eða hvað vantar. Röðin stendur líka efst í `verk-postur.gs`.
4. Ýttu á **Save**. Vaktin sem keyrir á 5 mínútna fresti kallar sjálf á
   nýja hlutann, það þarf ekki að setja hana upp aftur.
5. Prófaðu: hakaðu í undirverk hjá prufufyrirtæki með hlekk, bíddu í 5
   mínútur og sjáðu póstinn koma. Undir **Executions** sérðu ef eitthvað
   klikkar.

**4. Valkvætt: hlekkur beint á skrána.** Án þessa skrefs fær
viðskiptavinurinn hlekk á vinnusvæðið þegar skráin liggur hjá okkur, og
sækir hana þar eftir innskráningu. Það er öruggast. Viltu að pósturinn hafi
beinan hlekk á skrána, sem gildir í 7 daga eins og WeTransfer:

1. **Authentication -> Users -> Add user -> Create new user**. Netfang
   `afhending@tveir.is`, langt lykilorð úr lykilorðageymslunni þinni,
   hakaðu í **Auto Confirm User**. Netfangið þarf ekki að vera til.
2. Í **SQL Editor**:
   ```sql
   insert into stillingar_innri (lykill, gildi)
   select 'afhending_notandi', id::text from auth.users
    where email = 'afhending@tveir.is'
   on conflict (lykill) do update set gildi = excluded.gildi;
   ```
3. Á script.google.com: **Project Settings -> Script Properties -> Add
   script property**. Tvær línur: `AFHENDING_NETFANG` =
   `afhending@tveir.is` og `AFHENDING_LYKILORD` = lykilorðið. Aldrei í
   kóðann sjálfan.

Þessi notandi má lesa skrár undirverka sem er lokið og ekkert annað. Hann
sér engin gögn viðskiptavina, ekkert fyrirtæki og enga aðra skrá (eins og
allir innskráðir sér hann bara nöfnin ykkar Óskars). Hann birtist á
notendalistanum á stjórnborðinu: **tengdu hann aldrei við fyrirtæki**. Við notum hann en ekki
`service_role` lykilinn, því sá lykill opnar allan gagnagrunninn og á
hvergi heima utan Supabase. Hver sem fær hlekkinn úr póstinum getur sótt
skrána í 7 daga, nákvæmlega eins og með WeTransfer hlekk.

**Öryggisatriði sem þarf að laga fyrst.** Kaflinn **Innskráning með
lykilorði** segir að slökkva á **Allow new users to sign up**. Meðan
kveikt er á því getur hver sem er búið til aðgang og gert sig að admin,
og þá líka séð og breytt undirverkum. Kláraðu það áður en þetta fer í
notkun.

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

---

## Verk í tölvupósti: verk@tveir.is

Viðskiptavinur sendir póst á **verk@tveir.is** og hann verður að task á listanum
hans. Ef pósturinn er listi verður hver liður sinn taskur:

- línur sem byrja á `-`, `•`, `1.` eða `1)`, eða
- 2 til 15 stuttar línur án merkja, til dæmis `hanna logo` / `laga vefsíðu` /
  `finna bolta`. Kveðju efst (Hæ Jón,), inngangslínu sem endar á tvípunkti og
  undirskrift neðst (Kveðja, nafn, sími, netfang, Sent úr iPhone) er sleppt.

Annars, til dæmis venjulegur póstur í heilum setningum eða spurning, verður
efnislínan titill og textinn lýsing. Hver taskur úr lista fær allan póstinn í
lýsinguna, svo ekkert týnist þótt skiptingin fari fram hjá einhverju.
Póstur frá @tveir.is verður aldrei að task.

- `verk@tveir.is` er aukanetfang (alias) á tveir@tveir.is í Google Workspace.
- Skriftan `verk-postur.gs` keyrir á script.google.com í reikningnum
  tveir@tveir.is á 5 mínútna fresti. Hún svarar sendanda með lista yfir það
  sem fór inn.
- Hún kallar á fallið `taskur_ur_posti` (kafli 16 í `gagnagrunnur.sql`). Það
  býr bara til task, og bara ef sendandinn er skráður notandi hjá viðskiptavini.
  Lykillinn sem skriftan notar liggur í töflunni `stillingar_innri`, sem enginn
  kemst í utan fallsins.
- Óþekktir sendendur fá ekkert svar. Pósturinn fær merkið **Verk/Othekkt** í
  Gmail.
- Teams: Power Automate (Workflows í Teams) hjá viðskiptavininum getur sent
  hvert skeyti í rás sem póst á verk@tveir.is. Þá þarf ekkert nýtt hjá okkur.

## Póstur strax: vefapp skriftunnar

Þegar taskur eða undirverk er hakað í lokið kallar gagnagrunnurinn strax á
skriftuna, og viðskiptavinurinn fær póstinn innan nokkurra sekúndna. 5 mínútna
vaktin er áfram til vara. Þetta notar `pg_net` í Supabase og fallið
`vekja_postinn` (kafli 19 í `gagnagrunnur.sql`).

Uppsetning, einu sinni:

1. script.google.com, verkefnið verk-postur: **Deploy** > **New deployment**.
2. Tannhjólið við **Select type** > **Web app**.
3. **Execute as:** Me (tveir@tveir.is). **Who has access:** Anyone. Ekki
   "Anyone within Tveir", því Supabase er ekki innskráð hjá Google.
4. **Deploy**, leyfa aðganginn, og afrita **Web app URL** (endar á `/exec`).
5. Í SQL Editor í Supabase:

   ```sql
   insert into stillingar_innri (lykill, gildi)
   values ('postur_vefkrokur', 'https://script.google.com/macros/s/.../exec')
   on conflict (lykill) do update set gildi = excluded.gildi;
   ```

6. Prófa: haka í lokið á prufutask og athuga að pósturinn komi innan mínútu.
   Svarið frá Google sést í `select status_code, content from net._http_response
   order by created desc limit 5;` (`ok` er gott, `nei` þýðir rangan lykil,
   `gamalt` þýðir gamla útgáfu).

**Eftir hverja breytingu á kóðanum** (þar á meðal nýjan LYKILL):

1. Hækka `UTGAFA` efst í skriftunni og vista.
2. **Deploy** > **Manage deployments** > blýanturinn > **Version: New version**
   > **Deploy**. Slóðin helst sú sama.

Gleymist skref 2 sendir vefappið ekkert. 5 mínútna vaktin sendir þá póstinn með
nýja kóðanum og tveir@tveir.is fær einn póst um að birta nýja útgáfu.

---

## Tölfræði

Síðan **Tölfræði** (`tolfraedi.html`) sýnir fylgjendur, áhorf, náð, samskipti og
færslur hvers viðskiptavinar dag frá degi. Þið sjáið öll fyrirtæki,
viðskiptavinur sér bara sitt. Fyrsta hvers mánaðar verða til drög að
mánaðarskýrslu sem þú lest yfir og samþykkir með einum smelli, og þá fær
viðskiptavinurinn fallegan póst.

### Hvaðan tölurnar koma

| Miðill | Hvernig |
| --- | --- |
| Instagram | Sjálfvirkt á hverjum morgni um kl. 6, í gegnum Meta |
| Facebook síða | Sjálfvirkt á hverjum morgni um kl. 6, í gegnum Meta |
| TikTok | Slegið inn eða CSV skrá á síðunni, þar til TikTok samþykkir API aðgang |

Skriftan `tolfraedi.gs` sækir síðustu þrjá daga í hvert sinn, því Meta lagar
tölurnar sínar í allt að tvo sólarhringa eftir á. Tölur sem þið slóguð inn
sjálf ganga alltaf fyrir, sjálfvirka söfnunin skrifar aldrei yfir þær.

Hvað hver tala þýðir:

| Á síðunni | Instagram | Facebook |
| --- | --- | --- |
| Áhorf | `views` | `page_media_view` |
| Náð | `reach` | `page_total_media_view_unique` |
| Samskipti | `total_interactions` | `page_post_engagements` |
| Heimsóknir | `profile_views` ef Meta skilar því enn | `page_views_total` |
| Fylgjendur | fjöldinn um morguninn, skráður á gærdaginn | sama |

Gott að vita:

- Meta hætti með `impressions` árið 2025. `views` kom í staðinn, svo tölur frá
  því fyrir 2025 eru ekki sambærilegar.
- Náð á dag lögð saman yfir mánuð er ekki fjöldi ólíkra manna, því sami maður
  getur sést marga daga. Hún sýnir samt vel hvort gengur upp eða niður.
- Dagur Facebook endar á miðnætti í Kaliforníu, um kl. 8 að morgni hjá okkur.
- Sögur (stories) á Instagram eru ekki sóttar, Meta geymir tölur þeirra bara í
  sólarhring.
- Smámyndir af færslum koma frá Meta og hætta að virka eftir nokkra daga eða
  vikur. Tölurnar haldast.

### Að setja það upp (einu sinni)

**1. Gagnagrunnurinn.** Í Supabase verkefninu **Tveir.is CRM**: **SQL Editor
-> New query**, límdu inn allt úr `migrations/2026-11-18-tolfraedi.sql` og ýttu
á **Run**. Það á að enda á `Success. No rows returned`. Það má keyra aftur án
skaða. Sama efni er kafli 21 í `gagnagrunnur.sql`.

**2. Vefurinn.** Nýju og breyttu skrárnar fara á Vercel eins og venjulega.

**3. Viðskiptavinirnir gefa Tveir aðgang.** Hver viðskiptavinur þarf að hafa
Facebook síðu, og Instagram reikninginn sem **fagreikning** (Business eða
Creator) tengdan þeirri síðu. Svo:

1. Farðu á **business.facebook.com**, skráð inn sem þú, og veldu **Tveir** efst
   til vinstri.
2. **Settings** (tannhjólið) -> **Accounts** -> **Pages** -> **Add** ->
   **Request access to a Page**. Skrifaðu nafn síðunnar og veldu aðgang að
   **Content** og **Insights**.
3. **Accounts** -> **Instagram accounts** -> **Add** -> **Request access**, og
   sama fyrir Instagram reikninginn.
4. Viðskiptavinurinn fær tilkynningu í sínu Meta Business og samþykkir. Þar til
   það er gert kemur engin tala.

**4. Meta appið.** Þetta er bara gert einu sinni fyrir alla viðskiptavini.

1. Farðu á **developers.facebook.com**, skráð inn sem þú. Ef þú ert ekki með
   þróunaraðgang: **Get Started** og fylgdu skrefunum (staðfesta símanúmer).
2. **My Apps** -> **Create App**.
3. Nafn: `Tveir tölfræði`. Netfang: `tveir@tveir.is`. **Next**.
4. Við spurninguna hvað appið á að gera: veldu **Other**, svo **Business** sem
   tegund. **Next**.
5. **Business portfolio**: veldu **Tveir**. **Create app** og staðfestu með
   lykilorðinu þínu.
6. Á yfirlitssíðu appsins: **Add product** við **Instagram** og veldu **API
   setup with Facebook login**. Gerðu það sama við **Facebook Login for
   Business**.
7. **App settings** -> **Basic**: settu inn slóðina á persónuverndarstefnuna á
   tveir.is í **Privacy policy URL**, veldu flokk og ýttu á **Save changes**.
8. Efst á síðunni: skiptu **App Mode** úr **Development** í **Live**.
9. Valkvætt en betra: í **App settings** -> **Basic** ýttu á **Show** við **App
   secret** og afritaðu hann. Hann fer í skref 6 hér að neðan.

**5. Kerfisnotandinn og lykillinn.** Kerfisnotandi (System User) er
"starfsmaður" sem er ekki manneskja. Lykillinn hans rennur ekki út þótt þú
skiptir um lykilorð.

1. Aftur á **business.facebook.com** -> **Settings** -> **Users** -> **System
   users** -> **Add**.
2. Nafn: `Tveir tölfræði`. Hlutverk: **Employee**. **Create system user**.
3. Veldu hann -> **Assign assets**.
   - **Apps**: hakaðu í `Tveir tölfræði` og veldu **Manage app**.
   - **Pages**: hakaðu í síður viðskiptavinanna, og veldu **Content** og
     **Insights** (eða **Full control** ef færslurnar koma ekki).
   - **Instagram accounts**: hakaðu í reikningana, sama aðgang.
   - **Save changes**.
   Gerðu þetta aftur fyrir hvern nýjan viðskiptavin. Að síða sé í Tveir dugar
   ekki ein og sér, kerfisnotandinn þarf að fá hana líka.
4. **Generate new token**. App: `Tveir tölfræði`. **Token expiration: Never**.
5. Hakaðu í þessar heimildir og engar aðrar:
   `pages_show_list`, `pages_read_engagement`, `read_insights`,
   `instagram_basic`, `instagram_manage_insights`, `business_management`.
6. **Generate token** og afritaðu lykilinn strax. Meta sýnir hann bara einu
   sinni. Ekki senda hann í pósti eða á Slack, límdu hann beint í næsta skref.

**6. Lykillinn inn í Google skriftuna.** Á script.google.com, skráð inn sem
tveir@tveir.is, opnaðu verkefnið með `verk-postur.gs`:

1. **Project Settings** (tannhjólið til vinstri) -> **Script Properties** ->
   **Add script property**.
2. Property: `META_TOKEN`, Value: lykillinn úr skrefi 5. **Save script
   properties**.
3. Valkvætt: önnur lína, `META_APP_SECRET` = app secret úr skrefi 4.9. Þá
   fylgir hverju kalli undirskrift og stolinn lykill einn og sér gagnast minna.

Lyklar fara aldrei í kóðann sjálfan og aldrei á vefinn.

**7. Nýja skráin í skriftuna.**

1. Í **Editor** (`< >` til vinstri): ýttu á **+** við **Files** -> **Script**.
   Nefndu hana `tolfraedi` (Google bætir `.gs` við).
2. Afritaðu **allt** úr `tolfraedi.gs` hér og límdu inn í nýju skrána.
3. Opnaðu `verk-postur.gs` í sama verkefni, afritaðu **allt** úr nýju
   `verk-postur.gs` og límdu yfir. `ANON` og `LYKILL` eru í Script Properties
   (sjá kaflann Undirverk), ekki í kóðanum, svo þeim þarf ekki að breyta.
4. **Save** (diskurinn).
5. Efst: veldu fallið `setjaTolfraedi` í fellilistanum og ýttu á **Run**. Google
   biður um leyfi: **Review permissions** -> tveir@tveir.is -> **Allow**. Þetta
   setur upp söfnunina kl. 6 á hverjum morgni og keyrir hana einu sinni strax.
   5 mínútna vaktin helst óbreytt.
6. **Deploy** -> **Manage deployments** -> blýanturinn -> **Version: New
   version** -> **Deploy**. Útgáfan hækkaði, og annars sendir vefappið ekkert
   (sjá Póstur strax).
7. **Executions** til vinstri: línurnar sem byrja á `Tölfræði:` segja hvað
   klikkaði. Engin slík lína þýðir að allt fór inn.

`setja()` eyðir núna bara gömlum 5 mínútna vöktum, ekki tölfræðivaktinni. Ef
einhver keyrir gamla útgáfu af `setja()` hverfur tölfræðivaktin: keyrðu þá
`setjaTolfraedi` aftur.

**8. Miðlarnir inn á vinnusvæðið.** Á **Tölfræði**: veldu fyrirtækið ->
**Nýr miðill** (fyrsti miðillinn fer inn beint á síðunni, undir **Tengdu
fyrsta miðilinn**) -> **Tengja miðil**. **Auðkenni hjá miðlinum** er númerið
hér að neðan, ekki notandanafnið. Án þess safnast ekkert sjálfvirkt, en þið getið slegið tölur inn.

*Facebook síðu ID:* á **business.facebook.com** -> **Settings** -> **Accounts**
-> **Pages** -> smelltu á síðuna. Númerið stendur undir nafninu (til dæmis
`104512345678901`). Líka á síðunni sjálfri: **About** -> **Page transparency**
-> **Page ID**.

*Instagram ID:* það er annað en notandanafnið og byrjar oftast á `17841`.

1. Farðu á **developers.facebook.com/tools/explorer**.
2. Til hægri: **Meta App** = `Tveir tölfræði`. Límdu lykil kerfisnotandans í
   **Access Token** reitinn.
3. Skrifaðu í línuna efst:
   `me/accounts?fields=name,id,instagram_business_account{id,username}`
   og ýttu á **Submit**.
4. Hver síða birtist með `id` (Facebook síðu ID) og undir
   `instagram_business_account` er `id` (Instagram ID) og `username`.
5. Lokaðu flipanum á eftir, lykillinn á ekki að liggja þar.

Sjáist síða ekki í listanum hefur kerfisnotandinn ekki fengið hana (skref 5.3).
Vanti `instagram_business_account` er Instagram reikningurinn ekki fagreikningur
eða ekki tengdur síðunni.

### Þarf Meta App Review?

Líklega ekki til að byrja með. Meta segir að **Standard Access** dugi fyrir
reikninga sem fyrirtækið þitt á eða stýrir, og síðurnar eru í Tveir Business
með samþykki viðskiptavinanna.

Ef Executions sýnir villu með **kóða 10** eða **kóða 200** (heimild vantar)
þótt kerfisnotandinn hafi síðuna, þarf **Advanced Access**:

1. **Business Verification** fyrst: **business.facebook.com** -> **Settings**
   -> **Security Centre** -> **Start verification**. Þarf kennitölu Tveir ehf.,
   heimilisfang og síma eða lén. Tekur nokkra daga.
2. Á developers.facebook.com -> appið -> **App Review** -> **Permissions and
   features**: biðja um Advanced Access fyrir `instagram_basic`,
   `instagram_manage_insights`, `pages_read_engagement` og `read_insights`.
   Meta vill stutt myndband sem sýnir hvernig tölurnar eru notaðar (upptaka af
   Tölfræði síðunni dugar) og lýsingu. Það getur tekið frá nokkrum dögum upp í
   nokkrar vikur.

TikTok þarf sitt eigið samþykki hjá TikTok for Developers. Þangað til eru
tölurnar slegnar inn eða fluttar inn úr CSV á síðunni.

### Mánaðarskýrslurnar

1. Fyrsta hvers mánaðar um kl. 6 verða til drög fyrir hvert fyrirtæki með
   miðla, og tveir@tveir.is fær póstinn **Mánaðarskýrslur <mánuður> bíða
   yfirferðar**.
2. Opnaðu **Tölfræði**, veldu fyrirtækið og lestu drögin. Lagaðu samantektina
   ef þarf og ýttu á **Vista**.
3. **Samþykkja og senda**. Pósturinn fer innan nokkurra sekúndna (í síðasta
   lagi eftir 5 mínútur) á alla notendur fyrirtækisins á vinnusvæðinu.
4. Ekkert fer á viðskiptavininn án þess að þú samþykkir.

Samantektin kemur úr föstu sniðmáti sem segir bara það sem tölurnar segja, til
dæmis "Í nóvember voru áhorf samtals 48.210. Það er 12% meira en í október."
Hún giskar aldrei á ástæður.

**Valkvætt: Claude skrifar samantektina.** Settu Script Property
`ANTHROPIC_API_KEY` (lykill af console.anthropic.com). Claude fær bara tölurnar,
hvorki nafn fyrirtækisins né texta færslna. Nefni Claude tölu sem það fékk ekki,
eða klikki eitthvað, er sniðmátið notað í staðinn. Það kostar um 2 krónur á
fyrirtæki á mánuði (Claude Opus 5.5). Án lykilsins kostar ekkert.

Klikki skýrslugerðin fyrsta daginn reynir skriftan aftur annan og þriðja
daginn. Hún býr aldrei til drög tvisvar fyrir sama mánuð (Script Property
`skyrslur_manudur` heldur utan um það).

### Hvað þetta kostar

| | |
| --- | --- |
| Meta Graph API | 0 kr. |
| Google skriftan | 0 kr., langt undir mörkum Google |
| Claude samantekt | valkvætt, um 2 kr. á fyrirtæki á mánuði |

Meta breytir útgáfum og mælingum reglulega. Skriftan notar `v26.0`
(`META_GRAPH` efst í `tolfraedi.gs`). Þegar Meta sendir póst um að útgáfa eða
mæling hætti: hækka útgáfuna þar, vista og birta nýja útgáfu. Hætti Meta með
eina mælingu heldur söfnunin áfram með hinar, og Executions segir hver féll.
