// Paysages pixel art dessinés par le code, pour les mondes qui n'ont pas encore d'image.
// 320×180 pixels (affichés ×6 sur un écran 1920×1080) : ciel en bandes tramées, reliefs en couches.
// Pour les remplacer par tes images : change le chemin du fond dans js/fond.js.
const L = 320, H = 180;

function hasard(graine) { // suite pseudo-aléatoire reproductible : le paysage est toujours le même
  return () => {
    graine = (graine + 0x6d2b79f5) | 0;
    let t = Math.imul(graine ^ (graine >>> 15), 1 | graine);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function ciel(ctx, couleurs) {
  const h = Math.ceil(H / couleurs.length);
  couleurs.forEach((c, i) => {
    ctx.fillStyle = c;
    ctx.fillRect(0, i * h, L, h);
    if (!i) return;
    ctx.fillStyle = couleurs[i - 1]; // tramage sur 2 lignes entre deux bandes
    for (let x = 0; x < L; x += 2) { ctx.fillRect(x, i * h, 1, 1); if (x % 4 === 0) ctx.fillRect(x + 1, i * h + 1, 1, 1); }
  });
}

function disque(ctx, cx, cy, r, couleur) {
  ctx.fillStyle = couleur;
  for (let dy = -r; dy <= r; dy++) { const w = Math.floor(Math.sqrt(r * r - dy * dy)); ctx.fillRect(cx - w, cy + dy, 2 * w + 1, 1); }
}

/** Une couche de relief : `forme(x)` donne la hauteur (0 à 1) ; `neige` colore le sommet des pics. */
function relief(ctx, { base, amplitude, couleur, forme, neige, hauteurNeige = 0 }) {
  for (let x = 0; x < L; x++) {
    const y = Math.round(base - amplitude * forme(x));
    ctx.fillStyle = couleur;
    ctx.fillRect(x, y, 1, H - y);
    if (neige && y < hauteurNeige) { ctx.fillStyle = neige; ctx.fillRect(x, y, 1, Math.min(4, hauteurNeige - y)); }
  }
}

const ondes = (alea, n, echelle) => {
  const phases = Array.from({ length: n }, () => [alea() * 6.28, 0.5 + alea()]);
  return x => phases.reduce((s, [p, f], i) => s + Math.sin((x / echelle) * f * (i + 1) + p) / (i + 1), 0) / 2 + 0.5;
};
const pics = (alea, n) => {
  const sommets = Array.from({ length: n }, (_, i) => [((i + alea() * 0.6) / n) * L, 0.4 + alea() * 0.6]);
  return x => Math.max(0, ...sommets.map(([sx, h]) => h - Math.abs(x - sx) / 45));
};

const DESSINS = {
  desert(ctx, alea) {
    ciel(ctx, ['#e0705a', '#ea8a5c', '#f2a464', '#f7bd70', '#fbd383', '#fde3a0']);
    disque(ctx, 220, 96, 22, '#fff1c0');
    relief(ctx, { base: 128, amplitude: 22, couleur: '#c9785a', forme: x => Math.min(1, Math.max(0.3, (Math.sin(x / 37) - 0.05) * 4)) }); // plateaux aux flancs en pente
    relief(ctx, { base: 142, amplitude: 12, couleur: '#e8a25c', forme: ondes(alea, 3, 40) });
    relief(ctx, { base: 156, amplitude: 10, couleur: '#d98a48', forme: ondes(alea, 2, 30) });
    relief(ctx, { base: 170, amplitude: 8, couleur: '#c27238', forme: ondes(alea, 2, 25) });
    for (const x of [40, 120, 268]) { // cactus
      ctx.fillStyle = '#4f7a34';
      ctx.fillRect(x, 146, 4, 20); ctx.fillRect(x - 5, 152, 4, 3); ctx.fillRect(x - 5, 146, 3, 7); ctx.fillRect(x + 5, 149, 4, 3); ctx.fillRect(x + 6, 143, 3, 7);
    }
  },
  glaces(ctx, alea) {
    ciel(ctx, ['#141c38', '#1e2a4a', '#2b3d66', '#3d5a88', '#5a80a8', '#86a8c8']);
    for (let i = 0; i < 90; i++) { ctx.fillStyle = alea() > 0.8 ? '#fff4dc' : '#a8b8e0'; ctx.fillRect(Math.floor(alea() * L), Math.floor(alea() * 80), 1, 1); }
    for (let x = 0; x < L; x++) { // aurore boréale
      const y = Math.round(40 + 14 * Math.sin(x / 30) + 6 * Math.sin(x / 11));
      ctx.fillStyle = '#6ee0b0'; ctx.fillRect(x, y, 1, 3);
      if (x % 2) { ctx.fillStyle = '#4fb8a0'; ctx.fillRect(x, y + 3, 1, 4); }
    }
    relief(ctx, { base: 130, amplitude: 70, couleur: '#7a96b8', forme: pics(alea, 6), neige: '#e8f2ff', hauteurNeige: 90 });
    relief(ctx, { base: 150, amplitude: 50, couleur: '#56739a', forme: pics(alea, 5), neige: '#c8dcf0', hauteurNeige: 118 });
    relief(ctx, { base: 168, amplitude: 6, couleur: '#c8dcf0', forme: ondes(alea, 2, 30) });
    ctx.fillStyle = '#a8c4e0'; for (let x = 0; x < L; x += 3) ctx.fillRect(x, 172 + (x % 2), 2, 1);
  },
  volcan(ctx, alea) {
    ciel(ctx, ['#2a0f1a', '#3e1420', '#5e1a22', '#83241f', '#a8381f', '#d8562a']);
    for (let i = 0; i < 70; i++) { ctx.fillStyle = alea() > 0.5 ? '#ff9a52' : '#5e3a3a'; ctx.fillRect(Math.floor(alea() * L), Math.floor(alea() * 110), 1, 1); }
    relief(ctx, { base: 140, amplitude: 20, couleur: '#3a1a20', forme: ondes(alea, 3, 35) });
    relief(ctx, { base: 168, amplitude: 120, couleur: '#2b1418', forme: x => Math.min(0.88, Math.max(0, 1 - Math.abs(x - 170) / 110)) });
    for (let y = 63; y < 168; y++) { // coulée de lave
      const x = Math.round(170 + 9 * Math.sin(y / 9) + (y - 63) * 0.25);
      ctx.fillStyle = '#ff8a2a'; ctx.fillRect(x - 2, y, 5, 1);
      ctx.fillStyle = '#ffd25a'; ctx.fillRect(x, y, 1, 1);
    }
    ctx.fillStyle = '#ffd25a'; ctx.fillRect(160, 62, 21, 2);
    relief(ctx, { base: 176, amplitude: 8, couleur: '#1a0c10', forme: ondes(alea, 2, 20) });
  },
};

export const THEMES = Object.keys(DESSINS);

/** Dessine un paysage et renvoie un canvas 320×180. */
export function paysage(theme) {
  const canvas = Object.assign(document.createElement('canvas'), { width: L, height: H });
  DESSINS[theme](canvas.getContext('2d'), hasard(theme.length * 7919));
  return canvas;
}
