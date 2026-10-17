// Missions du jour : des séances d'une heure (au plus) prises dans les sous-tâches, testées dans tests/.
// Une sous-tâche de 10h devient 10 séances réparties sur plusieurs jours.
//
// Priorité d'une mission = urgence × poids de l'importance
//   urgence = travail restant / temps disponible d'ici l'échéance  (13h à 4 jours ≫ 13h à un mois)
//           + petit bonus de proximité ; en retard = très urgent ; sans échéance = urgence faible
// On remplit la journée séance par séance : chaque fois, la mission la plus prioritaire donne une séance de sa
// sous-tâche en cours (dans l'ordre de la mission). Chaque séance déjà prise la fait un peu baisser, pour varier.
import { ajouterJours, dateCourte, duree, joursEntre, jourSemaine } from './dates.js';
import { enregistrerJournee, majBonusMission, noterTravail } from './economie.js';
import { avancer, progression, restant, statut, uid } from './donnees.js';

export const SEANCE = 60; // durée d'une séance, en minutes
export const minutesDispo = (reglages, date) => reglages.minutesParJour[jourSemaine(date)];
const poids = importance => 0.5 + importance * 0.25; // 1 → 0,75 … 5 → 1,75
const BONUS_REPORT = 0.25;
const PENALITE_SEANCE = 0.3; // une mission perd un peu de priorité à chaque séance déjà prévue aujourd'hui

export function analyserMission(m, reglages, aujourdhui) {
  const restantes = m.taches.reduce((s, t) => s + restant(t), 0);
  if (!m.echeance) return { restantes, jours: null, charge: null, urgence: 0.05 };
  const jours = joursEntre(aujourdhui, m.echeance);
  if (jours < 0) return { restantes, jours, charge: Infinity, urgence: 3 + Math.min(-jours, 10) * 0.1 };
  let dispo = 0; // temps disponible d'aujourd'hui jusqu'à la veille de l'échéance (aujourd'hui si c'est pour aujourd'hui)
  for (let i = 0; i < Math.min(Math.max(jours, 1), 366); i++) dispo += minutesDispo(reglages, ajouterJours(aujourdhui, i));
  const charge = dispo ? restantes / dispo : restantes ? 10 : 0;
  return { restantes, jours, charge, urgence: charge + 1 / (jours + 1) };
}

/** Toutes les sous-tâches pas finies, de la plus prioritaire à la moins prioritaire (pour « Ajouter une séance »). */
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

/**
 * Propose des séances pour remplir `budget` minutes : [{ tache, minutes }].
 * `exclus` : sous-tâches reportées ou retirées aujourd'hui (leur mission attend demain).
 * `prevu` : minutes déjà prévues aujourd'hui par sous-tâche (pas encore faites).
 */
export function proposer(donnees, aujourdhui, budget, { exclus = new Set(), prevu = new Map() } = {}) {
  const files = [];
  for (const m of donnees.missions) {
    if (statut(m) !== 'encours') continue;
    const taches = m.taches.filter(t => !t.faite).map(t => ({ t, reste: restant(t) - (prevu.get(t.id) ?? 0) })).filter(x => x.reste > 0);
    if (taches.length) files.push({ taches, base: analyserMission(m, donnees.reglages, aujourdhui).urgence * poids(m.importance), prises: 0 });
  }
  const seances = [];
  for (let reste = budget; reste >= 15; ) {
    let choix = null, meilleur = -Infinity;
    for (const f of files) {
      const tete = f.taches[0];
      if (!tete || exclus.has(tete.t.id)) continue;
      const score = f.base + BONUS_REPORT * tete.t.reports - PENALITE_SEANCE * f.prises;
      if (score > meilleur) { choix = f; meilleur = score; }
    }
    if (!choix) break;
    const tete = choix.taches[0], minutes = Math.min(SEANCE, tete.reste, reste);
    seances.push({ tache: tete.t.id, minutes });
    tete.reste -= minutes;
    reste -= minutes;
    choix.prises++;
    if (tete.reste <= 0) choix.taches.shift();
  }
  return seances;
}

export function indexTaches(donnees) {
  const index = new Map();
  for (const m of donnees.missions) for (const t of m.taches) index.set(t.id, { t, m });
  return index;
}

const nouvelleSeance = ({ tache, minutes }, ajoutee = false) => ({ id: uid(), tache, minutes, faite: false, ajoutee });

/** Minutes prévues aujourd'hui (séances pas encore faites), par sous-tâche. */
function minutesPrevues(seances) {
  const prevu = new Map();
  for (const s of seances) if (!s.faite) prevu.set(s.tache, (prevu.get(s.tache) ?? 0) + s.minutes);
  return prevu;
}

/** Crée le plan du jour s'il n'existe pas encore pour aujourd'hui. Renvoie true s'il a été créé. */
export function preparerJournee(donnees, aujourdhui) {
  const j = donnees.journee; // un plan resté vide (aucune mission ce matin) se remplit dès qu'il y a de quoi faire
  if (j?.date === aujourdhui && (j.seances.length || j.retirees.length)) return false;
  if (j?.date === aujourdhui && !candidates(donnees, aujourdhui).length) return false;
  donnees.journee = { date: aujourdhui, seances: proposer(donnees, aujourdhui, minutesDispo(donnees.reglages, aujourdhui)).map(s => nouvelleSeance(s)), retirees: [] };
  return true;
}

