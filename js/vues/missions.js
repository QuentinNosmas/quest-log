// Page « Missions » : toutes les missions, triées par échéance, filtrables par catégorie.
import { CATEGORIES, progression, statut, trierMissions } from '../donnees.js';
import { badgeCategorie, badgeEcheance, barre, etoiles, html, ico } from '../ui.js';

export const titre = 'Missions';
const ONGLETS = [['encours', 'En cours'], ['terminee', 'Terminées'], ['archivee', 'Archivées']];

const carte = (m, aujourdhui) => {
  const p = progression(m);
  return html`<a class="cadre carte-mission" href="#/mission/${m.id}">
    <div class="mission-tete"><h3>${m.titre}</h3>${badgeCategorie(m.categorie)}</div>
    <div class="mission-infos">${etoiles(m.importance)}${badgeEcheance(m, aujourdhui)}<small>${p.faites}/${p.total} sous-tâches</small></div>
    ${barre(p.minutesFaites, p.minutesTotal)}
  </a>`;
};

export function rendre(app) {
  const onglet = app.ui.onglet ?? 'encours', categorie = app.ui.categorie ?? '';
  const toutes = app.donnees.missions;
  const liste = trierMissions(toutes.filter(m => statut(m) === onglet && (!categorie || m.categorie === categorie)));
  const vide = { encours: 'Aucune mission en cours.', terminee: 'Aucune mission terminée pour le moment.', archivee: 'Aucune mission archivée.' }[onglet];
  return html`
    <section class="cadre">
      <header class="vue-tete">
        <h1>Missions</h1>
        <div class="vue-actions"><button class="btn" data-action="nouvelle-mission">${ico('plus')}Nouvelle mission</button></div>
      </header>
      <div class="onglets" role="tablist">${ONGLETS.map(([v, l]) => html`
        <button class="btn btn-petit ${v === onglet ? 'enfonce' : 'btn-parchemin'}" role="tab" aria-selected="${v === onglet}" data-action="onglet" data-valeur="${v}">
          ${l} (${toutes.filter(m => statut(m) === v).length})</button>`)}
      </div>
      <div class="filtres" aria-label="Filtrer par catégorie">${[['', 'Toutes'], ...Object.entries(CATEGORIES)].map(([v, l]) => html`
        <button class="badge filtre ${v ? `badge-${v}` : ''} ${v === categorie ? 'actif' : ''}" aria-pressed="${v === categorie}" data-action="filtre" data-valeur="${v}">${l}</button>`)}
      </div>
    </section>
    ${liste.length ? liste.map(m => carte(m, app.aujourdhui)) : html`
      <section class="cadre etat-vide">
        ${ico('parchemin', 3)}
        <p>${vide}${categorie ? ` (catégorie ${CATEGORIES[categorie]})` : ''}</p>
        ${onglet === 'encours' && html`<button class="btn" data-action="nouvelle-mission">${ico('plus')}Nouvelle mission</button>`}
      </section>`}`;
}

export const actions = {
  onglet: (app, el) => { app.ui.onglet = el.dataset.valeur; app.rendre(); },
  filtre: (app, el) => { app.ui.categorie = el.dataset.valeur; app.rendre(); },
};
