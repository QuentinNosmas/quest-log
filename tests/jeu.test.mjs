// Tests du jeu : pièces, personnage, mondes, statistiques, migration des anciennes sauvegardes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { basculerTache, nouvelleMission, nouvellesDonnees, normaliser, progression } from '../js/donnees.js';
import { acheter, enregistrerJournee, enregistrerTache, gagne, mondesOuverts, solde } from '../js/economie.js';
import { MONDES } from '../js/mondes.js';
import { CALQUES, OBJETS, nouveauPersonnage, puissance, svgObjet, svgPersonnage } from '../js/personnage.js';
import { minutesParDate, niveau, series } from '../js/stats.js';

const cocher = (d, m, t, faite) => { basculerTache(m, t, faite); return enregistrerTache(d, t, m, faite, progression(m).terminee); };

test('pièces : cocher, décocher, terminer une mission, finir la journée', () => {
  const d = nouvellesDonnees();
  const m = nouvelleMission({ titre: 'M', importance: 4, taches: [{ titre: 'a', minutes: 60 }, { titre: 'b', minutes: 90 }] });
  d.missions.push(m);
  assert.equal(cocher(d, m, m.taches[0], true), 12);           // 1h = 12 pièces
  assert.equal(cocher(d, m, m.taches[0], false), 0);
  assert.equal(solde(d), 0);                                   // décocher reprend les pièces
  cocher(d, m, m.taches[0], true);
  assert.equal(cocher(d, m, m.taches[1], true), 18 + 40);      // dernière tâche + bonus de mission (10 × importance)
  assert.equal(solde(d), 12 + 18 + 40);
  cocher(d, m, m.taches[1], false);
  cocher(d, m, m.taches[1], true);
  assert.equal(solde(d), 70);                                  // pas de double bonus
  assert.equal(enregistrerJournee(d, '2026-10-17'), 15);
  assert.equal(enregistrerJournee(d, '2026-10-17'), 0);        // une fois par jour
  d.missions = [];
  assert.equal(solde(d), 85);                                  // supprimer une mission ne reprend rien
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

test('migration : une sauvegarde de la phase 1 garde tout et reçoit ses pièces', () => {
  const v1 = { app: 'quest-log', version: 1, missions: [
    { id: 'm1', titre: 'Fini', importance: 2, taches: [{ id: 't1', titre: 'x', minutes: 60, faite: true, faiteLe: '2026-10-16T10:00:00.000Z' }] },
    { id: 'm2', titre: 'En cours', taches: [{ id: 't2', titre: 'y', minutes: 30, faite: false }] },
  ] };
  const d = normaliser(v1);
  assert.equal(d.missions.length, 2);
  assert.equal(d.journal.t1.minutes, 60);
  assert.equal(gagne(d), 12 + 20);
  assert.equal(d.monde, 1);
  assert.equal(puissance(d.personnage), 0);
  // un fichier truqué ne peut pas équiper un objet non acheté
  const triche = normaliser({ ...d, personnage: { ...d.personnage, possedes: ['epee-5', 'nimporte'], equipe: { epee: 'epee-5', casque: 'casque-5' } } });
  assert.deepEqual(triche.personnage.possedes, ['epee-5']);
  assert.equal(triche.personnage.equipe.casque, null);
});