/** Nouvelle proposition : garde les séances faites ou ajoutées à la main, recalcule le reste. */
export function recalculerJournee(donnees, aujourdhui) {
  preparerJournee(donnees, aujourdhui);
  const j = donnees.journee, index = indexTaches(donnees);
  const gardees = j.seances.filter(s => index.has(s.tache) && (s.faite || s.ajoutee));
  const occupe = gardees.reduce((s, x) => s + x.minutes, 0);
  const budget = Math.max(0, minutesDispo(donnees.reglages, aujourdhui) - occupe);
  const nouvelles = proposer(donnees, aujourdhui, budget, { exclus: new Set(j.retirees), prevu: minutesPrevues(gardees) });
  j.seances = [...gardees, ...nouvelles.map(s => nouvelleSeance(s))];
}

/** Retirer une séance de la journée (sa sous-tâche n'est plus proposée aujourd'hui). */
export function retirerSeance(donnees, id) {
  const j = donnees.journee, s = j.seances.find(x => x.id === id);
  if (!s) return;
  j.seances = j.seances.filter(x => x !== s);
  if (!j.retirees.includes(s.tache)) j.retirees.push(s.tache);
}

/** Reporter à demain : toutes les séances prévues de cette sous-tâche sortent de la journée, et elle remontera ensuite. */
export function reporter(donnees, id) {
  const j = donnees.journee, s = j.seances.find(x => x.id === id);
  const x = s && indexTaches(donnees).get(s.tache);
  if (!x) return;
  x.t.reports++;
  x.t.maj = new Date().toISOString();
  j.seances = j.seances.filter(y => y.faite || y.tache !== s.tache);
  if (!j.retirees.includes(s.tache)) j.retirees.push(s.tache);
}

/** Ajoute une séance (1h, ou ce qui reste) d'une sous-tâche choisie. Renvoie false s'il n'y a plus rien à prévoir. */
export function ajouterSeance(donnees, idTache) {
  const j = donnees.journee, x = indexTaches(donnees).get(idTache);
  const libre = x ? restant(x.t) - (minutesPrevues(j.seances).get(idTache) ?? 0) : 0;
  if (libre <= 0) return false;
  j.seances.push(nouvelleSeance({ tache: idTache, minutes: Math.min(SEANCE, libre) }, true));
  j.retirees = j.retirees.filter(t => t !== idTache);
  return true;
}

/** Ce qu'affiche l'accueil : les séances du jour (sauf celles d'une sous-tâche finie entre-temps). */
export function seancesDuJour(donnees) {
  const index = indexTaches(donnees);
  return donnees.journee.seances
    .filter(s => index.has(s.tache) && !index.get(s.tache).m.archivee && (s.faite || !index.get(s.tache).t.faite))
    .map(s => ({ s, ...index.get(s.tache) }));
}

/** Coche ou décoche une séance : avancement de la sous-tâche, pièces, bonus de mission et de journée. */
export function validerSeance(donnees, id, faite, aujourdhui) {
  const s = donnees.journee.seances.find(x => x.id === id), x = s && indexTaches(donnees).get(s.tache);
  if (!x || s.faite === faite) return null;
  s.faite = faite;
  const missionFinie = avancer(x.m, x.t, faite ? s.minutes : -s.minutes);
  let gain = noterTravail(donnees, `seance:${s.id}`, faite ? s.minutes : 0, aujourdhui)
    + majBonusMission(donnees, x.m, progression(x.m).terminee);
  const journeeFinie = faite && seancesDuJour(donnees).every(y => y.s.faite);
  if (journeeFinie) gain += enregistrerJournee(donnees, aujourdhui);
  return { ...x, missionFinie, journeeFinie, gain };
}

/** Courtes raisons affichées à côté d'une séance proposée (3 au maximum). */
export function raisons(s, t, m, donnees, aujourdhui) {
  const a = analyserMission(m, donnees.reglages, aujourdhui), r = [];
  if (s?.ajoutee) r.push('ajoutée par toi');
  if (a.jours !== null) {
    if (a.jours < 0) r.push(`en retard de ${-a.jours} j`);
    else if (a.jours === 0) r.push("à rendre aujourd'hui");
    else if (a.jours === 1) r.push('échéance demain');
    else if (a.jours <= 21) r.push(`échéance dans ${a.jours} jours`);
    if (a.jours >= 0 && a.charge >= 0.5) r.push(`${duree(a.restantes)} restantes en ${Math.max(a.jours, 1)} j`);
  }
  if (m.importance >= 4) r.push(`importance ${m.importance}`);
  if (t.reports) r.push(`reportée ${t.reports} fois`);
  if (!r.length) r.push(a.jours === null ? 'sans échéance : pour avancer' : `échéance le ${dateCourte(m.echeance, aujourdhui)}`);
  return r.slice(0, 3);
}
