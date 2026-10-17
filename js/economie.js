// Économie du jeu : on gagne des pièces en travaillant (séances), en terminant missions et journées,
// on les dépense en équipement. Chaque gain est rangé sous une clé (séance, tâche, mission ou jour) :
// cocher puis décocher ne fait pas gagner deux fois, et supprimer une mission ne reprend rien.
//   journal : { 'seance:<id>' | 'fin:<idTâche>': { date, minutes, pieces } } → aussi l'historique du travail (Stats)
//   bonus   : { 'mission:<id>' | 'jour:<date>': pieces }
import { objet, prixObjet, puissance } from './personnage.js';
import { MONDES } from './mondes.js';

export const piecesTache = minutes => Math.max(1, Math.round(minutes / 5)); // 12 pièces par heure
export const bonusMission = importance => 10 * importance;
export const BONUS_JOURNEE = 15;

const somme = valeurs => valeurs.reduce((s, v) => s + v, 0);
export const gagne = d => somme(Object.values(d.journal).map(e => e.pieces)) + somme(Object.values(d.bonus));
export const depense = d => somme(d.personnage.possedes.map(prixObjet));
export const solde = d => gagne(d) - depense(d);

/** Note du travail fait sous une clé (minutes > 0), ou l'efface (minutes = 0). Renvoie les pièces gagnées. */
export function noterTravail(d, cle, minutes, date) {
  if (!minutes) { delete d.journal[cle]; return 0; }
  d.journal[cle] = { date, minutes, pieces: piecesTache(minutes) };
  return d.journal[cle].pieces;
}

/** Bonus de fin de mission : donné une fois quand elle est terminée, repris si elle ne l'est plus. Renvoie le gain. */
export function majBonusMission(d, m, terminee) {
  const cle = `mission:${m.id}`;
  if (!terminee) { delete d.bonus[cle]; return 0; }
  if (d.bonus[cle]) return 0;
  return (d.bonus[cle] = bonusMission(m.importance));
}

/** Bonus « journée accomplie », une seule fois par jour. Renvoie les pièces gagnées. */
export function enregistrerJournee(d, date) {
  if (d.bonus[`jour:${date}`]) return 0;
  d.bonus[`jour:${date}`] = BONUS_JOURNEE;
  return BONUS_JOURNEE;
}

/** Achète un objet et l'équipe. Lève une erreur s'il est déjà possédé ou trop cher. */
export function acheter(d, id) {
  const o = objet(id);
  if (!o || d.personnage.possedes.includes(id)) throw new Error('objet indisponible');
  if (solde(d) < o.prix) throw new Error('pas assez de pièces');
  d.personnage.possedes.push(id);
  d.personnage.equipe[o.emplacement] = id;
}

export const mondesOuverts = perso => MONDES.filter(m => puissance(perso) >= m.puissance);
