/* ==========================================================================
   Tveir vinnusvæði — reikningurinn á bak við bókhaldið
   Bókhaldssíðan og stjórnborðið nota bæði þessa skrá, svo tölurnar eru
   alltaf þær sömu á báðum stöðum.

   Upphæðir eru geymdar án VSK nema færslan sé merkt vsklaus, þá er talan
   endanleg. Því fer allur reikningur fram í pari: [VSK-skylt, VSK-laust].
   Vinna í mánuði greiðist í næsta mánuði.
   ========================================================================== */

export const MAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Maí', 'Jún', 'Júl', 'Ágú', 'Sep', 'Okt', 'Nóv', 'Des'];
export const MAN_LANGT = ['janúar', 'febrúar', 'mars', 'apríl', 'maí', 'júní', 'júlí',
                          'ágúst', 'september', 'október', 'nóvember', 'desember'];
export const VSK = 0.24;
export const LYKILL_VSK = 'tveir-vsk';

/* ---------- pörin ---------- */
export const P = (a, b) => [a || 0, b || 0];
export const pPlus = (a, b) => [a[0] + b[0], a[1] + b[1]];
export const pAf = (r) => (r && r.vsklaust ? [0, Number(r.upphaed) || 0] : [Number(r && r.upphaed) || 0, 0]);
export const pAn = (p) => p[0] + p[1];
export const pMed = (p) => p[0] * (1 + VSK) + p[1];

/* ---------- mánuðir ---------- */
export const mk = (ar, i) => ar + '-' + String(i + 1).padStart(2, '0');
const nuDags = new Date();
export const NU_AR = nuDags.getFullYear();
export const NU_MAN = mk(NU_AR, nuDags.getMonth());
export const naestiMan = (m, n) => {
  const [a, mm] = m.split('-').map(Number);
  const d = new Date(a, mm - 1 + n, 1);
  return mk(d.getFullYear(), d.getMonth());
};
export const NAESTI = naestiMan(NU_MAN, 1);
export const manHeiti = (m) => MAN_LANGT[Number(m.slice(5, 7)) - 1];

/* Er notandinn með rofann á Með VSK? Sama stilling á öllum síðum. */
export function lesaMedVsk() {
  try { return localStorage.getItem(LYKILL_VSK) === '1'; } catch (e) { return false; }
}

/* Föll sem svara: hvað er fast og hvað kemur aukalega í mánuði m */
export function reiknivel(sam, auka) {
  const virkurI = (s, m) => s.hefst && s.hefst <= m && (!s.lykur || s.lykur >= m);
  const fastI = (m) => sam.reduce((t, s) => (virkurI(s, m) ? pPlus(t, pAf(s)) : t), P());
  const aukaI = (m, kannski) => auka.reduce((t, a) =>
    (String(a.dags || '').slice(0, 7) === m && (a.stada === 'kannski') === !!kannski
      ? pPlus(t, pAf(a)) : t), P());
  return { virkurI, fastI, aukaI };
}
