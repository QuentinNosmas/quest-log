// Les 8 mondes de la carte. Seul effet d'un monde : le fond d'écran du site.
// `puissance` : équipement minimum pour y entrer (somme des niveaux portés, de 0 à 25).
// `fond` : nom d'un fond de js/fond.js (une image ou un paysage généré).
export const MONDES = [
  { numero: 1, nom: 'Le Crépuscule', fond: 'crepuscule', puissance: 0 },
  { numero: 2, nom: 'La Plaine', fond: 'plaine', puissance: 3 },
  { numero: 3, nom: 'Le Lac', fond: 'lac', puissance: 6 },
  { numero: 4, nom: 'Les Montagnes', fond: 'montagne', puissance: 9 },
  { numero: 5, nom: "La Forêt d'automne", fond: 'automne', puissance: 12 },
  { numero: 6, nom: 'Le Désert', fond: 'desert', puissance: 15 },
  { numero: 7, nom: 'Les Glaces', fond: 'glaces', puissance: 19 },
  { numero: 8, nom: 'Le Volcan', fond: 'volcan', puissance: 23 },
];
export const monde = numero => MONDES[numero - 1] ?? MONDES[0];
