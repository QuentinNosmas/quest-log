// Tests de la logique (sans navigateur) : node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lireDate, lireDuree, lireTache, lireSaisie } from '../js/saisie.js';
import { nouvellesDonnees, nouvelleMission, normaliser, basculerTache, progression, exemples } from '../js/donnees.js';
import { analyserMission, preparerJournee, recalculerJournee, reporter, candidates, indexTaches, raisons } from '../js/journee.js';
import { duree } from '../js/dates.js';

const AUJ = '2026-10-17'; // un samedi

test('dates tolérantes', () => {
  const d = t => lireDate(t, AUJ)?.date;
  assert.equal(d('12/12'), '2026-12-12');
  assert.equal(d('12/12/26'), '2026-12-12');
  assert.equal(d('12-12-2027'), '2027-12-12');
  assert.equal(d('12.12'), '2026-12-12');
  assert.equal(d('2026-12-12'), '2026-12-12');
  assert.equal(d('le 12 déc'), '2026-12-12');
  assert.equal(d('1er décembre'), '2026-12-01');
  assert.equal(d('12 Décembre 2027'), '2027-12-12');
  assert.equal(d('05/01'), '2027-01-05');       // déjà passé → l'an prochain
  assert.equal(d('10/10'), '2026-10-10');       // passé de peu → en retard, cette année
  assert.equal(d('demain'), '2026-10-18');
  assert.equal(d("aujourd'hui"), AUJ);
  assert.equal(d('dans 5 jours'), '2026-10-22');
  assert.equal(d('dans 3 semaines'), '2026-11-07');
  assert.equal(d('j+5'), '2026-10-22');
  assert.equal(d('lundi'), '2026-10-19');
  assert.equal(d('samedi'), '2026-10-24');     // le prochain, pas aujourd'hui
  assert.equal(d('mar'), '2026-10-20');
  assert.deepEqual(lireDate('sans date', AUJ), { date: null });
  assert.ok(lireDate('31/02', AUJ).erreur);
  assert.equal(lireDate('bientôt', AUJ), null);
  assert.equal(lireDate('partiel', AUJ), null);
});

test('durées tolérantes', () => {
  const cas = { '6h': 360, '6 h': 360, '1h30': 90, '1 h 30': 90, '1h30min': 90, '90min': 90, '90 min': 90, '45m': 45,
    '1,5h': 90, '1.5 h': 90, '2 heures': 120, '2h00': 120, '1:30': 90, '3 heures et demie': 210, '1h et quart': 75,
    'demi-heure': 30, '3': 180, '30 mn': 30 };
  for (const [t, min] of Object.entries(cas)) assert.equal(lireDuree(t), min, t);
  for (const t of ['', 'h', 'beaucoup', '0h', '-2h']) assert.equal(lireDuree(t), null, t);
  assert.equal(duree(360), '6h');
  assert.equal(duree(90), '1h30');
  assert.equal(duree(45), '45min');
});

test('lignes de sous-tâches', () => {
  assert.deepEqual(lireTache('Cours à apprendre - 6h'), { titre: 'Cours à apprendre', minutes: 360 });
  assert.deepEqual(lireTache('2 exercices poussés - 4h'), { titre: '2 exercices poussés', minutes: 240 });
  assert.deepEqual(lireTache('TD1 : 3h'), { titre: 'TD1', minutes: 180 });
  assert.deepEqual(lireTache('TD1 (1h30)'), { titre: 'TD1', minutes: 90 });
  assert.deepEqual(lireTache('TD1 3h'), { titre: 'TD1', minutes: 180 });
  assert.deepEqual(lireTache('- Relire le cours 1 h 30'), { titre: 'Relire le cours', minutes: 90 });
  assert.deepEqual(lireTache('Exos 2-3 - 2h'), { titre: 'Exos 2-3', minutes: 120 });
  assert.deepEqual(lireTache('Révision 1:30'), { titre: 'Révision', minutes: 90 });
  assert.equal(lireTache('TD2 - 3').minutes, 180);
  assert.ok(lireTache('TD2 - 3').note);
  assert.ok(lireTache('Chapitre 3').erreur);       // « 3 » sans unité ni séparateur : pas une durée
  assert.ok(lireTache('Réviser').erreur);
});

test('saisie rapide complète', () => {
  const r = lireSaisie('Partiel calcul stochastique | 12/12 | 5\nCours à apprendre - 6h\nTD1 - 3h\n2 exercices poussés - 4h', AUJ);
  assert.deepEqual(r.erreurs, []);
  assert.equal(r.missions.length, 1);
  const m = r.missions[0];
  assert.equal(m.titre, 'Partiel calcul stochastique');
  assert.equal(m.echeance, '2026-12-12');
  assert.equal(m.importance, 5);
  assert.equal(m.categorie, 'partiel');            // devinée depuis le titre
  assert.deepEqual(m.taches.map(t => t.minutes), [360, 180, 240]);

  const deux = lireSaisie('Apprendre Rust\nLire le livre - 10h\n\nDM éco ; demain ; devoir ; 4\nQ1 - 1h\nQ2 - beaucoup\n', AUJ);
  assert.equal(deux.missions.length, 2);
  assert.equal(deux.missions[0].categorie, 'perso'); // sans échéance ni mot-clé
  assert.equal(deux.missions[1].echeance, '2026-10-18');
  assert.equal(deux.missions[1].importance, 4);
  assert.deepEqual(deux.erreurs.map(e => e.ligne), [6]);

  const mauvais = lireSaisie('Projet | 99/99 | truc', AUJ);
  assert.equal(mauvais.erreurs.length, 2);
});

