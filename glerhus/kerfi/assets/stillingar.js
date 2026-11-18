/* ==========================================================================
   Glerhúsið á tveir.is: stillingar
   Þetta er eina skráin sem þarf að breyta til að tengja við Supabase.
   ========================================================================== */

export const stillingar = {
  /* Prufustilling. Á true keyrir vinnusvæðið á sýnidæmum í vafranum þínum
     og ekkert fer út á netið. Settu false þegar Supabase er tilbúið. */
  prufa: false,

  /* Supabase -> Project Settings -> API */
  supabaseUrl: 'https://wusqvolbwjysnjrfahjy.supabase.co',
  supabaseAnonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind1c3F2b2xid2p5c25qcmZhaGp5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQ2MDQ2NDQsImV4cCI6MjExMDE4MDY0NH0.CBEC8wLhLORbtr4QcFBfc_eWfa-nkk5qcO2EH1yIeCI',

  /* Hvert innskráningarhlekkurinn úr póstinum skal lenda */
  slod: 'https://tveir.is/glerhus/kerfi/',

  /* Hvað þurfum við að fá á tímann til að þetta borgi sig. Verð á verkefni
     deilt með skráðum tímum birtist rautt á stjórnborðinu ef það fer undir
     þessa tölu. Bara fyrir okkur, viðskiptavinur sér hana aldrei. */
  timagjald: 15500,

  /* Stærsta skrá sem má setja á undirverk, í MB. Supabase Free leyfir
     mest 50 MB á skrá. Stærri myndbönd fara á WeTransfer eða Google Drive
     og hlekkurinn er límdur inn. Á Pro má hækka þetta, en þá þarf líka að
     hækka hámarkið í Supabase: Storage -> Settings. */
  undirverkHamarkMb: 50,

  /* Harvey spjallið í hausnum. Þarf fallið api/harvey.js á Vercel og
     ANTHROPIC_API_KEY þar. Slökkt þangað til það er sett upp. */
  harvey: false
};

/* anon key er ætlaður til að vera opinber. Það sem ver gögnin er Row Level
   Security í gagnagrunninum, sjá gagnagrunnur.sql. Service role lykillinn
   fer aldrei hingað inn. */
