// Modèle de données de Quest Log : création, calculs et vérification (fonctions pures).
// Chaque mission et sous-tâche a un identifiant stable et une date de modification (`maj`) :
// c'est ce qui permettra plus tard de synchroniser entre appareils en fusionnant les changements.
// Une sous-tâche avance par séances : `minutesFaites` grandit jusqu'à `minutes` (l'estimation), elle est alors faite.
import { ajouterJours, dateISO, joursEntre } from './dates.js';
import { bonusMission, majBonusMission, noterTravail, piecesTache } from './economie.js';
import { MONDES } from './mondes.js';
import { CHEVEUX, COIFFURES, EMPLACEMENTS, PEAUX, TUNIQUES, nouveauPersonnage, objet } from './personnage.js';

export const VERSION = 3; // 2 : pièces, historique, personnage et monde ; 3 : avancement par séances
export const CATEGORIES = { partiel: 'Partiel', devoir: 'Devoir', perso: 'Projet perso', autre: 'Autre' };
export const JOURS_COURTS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

const maintenant = () => new Date().toISOString();
export const uid = () => globalThis.crypto?.randomUUID?.() ?? Date.now().toString(36) + Math.random().toString(36).slice(2, 10);

export function nouvellesDonnees() {
  return {
    app: 'quest-log',
    version: VERSION,
    creeLe: maintenant(),
    maj: maintenant(),
    missions: [],
    reglages: { minutesParJour: [240, 240, 240, 240, 240, 240, 240], rappelJours: 7, derniereSauvegarde: null, rappelMasqueLe: null },
    journee: null, // { date, seances: [{ id, tache, minutes, faite, ajoutee }], retirees } : le plan du jour, figé jusqu'au lendemain
    journal: {},   // { 'seance:<id>' | 'fin:<idTâche>': { date, minutes, pieces } } : tout le travail fait (voir economie.js)
    bonus: {},     // { 'mission:<id>' | 'jour:<date>': pieces }
    personnage: nouveauPersonnage(),
    monde: 1,
  };
}

export const nouvelleTache = ({ titre, minutes }) =>
  ({ id: uid(), titre, minutes, minutesFaites: 0, faite: false, faiteLe: null, reports: 0, maj: maintenant() });

export const nouvelleMission = ({ titre, echeance = null, importance = 3, categorie = 'autre', taches = [] }) => ({
  id: uid(), titre, echeance, importance, categorie, archivee: false,
  creeLe: maintenant(), termineeLe: null, maj: maintenant(),
  taches: taches.map(nouvelleTache),
});

/** Temps qu'il reste à faire sur une sous-tâche. */
export const restant = t => Math.max(0, t.minutes - t.minutesFaites);

