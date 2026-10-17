# Quest Log — guide

Ton gestionnaire de missions en pixel art. Le site est **100 % statique** : du HTML, du CSS et du JavaScript, sans compilation ni serveur obligatoire. Tes données restent **dans ton navigateur**.

## Les pages

| Page | Ce qu'on y fait |
|---|---|
| **Accueil** | Les missions du jour, en **séances d'une heure** : une sous-tâche de 10h devient 10 séances réparties sur plusieurs jours. Elles sont choisies selon l'importance, l'échéance et le travail restant, en gardant l'ordre des sous-tâches de chaque mission. |
| **Missions** | Toutes les missions et leurs sous-tâches (saisie rapide ou formulaire), avec l'avancement de chacune (ex. 3h / 10h). Une sous-tâche est finie quand ses séances atteignent son estimation, ou quand tu la coches « terminée ». |
| **Travail** | Rien que le paysage du monde actuel, pour travailler au calme. `Échap` ou le bouton discret en haut à gauche pour sortir. |
| **Calendrier** | Les échéances du mois et la liste des prochaines. |
| **Stats** | Le calendrier d'activité façon GitHub (plus un carré est vert, plus tu as fait ce que tu avais prévu ce jour-là) et tes chiffres clés. |
| **Personnage** | L'apparence de ton héros et la boutique d'équipement. |
| **Carte** | Les 8 mondes. Chacun demande une puissance minimum ; y voyager change le fond du site. |
| **Réglages** | Temps disponible, sauvegarde, restauration, exemples, remise à zéro. |

**L'économie** :
- **Les gains** :
  - chaque séance faite (ou sous-tâche cochée « terminée ») rapporte 12 pièces par heure de travail ;
  - une mission terminée rapporte 10 × son importance ;
  - une journée du jour entièrement accomplie rapporte 15 pièces.
- **Pas de triche possible** : décocher une tâche reprend ses pièces, et supprimer une mission ne reprend pas ce qui a été gagné.
- **Les achats** : les pièces achètent de l'équipement en 5 matières (bois, bronze, fer, or, cristal). Chaque objet porté donne 1 à 5 de puissance (25 au maximum), et la puissance ouvre les mondes.
- **Les réglages du jeu** se changent en haut de `js/economie.js` (gains), dans `NIVEAUX` de `js/personnage.js` (prix) et dans `js/mondes.js` (seuils, noms et fonds des mondes).

## 1. Lancer le site sur ton PC

