// Page Stats : calendrier d'activité façon GitHub (un carré par jour, plus vert = plus efficace) et chiffres clés.
import { ajouterJours, dateLongue, duree, jourSemaine } from '../dates.js';
import { progression } from '../donnees.js';
import { gagne } from '../economie.js';
import { minutesDispo } from '../journee.js';
import { minutesParDate, niveau, series } from '../stats.js';
import { html, ico } from '../ui.js';

export const titre = 'Stats';
const MOIS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

export function rendre(app) {
  const d = app.donnees, auj = app.aujourdhui;
  const parDate = minutesParDate(d.journal);
  const lundi = ajouterJours(auj, -jourSemaine(auj));
  const debut = ajouterJours(lundi, -52 * 7); // 53 semaines
  const cases = [], etiquettes = [];
  for (let i = 0, date = debut; date <= auj; i++, date = ajouterJours(date, 1)) {
    const min = parDate.get(date) ?? 0, dispo = minutesDispo(d.reglages, date);
    if (date.slice(8) === '01') etiquettes.push(html`<span style="grid-column:${Math.floor(i / 7) + 1}">${MOIS[Number(date.slice(5, 7)) - 1]}</span>`);
    cases.push(html`<i class="n${niveau(min, dispo)}" title="${dateLongue(date)} : ${min ? `${duree(min)} faites sur ${duree(dispo)} prévues` : 'rien de fait'}"></i>`);
  }
  const total = [...parDate.values()].reduce((s, v) => s + v, 0);
  let semaine = 0;
  for (let date = lundi; date <= auj; date = ajouterJours(date, 1)) semaine += parDate.get(date) ?? 0;
  const { actuelle, record } = series(parDate, auj);
  const seances = Object.keys(d.journal).filter(cle => cle.startsWith('seance:')).length;
  const chiffres = [
    ['horloge', duree(total), 'de travail accompli'],
    ['calendrier', duree(semaine), 'cette semaine'],
    ['coche', seances, seances > 1 ? 'séances accomplies' : 'séance accomplie'],
    ['trophee', d.missions.filter(m => progression(m).terminee).length, 'missions terminées'],
    ['feu', `${actuelle} j`, `série en cours (record : ${record} j)`],
    ['piece', gagne(d), 'pièces gagnées en tout'],
  ];
  return html`
    <section class="cadre">
      <h1>Stats</h1>
      <h2>${ico('stats', 2)} Mon activité</h2>
      <p class="note">Un carré par jour : plus il est vert, plus tu as fait de ce que tu avais prévu ce jour-là.</p>
      <div class="activite" tabindex="0" aria-label="Calendrier d'activité de l'année">
        <div class="activite-mois">${etiquettes}</div>
        <div class="activite-jours"><span>Lun</span><span></span><span>Mer</span><span></span><span>Ven</span><span></span><span>Dim</span></div>
        <div class="activite-grille">${cases}</div>
      </div>
      <div class="legende"><small>Moins</small>${[0, 1, 2, 3, 4].map(n => html`<i class="n${n}"></i>`)}<small>Plus</small></div>
    </section>
    <section class="cadre">
      <h2>${ico('trophee', 2)} Mes chiffres</h2>
      <ul class="chiffres">${chiffres.map(([icone, valeur, texte]) => html`<li class="cadre cadre-creux">${ico(icone, 2)}<strong>${valeur}</strong><small>${texte}</small></li>`)}</ul>
    </section>`;
}
