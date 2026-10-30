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

## Skrárnar

```
vinnusvaedi/
  index.html         innskráning
  yfirlit.html       það sem viðskiptavinurinn sér
  verk.html          eitt verkefni og taskar þess
  stjornbord.html    það sem við sjáum
  gagnagrunnur.sql   allar töflur og réttindi, keyrist einu sinni
  assets/
    stillingar.js    eina skráin sem þarf að breyta
    gogn.js          sækir gögnin, úr Supabase eða úr prufudæmum
    portal.js        sameiginlegt, haus, taskar, spjöld
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

- Viðhengi eru tilbúin í gagnagrunni og Storage en ekki komin í viðmótið
- Enginn póstur fer út fyrr en Make flæðið er sett upp
- Engin leitarsía á gömlum verkefnum, það kemur þegar listinn verður langur