Il faut [Node.js](https://nodejs.org) (déjà installé chez toi).

- **Le plus simple** : double-clique sur `lancer.bat`. Le navigateur s'ouvre sur http://localhost:8777.
- **Sinon**, dans un terminal, depuis le dossier du projet :
  ```bash
  node serveur.mjs
  ```
  puis ouvre http://localhost:8777. Pour arrêter : `Ctrl+C`.

> Ouvrir `index.html` en double-cliquant dessus ne marche pas : les navigateurs bloquent les scripts des fichiers ouverts directement depuis le disque. Il faut passer par le petit serveur, ou par la version en ligne.

La page `styleguide.html` (http://localhost:8777/styleguide.html) montre tous les éléments graphiques.

## 2. Mettre le site en ligne (gratuit)

### GitHub Pages
1. Crée un dépôt sur GitHub (par exemple `quest-log`) et envoie-y tous les fichiers du projet.
2. Dans le dépôt : **Settings → Pages → Build and deployment → Source : Deploy from a branch**, branche `main`, dossier `/ (root)`.
3. Une minute plus tard, le site est à l'adresse `https://<ton-pseudo>.github.io/quest-log/`.

### Vercel
1. Sur vercel.com, **Add New → Project**, puis importe ton dépôt GitHub.
2. *Framework Preset* : **Other**. Laisse la commande de build vide. *Output directory* : `.` (la racine).
3. **Deploy**.

Le code du site devient public (sur un dépôt public), mais **pas tes données** : elles ne quittent jamais ton navigateur. Ne mets pas tes fichiers de sauvegarde dans le dépôt (le `.gitignore` les ignore déjà).

### Sur ton téléphone
Ouvre l'adresse du site, puis ajoute-le à l'écran d'accueil :
- **iPhone (Safari)** : bouton Partager → *Sur l'écran d'accueil*. **Important sur iPhone** : Safari peut effacer les données d'un site non visité pendant 7 jours. Une fois ajouté à l'écran d'accueil, le site est protégé de ce nettoyage.
- **Android (Chrome)** : menu ⋮ → *Ajouter à l'écran d'accueil*.

## 3. Tes données et leur sauvegarde

- Les données sont enregistrées automatiquement **dans le navigateur**, séparément pour chaque appareil et chaque adresse : `localhost:8777`, la version en ligne et ton téléphone ont chacun leurs propres données.
- **Pour transférer ou mettre à l'abri** : *Réglages → Télécharger une sauvegarde* crée un fichier `quest-log-sauvegarde-AAAA-MM-JJ.json`. *Restaurer depuis un fichier* le recharge, sur n'importe quel appareil, après confirmation.
- **Rappel** : le site te propose de sauvegarder tous les 7 jours (modifiable dans les réglages).
- **Protections** : un onglet ne peut pas écraser les changements d'un autre, des données illisibles sont mises de côté au lieu d'être effacées, et un bandeau rouge apparaît si le navigateur refuse d'enregistrer.
- **Plus tard, la synchronisation** : toute la lecture et l'écriture passent par `js/stockage.js`. Une synchronisation en ligne s'ajoutera là, sans toucher au reste. Chaque mission et sous-tâche a déjà un identifiant stable et une date de modification pour pouvoir fusionner les changements.

## 4. Remplacer les graphismes par les tiens

| Élément | Où | Comment |
|---|---|---|
| Icônes | `assets/icones/<nom>.svg` | Remplace le fichier en gardant le même nom. Pour une image `.png`, ajoute son chemin dans `IMAGES` en haut de `js/ui.js`, par exemple `epee: 'assets/mes-images/epee.png'`. |
| Fonds (paysages) | `assets/fonds/` | Remplace les fichiers, ou change les chemins dans `FONDS` en haut de `js/fond.js`. Les mondes 6 à 8 (désert, glaces, volcan) sont dessinés par le code (`js/paysages.js`) : pour mettre tes images, remplace `() => paysage('desert')` par `'assets/fonds/desert.png'`. |
| Personnage et équipement | `js/personnage.js` | Dessinés en texte 32×32 (une lettre = un pixel), en calques : corps, coiffures, puis chaque pièce d'équipement. Les couleurs (peaux, cheveux, tuniques, matières) sont en haut du fichier. |
| Couleurs, polices, épaisseur des bordures | `css/pixel.css` | Toutes les variables sont en haut du fichier (`--or`, `--bois`, `--px`…). |

Quelques précisions :
- **Taille des icônes** : elles sont dessinées en 16×16 et affichées en ×1 ou ×2. Pour rester nettes, tes images doivent faire **16×16 ou 32×32 pixels**.
- **Icônes définies ailleurs** : le logo est dans `index.html` (`epee.svg`), la coche des cases et la flèche des listes sont dans `css/pixel.css` (`coche.svg`, `bas.svg`).
- **Les fonds** remplissent tout l'écran : ils sont agrandis d'un nombre entier de fois (jamais déformés), centrés, et ce qui dépasse est rogné. Pour un rendu net, l'image doit être du **vrai pixel art en PNG** (1 pixel du dessin = 1 pixel du fichier, aucun flou), par exemple **320×180** (×6 sur un écran 1920×1080). Une image JPEG ou réduite depuis un plus grand format reste floue : le site ne peut pas recréer la netteté qui manque au fichier.
- **Un seul fond partout** : `FOND_FIXE` en haut de `js/fond.js` (actuellement `fond.png`). Mets `null` pour que chaque monde de la carte ait de nouveau son paysage.
- **Redessiner les icônes actuelles** : elles sont décrites en texte dans `tools/icones.mjs` (une lettre = un pixel). Modifie le dessin, puis lance :
  ```bash
  node tools/icones.mjs
  ```
- **Les polices** (Press Start 2P et VT323, licence libre SIL OFL) sont dans `assets/polices/`.

## 5. Vérifier que tout marche

La logique est testée : lecture des dates et durées, saisie rapide, choix des missions du jour, pièces, boutique, mondes, statistiques, dessins du personnage et reprise des anciennes sauvegardes.
```bash
node --test
```

## 6. Organisation des fichiers

```
index.html          l'application
styleguide.html     la vitrine de tous les éléments graphiques
css/pixel.css       le système visuel pixel art (couleurs, boutons, cadres…)
css/app.css         la mise en page de l'application
js/app.js           démarrage, navigation, enregistrement
js/stockage.js      où vivent les données (navigateur, fichiers de sauvegarde)
js/donnees.js       le modèle : missions, sous-tâches, vérification des sauvegardes
js/journee.js       le choix des missions du jour
js/saisie.js        la lecture tolérante de la saisie rapide
js/economie.js      les pièces : gains, historique, achats
js/personnage.js    le héros : apparence, boutique, dessins
js/mondes.js        les 8 mondes de la carte
js/stats.js         les calculs des statistiques
js/fond.js          le paysage en fond d'écran
js/paysages.js      les paysages dessinés par le code (désert, glaces, volcan)
js/ui.js            briques d'affichage : icônes, badges, fenêtres, célébrations
js/vues/            les pages : accueil, missions, mission, calendrier, stats, personnage, carte, réglages, création
assets/             icônes, fonds, polices
tools/icones.mjs    le générateur d'icônes
tests/              les tests
serveur.mjs         petit serveur local facultatif
```
