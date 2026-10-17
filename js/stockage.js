// Où vivent les données. TOUTE l'application passe par ce fichier pour lire et écrire.
// Aujourd'hui : le stockage du navigateur (localStorage) + fichiers de sauvegarde.
// Plus tard : une synchronisation en ligne s'ajoutera ici (mêmes fonctions, asynchrones),
// sans rien changer au reste de l'application.
import { dateISO } from './dates.js';
import { normaliser, nouvellesDonnees } from './donnees.js';

const CLE = 'quest-log';

/** Charge les données. Si elles sont illisibles, elles sont mises de côté (jamais écrasées) et une erreur est levée. */
export async function charger() {
  const texte = localStorage.getItem(CLE);
  if (!texte) return nouvellesDonnees();
  try {
    return normaliser(JSON.parse(texte));
  } catch (e) {
    localStorage.setItem(`${CLE}:illisible:${Date.now()}`, texte);
    throw new Error(`données illisibles (${e.message}), elles ont été mises de côté`);
  }
}

/** Enregistre. Lève une erreur si le navigateur refuse (stockage plein ou bloqué). */
export async function enregistrer(donnees) {
  try {
    localStorage.setItem(CLE, JSON.stringify(donnees));
  } catch (err) {
    throw new Error(err.name === 'QuotaExceededError' ? 'le stockage du navigateur est plein' : "le navigateur refuse d'enregistrer (navigation privée ?)");
  }
}

/** Prévient quand un autre onglet a modifié les données (évite qu'un onglet écrase l'autre). */
export function surChangementAilleurs(rappel) {
  addEventListener('storage', e => {
    if (e.key !== CLE || !e.newValue) return;
    try { rappel(normaliser(JSON.parse(e.newValue))); } catch { /* ignoré : l'onglet actuel garde ses données */ }
  });
}

/** Demande au navigateur de ne jamais effacer ces données de lui-même. */
export async function proteger() {
  try { return (await navigator.storage?.persisted?.()) || (await navigator.storage?.persist?.()) || false; }
  catch { return false; }
}

export const tailleOctets = () => new Blob([localStorage.getItem(CLE) ?? '']).size;

// ---------- Fichiers de sauvegarde ----------
export function telechargerSauvegarde(donnees) {
  const blob = new Blob([JSON.stringify(donnees, null, 2)], { type: 'application/json' });
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `quest-log-sauvegarde-${dateISO()}.json` });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 10000);
}

/** Lit un fichier de sauvegarde choisi par l'utilisateur. Lève une erreur claire s'il n'est pas valide. */
export async function lireSauvegarde(fichier) {
  let brut;
  try { brut = JSON.parse(await fichier.text()); }
  catch { throw new Error("ce fichier n'est pas une sauvegarde Quest Log (format illisible)"); }
  return normaliser(brut);
}
