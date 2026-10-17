// Point d'entrée : charge les données, gère la navigation (#/…) et relie les boutons à leurs actions.
import { aujourdhui } from './dates.js';
import { basculerTache, nouvellesDonnees, progression } from './donnees.js';
import { enregistrerJournee, enregistrerTache, solde } from './economie.js';
import { FOND_FIXE, afficherFond } from './fond.js';
import { indexTaches, preparerJournee, tachesDuJour } from './journee.js';
import { monde } from './mondes.js';
import { charger, enregistrer, proteger, surChangementAilleurs } from './stockage.js';
import { celebrer, fermerFenetres, html, ico, notifier } from './ui.js';
import * as accueil from './vues/accueil.js';
import * as calendrier from './vues/calendrier.js';
import * as carte from './vues/carte.js';
import * as creation from './vues/creation.js';
import * as mission from './vues/mission.js';
import * as missions from './vues/missions.js';
import * as personnage from './vues/personnage.js';
import * as reglages from './vues/reglages.js';
import * as stats from './vues/stats.js';

const travail = { titre: 'Travail', rendre: () => '' }; // page Travail : rien que le paysage
const ROUTES = { '': accueil, missions, mission, travail, calendrier, stats, personnage, carte, reglages };
const MODULES = [accueil, calendrier, carte, creation, mission, missions, personnage, reglages, stats];

const MENU = [
  { route: '', icone: 'maison', libelle: 'Accueil' },
  { route: 'missions', icone: 'parchemin', libelle: 'Missions' },
  { route: 'travail', icone: 'feu', libelle: 'Travail' },
  { route: 'calendrier', icone: 'calendrier', libelle: 'Calendrier' },
  { route: 'stats', icone: 'stats', libelle: 'Stats' },
  { route: 'personnage', icone: 'casque', libelle: 'Personnage' },
  { route: 'carte', icone: 'carte', libelle: 'Carte' },
  null,
  { route: 'reglages', icone: 'engrenage', libelle: 'Réglages' },
];

const app = {
  donnees: nouvellesDonnees(),
  ui: {}, // état d'affichage non enregistré : onglet, filtre, sous-tâche en cours de modification
  aujourdhui: aujourdhui(),
  protege: false,

  /** Applique un changement aux données, l'enregistre et réaffiche. `entites` : ce qui a changé (pour la future synchro). */
  modifier(changement, ...entites) {
    const resultat = changement(app.donnees);
    const t = new Date().toISOString();
    for (const e of entites) e.maj = t;
    app.donnees.maj = t;
    app.sauver();
    app.rendre();
    return resultat;
  },

  async sauver() {
    try {
      await enregistrer(app.donnees);
      alerteStockage(null);
      if (!app.demandeProtection) { app.demandeProtection = true; app.protege = await proteger(); }
    } catch (e) {
      alerteStockage(e);
    }
  },

  /** Une sous-tâche vient d'être cochée : célébration et pièces gagnées. */
  recompenser(m, { missionFinie, journeeFinie, gain }, rect) {
    const grand = missionFinie || journeeFinie;
    celebrer(rect, grand);
    if (missionFinie) celebrer(null, true);
    const texte = missionFinie ? `Mission accomplie : ${m.titre} !` : journeeFinie ? 'Journée accomplie ! Repos mérité.' : 'Tâche accomplie !';
    notifier(`${texte} +${gain} pièces`, grand ? 'trophee' : 'piece', grand ? 4000 : 2400);
  },

  rendre,
};

const actions = Object.assign({}, ...MODULES.map(m => m.actions));
const formulaires = Object.assign({}, ...MODULES.map(m => m.formulaires));
const changements = Object.assign({}, ...MODULES.map(m => m.changements), {
  cocher(app, el) {
    const x = indexTaches(app.donnees).get(el.dataset.id);
    if (!x) return;
    const rect = el.getBoundingClientRect(), faite = el.checked;
    const resultat = app.modifier(d => {
      const missionFinie = basculerTache(x.m, x.t, faite);
      let gain = enregistrerTache(d, x.t, x.m, faite, progression(x.m).terminee);
      const journeeFinie = faite && d.journee.ids.includes(x.t.id) && tachesDuJour(d, app.aujourdhui).every(y => y.t.faite);
      if (journeeFinie) gain += enregistrerJournee(d, app.aujourdhui);
      return { missionFinie, journeeFinie, gain };
    });
    if (faite) app.recompenser(x.m, resultat, rect);
  },
});

// ---------- Affichage ----------
const vueEl = document.getElementById('vue');
const menuEl = document.getElementById('menu');
const bourseEl = document.getElementById('bourse');
let fondActuel = null;
let pagePrecedente = '#/'; // pour quitter la page Travail

