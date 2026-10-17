// Dates au format 'AAAA-MM-JJ' (jour local, sans heure) : simples à comparer, stocker et synchroniser.
// Les durées sont toujours en minutes.

export function dateISO(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export const aujourdhui = () => dateISO();

const versUTC = iso => { const [a, m, j] = iso.split('-').map(Number); return Date.UTC(a, m - 1, j); };
const depuisUTC = t => new Date(t).toISOString().slice(0, 10);

export const joursEntre = (de, a) => Math.round((versUTC(a) - versUTC(de)) / 864e5);
export const ajouterJours = (iso, n) => depuisUTC(versUTC(iso) + n * 864e5);
export const jourSemaine = iso => (new Date(versUTC(iso)).getUTCDay() + 6) % 7; // 0 = lundi … 6 = dimanche

export function ajouterMois(iso, n) {
  const [a, m, j] = iso.split('-').map(Number);
  const fin = new Date(Date.UTC(a, m - 1 + n + 1, 0)).getUTCDate(); // 31/01 + 1 mois = 28 ou 29/02
  return depuisUTC(Date.UTC(a, m - 1 + n, Math.min(j, fin)));
}

export function construire(a, m, j) {
  const d = new Date(Date.UTC(a, m - 1, j));
  return d.getUTCFullYear() === a && d.getUTCMonth() === m - 1 && d.getUTCDate() === j ? depuisUTC(d.getTime()) : null;
}

const fmt = options => new Intl.DateTimeFormat('fr-FR', { timeZone: 'UTC', ...options });
const FMT_LONG = fmt({ weekday: 'long', day: 'numeric', month: 'long' });
export const dateLongue = iso => FMT_LONG.format(versUTC(iso));          // « samedi 17 octobre »
export function dateCourte(iso, reference = aujourdhui()) {              // « 12/12 » ou « 12/12/2027 »
  const [a, m, j] = iso.split('-');
  return a === reference.slice(0, 4) ? `${j}/${m}` : `${j}/${m}/${a}`;
}

/** 360 → « 6h », 90 → « 1h30 », 45 → « 45min » */
export const duree = min => (min % 60 ? (min >= 60 ? `${Math.floor(min / 60)}h${String(min % 60).padStart(2, '0')}` : `${min}min`) : `${min / 60}h`);
