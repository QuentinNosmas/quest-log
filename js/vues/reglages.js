// Réglages : temps disponible, sauvegarde / restauration, exemples, réinitialisation.
import { dateLongue, dateISO, duree } from '../dates.js';
import { JOURS_COURTS, exemples, nouvellesDonnees } from '../donnees.js';
import { lireDuree } from '../saisie.js';
import { lireSauvegarde, tailleOctets, telechargerSauvegarde } from '../stockage.js';
import { confirmer, html, ico, notifier } from '../ui.js';

export const titre = 'Réglages';
const JOURS_LONGS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
const lireTemps = v => (/^\s*0*\s*(h|min)?\s*$/i.test(v) ? 0 : lireDuree(v)); // « 0 » ou vide = jour de repos
const boutonSauverAvant = html`<p><button type="button" class="btn btn-petit" data-action="exporter">${ico('disquette')}Sauvegarder d'abord mes données actuelles</button></p>`;

export function rendre(app) {
  const r = app.donnees.reglages, mpj = r.minutesParJour;
  const derniere = r.derniereSauvegarde;
  const ilYa = derniere && Math.floor((Date.now() - Date.parse(derniere)) / 864e5);
  return html`
    <section class="cadre">
      <h1>Réglages</h1>
      <h2>${ico('horloge', 2)} Mon temps disponible</h2>
      <p class="note">Le temps que tu peux consacrer à tes missions chaque jour (0 = jour de repos). Exemples : 4h, 2h30, 90min.</p>
      <form data-form="temps" class="temps-jours">
        ${JOURS_COURTS.map((j, i) => html`<label class="jour"><span class="etiquette">${j}</span>
          <input class="champ" name="j${i}" value="${duree(mpj[i])}" aria-label="Temps disponible le ${JOURS_LONGS[i]}"></label>`)}
        <div class="message-erreur" data-erreur hidden></div>
        <div class="actions-fenetre">
          <button type="button" class="btn btn-petit btn-parchemin" data-action="copier-lundi">Même temps que lundi partout</button>
          <button class="btn btn-vert">${ico('coche')}Enregistrer</button>
        </div>
      </form>
    </section>

    <section class="cadre">
      <h2>${ico('disquette', 2)} Sauvegarde</h2>
      <p>Tes données sont enregistrées <b>dans ce navigateur</b> (${Math.ceil(tailleOctets() / 1024)} Ko).
        Elles ne passent pas toutes seules d'un appareil à l'autre : pour les transférer, télécharge une sauvegarde ici puis restaure-la sur l'autre appareil.</p>
      <p>${derniere ? `Dernière sauvegarde : ${dateLongue(dateISO(new Date(derniere)))} (${ilYa ? `il y a ${ilYa} j` : "aujourd'hui"}).` : "Tu n'as encore jamais téléchargé de sauvegarde."}
        ${app.protege ? ' Le navigateur s\'est engagé à ne pas effacer tes données de lui-même.' : ' Sauvegarde régulièrement : un navigateur peut effacer les données d\'un site.'}</p>
      <div class="vue-actions">
        <button class="btn" data-action="exporter">${ico('disquette')}Télécharger une sauvegarde</button>
        <button class="btn btn-lagon" data-action="restaurer">${ico('coffre')}Restaurer depuis un fichier</button>
        <input type="file" accept=".json,application/json" id="fichier-restauration" data-change="fichier-restauration" hidden>
      </div>
      <label class="rangee-texte">Me rappeler de sauvegarder tous les
        <input class="champ champ-court" type="number" min="1" max="365" value="${r.rappelJours}" data-change="rappel-jours" aria-label="Nombre de jours entre deux rappels"> jours</label>
    </section>

    <section class="cadre">
      <h2>${ico('de', 2)} Données d'exemple</h2>
      <p class="note">Pour tester : un partiel dans 3 semaines, un devoir dans 5 jours et un projet perso sans échéance. Ils s'ajoutent à tes missions, tu pourras les supprimer.</p>
      <button class="btn btn-parchemin" data-action="exemples">${ico('de')}Charger les exemples</button>
    </section>

    <section class="cadre zone-danger">
      <h2>${ico('crane', 2)} Tout réinitialiser</h2>
      <p class="note">Efface toutes tes missions et tes réglages de ce navigateur.</p>
      <button class="btn btn-rouge" data-action="reinitialiser">${ico('poubelle')}Tout effacer</button>
    </section>`;
}

