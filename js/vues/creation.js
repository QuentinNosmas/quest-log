// Fenêtres de création et de modification d'une mission : saisie rapide (avec aperçu) ou formulaire.
import { duree } from '../dates.js';
import { CATEGORIES, nouvelleMission } from '../donnees.js';
import { lireSaisie } from '../saisie.js';
import { badgeCategorie, badgeEcheance, etoiles, fermerFenetreDe, html, ico, notifier, ouvrirFenetre, src } from '../ui.js';

let brouillon = ''; // la saisie rapide est gardée si la fenêtre est fermée par erreur
const EXEMPLE = 'Partiel calcul stochastique | 12/12 | 5\nCours à apprendre - 6h\nTD1 - 3h\n2 exercices poussés - 4h';

export function formulaireMission(m) {
  const imp = m?.importance ?? 3;
  return html`<form data-form="mission" data-id="${m?.id ?? ''}">
    <div class="champ-groupe">
      <label class="etiquette" for="fm-titre">Titre</label>
      <input class="champ" id="fm-titre" name="titre" required maxlength="200" value="${m?.titre ?? ''}" placeholder="Partiel calcul stochastique" autofocus>
    </div>
    <div class="rangee-champs">
      <div class="champ-groupe">
        <label class="etiquette" for="fm-echeance">Échéance (facultative)</label>
        <input class="champ" type="date" id="fm-echeance" name="echeance" value="${m?.echeance ?? ''}">
      </div>
      <div class="champ-groupe">
        <label class="etiquette" for="fm-categorie">Catégorie</label>
        <select class="champ" id="fm-categorie" name="categorie">${Object.entries(CATEGORIES).map(([v, l]) =>
          html`<option value="${v}" ${(m?.categorie ?? 'partiel') === v ? html`selected` : ''}>${l}</option>`)}</select>
      </div>
    </div>
    <fieldset class="choix-importance">
      <legend class="etiquette">Importance</legend>
      ${[1, 2, 3, 4, 5].map(i => html`<label title="Importance ${i}"><input class="sr" type="radio" name="importance" value="${i}" ${i === imp ? html`checked` : ''}><img class="ico ico-2x" src="${src('etoile')}" alt="${i}"></label>`)}
    </fieldset>
    <div class="actions-fenetre">
      <button type="button" class="btn btn-parchemin" data-fermer>Annuler</button>
      <button class="btn btn-vert">${ico('coche')}${m ? 'Enregistrer' : 'Créer la mission'}</button>
    </div>
  </form>`;
}

function apercu(r, texte, aujourdhui) {
  if (!texte.trim()) return html`<p class="note">L'aperçu de ce qui sera créé s'affichera ici.</p>`;
  return html`${r.missions.map(m => {
    const total = m.taches.reduce((s, t) => s + t.minutes, 0), n = m.taches.length;
    return html`<div class="cadre cadre-creux apercu-mission">
      <div class="mission-tete"><h3>${m.titre}</h3>${badgeCategorie(m.categorie)}</div>
      <div class="mission-infos">${etoiles(m.importance)}${badgeEcheance({ echeance: m.echeance, taches: [] }, aujourdhui)}</div>
      ${n ? html`<ul class="sous-taches">${m.taches.map(t => html`<li><span>${t.titre}</span><span class="puce">${duree(t.minutes)}</span></li>`)}</ul>`
        : html`<p class="note">Aucune sous-tâche : tu pourras en ajouter ensuite.</p>`}
      <small>${n} sous-tâche${n > 1 ? 's' : ''} · ${duree(total)} au total${m.notes.length ? ` · ${m.notes.join(', ')}` : ''}</small>
    </div>`;
  })}
  ${r.erreurs.map(e => html`<div class="message-erreur">${ico('alerte')}<span>Ligne ${e.ligne} : ${e.message}</span></div>`)}
  ${r.notes.map(e => html`<div class="message-info">${ico('eclair')}<span>Ligne ${e.ligne} : ${e.message}</span></div>`)}`;
}

