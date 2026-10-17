// Missions du jour : choisit les sous-tâches à faire aujourd'hui (fonctions pures, testées dans tests/).
//
// Priorité d'une mission = urgence × poids de l'importance
//   urgence = travail restant / temps disponible d'ici l'échéance  (13h à 4 jours ≫ 13h à un mois)
//           + petit bonus de proximité ; en retard = très urgent ; sans échéance = urgence faible
// Priorité d'une sous-tâche = priorité de sa mission + bonus par report, en gardant l'ordre de la mission.
// On remplit ensuite la journée dans l'ordre des priorités sans dépasser le temps disponible.
import { ajouterJours, dateCourte, dateISO, duree, joursEntre, jourSemaine } from './dates.js';
import { statut } from './donnees.js';

export const minutesDispo = (reglages, date) => reglages.minutesParJour[jourSemaine(date)];
const poids = importance => 0.5 + importance * 0.25; // 1 → 0,75 … 5 → 1,75
const BONUS_REPORT = 0.25;

export function analyserMission(m, reglages, aujourdhui) {
  const restantes = m.taches.reduce((s, t) => s + (t.faite ? 0 : t.minutes), 0);
  if (!m.echeance) return { restantes, jours: null, charge: null, urgence: 0.05 };
  const jours = joursEntre(aujourdhui, m.echeance);
  if (jours < 0) return { restantes, jours, charge: Infinity, urgence: 3 + Math.min(-jours, 10) * 0.1 };
  let dispo = 0; // temps disponible d'aujourd'hui jusqu'à la veille de l'échéance (aujourd'hui si c'est pour aujourd'hui)
  for (let i = 0; i < Math.min(Math.max(jours, 1), 366); i++) dispo += minutesDispo(reglages, ajouterJours(aujourdhui, i));
  const charge = dispo ? restantes / dispo : restantes ? 10 : 0;
  return { restantes, jours, charge, urgence: charge + 1 / (jours + 1) };
}

/** Toutes les sous-tâches à faire, de la plus prioritaire à la moins prioritaire. */
export function candidates(donnees, aujourdhui) {
  const liste = [];
  for (const m of donnees.missions) {
    if (statut(m) !== 'encours') continue;
    const a = analyserMission(m, donnees.reglages, aujourdhui);
    let rang = 0;
    for (const t of m.taches) {
      if (t.faite) continue;
      liste.push({ t, m, a, score: a.urgence * poids(m.importance) + BONUS_REPORT * t.reports - 0.01 * rang++ });
    }
  }
  return liste.sort((x, y) => y.score - x.score);
}

/** Choisit des sous-tâches pour remplir `budget` minutes, en gardant l'ordre des sous-tâches de chaque mission. */
export function proposer(donnees, aujourdhui, budget, exclus = new Set()) {
  const choisis = [], bloquees = new Set();
  let reste = budget;
  for (const { t, m } of candidates(donnees, aujourdhui)) {
    if (reste <= 0) break;
    if (bloquees.has(m.id)) continue;
    if (exclus.has(t.id)) { bloquees.add(m.id); continue; } // reportée ou retirée : la suite de la mission attend aussi
    if (t.minutes <= reste) { choisis.push(t.id); reste -= t.minutes; }
    else if (reste === budget) { choisis.push(t.id); reste = 0; } // plus longue que la journée : on l'avance aujourd'hui
    else bloquees.add(m.id); // l'étape suivante ne rentre pas : on ne saute pas à la suivante de la même mission
  }
  return choisis;
}

export function indexTaches(donnees) {
  const index = new Map();
  for (const m of donnees.missions) for (const t of m.taches) index.set(t.id, { t, m });
  return index;
}