export const actions = {
  exporter(app) {
    app.modifier(d => { d.reglages.derniereSauvegarde = new Date().toISOString(); });
    telechargerSauvegarde(app.donnees);
    notifier('Sauvegarde téléchargée', 'disquette');
  },
  'rappel-plus-tard': app => app.modifier(d => { d.reglages.rappelMasqueLe = app.aujourdhui; }),
  restaurer: () => document.getElementById('fichier-restauration').click(),
  'copier-lundi'(app, el) {
    const champs = el.form.querySelectorAll('input');
    champs.forEach(c => { c.value = champs[0].value; });
  },
  async exemples(app) {
    if (app.donnees.missions.length && !(await confirmer({
      titre: 'Charger les exemples ?', icone: 'de', danger: false, bouton: 'Ajouter les exemples',
      message: "Les 3 missions d'exemple s'ajouteront à tes missions actuelles.",
    }))) return;
    app.modifier(d => d.missions.push(...exemples(app.aujourdhui)));
    notifier('Exemples chargés !', 'de');
    location.hash = '#/';
  },
  async reinitialiser(app) {
    const premier = await confirmer({
      titre: 'Tout effacer ?', icone: 'crane', bouton: 'Continuer', extra: boutonSauverAvant,
      message: `Tes ${app.donnees.missions.length} missions et tes réglages seront effacés de ce navigateur.`,
    });
    if (!premier) return;
    const second = await confirmer({
      titre: 'Vraiment tout effacer ?', icone: 'crane', bouton: 'Oui, tout effacer',
      message: "Dernière confirmation : c'est définitif. Sans fichier de sauvegarde, rien ne pourra être récupéré.",
    });
    if (!second) return;
    app.donnees = nouvellesDonnees();
    app.ui = {};
    app.modifier(() => {});
    notifier('Tout a été effacé', 'poubelle');
    location.hash = '#/';
  },
};

export const changements = {
  'rappel-jours'(app, el) {
    const n = Math.round(Number(el.value));
    if (n >= 1 && n <= 365) app.modifier(d => { d.reglages.rappelJours = n; });
  },
  async 'fichier-restauration'(app, el) {
    const fichier = el.files[0];
    el.value = ''; // permet de rechoisir le même fichier
    if (!fichier) return;
    let donnees;
    try { donnees = await lireSauvegarde(fichier); }
    catch (e) { notifier(`Impossible de restaurer : ${e.message}`, 'alerte', 5000); return; }
    const n = donnees.missions.length, k = donnees.missions.reduce((s, m) => s + m.taches.length, 0);
    const ok = await confirmer({
      titre: 'Restaurer cette sauvegarde ?', icone: 'coffre', bouton: 'Restaurer', extra: boutonSauverAvant,
      message: `Ce fichier contient ${n} mission${n > 1 ? 's' : ''} (${k} sous-tâches), enregistré le ${dateLongue(dateISO(new Date(donnees.maj)))}. Tes données actuelles seront remplacées.`,
    });
    if (!ok) return;
    app.donnees = donnees;
    app.ui = {};
    app.modifier(() => {});
    notifier('Sauvegarde restaurée !', 'coffre');
  },
};

export const formulaires = {
  temps(app, form, data) {
    const valeurs = JOURS_COURTS.map((_, i) => lireTemps(String(data.get(`j${i}`))));
    const faux = valeurs.findIndex(v => v === null || v > 1440);
    const erreur = form.querySelector('[data-erreur]');
    erreur.hidden = faux < 0;
    if (faux >= 0) {
      erreur.innerHTML = html`${ico('alerte')}<span>Temps du ${JOURS_LONGS[faux]} non compris : écris par exemple 4h, 2h30 ou 0.</span>`;
      return;
    }
    app.modifier(d => { d.reglages.minutesParJour = valeurs; });
    notifier('Temps enregistré. « Nouvelle proposition » pour en tenir compte aujourd\'hui.', 'horloge', 3500);
  },
};
