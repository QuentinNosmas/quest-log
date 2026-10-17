// Lecture tolérante de la saisie rapide : dates, durées, missions et sous-tâches.
// Fonctions pures, sans affichage : testées dans tests/saisie.test.mjs.
import { ajouterJours, ajouterMois, construire, joursEntre, jourSemaine } from './dates.js';

const sansAccents = t => t.normalize('NFD').replace(/[̀-ͯ]/g, '');
const simplifier = t => sansAccents(String(t)).toLowerCase().replace(/[’`]/g, "'").replace(/\s+/g, ' ').trim();

const MOIS = ['janvier', 'fevrier', 'mars', 'avril', 'mai', 'juin', 'juillet', 'aout', 'septembre', 'octobre', 'novembre', 'decembre'];
const JOURS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];

function numeroMois(mot) {
  const m = mot.replace(/\.$/, '');
  if (m.length < 3) return null;
  const trouves = MOIS.flatMap((nom, i) => (nom.startsWith(m) ? [i + 1] : []));
  return trouves.length === 1 ? trouves[0] : null;
}

/**
 * Lit une date écrite librement. Renvoie :
 *  { date: 'AAAA-MM-JJ' } | { date: null } (« sans date » explicite) | { erreur } | null (pas une date)
 */
export function lireDate(texte, aujourdhui) {
  let t = simplifier(texte).replace(/^(?:pour |avant |d'ici |a rendre |echeance :? ?)?(?:le |au )?/, '');
  if (/^(?:aucune?|sans(?: date| echeance)?|pas de date|-|—|\/)$/.test(t)) return { date: null };
  if (/^(?:aujourd'?hui|auj|ce soir)$/.test(t)) return { date: aujourdhui };
  if (t === 'demain') return { date: ajouterJours(aujourdhui, 1) };
  if (/^apres[- ]demain$/.test(t)) return { date: ajouterJours(aujourdhui, 2) };

  let m = t.match(/^(?:dans |j ?\+ ?)(\d+) ?(j|jours?|s|sem|semaines?|mois)?$/);
  if (m) {
    const n = Number(m[1]), unite = m[2] ?? 'j';
    if (unite === 'mois') return { date: ajouterMois(aujourdhui, n) };
    return { date: ajouterJours(aujourdhui, unite.startsWith('s') ? 7 * n : n) };
  }

  m = t.match(/^([a-z]+)(?: prochain)?$/);
  if (m) {
    const i = JOURS.findIndex(j => j === m[1] || (m[1].length >= 3 && j.startsWith(m[1])));
    if (i >= 0) return { date: ajouterJours(aujourdhui, ((i - jourSemaine(aujourdhui) + 6) % 7) + 1) };
  }

  let a, mo, j;
  if ((m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/))) [a, mo, j] = [m[1], m[2], m[3]].map(Number);
  else if ((m = t.match(/^(\d{1,2}) ?[/.-] ?(\d{1,2})(?: ?[/.-] ?(\d{2}|\d{4}))?$/))) [j, mo, a] = [Number(m[1]), Number(m[2]), m[3] && Number(m[3])];
  else if ((m = t.match(/^(\d{1,2})(?:er)? ([a-z.]+)(?: (\d{2}|\d{4}))?$/))) {
    mo = numeroMois(m[2]);
    if (!mo) return null;
    [j, a] = [Number(m[1]), m[3] && Number(m[3])];
  } else return null;

  if (a && a < 100) a += 2000;
  if (!a) {
    // sans année : la prochaine occurrence (une date passée depuis moins d'un mois reste cette année → en retard)
    a = Number(aujourdhui.slice(0, 4));
    const essai = construire(a, mo, j);
    if (essai && joursEntre(aujourdhui, essai) < -30) a += 1;
  }
  const date = construire(a, mo, j);
  return date ? { date } : { erreur: `la date « ${texte.trim()} » n'existe pas` };
}

/** Lit une durée (« 6h », « 1h30 », « 90min », « 1,5 h », « 2 heures et demie », « 1:30 », « 3 »). Renvoie des minutes ou null. */
export function lireDuree(texte) {
  const t = simplifier(texte).replace(',', '.');
  let m, minutes = null;
  if ((m = t.match(/^(\d+(?:\.\d+)?) ?(?:h|hr?s?|heures?)(?: ?(\d{1,2}) ?(?:min|minutes?|mn|m)?)?( et (?:demie?|quart))?$/))) {
    minutes = Number(m[1]) * 60 + Number(m[2] ?? 0) + (m[3] ? (m[3].includes('quart') ? 15 : 30) : 0);
  } else if ((m = t.match(/^(\d+) ?(?:min|minutes?|mn|m)$/))) minutes = Number(m[1]);
  else if ((m = t.match(/^(\d+):(\d{2})$/))) minutes = Number(m[1]) * 60 + Number(m[2]);
  else if (/^(?:une )?demi[- ]heure$/.test(t)) minutes = 30;
  else if ((m = t.match(/^(\d+(?:\.\d+)?)$/))) minutes = Number(m[1]) * 60; // nombre seul = heures
  minutes = minutes === null ? null : Math.round(minutes);
  return minutes > 0 && minutes <= 1000 * 60 ? minutes : null;
}

const CATEGORIES = [
  ['partiel', /^(?:partiels?|exam(?:en)?s?|controles?|ds|interros?|concours|midterms?|finals?)$/],
  ['devoir', /^(?:devoirs?|dm|td|tp|rendus?|rapports?|exposes?|memoires?|homeworks?)$/],
  ['perso', /^(?:perso|projet perso|projets? persos?|projets?|personnel)$/],
  ['autre', /^(?:autres?|divers)$/],
];
const lireCategorie = t => CATEGORIES.find(([, re]) => re.test(simplifier(t)))?.[0] ?? null;

function devinerCategorie(titre, echeance) {
  const t = ` ${simplifier(titre).replace(/[^a-z0-9]+/g, ' ')} `;
  if (/ (?:partiels?|exam|examen|controle|ds|interro|concours|midterm|final|qcm) /.test(t)) return 'partiel';
  if (/ (?:devoir|dm|td|tp|rendu|rapport|expose|memoire|homework) /.test(t)) return 'devoir';
  return echeance ? 'autre' : 'perso';
}

function lireImportance(t) {
  const s = simplifier(t);
  const m = s.match(/^(?:imp(?:ortance)?\.? ?:? ?)?([1-5])(?: ?\/ ?5)?$/);
  if (m) return Number(m[1]);
  return /^[*★]{1,5}$/.test(s) ? s.length : null;
}

/** Une ligne de sous-tâche : « TD1 - 3h », « TD1 : 3h », « TD1 (3h) », « TD1 3h », « - TD1 3h ». */
export function lireTache(ligne) {
  const l = ligne.replace(/^\s*(?:[-*•·→>]|\d+[.)])\s+/, '').trim();
  // 1) avec un séparateur explicite : la durée est ce qui suit le dernier séparateur
  const separateurs = [...l.matchAll(/\s[-–—]\s|\s?:(?!\d)\s?|\s?[|;]\s?|,\s|\s?\(/g)]; // « 1:30 » et « 1,5h » ne coupent pas
  const dernier = separateurs.at(-1);
  if (dernier) {
    const titre = l.slice(0, dernier.index).trim();
    const brut = l.slice(dernier.index + dernier[0].length).replace(/\)\s*$/, '').trim();
    const minutes = lireDuree(brut);
    if (titre && minutes) {
      const seul = /^\d+(?:[.,]\d+)?$/.test(brut);
      return { titre, minutes, ...(seul && { note: `« ${brut} » compris comme ${brut}h` }) };
    }
  }
  // 2) sans séparateur : les derniers mots, avec une unité obligatoire (« Chapitre 3 » n'est pas une durée)
  const mots = l.split(' ');
  for (let k = Math.min(5, mots.length - 1); k >= 1; k--) {
    const brut = mots.slice(-k).join(' ');
    if (/^\d+(?:[.,]\d+)?$/.test(brut.trim())) continue;
    const minutes = lireDuree(brut);
    if (minutes) return { titre: mots.slice(0, -k).join(' ').replace(/[\s\-–—:|;,]+$/, ''), minutes };
  }
  const titre = (dernier ? l.slice(0, dernier.index).trim() : l) || 'TD1';
  return { erreur: `durée introuvable (écris par exemple « ${titre} - 2h »)` };
}