test('progression et fin de mission', () => {
  const m = nouvelleMission({ titre: 'M', taches: [{ titre: 'a', minutes: 60 }, { titre: 'b', minutes: 120 }] });
  assert.equal(basculerTache(m, m.taches[0], true), false);
  assert.equal(basculerTache(m, m.taches[1], true), true);   // dernière tâche → mission terminée
  assert.ok(m.termineeLe);
  assert.deepEqual(progression(m), { faites: 2, total: 2, minutesFaites: 180, minutesTotal: 180, terminee: true });
  basculerTache(m, m.taches[1], false);
  assert.equal(m.termineeLe, null);
});

test('normaliser refuse les mauvais fichiers et répare le reste', () => {
  assert.throws(() => normaliser({ truc: 1 }));
  assert.throws(() => normaliser(null));
  assert.throws(() => normaliser({ missions: [], version: 99 }));
  const d = normaliser({ missions: [{ titre: 'X', importance: 12, categorie: 'zzz', echeance: 'demain', taches: [{ titre: 't', minutes: -5 }, 'bad'] }] });
  assert.equal(d.missions[0].importance, 5);
  assert.equal(d.missions[0].categorie, 'autre');
  assert.equal(d.missions[0].echeance, null);
  assert.equal(d.missions[0].taches.length, 1);
  assert.equal(d.missions[0].taches[0].minutes, 1);
  const rond = normaliser(JSON.parse(JSON.stringify({ ...nouvellesDonnees(), missions: exemples(AUJ) })));
  assert.equal(rond.missions.length, 3);
});

test('missions du jour', () => {
  const d = nouvellesDonnees(); // 4h par jour
  const proche = nouvelleMission({ titre: 'Partiel proche', echeance: '2026-10-21', importance: 3, taches: [{ titre: 'p1', minutes: 120 }, { titre: 'p2', minutes: 120 }, { titre: 'p3', minutes: 540 }] });
  const loin = nouvelleMission({ titre: 'Partiel loin', echeance: '2026-11-16', importance: 3, taches: [{ titre: 'l1', minutes: 120 }, { titre: 'l2', minutes: 660 }] });
  const perso = nouvelleMission({ titre: 'Perso', importance: 5, taches: [{ titre: 'x', minutes: 60 }] });
  d.missions.push(loin, perso, proche);

  // 13h à 4 jours est plus urgent que 13h à un mois
  assert.ok(analyserMission(proche, d.reglages, AUJ).urgence > analyserMission(loin, d.reglages, AUJ).urgence);
  assert.equal(candidates(d, AUJ)[0].t.titre, 'p1');

  preparerJournee(d, AUJ);
  const titres = () => d.journee.ids.map(id => indexTaches(d).get(id).t.titre);
  assert.deepEqual(titres(), ['p1', 'p2']); // 4h remplies par le partiel proche

  // le plan est figé pour la journée
  d.missions.push(nouvelleMission({ titre: 'Urgence', echeance: AUJ, importance: 5, taches: [{ titre: 'u', minutes: 60 }] }));
  assert.equal(preparerJournee(d, AUJ), false);
  assert.deepEqual(titres(), ['p1', 'p2']);

  // une nouvelle proposition garde ce qui est fait et prend en compte les changements
  basculerTache(proche, proche.taches[0], true);
  recalculerJournee(d, AUJ);
  assert.deepEqual(titres(), ['p1', 'u', 'x']); // l'heure restante est comblée

  // une tâche reportée sort de la journée et remonte ensuite
  reporter(d, loin.taches[0].id);
  assert.equal(loin.taches[0].reports, 1);
  assert.ok(raisons(loin.taches[0], loin, d, AUJ).includes('reportée 1 fois'));

  // tâche plus longue que la journée : proposée seule pour être avancée
  const seul = nouvellesDonnees();
  seul.missions.push(nouvelleMission({ titre: 'Gros', echeance: '2026-10-20', taches: [{ titre: 'énorme', minutes: 600 }] }));
  preparerJournee(seul, AUJ);
  assert.equal(seul.journee.ids.length, 1);

  // jour de repos
  const repos = nouvellesDonnees();
  repos.reglages.minutesParJour[5] = 0; // samedi
  repos.missions.push(perso);
  preparerJournee(repos, AUJ);
  assert.deepEqual(repos.journee.ids, []);

  // l'ordre des sous-tâches d'une mission est respecté même si une étape ne rentre pas
  const ordre = nouvellesDonnees();
  ordre.missions.push(nouvelleMission({ titre: 'DM', echeance: '2026-10-22', importance: 4, taches: [{ titre: 'q1', minutes: 120 }, { titre: 'q2', minutes: 150 }, { titre: 'redaction', minutes: 90 }] }));
  preparerJournee(ordre, AUJ);
  assert.deepEqual(ordre.journee.ids.map(id => indexTaches(ordre).get(id).t.titre), ['q1']);
  reporter(ordre, ordre.journee.ids[0]);
  recalculerJournee(ordre, AUJ);
  assert.deepEqual(ordre.journee.ids, []); // q1 reportée : on ne saute pas à q2

  // raisons lisibles
  assert.deepEqual(raisons(proche.taches[1], proche, d, AUJ).slice(0, 2), ['échéance dans 4 jours', '11h restantes en 4 j']);
});
