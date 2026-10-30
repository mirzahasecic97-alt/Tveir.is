/* ==========================================================================
   Tveir vinnusvæði — stillingar
   Þetta er eina skráin sem þarf að breyta til að tengja við Supabase.
   ========================================================================== */

export const stillingar = {
  /* Prufustilling. Á true keyrir vinnusvæðið á sýnidæmum í vafranum þínum
     og ekkert fer út á netið. Settu false þegar Supabase er tilbúið. */
  prufa: true,

  /* Supabase -> Project Settings -> API */
  supabaseUrl: '',
  supabaseAnonKey: '',

  /* Hvert innskráningarhlekkurinn úr póstinum skal lenda */
  slod: 'https://tveir.is/vinnusvaedi/',

  /* Hvað þurfum við að fá á tímann til að þetta borgi sig. Verð á verkefni
     deilt með skráðum tímum birtist rautt á stjórnborðinu ef það fer undir
     þessa tölu. Bara fyrir okkur, viðskiptavinur sér hana aldrei. */
  timagjald: 12000
};

/* anon key er ætlaður til að vera opinber. Það sem ver gögnin er Row Level
   Security í gagnagrunninum, sjá gagnagrunnur.sql. Service role lykillinn
   fer aldrei hingað inn. */
