// Page d'une mission : avancement, sous-tâches (cocher, ajouter, modifier, réordonner, supprimer).
import { dateLongue, duree } from '../dates.js';
import { actualiser, nouvelleTache, progression } from '../donnees.js';
import { lireDuree } from '../saisie.js';
import { badgeCategorie, badgeEcheance, barre, confirmer, etoiles, html, ico, notifier } from '../ui.js';
import { ouvrirEdition } from './creation.js';

export const titre = 'Mission';
const trouver = (app, id) => app.donnees.missions.find(m => m.id === id);
const trouverTache = (app, id) => {
  for (const m of app.donnees.missions) { const t = m.taches.find(x => x.id === id); if (t) return { m, t }; }
  return {};
};

const ligne = (t, i, n) => html`<li class="${t.faite ? 'fait' : ''}">
  <input type="checkbox" class="case" data-change="cocher" data-id="${t.id}" data-cle="c-${t.id}" ${t.faite ? html`checked` : ''} aria-label="Fait : ${t.titre}">
  <span class="st-titre">${t.titre}</span>
  ${t.reports ? html`<span class="puce puce-raison" title="Reportée ${t.reports} fois">${ico('sablier')}×${t.reports}</span>` : ''}
  <span class="puce">${duree(t.minutes)}</span>
  <span class="st-actions">
    <button class="btn btn-icone btn-parchemin" data-action="monter" data-id="${t.id}" data-cle="h-${t.id}" title="Monter" ${i === 0 ? html`disabled` : ''}>${ico('haut', 1, 'Monter')}</button>
    <button class="btn btn-icone btn-parchemin" data-action="descendre" data-id="${t.id}" data-cle="b-${t.id}" title="Descendre" ${i === n - 1 ? html`disabled` : ''}>${ico('bas', 1, 'Descendre')}</button>
    <button class="btn btn-icone btn-bois" data-action="editer-tache" data-id="${t.id}" title="Modifier">${ico('crayon', 1, 'Modifier')}</button>
    <button class="btn btn-icone btn-rouge" data-action="supprimer-tache" data-id="${t.id}" title="Supprimer">${ico('poubelle', 1, 'Supprimer')}</button>
  </span>
</li>`;

const ligneEdition = t => html`<li>
  <form class="form-tache" data-form="editer-tache" data-id="${t.id}">
    <input class="champ" name="titre" required maxlength="200" value="${t.titre}" aria-label="Titre de la sous-tâche" autofocus>
    <input class="champ champ-duree" name="duree" required value="${duree(t.minutes)}" aria-label="Durée estimée">
    <button class="btn btn-vert btn-petit">${ico('coche')}OK</button>
    <button type="button" class="btn btn-parchemin btn-petit" data-action="annuler-edition">Annuler</button>
    <div class="message-erreur" data-erreur hidden></div>
  </form>
</li>`;

