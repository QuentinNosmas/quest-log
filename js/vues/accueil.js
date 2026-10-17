// Accueil : les missions du jour.
import { dateLongue, duree } from '../dates.js';
import {
  ajouterAJournee, candidates, minutesDispo, raisons, recalculerJournee, reporter, retirerDeJournee, tachesDuJour,
} from '../journee.js';
import { barre, fermerFenetreDe, html, ico, notifier, ouvrirFenetre } from '../ui.js';

export const titre = 'Missions du jour';

const ligne = ({ t, m }, app) => html`<li class="tache-jour${t.faite ? ' fait' : ''}">
  <input type="checkbox" class="case" data-change="cocher" data-id="${t.id}" data-cle="c-${t.id}" ${t.faite ? html`checked` : ''} aria-label="Terminer : ${t.titre}">
  <div class="tache-corps">
    <strong>${t.titre}</strong> <a class="lien-mission" href="#/mission/${m.id}">· ${m.titre}</a>
    ${!t.faite && html`<div>${raisons(t, m, app.donnees, app.aujourdhui).map(r => html`<span class="puce puce-raison">${r}</span>`)}</div>`}
  </div>
  <span class="puce">${ico('horloge')}${duree(t.minutes)}</span>
  ${!t.faite && html`<div class="tache-actions">
    <button class="btn btn-icone btn-lagon" data-action="reporter" data-id="${t.id}" title="Reporter à demain">${ico('sablier', 1, 'Reporter à demain')}</button>
    <button class="btn btn-icone btn-rouge" data-action="retirer" data-id="${t.id}" title="Retirer de ma journée">${ico('fermer', 1, 'Retirer de ma journée')}</button>
  </div>`}
</li>`;

const accueilVide = () => html`<section class="cadre etat-vide">
  ${ico('parchemin', 3)}
  <h1>Bienvenue, aventurier !</h1>
  <p>Ton journal de quêtes est vide. Crée ta première mission : un partiel, un devoir, un projet…<br>
  Chaque jour, je te proposerai les tâches à faire selon le temps dont tu disposes.</p>
  <div class="vue-actions centre">
    <button class="btn btn-grand" data-action="nouvelle-mission">${ico('plus', 2)}Créer ma première mission</button>
    <button class="btn btn-parchemin" data-action="exemples">${ico('de')}Essayer avec des exemples</button>
  </div>
</section>`;

export function rendre(app) {
  const d = app.donnees, auj = app.aujourdhui;
  if (!d.missions.length) return accueilVide();
  const taches = tachesDuJour(d, auj);
  const dispo = minutesDispo(d.reglages, auj);
  const prevu = taches.reduce((s, x) => s + x.t.minutes, 0);
  const fait = taches.reduce((s, x) => s + (x.t.faite ? x.t.minutes : 0), 0);
  const resteAFaire = candidates(d, auj).length;
  const vide = !resteAFaire && !taches.length ? html`${ico('trophee', 3)}<p>Toutes tes missions sont terminées. Quel héros !</p>
      <button class="btn" data-action="nouvelle-mission">${ico('plus')}Nouvelle mission</button>`
    : !dispo ? html`${ico('maison', 3)}<p>Jour de repos ! Rien n'est prévu aujourd'hui.<br>Tu peux quand même ajouter une tâche si tu en as envie.</p>`
    : html`${ico('sablier', 3)}<p>Ta journée est vide. Ajoute une tâche ou demande une nouvelle proposition.</p>`;

  return html`<section class="cadre">
    <header class="vue-tete">
      <div><h1>Missions du jour</h1><span class="etiquette">${dateLongue(auj)}</span></div>
      <div class="vue-actions">
        <button class="btn btn-petit btn-lagon" data-action="recalculer" title="Recalcule ta journée avec tes dernières missions">${ico('de')}Nouvelle proposition</button>
        <button class="btn btn-petit" data-action="choisir-tache" ${resteAFaire ? '' : html`disabled`}>${ico('plus')}Ajouter une tâche</button>
      </div>
    </header>
    <div class="jour-resume">
      <span class="puce">${ico('horloge')}${duree(prevu)} au programme · ${duree(dispo)} disponibles</span>
      <a class="lien-mission" href="#/reglages">changer mon temps</a>
    </div>
    ${taches.length ? html`
      ${barre(fait, prevu, fait >= prevu ? 'Journée accomplie !' : `${duree(fait)} / ${duree(prevu)} faites`)}
      <ul class="taches-jour">${taches.map(x => ligne(x, app))}</ul>`
    : html`<div class="etat-vide">${vide}</div>`}
  </section>`;
}

function choisirTache(app) {
  const dans = new Set(app.donnees.journee.ids);
  const liste = candidates(app.donnees, app.aujourdhui).filter(c => !dans.has(c.t.id));
  ouvrirFenetre({
    titre: 'Ajouter à ma journée', icone: 'plus', large: true,
    corps: html`<p class="note">De la plus prioritaire à la moins prioritaire.</p>
      <ul class="choix-taches">${liste.map(({ t, m }) => html`<li>
        <button class="btn btn-parchemin" data-action="ajouter-a-journee" data-id="${t.id}">
          <span class="choix-titre">${t.titre} <small>· ${m.titre}</small></span><span class="puce">${duree(t.minutes)}</span>
        </button></li>`)}</ul>`,
  });
}

export const actions = {
  recalculer(app) {
    app.modifier(d => recalculerJournee(d, app.aujourdhui));
    notifier('Nouvelle proposition prête !', 'de');
  },
  reporter(app, el) {
    app.modifier(d => reporter(d, el.dataset.id));
    notifier('Reportée à demain', 'sablier');
  },
  retirer: (app, el) => app.modifier(d => retirerDeJournee(d, el.dataset.id)),
  'choisir-tache': app => choisirTache(app),
  'ajouter-a-journee'(app, el) {
    fermerFenetreDe(el);
    app.modifier(d => ajouterAJournee(d, el.dataset.id));
    notifier('Ajoutée à ta journée', 'plus');
  },
};