function bandeauRappel() {
  const d = app.donnees, r = d.reglages;
  if (!d.missions.length || r.rappelMasqueLe === app.aujourdhui) return '';
  const jours = Math.floor((Date.now() - Date.parse(r.derniereSauvegarde ?? d.creeLe)) / 864e5);
  if (jours < r.rappelJours || (r.derniereSauvegarde && d.maj <= r.derniereSauvegarde)) return '';
  return html`<div class="cadre rappel" role="status">${ico('disquette', 2)}
    <p>${r.derniereSauvegarde ? `Ta dernière sauvegarde date de ${jours} jours.` : "Tu n'as encore jamais sauvegardé tes données dans un fichier."}
      Une sauvegarde te protège si ce navigateur perd ses données.</p>
    <div class="vue-actions">
      <button class="btn btn-petit" data-action="exporter">${ico('disquette')}Sauvegarder</button>
      <button class="btn btn-petit btn-parchemin" data-action="rappel-plus-tard">Plus tard</button>
    </div></div>`;
}

function rendre() {
  app.aujourdhui = aujourdhui();
  if (preparerJournee(app.donnees, app.aujourdhui)) app.sauver();
  const [nom = '', param] = location.hash.replace(/^#\/?/, '').split('/');
  const vue = ROUTES[nom] ?? accueil;
  const { nom: nomMonde, numero } = monde(app.donnees.monde);
  const fond = FOND_FIXE ?? monde(app.donnees.monde).fond;
  if (fond !== fondActuel) { fondActuel = fond; afficherFond(fond); }
  document.body.classList.toggle('mode-travail', vue === travail);
  bourseEl.innerHTML = html`${ico('piece', 2)}<span><b>${solde(app.donnees)}</b> pièces<small>Monde ${numero} · ${nomMonde}</small></span>`;
  const cle = document.activeElement?.dataset?.cle;
  vueEl.innerHTML = html`${vue === travail ? '' : bandeauRappel()}${vue.rendre(app, param && decodeURIComponent(param))}`;
  const actif = nom === 'mission' ? 'missions' : ROUTES[nom] ? nom : '';
  for (const a of menuEl.querySelectorAll('[data-route]')) a.setAttribute('aria-current', a.dataset.route === actif ? 'page' : 'false');
  document.title = `${vue.titre} · Quest Log`;
  if (document.querySelector('.voile')) return; // une fenêtre est ouverte : ne pas lui voler le focus
  const cible = (cle && vueEl.querySelector(`[data-cle="${CSS.escape(cle)}"]`)) || vueEl.querySelector('[autofocus]');
  cible?.focus({ preventScroll: true });
}

function alerteStockage(erreur) {
  const el = document.getElementById('alerte-stockage');
  el.hidden = !erreur;
  if (erreur) el.innerHTML = html`${ico('alerte', 2)}<p><b>Attention :</b> ${erreur.message}. Tes derniers changements risquent d'être perdus : télécharge une sauvegarde.</p>
    <button class="btn btn-petit" data-action="exporter">${ico('disquette')}Sauvegarder</button>`;
}

menuEl.innerHTML = html`${MENU.map(e => (e
  ? html`<a href="#/${e.route}" data-route="${e.route}" title="${e.libelle}">${ico(e.icone, 2)}<span class="libelle">${e.libelle}</span></a>`
  : html`<hr>`))}`;

// ---------- Événements (un seul écouteur par type, pour toute l'application) ----------
document.addEventListener('click', e => {
  const el = e.target.closest('[data-action]');
  if (!el || el.disabled) return;
  e.preventDefault();
  actions[el.dataset.action]?.(app, el, e);
});
document.addEventListener('change', e => {
  const el = e.target.closest('[data-change]');
  if (el) changements[el.dataset.change]?.(app, el, e);
});
document.addEventListener('submit', e => {
  const form = e.target.closest('form[data-form]');
  if (!form) return;
  e.preventDefault();
  formulaires[form.dataset.form]?.(app, form, new FormData(form));
});
addEventListener('hashchange', e => {
  const avant = new URL(e.oldURL).hash || '#/';
  if (avant !== '#/travail') pagePrecedente = avant;
  fermerFenetres();
  app.ui.edition = null;
  rendre();
  scrollTo(0, 0);
});
const quitterTravail = () => { location.hash = pagePrecedente; };
document.getElementById('sortie-travail').addEventListener('click', quitterTravail);
addEventListener('keydown', e => { if (e.key === 'Escape' && document.body.classList.contains('mode-travail')) quitterTravail(); });
document.addEventListener('visibilitychange', () => { if (!document.hidden && aujourdhui() !== app.aujourdhui) rendre(); }); // nouveau jour

// ---------- Démarrage ----------
try {
  app.donnees = await charger();
} catch (e) {
  alerteStockage(e);
}
try { app.protege = (await navigator.storage?.persisted?.()) ?? false; } catch { /* navigateur sans cette fonction */ }
surChangementAilleurs(d => { app.donnees = d; rendre(); });
rendre();
