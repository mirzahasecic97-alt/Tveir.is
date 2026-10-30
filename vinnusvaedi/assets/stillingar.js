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
  slod: 'https://tveir.is/vinnusvaedi/'
};

/* anon key er ætlaður til að vera opinber. Það sem ver gögnin er Row Level
   Security í gagnagrunninum, sjá gagnagrunnur.sql. Service role lykillinn
   fer aldrei hingað inn. */
