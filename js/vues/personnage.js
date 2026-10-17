// Page Personnage : apparence du héros et boutique d'équipement.
import { acheter, mondesOuverts, solde } from '../economie.js';
import { MONDES } from '../mondes.js';
import {
  CHEVEUX, COIFFURES, EMPLACEMENTS, OBJETS, PEAUX, TUNIQUES, objet, puissance, svgObjet, svgPersonnage,
} from '../personnage.js';
import { Brut, celebrer, confirmer, html, ico, notifier } from '../ui.js';

export const titre = 'Personnage';

const pastilles = (champ, liste, choisi, cle) => html`<div class="pastilles" role="group" aria-label="${champ}">${liste.map((c, i) => html`
  <button class="pastille${i === choisi ? ' actif' : ''}" style="--c:${c[cle]}" aria-pressed="${i === choisi}" title="${c.nom}"
    data-action="perso" data-champ="${champ}" data-valeur="${i}"><span class="sr">${c.nom}</span></button>`)}</div>`;

function carteObjet(o, p, argent) {
  const possede = p.possedes.includes(o.id), porte = p.equipe[o.emplacement] === o.id;
  const bouton = porte ? html`<button class="btn btn-petit btn-parchemin" data-action="retirer-objet" data-valeur="${o.emplacement}">Retirer</button>`
    : possede ? html`<button class="btn btn-petit btn-vert" data-action="equiper" data-valeur="${o.id}">Équiper</button>`
    : html`<button class="btn btn-petit" data-action="acheter" data-valeur="${o.id}" ${argent < o.prix ? html`disabled title="Il te manque ${o.prix - argent} pièces"` : ''}>${ico('piece')}${o.prix}</button>`;
  return html`<li class="objet${porte ? ' porte' : possede ? ' possede' : ''}">
    <div class="objet-image">${new Brut(svgObjet(o.id, 64))}</div>
    <strong>${o.nom}</strong>
    <small>+${o.niveau} puissance${porte ? ' · porté' : ''}</small>
    ${bouton}
  </li>`;
}

export function rendre(app) {
  const p = app.donnees.personnage, argent = solde(app.donnees), force = puissance(p);
  const suivant = MONDES.find(m => m.puissance > force);
  return html`
    <section class="cadre">
      <header class="vue-tete">
        <h1>Personnage</h1>
        <span class="badge badge-termine">${ico('piece')}${argent} pièces</span>
      </header>
      <div class="perso">
        <div class="perso-scene">${new Brut(svgPersonnage(p, 192))}</div>
        <div class="perso-reglages">
          <label class="etiquette" for="perso-nom">Nom</label>
          <input class="champ" id="perso-nom" maxlength="24" value="${p.nom}" data-change="perso-nom">
          <p class="rangee-texte"><span class="badge echeance">${ico('epee')}Puissance ${force}</span>
            <small>${suivant ? `Monde ${suivant.numero} à la puissance ${suivant.puissance}` : 'Tous les mondes sont ouverts !'}</small></p>
          <span class="etiquette">Peau</span>${pastilles('peau', PEAUX, p.peau, 'S')}
          <span class="etiquette">Coiffure</span>
          <div class="vue-actions">${COIFFURES.map(c => html`<button class="btn btn-petit ${c.id === p.coiffure ? 'enfonce' : 'btn-parchemin'}" aria-pressed="${c.id === p.coiffure}"
            data-action="perso" data-champ="coiffure" data-valeur="${c.id}">${c.nom}</button>`)}</div>
          <span class="etiquette">Cheveux</span>${pastilles('cheveux', CHEVEUX, p.cheveux, 'H')}
          <span class="etiquette">Tunique</span>${pastilles('tunique', TUNIQUES, p.tunique, 'T')}
          ${p.equipe.casque && html`<p class="note">Retire le casque pour voir la coiffure.</p>`}
        </div>
      </div>
    </section>
    <section class="cadre">
      <h2>${ico('coffre', 2)} Boutique</h2>
      <p class="note">Gagne des pièces en accomplissant tes tâches (12 par heure de travail), tes missions et tes journées.
        Chaque objet porté ajoute sa valeur à ta puissance, qui ouvre de nouveaux mondes sur la carte.</p>
      ${EMPLACEMENTS.map(e => html`<h3>${e.nom}</h3>
        <ul class="boutique">${OBJETS.filter(o => o.emplacement === e.id).map(o => carteObjet(o, p, argent))}</ul>`)}
    </section>`;
}

/** Applique un changement d'équipement et annonce les mondes qui viennent de s'ouvrir. */
function changerEquipement(app, changement, rect) {
  const avant = mondesOuverts(app.donnees.personnage).length;
  app.modifier(changement);
  const nouveaux = mondesOuverts(app.donnees.personnage).slice(avant);
  if (!nouveaux.length) return false;
  celebrer(rect, true);
  const dernier = nouveaux.at(-1);
  notifier(nouveaux.length > 1 ? `${nouveaux.length} nouveaux mondes ouverts, jusqu'au ${dernier.numero} · ${dernier.nom} ! Va sur la Carte.`
    : `Nouveau monde ouvert : ${dernier.numero} · ${dernier.nom} ! Va sur la Carte.`, 'carte', 4500);
  return true;
}

export const actions = {
  perso(app, el) {
    const { champ, valeur } = el.dataset;
    app.modifier(d => { d.personnage[champ] = champ === 'coiffure' ? valeur : Number(valeur); });
  },
  async acheter(app, el) {
    const o = objet(el.dataset.valeur), rect = el.getBoundingClientRect();
    if (!(await confirmer({ titre: 'Acheter ?', icone: 'piece', danger: false, bouton: 'Acheter', message: `${o.nom} pour ${o.prix} pièces ?` }))) return;
    try {
      if (!changerEquipement(app, d => acheter(d, o.id), rect)) { celebrer(rect); notifier(`${o.nom} : équipé !`, 'coffre'); }
    } catch (e) {
      notifier(`Achat impossible : ${e.message}`, 'alerte');
    }
  },
  equiper(app, el) {
    const o = objet(el.dataset.valeur);
    changerEquipement(app, d => { d.personnage.equipe[o.emplacement] = o.id; }, el.getBoundingClientRect());
  },
  'retirer-objet': (app, el) => app.modifier(d => { d.personnage.equipe[el.dataset.valeur] = null; }),
};

export const changements = {
  'perso-nom': (app, el) => app.modifier(d => { d.personnage.nom = el.value.trim().slice(0, 24) || 'Aventurier'; }),
};