/**
 * Lit toute la saisie rapide. Une mission par bloc (blocs séparés par une ligne vide) :
 *   Titre | échéance | importance | catégorie     (tout est facultatif sauf le titre, dans n'importe quel ordre)
 *   Sous-tâche - durée
 */
export function lireSaisie(texte, aujourdhui) {
  const missions = [], erreurs = [], notes = [];
  let courante = null;
  texte.split(/\r?\n/).forEach((brut, i) => {
    const ligne = brut.trim(), n = i + 1;
    if (!ligne) { courante = null; return; }
    if (!courante) {
      const [titre, ...parties] = ligne.split(/\s*[|;]\s*/);
      courante = { ligne: n, titre: titre.trim(), echeance: null, importance: 3, categorie: null, taches: [], notes: [] };
      if (!courante.titre) erreurs.push({ ligne: n, message: 'il manque le titre de la mission' });
      let importanceDonnee = false;
      for (const p of parties.filter(Boolean)) {
        const imp = lireImportance(p), cat = lireCategorie(p), date = imp || cat ? null : lireDate(p, aujourdhui);
        if (imp) { courante.importance = imp; importanceDonnee = true; }
        else if (cat) courante.categorie = cat;
        else if (date?.erreur) erreurs.push({ ligne: n, message: date.erreur });
        else if (date) courante.echeance = date.date;
        else erreurs.push({ ligne: n, message: `« ${p} » non compris (attendu : une échéance, une importance de 1 à 5 ou une catégorie)` });
      }
      if (!parties.length && /\d{1,2}\s*\/\s*\d{1,2}/.test(ligne))
        notes.push({ ligne: n, message: "pour donner une échéance, sépare-la du titre avec | (ex. « Partiel | 12/12 | 5 »)" });
      if (!importanceDonnee) courante.notes.push('importance 3 par défaut');
      if (!courante.categorie) {
        courante.categorie = devinerCategorie(courante.titre, courante.echeance);
        courante.notes.push('catégorie devinée');
      }
      if (courante.titre) missions.push(courante);
      return;
    }
    const t = lireTache(ligne);
    if (t.erreur) erreurs.push({ ligne: n, message: t.erreur });
    else {
      courante.taches.push({ titre: t.titre, minutes: t.minutes });
      if (t.note) notes.push({ ligne: n, message: t.note });
    }
  });
  return { missions, erreurs, notes };
}