export function rendre(app, id) {
  const m = trouver(app, id);
  if (!m) return html`<section class="cadre etat-vide">${ico('crane', 3)}<p>Cette mission n'existe pas (ou plus).</p>
    <a class="btn" href="#/missions">${ico('gauche')}Retour aux missions</a></section>`;
  const p = progression(m);
  return html`
    <div><a class="btn btn-petit btn-parchemin" href="#/missions">${ico('gauche')}Missions</a></div>
    <section class="cadre">
      <div class="mission-tete"><h1>${m.titre}</h1>${badgeCategorie(m.categorie)}</div>
      <div class="mission-infos">
        ${etoiles(m.importance)}${badgeEcheance(m, app.aujourdhui)}
        ${m.echeance && html`<small>${dateLongue(m.echeance)}</small>`}
        ${m.archivee && html`<span class="badge badge-bientot">${ico('coffre')}Archivée</span>`}
      </div>
      ${barre(p.minutesFaites, p.minutesTotal)}
      <small>${p.faites}/${p.total} sous-tâches faites${p.total > p.faites ? ` · ${duree(p.minutesTotal - p.minutesFaites)} restantes` : ''}</small>
      ${p.terminee && html`<div class="victoire">${ico('trophee', 3)}<div><h2>Mission accomplie !</h2><p>Bravo, aventurier. Tu peux l'archiver pour faire de la place.</p></div></div>`}
      <div class="vue-actions">
        <button class="btn btn-petit btn-bois" data-action="modifier-mission" data-id="${m.id}">${ico('crayon')}Modifier</button>
        <button class="btn btn-petit btn-parchemin" data-action="archiver" data-id="${m.id}">${ico('coffre')}${m.archivee ? 'Désarchiver' : 'Archiver'}</button>
        <button class="btn btn-petit btn-rouge" data-action="supprimer-mission" data-id="${m.id}">${ico('poubelle')}Supprimer</button>
      </div>
    </section>
    <section class="cadre">
      <h2>Sous-tâches</h2>
      ${m.taches.length ? html`<ul class="sous-taches">${m.taches.map((t, i) => (app.ui.edition === t.id ? ligneEdition(t) : ligne(t, i, m.taches.length)))}</ul>`
        : html`<p class="note">Aucune sous-tâche pour l'instant. Découpe ta mission en étapes avec leur durée estimée.</p>`}
      <form class="form-tache ajout" data-form="ajouter-tache" data-id="${m.id}">
        <input class="champ" name="titre" required maxlength="200" placeholder="Nouvelle sous-tâche" aria-label="Nouvelle sous-tâche" data-cle="ajout-titre" ${m.taches.length ? '' : html`autofocus`}>
        <input class="champ champ-duree" name="duree" required placeholder="1h30" aria-label="Durée estimée">
        <button class="btn btn-vert btn-petit">${ico('plus')}Ajouter</button>
        <div class="message-erreur" data-erreur hidden></div>
      </form>
    </section>`;
}

/** Lit titre + durée d'un formulaire de sous-tâche ; affiche l'erreur dans le formulaire si besoin. */
function lireFormulaireTache(form, data) {
  const titre = String(data.get('titre')).trim(), brut = String(data.get('duree')).trim();
  const minutes = lireDuree(brut);
  const probleme = !titre ? 'Il manque le titre de la sous-tâche.'
    : !minutes ? `Durée « ${brut} » non comprise : écris par exemple 2h, 1h30 ou 45min.` : null;
  const erreur = form.querySelector('[data-erreur]');
  form.elements.duree.classList.toggle('erreur', !minutes);
  if (!probleme) return { titre, minutes };
  erreur.hidden = false;
  erreur.innerHTML = html`${ico('alerte')}<span>${probleme}</span>`;
  (titre ? form.elements.duree : form.elements.titre).focus();
  return null;
}

function deplacer(app, id, sens) {
  const { m } = trouverTache(app, id);
  if (!m) return;
  const i = m.taches.findIndex(t => t.id === id), j = i + sens;
  if (j < 0 || j >= m.taches.length) return;
  app.modifier(() => { [m.taches[i], m.taches[j]] = [m.taches[j], m.taches[i]]; }, m);
}

export const actions = {
  monter: (app, el) => deplacer(app, el.dataset.id, -1),
  descendre: (app, el) => deplacer(app, el.dataset.id, 1),
  'editer-tache': (app, el) => { app.ui.edition = el.dataset.id; app.rendre(); },
  'annuler-edition': app => { app.ui.edition = null; app.rendre(); },
  async 'supprimer-tache'(app, el) {
    const { m, t } = trouverTache(app, el.dataset.id);
    if (!t || !(await confirmer({ titre: 'Supprimer la sous-tâche ?', message: `« ${t.titre} » sera supprimée.`, bouton: 'Supprimer' }))) return;
    app.modifier(() => { m.taches = m.taches.filter(x => x !== t); actualiser(m); });
  },
  'modifier-mission': (app, el) => ouvrirEdition(trouver(app, el.dataset.id)),
  archiver(app, el) {
    const m = trouver(app, el.dataset.id);
    app.modifier(() => { m.archivee = !m.archivee; }, m);
    notifier(m.archivee ? 'Mission archivée' : 'Mission désarchivée', 'coffre');
  },
  async 'supprimer-mission'(app, el) {
    const m = trouver(app, el.dataset.id);
    const ok = await confirmer({
      titre: 'Supprimer la mission ?', bouton: 'Supprimer',
      message: `« ${m.titre} » et ses ${m.taches.length} sous-tâches seront supprimées définitivement. (Pour la garder sans l'afficher, archive-la plutôt.)`,
    });
    if (!ok) return;
    app.modifier(d => { d.missions = d.missions.filter(x => x !== m); });
    notifier('Mission supprimée', 'poubelle');
    location.hash = '#/missions';
  },
};

export const formulaires = {
  'ajouter-tache'(app, form, data) {
    const m = trouver(app, form.dataset.id), champs = lireFormulaireTache(form, data);
    if (!m || !champs) return;
    app.modifier(() => { m.taches.push(nouvelleTache(champs)); actualiser(m); });
    document.querySelector('[data-cle="ajout-titre"]')?.focus(); // enchaîner les ajouts au clavier
  },
  'editer-tache'(app, form, data) {
    const { m, t } = trouverTache(app, form.dataset.id), champs = lireFormulaireTache(form, data);
    if (!t || !champs) return;
    app.ui.edition = null;
    app.modifier(() => Object.assign(t, champs), t, m);
  },
};
