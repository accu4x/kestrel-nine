// Build the single-file artifact: node artifact/build.mjs            (home edition, shared data)
//                                  node artifact/build.mjs --public   (public edition, device-only records)
// Inlines src/style.css and the four scripts into src/template.html -> dist/kestrel-nine.html
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const src = (f) => readFileSync(join(here, 'src', f), 'utf8');
const PUBLIC = process.argv.includes('--public');
const scripts = (PUBLIC ? 'window.K9_PUBLIC = true;\n' : '') + ['engine.js', 'content.js', 'render.js', 'game.js'].map(src).join('\n;\n');
if (scripts.includes('</script')) throw new Error('A script contains a closing script tag.');
const html = src('template.html')
  .replace('<title>Kestrel Nine</title>', PUBLIC ? '<title>Kestrel Nine</title>' : '<title>Kestrel Nine Home</title>')
  .replace('/*STYLE*/', () => src('style.css'))
  .replace('/*SCRIPTS*/', () => scripts);
mkdirSync(join(here, 'dist'), { recursive: true });
const out = PUBLIC ? 'kestrel-nine-public.html' : 'kestrel-nine.html';
writeFileSync(join(here, 'dist', out), html);
console.log('built dist/' + out, (html.length / 1024).toFixed(1) + ' KB');
