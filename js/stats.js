// Calculs des statistiques à partir de l'historique (le journal des tâches faites). Fonctions pures.
import { ajouterJours, joursEntre } from './dates.js';

/** Minutes faites par jour : Map 'AAAA-MM-JJ' → minutes. */
export function minutesParDate(journal) {
  const parDate = new Map();
  for (const { date, minutes } of Object.values(journal)) parDate.set(date, (parDate.get(date) ?? 0) + minutes);
  return parDate;
}

/** Niveau d'efficacité d'un jour (0 à 4) : travail fait par rapport au temps prévu ce jour-là. */
export function niveau(minutes, dispo) {
  if (!minutes) return 0;
  const ratio = dispo ? minutes / dispo : 1;
  return ratio >= 1 ? 4 : ratio >= 0.5 ? 3 : ratio >= 0.25 ? 2 : 1;
}

/** Séries de jours d'affilée avec du travail. La série en cours n'est pas rompue tant que la journée n'est pas finie. */
export function series(parDate, aujourdhui) {
  let actuelle = 0;
  for (let j = parDate.get(aujourdhui) ? aujourdhui : ajouterJours(aujourdhui, -1); parDate.get(j); j = ajouterJours(j, -1)) actuelle++;
  let record = 0, courant = 0, precedent = null;
  for (const date of [...parDate.keys()].filter(d => parDate.get(d) > 0).sort()) {
    courant = precedent && joursEntre(precedent, date) === 1 ? courant + 1 : 1;
    record = Math.max(record, courant);
    precedent = date;
  }
  return { actuelle, record };
}