export function ouvrirCreation(app) {
  const f = ouvrirFenetre({
    titre: 'Nouvelle mission', icone: 'plus', large: true,
    corps: html`
      <div class="onglets" role="tablist">
        <button type="button" class="btn btn-petit enfonce" role="tab" aria-selected="true" data-onglet="rapide">${ico('eclair')}Saisie rapide</button>
        <button type="button" class="btn btn-petit btn-parchemin" role="tab" aria-selected="false" data-onglet="formulaire">${ico('crayon')}Formulaire</button>
      </div>
      <div data-panneau="rapide">
        <label class="etiquette" for="saisie-rapide">1re ligne : titre | échéance | importance — puis une sous-tâche par ligne</label>
        <textarea class="champ" id="saisie-rapide" rows="6" spellcheck="false" placeholder="${EXEMPLE}" autofocus>${brouillon}</textarea>
        <details class="aide">
          <summary>Formats acceptés</summary>
          <ul>
            <li><b>Échéance</b> : 12/12, 12/12/2027, 12 déc, demain, lundi, dans 5 jours, sans date</li>
            <li><b>Importance</b> : un chiffre de 1 à 5 (3 si tu ne mets rien)</li>
            <li><b>Catégorie</b> : partiel, devoir, perso ou autre (sinon devinée d'après le titre)</li>
            <li><b>Durées</b> : 6h, 1h30, 90min, 1,5h, 2 heures et demie</li>
            <li><b>Plusieurs missions d'un coup</b> : laisse une ligne vide entre elles</li>
          </ul>
        </details>
        <div class="apercu" aria-live="polite"></div>
        <div class="actions-fenetre">
          <button type="button" class="btn btn-parchemin" data-fermer>Annuler</button>
          <button type="button" class="btn btn-vert" data-creer disabled>Créer</button>
        </div>
      </div>
      <div data-panneau="formulaire" hidden>${formulaireMission()}</div>`,
  });
  const el = f.el;

  for (const bouton of el.querySelectorAll('[data-onglet]')) bouton.addEventListener('click', () => {
    for (const b of el.querySelectorAll('[data-onglet]')) {
      const actif = b === bouton;
      b.classList.toggle('enfonce', actif);
      b.classList.toggle('btn-parchemin', !actif);
      b.setAttribute('aria-selected', actif);
    }
    for (const p of el.querySelectorAll('[data-panneau]')) p.hidden = p.dataset.panneau !== bouton.dataset.onglet;
    el.querySelector(`[data-panneau="${bouton.dataset.onglet}"] :is(textarea, input)`).focus();
  });

  const zone = el.querySelector('#saisie-rapide'), zoneApercu = el.querySelector('.apercu'), creer = el.querySelector('[data-creer]');
  let resultat;
  const majApercu = () => {
    brouillon = zone.value;
    resultat = lireSaisie(zone.value, app.aujourdhui);
    zoneApercu.innerHTML = apercu(resultat, zone.value, app.aujourdhui);
    const n = resultat.missions.length;
    creer.disabled = !n;
    creer.innerHTML = html`${ico('coche')}${n > 1 ? `Créer ${n} missions` : 'Créer la mission'}${resultat.erreurs.length ? ' en ignorant les erreurs' : ''}`;
  };
  zone.addEventListener('input', majApercu);
  majApercu();

  creer.addEventListener('click', () => {
    const nouvelles = resultat.missions.map(m => nouvelleMission(m));
    app.modifier(d => d.missions.push(...nouvelles));
    brouillon = '';
    f.fermer();
    notifier(nouvelles.length > 1 ? `${nouvelles.length} missions créées !` : 'Mission créée !', 'parchemin');
    location.hash = nouvelles.length === 1 ? `#/mission/${nouvelles[0].id}` : '#/missions';
  });
}

export const ouvrirEdition = m => ouvrirFenetre({ titre: 'Modifier la mission', icone: 'crayon', corps: formulaireMission(m) });

export const actions = {
  'nouvelle-mission': app => ouvrirCreation(app),
};

export const formulaires = {
  mission(app, form, data) {
    const titre = String(data.get('titre')).trim();
    if (!titre) return;
    const categorie = data.get('categorie');
    const champs = {
      titre,
      echeance: data.get('echeance') || null,
      importance: Number(data.get('importance')) || 3,
      categorie: categorie in CATEGORIES ? categorie : 'autre',
    };
    fermerFenetreDe(form);
    const existante = app.donnees.missions.find(m => m.id === form.dataset.id);
    if (existante) {
      app.modifier(() => Object.assign(existante, champs), existante);
      notifier('Mission modifiée', 'crayon');
    } else {
      const m = nouvelleMission(champs);
      app.modifier(d => d.missions.push(m));
      notifier('Mission créée ! Ajoute ses sous-tâches.', 'parchemin');
      location.hash = `#/mission/${m.id}`;
    }
  },
};
