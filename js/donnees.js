// Modèle de données de Quest Log : création, calculs et vérification (fonctions pures).
// Chaque mission et sous-tâche a un identifiant stable et une date de modification (`maj`) :
// c'est ce qui permettra plus tard de synchroniser entre appareils en fusionnant les changements.
import { ajouterJours, dateISO, joursEntre } from './dates.js';
import { bonusMission, piecesTache } from './economie.js';
import { MONDES } from './mondes.js';
import { CHEVEUX, COIFFURES, EMPLACEMENTS, PEAUX, TUNIQUES, nouveauPersonnage, objet } from './personnage.js';

export const VERSION = 2; // 2 : pièces, historique, personnage et monde
export const CATEGORIES = { partiel: 'Partiel', devoir: 'Devoir', perso: 'Projet perso', autre: 'Autre' };
export const JOURS_COURTS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

const maintenant = () => new Date().toISOString();
const uid = () => globalThis.crypto?.randomUUID?.() ?? Date.now().toString(36) + Math.random().toString(36).slice(2, 10);

export function nouvellesDonnees() {
  return {
    app: 'quest-log',
    version: VERSION,
    creeLe: maintenant(),
    maj: maintenant(),
    missions: [],
    reglages: { minutesParJour: [240, 240, 240, 240, 240, 240, 240], rappelJours: 7, derniereSauvegarde: null, rappelMasqueLe: null },
    journee: null, // { date, ids, retirees, ajoutees } : le plan du jour, figé jusqu'au lendemain
    journal: {},   // { [idTâche]: { date, minutes, pieces } } : tout ce qui a été fait (voir economie.js)
    bonus: {},     // { 'mission:<id>' | 'jour:<date>': pieces }
    personnage: nouveauPersonnage(),
    monde: 1,
  };
}

export const nouvelleTache = ({ titre, minutes }) =>
  ({ id: uid(), titre, minutes, faite: false, faiteLe: null, reports: 0, maj: maintenant() });

export const nouvelleMission = ({ titre, echeance = null, importance = 3, categorie = 'autre', taches = [] }) => ({
  id: uid(), titre, echeance, importance, categorie, archivee: false,
  creeLe: maintenant(), termineeLe: null, maj: maintenant(),
  taches: taches.map(nouvelleTache),
});

export function progression(m) {
  let faites = 0, minutesFaites = 0, minutesTotal = 0;
  for (const t of m.taches) {
    minutesTotal += t.minutes;
    if (t.faite) { faites++; minutesFaites += t.minutes; }
  }
  return { faites, total: m.taches.length, minutesFaites, minutesTotal, terminee: m.taches.length > 0 && faites === m.taches.length };
}

export const statut = m => (m.archivee ? 'archivee' : progression(m).terminee ? 'terminee' : 'encours');

/** Niveau d'alerte de l'échéance : aucune | calme | bientot (≤ 7 j) | urgent (≤ 3 j) | depassee. */
export function alerteEcheance(m, aujourdhui) {
  if (!m.echeance) return { niveau: 'aucune', jours: null };
  const jours = joursEntre(aujourdhui, m.echeance);
  return { jours, niveau: jours < 0 ? 'depassee' : jours <= 3 ? 'urgent' : jours <= 7 ? 'bientot' : 'calme' };
}

/** À appeler après tout changement des sous-tâches : met à jour la date de fin de la mission. */
export function actualiser(m) {
  m.termineeLe = progression(m).terminee ? (m.termineeLe ?? maintenant()) : null;
  m.maj = maintenant();
}

/** Coche / décoche une sous-tâche. Renvoie true si la mission vient d'être terminée. */
export function basculerTache(m, t, faite) {
  const avant = progression(m).terminee;
  t.faite = faite;
  t.faiteLe = faite ? maintenant() : null;
  t.maj = maintenant();
  actualiser(m);
  return progression(m).terminee && !avant;
}

/** Trie : échéance la plus proche d'abord, sans échéance à la fin, puis importance. */
export const trierMissions = missions => [...missions].sort((a, b) =>
  (a.echeance ?? '9999').localeCompare(b.echeance ?? '9999') || b.importance - a.importance || a.creeLe.localeCompare(b.creeLe));

// ---------- Vérification d'un fichier importé ou du stockage ----------
const estDate = v => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
const texte = (v, defaut = '') => (typeof v === 'string' ? v : defaut);
const entier = (v, min, max, defaut) => (Number.isFinite(Number(v)) ? Math.min(max, Math.max(min, Math.round(Number(v)))) : defaut);

