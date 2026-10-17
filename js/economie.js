// Économie du jeu : on gagne des pièces en accomplissant tâches, missions et journées,
// on les dépense en équipement. Chaque gain est rangé sous une clé (tâche, mission ou jour) :
// cocher puis décocher ne fait pas gagner deux fois, et supprimer une mission ne reprend rien.
//   journal : { [idTâche]: { date, minutes, pieces } }   → aussi l'historique de tout ce qui a été fait (Stats)
//   bonus   : { 'mission:<id>' | 'jour:<date>': pieces }
import { dateISO } from './dates.js';
import { objet, prixObjet, puissance } from './personnage.js';
import { MONDES } from './mondes.js';

export const piecesTache = minutes => Math.max(1, Math.round(minutes / 5)); // 12 pièces par heure
export const bonusMission = importance => 10 * importance;
export const BONUS_JOURNEE = 15;

const somme = valeurs => valeurs.reduce((s, v) => s + v, 0);
export const gagne = d => somme(Object.values(d.journal).map(e => e.pieces)) + somme(Object.values(d.bonus));
export const depense = d => somme(d.personnage.possedes.map(prixObjet));
export const solde = d => gagne(d) - depense(d);

/** Une sous-tâche vient d'être cochée ou décochée. Renvoie les pièces gagnées. */
export function enregistrerTache(d, t, m, faite, missionTerminee) {
  const cleMission = `mission:${m.id}`;
  if (!faite) {
    delete d.journal[t.id];
    delete d.bonus[cleMission];
    return 0;
  }
  const pieces = piecesTache(t.minutes);
  d.journal[t.id] = { date: dateISO(new Date(t.faiteLe ?? Date.now())), minutes: t.minutes, pieces };
  if (!missionTerminee || d.bonus[cleMission]) return pieces;
  d.bonus[cleMission] = bonusMission(m.importance);
  return pieces + d.bonus[cleMission];
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
