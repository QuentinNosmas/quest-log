// Page Calendrier : toutes les échéances du mois d'un coup d'œil, et la liste des prochaines.
import { ajouterJours, ajouterMois, construire, dateCourte, jourSemaine } from '../dates.js';
import { JOURS_COURTS, progression, statut, trierMissions } from '../donnees.js';
import { badgeCategorie, badgeEcheance, html, ico } from '../ui.js';

export const titre = 'Calendrier';
const NOM_MOIS = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric', timeZone: 'UTC' });

export function rendre(app, mois) {
  const auj = app.aujourdhui;
  const [a, m] = (/^\d{4}-\d{2}$/.test(mois ?? '') ? mois : auj.slice(0, 7)).split('-').map(Number);
  const premier = construire(a, m, 1) ?? `${auj.slice(0, 7)}-01`;
  const debut = ajouterJours(premier, -jourSemaine(premier));
  const fin = ajouterJours(ajouterMois(premier, 1), -1);
  const semaines = Math.ceil((jourSemaine(premier) + Number(fin.slice(8))) / 7);
  const visibles = app.donnees.missions.filter(x => x.echeance && !x.archivee);
  const parJour = new Map();
  for (const x of visibles) parJour.set(x.echeance, [...(parJour.get(x.echeance) ?? []), x]);
  const titreMois = NOM_MOIS.format(Date.UTC(Number(premier.slice(0, 4)), Number(premier.slice(5, 7)) - 1, 1));
  const aVenir = trierMissions(visibles.filter(x => statut(x) === 'encours')).slice(0, 12);

  const jours = Array.from({ length: semaines * 7 }, (_, i) => {
    const date = ajouterJours(debut, i);
    const classes = [date.slice(0, 7) !== premier.slice(0, 7) && 'hors', date === auj && 'aujourdhui', date < auj && 'passe'].filter(Boolean).join(' ');
    return html`<div class="jour-cal ${classes}">
      <span class="num">${Number(date.slice(8))}</span>
      ${(parJour.get(date) ?? []).map(x => html`<a class="cal-mission badge-${x.categorie}${progression(x).terminee ? ' fini' : ''}" href="#/mission/${x.id}" title="${x.titre}">${x.titre}</a>`)}
    </div>`;
  });

  return html`
    <section class="cadre">
      <header class="vue-tete">
        <h1>Calendrier</h1>
        <div class="vue-actions">
          <a class="btn btn-petit btn-parchemin btn-icone" href="#/calendrier/${ajouterMois(premier, -1).slice(0, 7)}" title="Mois précédent">${ico('gauche', 1, 'Mois précédent')}</a>
          <a class="btn btn-petit btn-parchemin" href="#/calendrier">Aujourd'hui</a>
          <a class="btn btn-petit btn-parchemin btn-icone" href="#/calendrier/${ajouterMois(premier, 1).slice(0, 7)}" title="Mois suivant">${ico('droite', 1, 'Mois suivant')}</a>
        </div>
      </header>
      <h2 class="titre-mois">${titreMois[0].toUpperCase() + titreMois.slice(1)}</h2>
      <div class="calendrier">
        ${JOURS_COURTS.map(j => html`<div class="entete-cal">${j}</div>`)}
        ${jours}
      </div>
    </section>
    <section class="cadre">
      <h2>${ico('sablier', 2)} Prochaines échéances</h2>
      ${aVenir.length ? html`<ul class="liste-echeances">${aVenir.map(x => html`<li>
          <span class="date-echeance">${dateCourte(x.echeance, auj)}</span>
          <a class="lien-titre" href="#/mission/${x.id}">${x.titre}</a>
          ${badgeCategorie(x.categorie)}${badgeEcheance(x, auj)}
        </li>`)}</ul>`
        : html`<p class="note">Aucune échéance à venir. Les missions sans date n'apparaissent pas ici.</p>`}
    </section>`;
}