/** Crée le plan du jour s'il n'existe pas encore pour aujourd'hui. Renvoie true s'il a été créé. */
export function preparerJournee(donnees, aujourdhui) {
  const j = donnees.journee; // un plan resté vide (aucune mission ce matin) se remplit dès qu'il y a de quoi faire
  if (j?.date === aujourdhui && (j.ids.length || j.retirees.length || j.ajoutees.length)) return false;
  if (j?.date === aujourdhui && !candidates(donnees, aujourdhui).length) return false;
  donnees.journee = { date: aujourdhui, ids: proposer(donnees, aujourdhui, minutesDispo(donnees.reglages, aujourdhui)), retirees: [], ajoutees: [] };
  return true;
}

/** Nouvelle proposition : garde ce qui est déjà fait ou ajouté à la main, recalcule le reste. */
export function recalculerJournee(donnees, aujourdhui) {
  preparerJournee(donnees, aujourdhui);
  const j = donnees.journee, index = indexTaches(donnees);
  const gardees = j.ids.filter(id => index.has(id) && (index.get(id).t.faite || j.ajoutees.includes(id)));
  const occupe = gardees.reduce((s, id) => s + index.get(id).t.minutes, 0);
  const budget = Math.max(0, minutesDispo(donnees.reglages, aujourdhui) - occupe);
  j.ids = [...gardees, ...proposer(donnees, aujourdhui, budget, new Set([...gardees, ...j.retirees]))];
}

const retirer = (liste, id) => liste.filter(x => x !== id);

export function retirerDeJournee(donnees, id) {
  const j = donnees.journee;
  j.ids = retirer(j.ids, id);
  j.ajoutees = retirer(j.ajoutees, id);
  if (!j.retirees.includes(id)) j.retirees.push(id);
}

/** Reporter à demain : retirée aujourd'hui, et elle remontera en priorité les jours suivants. */
export function reporter(donnees, id) {
  const x = indexTaches(donnees).get(id);
  if (x) { x.t.reports++; x.t.maj = new Date().toISOString(); }
  retirerDeJournee(donnees, id);
}

export function ajouterAJournee(donnees, id) {
  const j = donnees.journee;
  if (!j.ids.includes(id)) j.ids.push(id);
  if (!j.ajoutees.includes(id)) j.ajoutees.push(id);
  j.retirees = retirer(j.retirees, id);
}

/** Ce qu'affiche l'accueil : le plan du jour + ce qui a été fait aujourd'hui ailleurs. */
export function tachesDuJour(donnees, aujourdhui) {
  const index = indexTaches(donnees);
  const ids = [...donnees.journee.ids];
  for (const [id, { t }] of index) if (t.faite && t.faiteLe && dateISO(new Date(t.faiteLe)) === aujourdhui && !ids.includes(id)) ids.push(id);
  return ids.filter(id => index.has(id) && !index.get(id).m.archivee).map(id => index.get(id));
}


/** Courtes raisons affichées à côté d'une tâche proposée (3 au maximum). */
export function raisons(t, m, donnees, aujourdhui) {
  const a = analyserMission(m, donnees.reglages, aujourdhui), r = [];
  if (donnees.journee?.ajoutees.includes(t.id)) r.push('ajoutée par toi');
  if (a.jours !== null) {
    if (a.jours < 0) r.push(`en retard de ${-a.jours} j`);
    else if (a.jours === 0) r.push("à rendre aujourd'hui");
    else if (a.jours === 1) r.push('échéance demain');
    else if (a.jours <= 21) r.push(`échéance dans ${a.jours} jours`);
    if (a.jours >= 0 && a.charge >= 0.5) r.push(`${duree(a.restantes)} restantes en ${Math.max(a.jours, 1)} j`);
  }
  if (m.importance >= 4) r.push(`importance ${m.importance}`);
  if (t.reports) r.push(`reportée ${t.reports} fois`);
  if (t.minutes > minutesDispo(donnees.reglages, aujourdhui)) r.push('plus longue que ta journée');
  if (!r.length) r.push(a.jours === null ? 'sans échéance : pour avancer' : `échéance le ${dateCourte(m.echeance, aujourdhui)}`);
  return r.slice(0, 3);
}
