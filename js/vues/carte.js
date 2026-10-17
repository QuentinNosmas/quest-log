// Page Carte : les 8 mondes reliés par un chemin, façon Super Mario Bros 3.
// Un monde s'ouvre quand la puissance du personnage atteint son seuil ; y voyager change le fond du site.
import { FOND_FIXE, apercuFond } from '../fond.js';
import { MONDES } from '../mondes.js';
import { puissance, svgPersonnage } from '../personnage.js';
import { Brut, celebrer, html, ico, notifier, src } from '../ui.js';

export const titre = 'Carte';
const T = 16; // une case = 16 pixels ; carte de 12 × 7 cases
const CASES = [[1, 2], [4, 2], [7, 2], [10, 2], [10, 5], [7, 5], [4, 5], [1, 5]]; // position de chaque monde
const ARBRES = [[6, 4], [40, 8], [92, 4], [140, 10], [178, 2], [20, 58], [60, 62], [100, 56], [132, 64], [182, 52], [44, 98], [96, 100], [150, 98], [182, 92]];
const ARBRE = ['..kkkk..', '.keEeek.', 'keEeeeek', 'keeeeEek', '.keeeek.', '..kkkk..', '...kbk..', '...kkk..'];
const COULEURS_ARBRE = { k: '#2b1d2e', e: '#3f7a2a', E: '#6cad3d', b: '#8a4b2a' };

const rect = (x, y, l, h, c) => `<rect x="${x}" y="${y}" width="${l}" height="${h}" fill="${c}"/>`;

function decor() {
  let s = rect(0, 0, 12 * T, 7 * T, '#5a9a3a'), graine = 7;
  const alea = () => (graine = (graine * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 90; i++) s += rect(Math.floor(alea() * 190), Math.floor(alea() * 110), 2, 1, alea() > 0.85 ? '#f28c8c' : '#3f7a2a');
  for (const [ax, ay] of ARBRES) ARBRE.forEach((l, y) => [...l].forEach((c, x) => { if (c !== '.') s += rect(ax + x, ay + y, 1, 1, COULEURS_ARBRE[c]); }));
  // chemin de sable entre les mondes, avec des pointillés
  for (let i = 1; i < CASES.length; i++) {
    const [ax, ay] = CASES[i - 1], [bx, by] = CASES[i];
    const x = Math.min(ax, bx) * T + 5, y = Math.min(ay, by) * T + 5;
    const l = Math.abs(bx - ax) * T + 6, h = Math.abs(by - ay) * T + 6;
    s += rect(x, y, l, h, '#e8c88a');
    for (let p = 0; p < Math.max(l, h); p += 6) s += l > h ? rect(x + p, y + 2, 2, 2, '#b8864a') : rect(x + 2, y + p, 2, 2, '#b8864a');
  }
  return s;
}

function noeud(m, ouvert, ici) {
  const [cx, cy] = CASES[m.numero - 1], x = cx * T, y = cy * T;
  const fond = ici ? '#ff9a52' : ouvert ? '#f7c548' : '#a8a0b0';
  return `<g class="noeud${ouvert ? ' ouvert' : ''}" data-action="voyager" data-numero="${m.numero}">
    ${rect(x, y, T, T, '#2b1d2e')}${rect(x + 1, y + 1, T - 2, T - 2, fond)}${rect(x + 1, y + T - 3, T - 2, 2, 'rgb(0 0 0 / .2)')}
    ${ouvert ? `<text x="${x + 8}" y="${y + 12}" text-anchor="middle" font-family="'Press Start 2P'" font-size="8" fill="#2b1d2e">${m.numero}</text>`
      : `<image href="${src('cadenas')}" x="${x + 2}" y="${y + 2}" width="12" height="12" style="image-rendering:pixelated"/>`}
  </g>`;
}

export function rendre(app) {
  const d = app.donnees, force = puissance(d.personnage);
  const [hx, hy] = CASES[d.monde - 1];
  const heros = svgPersonnage(d.personnage, 32).replace('<svg ', `<svg x="${hx * T - 8}" y="${hy * T - 21}" `);
  const carte = `<svg class="carte-monde" viewBox="0 0 ${12 * T} ${7 * T}" shape-rendering="crispEdges" aria-hidden="true">
    ${decor()}${MONDES.map(m => noeud(m, force >= m.puissance, m.numero === d.monde)).join('')}${heros}</svg>`;
  return html`
    <section class="cadre">
      <header class="vue-tete">
        <h1>Carte du monde</h1>
        <span class="badge echeance">${ico('epee')}Puissance ${force}</span>
      </header>
      <p class="note">Équipe ton personnage pour gagner en puissance et ouvrir de nouveaux mondes.${FOND_FIXE ? '' : ' Voyager change le paysage du site.'}</p>
      <div class="cadre-carte">${new Brut(carte)}</div>
    </section>
    <section class="cadre">
      <h2>${ico('carte', 2)} Les 8 mondes</h2>
      <ul class="mondes">${MONDES.map(m => {
        const ouvert = force >= m.puissance, ici = m.numero === d.monde;
        return html`<li class="monde${ici ? ' ici' : ''}${ouvert ? '' : ' ferme'}">
          <img class="monde-apercu" src="${apercuFond(m.fond)}" alt="">
          <div class="monde-texte"><span class="etiquette">Monde ${m.numero}</span><strong>${m.nom}</strong>
            <small>${m.puissance ? `Puissance ${m.puissance} requise` : 'Ouvert dès le départ'}</small></div>
          ${ici ? html`<span class="badge badge-termine">${ico('casque')}Tu es ici</span>`
            : ouvert ? html`<button class="btn btn-petit btn-vert" data-action="voyager" data-numero="${m.numero}">${ico('carte')}Voyager</button>`
            : html`<span class="badge badge-bientot">${ico('cadenas')}Encore ${m.puissance - force}</span>`}
        </li>`;
      })}</ul>
    </section>`;
}

export const actions = {
  voyager(app, el) {
    const m = MONDES[Number(el.dataset.numero) - 1];
    if (!m || m.numero === app.donnees.monde) return;
    if (puissance(app.donnees.personnage) < m.puissance) {
      notifier(`Monde ${m.numero} fermé : il faut une puissance de ${m.puissance}.`, 'cadenas');
      return;
    }
    app.modifier(d => { d.monde = m.numero; });
    celebrer(el.getBoundingClientRect(), true);
    notifier(`Bienvenue : Monde ${m.numero} · ${m.nom} !`, 'carte', 3500);
  },
};