/** Vérifie et complète des données (fichier importé, stockage). Lève une erreur si ce n'est pas une sauvegarde Quest Log. */
export function normaliser(brut) {
  if (!brut || typeof brut !== 'object' || !Array.isArray(brut.missions))
    throw new Error("ce fichier n'est pas une sauvegarde Quest Log");
  if (Number(brut.version) > VERSION)
    throw new Error('cette sauvegarde vient d\'une version plus récente de Quest Log');
  const base = nouvellesDonnees();
  const missions = brut.missions.filter(m => m && typeof m.titre === 'string').map(m => {
    const taches = (Array.isArray(m.taches) ? m.taches : []).filter(t => t && typeof t.titre === 'string').map(t => ({
      id: texte(t.id) || uid(),
      titre: t.titre,
      minutes: entier(t.minutes, 1, 60000, 60),
      faite: t.faite === true,
      faiteLe: t.faite === true ? texte(t.faiteLe, null) : null,
      reports: entier(t.reports, 0, 999, 0),
      maj: texte(t.maj, base.maj),
    }));
    const mission = {
      id: texte(m.id) || uid(),
      titre: m.titre,
      echeance: estDate(m.echeance) ? m.echeance : null,
      importance: entier(m.importance, 1, 5, 3),
      categorie: m.categorie in CATEGORIES ? m.categorie : 'autre',
      archivee: m.archivee === true,
      creeLe: texte(m.creeLe, base.creeLe),
      termineeLe: texte(m.termineeLe, null),
      maj: texte(m.maj, base.maj),
      taches,
    };
    if (!progression(mission).terminee) mission.termineeLe = null;
    else mission.termineeLe ??= mission.maj;
    return mission;
  });
  const r = brut.reglages ?? {};
  const objetDe = v => (v && typeof v === 'object' ? v : {});
  // Version 1 (sans historique) : les tâches déjà faites et les missions terminées rapportent leurs pièces
  const journal = brut.journal ? {} : Object.fromEntries(missions.flatMap(m => m.taches.filter(t => t.faite).map(t =>
    [t.id, { date: dateISO(new Date(t.faiteLe ?? m.maj)), minutes: t.minutes, pieces: piecesTache(t.minutes) }])));
  for (const [id, e] of Object.entries(objetDe(brut.journal)))
    if (estDate(e?.date)) journal[id] = { date: e.date, minutes: entier(e.minutes, 0, 60000, 0), pieces: entier(e.pieces, 0, 1e6, 0) };
  const bonus = brut.bonus ? {} : Object.fromEntries(missions.filter(m => m.termineeLe).map(m => [`mission:${m.id}`, bonusMission(m.importance)]));
  for (const [cle, v] of Object.entries(objetDe(brut.bonus))) if (/^(mission|jour):/.test(cle)) bonus[cle] = entier(v, 0, 1e6, 0);
  const p = objetDe(brut.personnage), perso = nouveauPersonnage();
  perso.nom = texte(p.nom, perso.nom).slice(0, 24) || perso.nom;
  perso.peau = entier(p.peau, 0, PEAUX.length - 1, 0);
  perso.cheveux = entier(p.cheveux, 0, CHEVEUX.length - 1, 0);
  perso.tunique = entier(p.tunique, 0, TUNIQUES.length - 1, 0);
  perso.coiffure = COIFFURES.some(c => c.id === p.coiffure) ? p.coiffure : perso.coiffure;
  perso.possedes = [...new Set((Array.isArray(p.possedes) ? p.possedes : []).filter(id => objet(id)))];
  for (const e of EMPLACEMENTS) {
    const id = objetDe(p.equipe)[e.id];
    perso.equipe[e.id] = perso.possedes.includes(id) && objet(id).emplacement === e.id ? id : null;
  }
  const mpj = Array.isArray(r.minutesParJour) && r.minutesParJour.length === 7 ? r.minutesParJour : base.reglages.minutesParJour;
  const j = brut.journee;
  return {
    ...base,
    creeLe: texte(brut.creeLe, base.creeLe),
    maj: texte(brut.maj, base.maj),
    missions,
    reglages: {
      minutesParJour: mpj.map(v => entier(v, 0, 1440, 240)),
      rappelJours: entier(r.rappelJours, 1, 365, 7),
      derniereSauvegarde: texte(r.derniereSauvegarde, null),
      rappelMasqueLe: estDate(r.rappelMasqueLe) ? r.rappelMasqueLe : null,
    },
    journee: j && estDate(j.date) && [j.ids, j.retirees, j.ajoutees].every(Array.isArray)
      ? { date: j.date, ids: j.ids.map(String), retirees: j.retirees.map(String), ajoutees: j.ajoutees.map(String) }
      : null,
    journal,
    bonus,
    personnage: perso,
    monde: entier(brut.monde, 1, MONDES.length, 1),
  };
}

/** Données d'exemple : un partiel dans 3 semaines, un devoir dans 5 jours, un projet perso sans échéance. */
export function exemples(aujourdhui) {
  const devoir = nouvelleMission({
    titre: "DM d'économétrie", echeance: ajouterJours(aujourdhui, 5), importance: 4, categorie: 'devoir',
    taches: [
      { titre: "Lire l'énoncé", minutes: 30 },
      { titre: 'Questions 1 à 3', minutes: 120 },
      { titre: 'Questions 4 à 6', minutes: 150 },
      { titre: 'Rédaction propre', minutes: 90 },
    ],
  });
  basculerTache(devoir, devoir.taches[0], true);
  devoir.taches[0].faiteLe = new Date(Date.now() - 864e5).toISOString(); // faite hier
  return [
    nouvelleMission({
      titre: 'Partiel calcul stochastique', echeance: ajouterJours(aujourdhui, 21), importance: 5, categorie: 'partiel',
      taches: [
        { titre: 'Cours à apprendre', minutes: 360 },
        { titre: 'TD1', minutes: 180 },
        { titre: 'TD2', minutes: 180 },
        { titre: '2 exercices poussés', minutes: 240 },
        { titre: 'Annales', minutes: 180 },
      ],
    }),
    devoir,
    nouvelleMission({
      titre: 'Mon site Quest Log', importance: 2, categorie: 'perso',
      taches: [
        { titre: 'Dessiner mes propres icônes', minutes: 120 },
        { titre: 'Trouver des fonds en grand format', minutes: 60 },
        { titre: 'Mettre le site en ligne', minutes: 45 },
      ],
    }),
  ];
}
