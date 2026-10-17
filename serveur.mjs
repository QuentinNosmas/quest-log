// Petit serveur local, facultatif : pour utiliser ou tester le site sur ton PC sans le mettre en ligne.
// (Le site est entièrement statique : en ligne, GitHub Pages ou Vercel suffisent.)
// Lancer : node serveur.mjs   puis ouvrir http://localhost:8777
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync, statSync } from 'node:fs';
import { join, normalize, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const PORT = 8777;
const RACINE = fileURLToPath(new URL('.', import.meta.url));
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.woff2': 'font/woff2', '.ttf': 'font/ttf',
};

createServer(async (req, res) => {
  const chemin = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const fichier = normalize(join(RACINE, chemin === '/' ? 'index.html' : chemin));
  if (!fichier.startsWith(RACINE) || !existsSync(fichier) || !statSync(fichier).isFile()) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('Introuvable');
  }
  res.writeHead(200, { 'Content-Type': TYPES[extname(fichier).toLowerCase()] ?? 'application/octet-stream', 'Cache-Control': 'no-cache' });
  res.end(await readFile(fichier));
}).listen(PORT, '127.0.0.1', () => console.log(`Quest Log : http://localhost:${PORT}  (Ctrl+C pour arrêter)`));
