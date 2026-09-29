// Build: node artifact/build.mjs            home edition, shared data      -> dist/kestrel-nine.html
//        node artifact/build.mjs --public   public edition, device records -> dist/kestrel-nine-public.html
//        node artifact/build.mjs --site     installable app for play.latentmirror.com -> dist/site/
// The two artifact editions inline src/style.css and the scripts into src/template.html. The site
// edition serves the same sources as separate files, because its CSP allows no inline script or style.
import { readFileSync, writeFileSync, mkdirSync, rmSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { ICONS, drawIcon } from './icons.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const src = (f) => readFileSync(join(here, 'src', f), 'utf8');
const PUBLIC = process.argv.includes('--public');
const SITE = process.argv.includes('--site');
const SCRIPTS = ['engine.js', 'content.js', 'render.js', 'game.js'];
const CLAUDE_SHARE_URL = "'https://claude.ai/artifact/VRsr1KHKCh5mcX1EBTYT8V'";

if (SITE) buildSite();
else buildArtifact();

function buildArtifact() {
  const scripts = (PUBLIC ? 'window.K9_PUBLIC = true;\n' : '') + SCRIPTS.map(src).join('\n;\n');
  if (scripts.includes('</script')) throw new Error('A script contains a closing script tag.');
  const html = src('template.html')
    .replace('<title>Kestrel Nine</title>', PUBLIC ? '<title>Kestrel Nine</title>' : '<title>Kestrel Nine Home</title>')
    .replace('/*STYLE*/', () => src('style.css'))
    .replace('/*SCRIPTS*/', () => scripts);
  mkdirSync(join(here, 'dist'), { recursive: true });
  const out = PUBLIC ? 'kestrel-nine-public.html' : 'kestrel-nine.html';
  writeFileSync(join(here, 'dist', out), html);
  console.log('built dist/' + out, (html.length / 1024).toFixed(1) + ' KB');
}

function buildSite() {
  const SLUG = 'kestrel-nine';
  const PLAY_URL = `https://play.latentmirror.com/${SLUG}/`;
  const GROUND = '#14161f'; // Slate --hh-ground
  const root = join(here, 'dist', 'site');
  const app = join(root, SLUG); // a route does not strip its path, so assets live under /kestrel-nine/
  // Empty rather than remove the folder: Windows refuses to delete a directory a shell is in.
  mkdirSync(root, { recursive: true });
  for (const name of readdirSync(root)) rmSync(join(root, name), { recursive: true, force: true });
  mkdirSync(app, { recursive: true });

  const content = src('content.js');
  if (!content.includes(CLAUDE_SHARE_URL)) throw new Error('SHARE_URL in content.js changed; update build.mjs.');
  const sources = { 'content.js': content.replace(CLAUDE_SHARE_URL, `'${PLAY_URL}'`) };
  const appJs = 'window.K9_PUBLIC = true;\nwindow.K9_SITE = true;\n' +
    ['engine.js', 'content.js', 'render.js', 'save.js', 'game.js'].map((f) => sources[f] || src(f)).join('\n;\n');

  const tpl = src('template.html');
  const body = tpl.slice(tpl.indexOf('<div class="app">'), tpl.indexOf('<script>')).trim();
  if (/\sstyle=|<style|<script/i.test(body)) throw new Error('The page shell carries inline style or script.');
  const indexHtml = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Kestrel Nine</title>
<meta name="description" content="A retro vector space game of minds and machines. Installs as an app and plays offline.">
<meta name="theme-color" content="${GROUND}">
<link rel="manifest" href="manifest.webmanifest">
<link rel="icon" href="icon-192.png" type="image/png">
<link rel="apple-touch-icon" href="apple-touch-icon.png">
<link rel="stylesheet" href="app.css">
</head>
<body>
${body}
<script src="app.js" defer></script>
</body>
</html>
`;

  const manifest = JSON.stringify({
    name: 'Kestrel Nine',
    short_name: 'Kestrel Nine',
    description: 'A retro vector space game of minds and machines.',
    id: `/${SLUG}/`,
    start_url: `/${SLUG}/`,
    scope: `/${SLUG}/`,
    display: 'standalone',
    background_color: GROUND,
    theme_color: GROUND,
    icons: [
      { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }, null, 2) + '\n';

  const files = { 'index.html': indexHtml, 'app.js': appJs, 'app.css': src('style.css'), 'manifest.webmanifest': manifest };
  for (const icon of ICONS) files[icon.file] = drawIcon(icon);

  const hash = createHash('sha256');
  for (const name of Object.keys(files).sort()) hash.update(name).update(files[name]);
  const cache = 'k9-' + hash.digest('hex').slice(0, 12);
  // './' is the start URL; index.html itself is not listed, since the host redirects it to './'.
  const precache = ['./', ...Object.keys(files).filter((f) => f !== 'index.html')];
  const sw = src('sw.js').replace("'/*CACHE*/'", JSON.stringify(cache)).replace('/*FILES*/[]', JSON.stringify(precache));
  if (sw.includes('/*CACHE*/') || sw.includes('/*FILES*/')) throw new Error('sw.js placeholders were not filled.');
  files['sw.js'] = sw;

  for (const [name, data] of Object.entries(files)) writeFileSync(join(app, name), data);
  writeFileSync(join(root, '_headers'), src('site-headers.txt').replaceAll('{SLUG}', SLUG));
  const kb = Object.values(files).reduce((a, d) => a + d.length, 0) / 1024;
  console.log(`built dist/site/${SLUG}/ (${Object.keys(files).length} files, ${kb.toFixed(1)} KB, cache ${cache})`);
}
