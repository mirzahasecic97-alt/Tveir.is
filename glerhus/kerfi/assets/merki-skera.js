/* ==========================================================================
   Glerhúsið: merkið stillt áður en því er hlaðið upp.
   skeraMerki(skra) opnar glugga þar sem notandinn þysjar, dregur merkið til
   og velur lögun (breitt eða ferningur). Sér strax hvernig það lítur út í
   hausnum. Skilar nýrri PNG skrá, eða null ef hætt var við.
   Gegnsæi heldur sér. Auðar gegnsæjar brúnir eru skornar af strax svo
   merkið fylli rammann.
   ========================================================================== */

const LOGUN = {
  breitt: { b: 600, h: 150, heiti: 'Breitt' },     /* hausinn sýnir mest 150 x 34 */
  ferningur: { b: 300, h: 300, heiti: 'Ferningur' }
};
const MEST = 2 * 1024 * 1024;

let stillt = false;
function setjaStil() {
  if (stillt) return; stillt = true;
  const s = document.createElement('style');
  s.textContent = `
.mskera { border: none; border-radius: 18px; padding: 0; width: min(560px, calc(100vw - 32px)); max-height: calc(100vh - 32px);
  background: var(--card, #fff); color: var(--ink, #14213d); box-shadow: 0 24px 60px rgba(0,0,0,.28); }
.mskera::backdrop { background: rgba(10,16,30,.45); }
.mskera__inn { padding: 20px; display: grid; gap: 14px; }
.mskera h2 { margin: 0; font-size: 1.15rem; }
.mskera__lysing { margin: 0; font-size: .9rem; opacity: .75; }
.mskera__rammi { position: relative; width: 100%; border-radius: 12px; overflow: hidden; touch-action: none; cursor: grab;
  outline: 2px solid var(--acc, #5b93f0); outline-offset: 0;
  background-color: #fff; background-image: linear-gradient(45deg,#e6e9ef 25%,transparent 25%),linear-gradient(-45deg,#e6e9ef 25%,transparent 25%),
  linear-gradient(45deg,transparent 75%,#e6e9ef 75%),linear-gradient(-45deg,transparent 75%,#e6e9ef 75%);
  background-size: 18px 18px; background-position: 0 0,0 9px,9px -9px,-9px 0; }
.mskera__rammi.er-dregid { cursor: grabbing; }
.mskera__rammi.er-ferningur { width: min(100%, 280px); justify-self: center; }
.mskera__rammi canvas { display: block; width: 100%; height: auto; }
.mskera__rad { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.mskera__rad input[type=range] { flex: 1; min-width: 160px; accent-color: var(--acc, #5b93f0); }
.mskera__haus { display: flex; align-items: center; gap: 12px; padding: 10px 14px; border-radius: 12px;
  background: var(--bg, #f3f5f9); font-size: .85rem; }
.mskera__haus img { max-height: 34px; max-width: 150px; width: auto; object-fit: contain; }
.mskera__takkar { display: flex; justify-content: flex-end; gap: 10px; flex-wrap: wrap; }
.mskera__logun { display: inline-flex; gap: 6px; }
.mskera__logun button[aria-pressed="true"] { background: var(--acc, #5b93f0) !important; color: var(--acc-texti, #fff) !important; border-color: transparent !important; }
`;
  document.head.append(s);
}

function hladaMynd(skra) {
  return new Promise((leysa, hafna) => {
    const slod = URL.createObjectURL(skra);
    const m = new Image();
    m.onload = () => leysa({ m, slod });
    m.onerror = () => { URL.revokeObjectURL(slod); hafna(new Error('Það tókst ekki að lesa myndina.')); };
    m.src = slod;
  });
}

/* Svæðið sem er ekki gegnsætt. Ef myndin hefur ekkert gegnsæi er öll myndin notuð. */
function efniMyndar(m) {
  const B = m.naturalWidth, H = m.naturalHeight;
  const k = Math.min(1, 600 / Math.max(B, H));
  const b = Math.max(1, Math.round(B * k)), h = Math.max(1, Math.round(H * k));
  const c = document.createElement('canvas'); c.width = b; c.height = h;
  const x = c.getContext('2d', { willReadFrequently: true });
  x.drawImage(m, 0, 0, b, h);
  let d;
  try { d = x.getImageData(0, 0, b, h).data; } catch (e) { return { x: 0, y: 0, b: B, h: H }; }
  let x0 = b, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) for (let i = 0; i < b; i++) {
    if (d[(y * b + i) * 4 + 3] > 8) { if (i < x0) x0 = i; if (i > x1) x1 = i; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  }
  if (x1 < 0) return { x: 0, y: 0, b: B, h: H };
  return { x: x0 / k, y: y0 / k, b: (x1 - x0 + 1) / k, h: (y1 - y0 + 1) / k };
}

