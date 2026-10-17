// Briques d'affichage communes : gabarits HTML sûrs, icônes, badges, fenêtres, notifications.
import { dateCourte, dateLongue, duree } from './dates.js';
import { CATEGORIES, alerteEcheance, progression } from './donnees.js';

// ---------- Gabarits HTML : tout texte inséré est échappé (protège contre un fichier importé piégé) ----------
export class Brut { constructor(s) { this.s = s; } toString() { return this.s; } }
const ECHAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const echapper = v => (v instanceof Brut ? v.s : Array.isArray(v) ? v.map(echapper).join('')
  : v == null || v === false ? '' : String(v).replace(/[&<>"']/g, c => ECHAP[c]));
export const html = (chaines, ...valeurs) =>
  new Brut(chaines.reduce((acc, c, i) => acc + c + (i < valeurs.length ? echapper(valeurs[i]) : ''), ''));

// ---------- Icônes ----------
// Pour remplacer une icône par ta propre image : remplace le fichier assets/icones/<nom>.svg,
// ou indique ici le chemin de ton image (png accepté), par exemple  epee: 'assets/mes-images/epee.png'
export const IMAGES = {};
export const src = nom => IMAGES[nom] ?? `assets/icones/${nom}.svg`;
export const ico = (nom, taille = 1, alt = '') =>
  html`<img class="ico${taille > 1 ? ` ico-${taille}x` : ''}" src="${src(nom)}" alt="${alt}">`;

// ---------- Badges et indicateurs ----------
export const etoiles = n => html`<span class="importance" role="img" aria-label="Importance ${n} sur 5" title="Importance ${n} sur 5">${
  [1, 2, 3, 4, 5].map(i => html`<img class="ico${i > n ? ' vide' : ''}" src="${src('etoile')}" alt="">`)}</span>`;

export const badgeCategorie = c => html`<span class="badge badge-${c}">${CATEGORIES[c]}</span>`;

export function badgeEcheance(m, aujourdhui) {
  if (progression(m).terminee) return html`<span class="badge badge-termine">${ico('trophee')}Terminée</span>`;
  const { niveau, jours } = alerteEcheance(m, aujourdhui);
  if (niveau === 'aucune') return html`<span class="badge echeance echeance-aucune">Sans échéance</span>`;
  const icone = { calme: 'calendrier', bientot: 'sablier', urgent: 'alerte', depassee: 'crane' }[niveau];
  const texte = jours < 0 ? `En retard de ${-jours} j` : jours === 0 ? "Aujourd'hui" : `J-${jours}`;
  return html`<span class="badge echeance echeance-${niveau}" title="Échéance : ${dateLongue(m.echeance)}">${ico(icone)}${texte} · ${dateCourte(m.echeance, aujourdhui)}</span>`;
}

export function barre(fait, total, texte = `${duree(fait)} / ${duree(total)}`) {
  const pct = total ? Math.round((fait / total) * 100) : 0;
  return html`<div class="barre${total && fait >= total ? ' or' : ''}" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}" aria-label="${texte}"><span style="--v:${pct}%"></span><b>${texte}</b></div>`;
}

/** Avancement d'une sous-tâche : petite barre + « 3h / 10h ». */
export const avancement = t => html`<span class="avancement" title="Avancement de la sous-tâche">
  <span class="mini-barre"><i style="--v:${Math.round((Math.min(t.minutesFaites, t.minutes) / t.minutes) * 100)}%"></i></span>
  ${duree(Math.min(t.minutesFaites, t.minutes))} / ${duree(t.minutes)}</span>`;

// ---------- Fenêtres ----------
const pile = [];
addEventListener('keydown', e => { if (e.key === 'Escape' && pile.length) pile.at(-1).fermer(); });

/** Ouvre une fenêtre par-dessus la page. Se ferme avec la croix, un bouton [data-fermer] ou Échap. */
export function ouvrirFenetre({ titre, icone = 'parchemin', corps, large = false, auFermer }) {
  const precedent = document.activeElement;
  const voile = document.createElement('div');
  voile.className = 'voile';
  voile.innerHTML = html`<div class="cadre fenetre${large ? ' fenetre-large' : ''}" role="dialog" aria-modal="true" aria-label="${titre}">
    <div class="fenetre-titre">${ico(icone)}<span>${titre}</span>
      <button type="button" class="btn btn-icone btn-rouge" data-fermer title="Fermer">${ico('fermer', 1, 'Fermer')}</button></div>
    <div class="fenetre-corps">${corps}</div></div>`;
  document.body.append(voile);
  const f = {
    el: voile,
    fermer() {
      if (!voile.isConnected) return;
      voile.remove();
      pile.splice(pile.indexOf(f), 1);
      auFermer?.();
      precedent?.focus?.();
    },
  };
  pile.push(f);
  voile.addEventListener('click', e => { if (e.target.closest('[data-fermer]')) f.fermer(); });
  (voile.querySelector('[autofocus]') ?? voile.querySelector('.fenetre-corps :is(input, textarea, select, button)'))?.focus();
  return f;
}

/** Ferme toutes les fenêtres (en changeant de page). */
export const fermerFenetres = () => [...pile].reverse().forEach(f => f.fermer());

/** Ferme la fenêtre qui contient cet élément. */
export const fermerFenetreDe = noeud => pile.find(f => f.el.contains(noeud))?.fermer();

/** Demande une confirmation. Renvoie une promesse : true si l'utilisateur confirme. */
export function confirmer({ titre, message, bouton = 'Confirmer', icone = 'alerte', danger = true, extra = '' }) {
  return new Promise(resoudre => {
    let oui = false;
    const f = ouvrirFenetre({
      titre, icone, auFermer: () => resoudre(oui),
      corps: html`<p>${message}</p>${extra}
        <div class="actions-fenetre">
          <button type="button" class="btn btn-parchemin" data-fermer autofocus>Annuler</button>
          <button type="button" class="btn ${danger ? 'btn-rouge' : 'btn-vert'}" data-oui>${bouton}</button>
        </div>`,
    });
    f.el.querySelector('[data-oui]').addEventListener('click', () => { oui = true; f.fermer(); });
  });
}

// ---------- Notifications et célébrations ----------
export function notifier(message, icone = 'trophee', dureeMs = 2400) {
  document.querySelector('.toast')?.remove();
  const t = document.createElement('div');
  t.className = 'cadre toast';
  t.setAttribute('role', 'status');
  t.innerHTML = html`${ico(icone, 2)}<span>${message}</span>`;
  document.body.append(t);
  setTimeout(() => t.remove(), dureeMs);
}

/** Gerbe d'étincelles pixel depuis un point de l'écran (grande = fin de mission). */
export function celebrer(rect, grande = false) {
  const n = grande ? 40 : 24, couleurs = ['var(--or)', 'var(--or-clair)', 'var(--braise)', 'var(--herbe-clair)', 'var(--rose)'];
  const cx = rect ? rect.left + rect.width / 2 : innerWidth / 2, cy = rect ? rect.top + rect.height / 2 : innerHeight / 2;
  for (let i = 0; i < n; i++) {
    const s = document.createElement('i');
    const a = (i / n) * Math.PI * 2, d = (grande ? 110 : 60) + Math.random() * (grande ? 120 : 70);
    s.className = 'etincelle';
    s.style.cssText = `left:${cx}px;top:${cy}px;--dx:${Math.round((Math.cos(a) * d) / 4) * 4}px;--dy:${Math.round((Math.sin(a) * d) / 4) * 4}px;--c:${couleurs[i % couleurs.length]}`;
    document.body.append(s);
    setTimeout(() => s.remove(), 800);
  }
}
