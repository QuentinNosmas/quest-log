// Fond d'écran : le paysage du monde actuel.
// Il est agrandi d'un nombre ENTIER de fois (pixels toujours nets, jamais déformés) pour remplir tout l'écran,
// centré : ce qui dépasse sur les bords est rogné (sur téléphone en hauteur, on voit surtout le milieu de l'image).

import { paysage } from './paysages.js';

// Pour utiliser tes propres images : remplace les fichiers, ou change les chemins ici (png accepté).
// Les fonds écrits paysage('…') sont dessinés par le code (js/paysages.js) en attendant une image.
export const FONDS = {
  fond: 'assets/fonds/fond.png',
  crepuscule: 'assets/fonds/crepuscule.jpg',
  plaine: 'assets/fonds/plaine.jpg',
  lac: 'assets/fonds/lac.jpg',
  montagne: 'assets/fonds/montagne.jpg',
  automne: 'assets/fonds/automne.jpg',
  desert: () => paysage('desert'),
  glaces: () => paysage('glaces'),
  volcan: () => paysage('volcan'),
};

/** Le même fond partout, quel que soit le monde. Mets null pour que chaque monde ait de nouveau le sien. */
export const FOND_FIXE = 'fond';

const apercus = {};
/** Adresse d'une image du fond (pour les miniatures de la carte). */
export function apercuFond(nom) {
  const source = FONDS[nom] ?? FONDS.crepuscule;
  return typeof source === 'string' ? source : (apercus[nom] ??= source().toDataURL());
}

const canvas = document.createElement('canvas');
canvas.id = 'fond';
canvas.setAttribute('aria-hidden', 'true');
let image = null;

export async function afficherFond(nom) {
  try {
    const source = FONDS[nom] ?? FONDS.crepuscule;
    if (typeof source === 'string') {
      const img = new Image();
      img.src = source;
      await img.decode();
      image = img;
    } else image = source();
    if (!canvas.isConnected) document.body.prepend(canvas);
    dessiner();
  } catch (e) {
    console.warn('Fond introuvable :', nom, e); // la couleur de fond reste affichée
  }
}

function dessiner() {
  if (!image) return;
  const w = image.naturalWidth || image.width, h = image.naturalHeight || image.height;
  const dpr = window.devicePixelRatio || 1;
  const W = Math.ceil(innerWidth * dpr), H = Math.ceil(innerHeight * dpr); // en pixels réels de l'écran
  const s = Math.max(1, Math.ceil(W / w), Math.ceil(H / h)); // plus petit agrandissement entier qui couvre tout l'écran
  const cw = Math.ceil(W / s), ch = Math.ceil(H / s);
  canvas.width = cw;
  canvas.height = ch;
  canvas.style.width = `${(cw * s) / dpr}px`;
  canvas.style.height = `${(ch * s) / dpr}px`;

  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(image, Math.floor((cw - w) / 2), Math.floor((ch - h) / 2));
}

addEventListener('resize', () => requestAnimationFrame(dessiner));