export function progression(m) {
  let faites = 0, minutesFaites = 0, minutesTotal = 0;
  for (const t of m.taches) {
    minutesTotal += t.minutes;
    minutesFaites += Math.min(t.minutesFaites, t.minutes);
    if (t.faite) faites++;
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

/** À appeler après tout changement des sous-tâches : une sous-tâche est faite quand son temps est atteint. */
export function actualiser(m) {
  for (const t of m.taches) {
    const faite = t.minutesFaites >= t.minutes;
    if (faite !== t.faite) { t.faite = faite; t.faiteLe = faite ? maintenant() : null; }
  }
  m.termineeLe = progression(m).terminee ? (m.termineeLe ?? maintenant()) : null;
  m.maj = maintenant();
}

/** Ajoute (ou retire, si négatif) du temps fait sur une sous-tâche. Renvoie true si la mission vient d'être terminée. */
export function avancer(m, t, minutes) {
  const avant = progression(m).terminee;
  t.minutesFaites = Math.max(0, t.minutesFaites + minutes);
  t.maj = maintenant();
  actualiser(m);
  return progression(m).terminee && !avant;
}

/**
 * La case « terminée » d'une sous-tâche (page de la mission). Cocher : le temps restant est compté comme fait.
 * Décocher : on retire ce temps ; si elle avait été finie par ses séances, c'est qu'il lui faut plus de temps (+1h).
 */
export function terminerTache(d, m, t, faite, date) {
  const cle = `fin:${t.id}`;
  let missionFinie = false, plusDeTemps = false;
  if (faite) {
    const reste = restant(t);
    missionFinie = avancer(m, t, reste);
    noterTravail(d, cle, reste, date);
  } else if (d.journal[cle]) {
    avancer(m, t, -d.journal[cle].minutes);
    noterTravail(d, cle, 0, date);
  } else {
    t.minutes = t.minutesFaites + 60;
    avancer(m, t, 0);
    plusDeTemps = true;
  }
  const gain = (faite ? d.journal[cle]?.pieces ?? 0 : 0) + majBonusMission(d, m, progression(m).terminee);
  return { missionFinie, gain, plusDeTemps };
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
    throw Object.assign(new Error("ces données viennent d'une version plus récente de Quest Log : recharge la page (Ctrl+F5)"), { versionRecente: true });
  const base = nouvellesDonnees();
  const missions = brut.missions.filter(m => m && typeof m.titre === 'string').map(m => {
    const taches = (Array.isArray(m.taches) ? m.taches : []).filter(t => t && typeof t.titre === 'string').map(t => {
      const minutes = entier(t.minutes, 1, 60000, 60);
      return {
        id: texte(t.id) || uid(),
        titre: t.titre,
        minutes,
        minutesFaites: entier(t.minutesFaites, 0, 60000, t.faite === true ? minutes : 0), // avant la version 3 : faite = tout le temps fait
        faite: t.faite === true,
        faiteLe: t.faite === true ? texte(t.faiteLe, null) : null,
        reports: entier(t.reports, 0, 999, 0),
        maj: texte(t.maj, base.maj),
      };
    });
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
    const maj = mission.maj;
    actualiser(mission);
    mission.maj = maj;
    return mission;
  });
  const r = brut.reglages ?? {};
  const objetDe = v => (v && typeof v === 'object' ? v : {});
  const idsTaches = new Set(missions.flatMap(m => m.taches.map(t => t.id)));
  // Version 1 (sans historique) : les tâches déjà faites et les missions terminées rapportent leurs pièces
  const journal = brut.journal ? {} : Object.fromEntries(missions.flatMap(m => m.taches.filter(t => t.faite).map(t =>
    [`fin:${t.id}`, { date: dateISO(new Date(t.faiteLe ?? m.maj)), minutes: t.minutes, pieces: piecesTache(t.minutes) }])));
  for (const [cle, e] of Object.entries(objetDe(brut.journal))) {
    if (!estDate(e?.date)) continue;
    // version 2 : une tâche cochée était notée sous son identifiant → c'est une fin de tâche
    journal[idsTaches.has(cle) ? `fin:${cle}` : cle] = { date: e.date, minutes: entier(e.minutes, 0, 60000, 0), pieces: entier(e.pieces, 0, 1e6, 0) };
  }
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
  const j = brut.journee; // l'ancien plan du jour (avant les séances) est simplement recalculé
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
    journee: j && estDate(j.date) && Array.isArray(j.seances) && Array.isArray(j.retirees)
      ? {
        date: j.date,
        seances: j.seances.filter(s => s && typeof s.tache === 'string').map(s => ({
          id: texte(s.id) || uid(), tache: s.tache, minutes: entier(s.minutes, 1, 600, 60), faite: s.faite === true, ajoutee: s.ajoutee === true,
        })),
        retirees: j.retirees.map(String),
      }
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
  avancer(devoir, devoir.taches[0], 30);
  devoir.taches[0].faiteLe = new Date(Date.now() - 864e5).toISOString(); // faite hier
  const partiel = nouvelleMission({
    titre: 'Partiel calcul stochastique', echeance: ajouterJours(aujourdhui, 21), importance: 5, categorie: 'partiel',
    taches: [
      { titre: 'Cours à apprendre', minutes: 600 },
      { titre: 'TD1', minutes: 180 },
      { titre: 'TD2', minutes: 180 },
      { titre: '2 exercices poussés', minutes: 240 },
      { titre: 'Annales', minutes: 180 },
    ],
  });
  avancer(partiel, partiel.taches[0], 180); // déjà 3 séances sur 10
  return [
    partiel,
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