function takki(texti, flokkur, smella) {
  const t = document.createElement('button');
  t.type = 'button'; t.className = flokkur; t.textContent = texti;
  t.addEventListener('click', smella);
  return t;
}

export async function skeraMerki(skra) {
  if (!skra) return null;
  setjaStil();
  const { m, slod } = await hladaMynd(skra);
  const efni = efniMyndar(m);
  let logun = efni.b / efni.h < 1.6 ? 'ferningur' : 'breitt';
  let kvardi = 1, dx = 0, dy = 0;   /* kvardi 1 = passar inn í rammann; dx, dy í pixlum útkomunnar */

  const glugi = document.createElement('dialog');
  glugi.className = 'mskera';
  const inn = document.createElement('div'); inn.className = 'mskera__inn';
  const fyrirsogn = document.createElement('h2'); fyrirsogn.textContent = 'Stilltu merkið';
  const lysing = document.createElement('p'); lysing.className = 'mskera__lysing';
  lysing.textContent = 'Dragðu merkið til og þysjaðu inn eða út. Það sem er innan rammans fer í hausinn.';
  const rammi = document.createElement('div'); rammi.className = 'mskera__rammi';
  const strigi = document.createElement('canvas'); rammi.append(strigi);

  const logunarTakkar = document.createElement('div'); logunarTakkar.className = 'mskera__logun';
  const tBreitt = takki(LOGUN.breitt.heiti, 'btn btn--sm btn--ghost', () => skiptaLogun('breitt'));
  const tFern = takki(LOGUN.ferningur.heiti, 'btn btn--sm btn--ghost', () => skiptaLogun('ferningur'));
  logunarTakkar.append(tBreitt, tFern);

  const sledi = document.createElement('input');
  sledi.type = 'range'; sledi.min = '0.3'; sledi.max = '4'; sledi.step = '0.01'; sledi.value = '1';
  sledi.setAttribute('aria-label', 'Stærð merkisins');
  const minna = takki('−', 'btn btn--sm btn--ghost', () => setjaKvarda(kvardi / 1.15));
  minna.setAttribute('aria-label', 'Minnka');
  const meira = takki('+', 'btn btn--sm btn--ghost', () => setjaKvarda(kvardi * 1.15));
  meira.setAttribute('aria-label', 'Stækka');
  const midja = takki('Miðja', 'btn btn--sm btn--ghost', () => { kvardi = 1; dx = 0; dy = 0; sledi.value = '1'; teikna(); });

  const rad1 = document.createElement('div'); rad1.className = 'mskera__rad';
  const lLogun = document.createElement('span'); lLogun.className = 'skyring'; lLogun.textContent = 'Lögun';
  rad1.append(lLogun, logunarTakkar);
  const rad2 = document.createElement('div'); rad2.className = 'mskera__rad';
  rad2.append(minna, sledi, meira, midja);

  const haus = document.createElement('div'); haus.className = 'mskera__haus';
  const hausMynd = document.createElement('img'); hausMynd.alt = '';
  const hausTexti = document.createElement('span'); hausTexti.className = 'skyring'; hausTexti.textContent = 'Svona lítur það út í hausnum';
  haus.append(hausMynd, hausTexti);

  const takkar = document.createElement('div'); takkar.className = 'mskera__takkar';
  let svar = null;
  const haetta = takki('Hætta við', 'btn btn--ghost', () => glugi.close());
  const nota = takki('Nota merkið', 'btn', async () => {
    nota.disabled = true; nota.textContent = 'Augnablik';
    svar = await utkoma();
    glugi.close();
  });
  takkar.append(haetta, nota);

  inn.append(fyrirsogn, lysing, rammi, rad1, rad2, haus, takkar);
  glugi.append(inn);
  document.body.append(glugi);

  function stadall() {
    const L = LOGUN[logun];
    /* Kvardi 1: efni merkisins passar inn í rammann með smá spássíu */
    const k = Math.min(L.b * 0.92 / efni.b, L.h * 0.86 / efni.h);
    return { L, k: k * kvardi };
  }
  function teiknaA(c, L, kk) {
    const x = c.getContext('2d');
    x.clearRect(0, 0, L.b, L.h);
    x.imageSmoothingQuality = 'high';
    const b = m.naturalWidth * kk, h = m.naturalHeight * kk;
    const midX = L.b / 2 + dx - (efni.x + efni.b / 2) * kk;
    const midY = L.h / 2 + dy - (efni.y + efni.h / 2) * kk;
    x.drawImage(m, midX, midY, b, h);
  }
  let forsyn = 0;
  function teikna() {
    const { L, k } = stadall();
    strigi.width = L.b; strigi.height = L.h;
    rammi.classList.toggle('er-ferningur', logun === 'ferningur');
    teiknaA(strigi, L, k);
    tBreitt.setAttribute('aria-pressed', String(logun === 'breitt'));
    tFern.setAttribute('aria-pressed', String(logun === 'ferningur'));
    cancelAnimationFrame(forsyn);
    forsyn = requestAnimationFrame(() => { try { hausMynd.src = strigi.toDataURL('image/png'); } catch (e) { /* sleppum */ } });
  }
  function setjaKvarda(k) {
    kvardi = Math.min(4, Math.max(0.3, k));
    sledi.value = String(kvardi);
    teikna();
  }
  function skiptaLogun(ny) { logun = ny; dx = 0; dy = 0; teikna(); }

  sledi.addEventListener('input', () => setjaKvarda(Number(sledi.value)));
  rammi.addEventListener('wheel', (e) => { e.preventDefault(); setjaKvarda(kvardi * (e.deltaY < 0 ? 1.06 : 1 / 1.06)); }, { passive: false });

  /* Dregið með mús eða fingri; tveir fingur þysja */
  const fingur = new Map();
  let upphafsBil = 0, upphafsKvardi = 1;
  const hlutfall = () => LOGUN[logun].b / rammi.getBoundingClientRect().width;
  rammi.addEventListener('pointerdown', (e) => {
    rammi.setPointerCapture(e.pointerId); fingur.set(e.pointerId, { x: e.clientX, y: e.clientY });
    rammi.classList.add('er-dregid');
    if (fingur.size === 2) { const [a, b] = [...fingur.values()]; upphafsBil = Math.hypot(a.x - b.x, a.y - b.y); upphafsKvardi = kvardi; }
  });
  rammi.addEventListener('pointermove', (e) => {
    const adur = fingur.get(e.pointerId); if (!adur) return;
    const nu = { x: e.clientX, y: e.clientY }; fingur.set(e.pointerId, nu);
    if (fingur.size === 2) {
      const [a, b] = [...fingur.values()]; const bil = Math.hypot(a.x - b.x, a.y - b.y);
      if (upphafsBil > 0) setjaKvarda(upphafsKvardi * bil / upphafsBil);
      return;
    }
    const h = hlutfall(); dx += (nu.x - adur.x) * h; dy += (nu.y - adur.y) * h; teikna();
  });
  const sleppa = (e) => { fingur.delete(e.pointerId); if (!fingur.size) rammi.classList.remove('er-dregid'); };
  rammi.addEventListener('pointerup', sleppa);
  rammi.addEventListener('pointercancel', sleppa);
  /* Örvatakkar færa, + og - þysja */
  glugi.addEventListener('keydown', (e) => {
    if (e.target === sledi) return;
    const skref = e.shiftKey ? 20 : 5;
    if (e.key === 'ArrowLeft') dx -= skref; else if (e.key === 'ArrowRight') dx += skref;
    else if (e.key === 'ArrowUp') dy -= skref; else if (e.key === 'ArrowDown') dy += skref;
    else if (e.key === '+' || e.key === '=') return setjaKvarda(kvardi * 1.1);
    else if (e.key === '-') return setjaKvarda(kvardi / 1.1);
    else return;
    e.preventDefault(); teikna();
  });

  async function utkoma() {
    const { L, k } = stadall();
    const c = document.createElement('canvas'); c.width = L.b; c.height = L.h;
    teiknaA(c, L, k);
    let blob = await new Promise((r) => c.toBlob(r, 'image/png'));
    if (blob && blob.size > MEST) blob = await new Promise((r) => c.toBlob(r, 'image/webp', 0.92));
    if (!blob) return null;
    const endir = blob.type === 'image/webp' ? 'webp' : 'png';
    return new File([blob], 'merki.' + endir, { type: blob.type });
  }

  teikna();
  return new Promise((leysa) => {
    glugi.addEventListener('close', () => { URL.revokeObjectURL(slod); glugi.remove(); leysa(svar); }, { once: true });
    glugi.showModal();
    nota.focus();
  });
}
