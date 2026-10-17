// Tests du jeu : pièces, personnage, mondes, statistiques, migration des anciennes sauvegardes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { VERSION, avancer, nouvelleMission, nouvellesDonnees, normaliser, terminerTache } from '../js/donnees.js';
import { acheter, gagne, mondesOuverts, solde } from '../js/economie.js';
import { preparerJournee, validerSeance } from '../js/journee.js';
import { MONDES } from '../js/mondes.js';
import { CALQUES, OBJETS, nouveauPersonnage, puissance, svgObjet, svgPersonnage } from '../js/personnage.js';
import { minutesParDate, niveau, series } from '../js/stats.js';

const AUJ = '2026-10-17';

test('pièces : séances, fin de mission, journée accomplie', () => {
  const d = nouvellesDonnees();
  const m = nouvelleMission({ titre: 'M', importance: 4, taches: [{ titre: 'a', minutes: 60 }, { titre: 'b', minutes: 90 }] });
  d.missions.push(m);
  preparerJournee(d, AUJ);
  const [sa, sb1, sb2] = d.journee.seances;
  assert.deepEqual(d.journee.seances.map(s => s.minutes), [60, 60, 30]);
  assert.equal(validerSeance(d, sa.id, true, AUJ).gain, 12);          // 1h = 12 pièces
  validerSeance(d, sa.id, false, AUJ);
  assert.equal(solde(d), 0);                                           // décocher reprend les pièces
  validerSeance(d, sa.id, true, AUJ);
  validerSeance(d, sb1.id, true, AUJ);
  const fin = validerSeance(d, sb2.id, true, AUJ);
  assert.equal(fin.missionFinie, true);
  assert.equal(fin.journeeFinie, true);
  assert.equal(fin.gain, 6 + 40 + 15);                                 // 30 min + bonus de mission (10 × importance) + journée
  assert.equal(solde(d), 12 + 12 + 6 + 40 + 15);
  validerSeance(d, sb2.id, false, AUJ);
  assert.equal(solde(d), 12 + 12 + 15);                                // le bonus de mission est repris, celui du jour reste
  validerSeance(d, sb2.id, true, AUJ);
  assert.equal(solde(d), 85);                                          // pas de double bonus de journée
  d.missions = [];
  assert.equal(solde(d), 85);                                          // supprimer une mission ne reprend rien
});

test('terminer une sous-tâche depuis la page de la mission', () => {
  const d = nouvellesDonnees();
  const m = nouvelleMission({ titre: 'N', importance: 2, taches: [{ titre: 'c', minutes: 120 }] });
  const t = m.taches[0];
  d.missions.push(m);
  avancer(m, t, 60);                                                   // 1h déjà faite en séance
  const r = terminerTache(d, m, t, true, AUJ);
  assert.deepEqual([r.missionFinie, r.gain, t.faite, t.minutesFaites], [true, 12 + 20, true, 120]); // l'heure restante + bonus
  terminerTache(d, m, t, false, AUJ);
  assert.deepEqual([t.faite, t.minutesFaites, solde(d)], [false, 60, 0]);
  avancer(m, t, 60);                                                   // finie par ses séances…
  const r2 = terminerTache(d, m, t, false, AUJ);                       // …mais pas vraiment : il faut plus de temps
  assert.deepEqual([r2.plusDeTemps, t.minutes, t.faite], [true, 180, false]);
});

test('boutique et mondes', () => {
  const d = nouvellesDonnees();
  d.bonus['jour:x'] = 100;
  assert.throws(() => acheter(d, 'epee-3'));                   // trop cher
  acheter(d, 'epee-2');
  assert.equal(solde(d), 20);
  assert.equal(d.personnage.equipe.epee, 'epee-2');
  assert.throws(() => acheter(d, 'epee-2'));                   // déjà possédé
  assert.equal(puissance(d.personnage), 2);
  assert.deepEqual(mondesOuverts(d.personnage).map(m => m.numero), [1]);
  d.personnage.equipe.casque = 'casque-1';
  assert.deepEqual(mondesOuverts(d.personnage).map(m => m.numero), [1, 2]);
  // les mondes sont de plus en plus exigeants et le dernier reste atteignable (puissance max 25)
  MONDES.slice(1).forEach((m, i) => assert.ok(m.puissance > MONDES[i].puissance));
  assert.ok(MONDES.at(-1).puissance <= 25);
  assert.equal(OBJETS.length, 25);
});

test('dessins du personnage : 32×32 et lettres connues', () => {
  for (const [nom, lignes] of Object.entries(CALQUES)) {
    assert.equal(lignes.length, 32, nom);
    lignes.forEach((l, y) => {
      assert.equal(l.length, 32, `${nom}, ligne ${y}`);
      assert.match(l, /^[.kwbyPBzrSsmTtHhLMD]*$/, `${nom}, ligne ${y}`);
    });
  }
  const p = nouveauPersonnage();
  assert.match(svgPersonnage(p), /^<svg[^>]+width="192"[\s\S]*<\/svg>$/);
  for (const o of OBJETS) assert.match(svgObjet(o.id), /<rect/);
});

test('statistiques : minutes par jour, efficacité, séries', () => {
  const journal = { a: { date: '2026-10-15', minutes: 60 }, b: { date: '2026-10-16', minutes: 30 }, c: { date: '2026-10-16', minutes: 90 }, d: { date: '2026-10-10', minutes: 20 } };
  const parDate = minutesParDate(journal);
  assert.equal(parDate.get('2026-10-16'), 120);
  assert.deepEqual(series(parDate, '2026-10-17'), { actuelle: 2, record: 2 }); // aujourd'hui pas encore travaillé : série gardée
  assert.deepEqual(series(parDate, '2026-10-18'), { actuelle: 0, record: 2 });
  assert.deepEqual([0, 30, 60, 120, 240].map(min => niveau(min, 240)), [0, 1, 2, 3, 4]);
  assert.equal(niveau(30, 0), 4); // travail un jour de repos
});

test('migration : les données actuelles (version 2) sont toutes gardées', () => {
  const v2 = {
    app: 'quest-log', version: 2, creeLe: '2026-10-17T10:00:00.000Z', maj: '2026-10-17T15:00:00.000Z',
    missions: [
      { id: 'm1', titre: 'Partiel stats', echeance: '2026-11-20', importance: 5, categorie: 'partiel', archivee: false, creeLe: '2026-10-17T10:00:00.000Z', termineeLe: null, maj: '2026-10-17T15:00:00.000Z',
        taches: [{ id: 't1', titre: 'Cours', minutes: 600, faite: false, faiteLe: null, reports: 2, maj: 'x' },
                 { id: 't2', titre: 'TD 1', minutes: 120, faite: true, faiteLe: '2026-10-17T14:00:00.000Z', reports: 0, maj: 'x' }] },
      { id: 'm2', titre: 'Projet', echeance: null, importance: 2, categorie: 'perso', archivee: true, creeLe: 'x', termineeLe: null, maj: 'x', taches: [] },
    ],
    reglages: { minutesParJour: [180, 180, 180, 180, 180, 60, 0], rappelJours: 5, derniereSauvegarde: null, rappelMasqueLe: null },
    journee: { date: '2026-10-17', ids: ['t1'], retirees: [], ajoutees: [] },
    journal: { t2: { date: '2026-10-17', minutes: 120, pieces: 24 }, ancienne: { date: '2026-10-10', minutes: 30, pieces: 6 } },
    bonus: { 'jour:2026-10-16': 15 },
    personnage: { nom: 'Quentin', peau: 1, cheveux: 2, coiffure: 'pics', tunique: 3, possedes: ['epee-1'], equipe: { epee: 'epee-1' } },
    monde: 1,
  };
  const d = normaliser(JSON.parse(JSON.stringify(v2)));
  assert.equal(VERSION, 3);
  assert.deepEqual(d.missions.map(m => [m.id, m.titre, m.taches.length, m.archivee]), [['m1', 'Partiel stats', 2, false], ['m2', 'Projet', 0, true]]);
  const [t1, t2] = d.missions[0].taches;
  assert.deepEqual([t1.minutesFaites, t1.faite, t1.reports], [0, false, 2]);
  assert.deepEqual([t2.minutesFaites, t2.faite, t2.faiteLe], [120, true, '2026-10-17T14:00:00.000Z']);
  assert.deepEqual(Object.keys(d.journal).sort(), ['ancienne', 'fin:t2']);   // la tâche cochée devient une « fin de tâche »
  assert.equal(gagne(d), 24 + 6 + 15);                                       // aucune pièce perdue
  assert.deepEqual(d.reglages.minutesParJour, [180, 180, 180, 180, 180, 60, 0]);
  assert.deepEqual([d.personnage.nom, d.personnage.equipe.epee], ['Quentin', 'epee-1']);
  assert.equal(d.journee, null);                                             // l'ancien plan du jour est recalculé
  // décocher la tâche migrée fonctionne comme avant
  terminerTache(d, d.missions[0], t2, false, AUJ);
  assert.deepEqual([t2.faite, t2.minutesFaites, gagne(d)], [false, 0, 6 + 15]);
});

test('migration : une sauvegarde de la phase 1 garde tout et reçoit ses pièces', () => {
  const v1 = { app: 'quest-log', version: 1, missions: [
    { id: 'm1', titre: 'Fini', importance: 2, taches: [{ id: 't1', titre: 'x', minutes: 60, faite: true, faiteLe: '2026-10-16T10:00:00.000Z' }] },
    { id: 'm2', titre: 'En cours', taches: [{ id: 't2', titre: 'y', minutes: 30, faite: false }] },
  ] };
  const d = normaliser(v1);
  assert.equal(d.missions.length, 2);
  assert.equal(d.journal['fin:t1'].minutes, 60);
  assert.equal(gagne(d), 12 + 20);
  assert.equal(d.monde, 1);
  assert.equal(puissance(d.personnage), 0);
  // un fichier truqué ne peut pas équiper un objet non acheté
  const triche = normaliser({ ...d, personnage: { ...d.personnage, possedes: ['epee-5', 'nimporte'], equipe: { epee: 'epee-5', casque: 'casque-5' } } });
  assert.deepEqual(triche.personnage.possedes, ['epee-5']);
  assert.equal(triche.personnage.equipe.casque, null);
});
