// Build-time frontend asset pipeline.
//
// Runs in the Docker builder stage (never at server runtime). Produces a fully
// static `dist/` that nginx serves straight from disk: bundled + minified +
// content-hashed JS/CSS, fingerprinted images/fonts, a rewritten index.html,
// and a .gz sibling for every text asset (for nginx `gzip_static`).
//
// Design notes:
//   * We compute every output's content hash ourselves (sha1[:8]) so JS, CSS,
//     HTML and binary assets all share one fingerprinting scheme — and so we
//     can rewrite asset references *inside* a bundle before hashing it.
//   * Assets are hashed first; then JS/CSS bundles have any "/static/..."
//     string references (e.g. logo-loser.svg used from JS, the font + bar-top
//     url() in critical.css) rewritten to the hashed paths before *their* hash
//     is taken. esbuild does not rewrite string-literal URLs, so we do it.
//   * critical.css stays a separate <link> (NOT inlined): the CSP is
//     `style-src 'self'` with no 'unsafe-inline', so an inline <style> would be
//     a policy violation.
import esbuild from 'esbuild';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import {
  rmSync, mkdirSync, readFileSync, writeFileSync, readdirSync, statSync,
} from 'node:fs';
import { join, dirname, basename, extname } from 'node:path';

const ROOT = process.cwd();
const SRC = join(ROOT, 'static');
const DIST = join(ROOT, 'dist');
const DIST_STATIC = join(DIST, 'static');

const sha8 = (buf) => createHash('sha1').update(buf).digest('hex').slice(0, 8);
const ensureDir = (p) => mkdirSync(dirname(p), { recursive: true });

rmSync(DIST, { recursive: true, force: true });
mkdirSync(DIST_STATIC, { recursive: true });

// manifest: original "/static/..." URL -> hashed "/static/..." URL
const manifest = new Map();

function writeHashed(relDir, name, ext, contents) {
  const buf = Buffer.isBuffer(contents) ? contents : Buffer.from(contents);
  const hash = sha8(buf);
  const outName = `${name}-${hash}${ext}`;
  const outPath = join(DIST_STATIC, relDir, outName);
  ensureDir(outPath);
  writeFileSync(outPath, buf);
  return `/static/${relDir}/${outName}`.replace(/\/+/g, '/');
}

// Replace every known original asset URL in a text blob with its hashed URL.
function rewriteRefs(text) {
  for (const [from, to] of manifest) text = text.split(from).join(to);
  return text;
}

function walk(dir) {
  const out = [];
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

// ── 1. Fingerprint leaf binary assets (images, fonts) ─────────────────────────
const minifySvg = (text) => {
  let s = text.replace(/<!--[\s\S]*?-->/g, '').replace(/[ \t]*\n[ \t]*/g, ' ');
  while (/ {2}/.test(s)) s = s.replace(/ {2,}/g, ' ');
  return s.trim();
};

for (const sub of ['images', 'fonts']) {
  const dir = join(SRC, sub);
  for (const file of walk(dir)) {
    const ext = extname(file);
    const name = basename(file, ext);
    const raw = readFileSync(file);
    const contents = ext === '.svg' ? minifySvg(raw.toString()) : raw;
    const url = writeHashed(sub, name, ext, contents);
    manifest.set(`/static/${sub}/${basename(file)}`, url);
  }
}

// ── 2. Bundle + minify JS, rewrite asset refs, then hash ──────────────────────
{
  const res = await esbuild.build({
    entryPoints: [join(SRC, 'js', 'app.js')],
    bundle: true, minify: true, format: 'esm', target: 'es2020',
    write: false, legalComments: 'none',
  });
  const js = rewriteRefs(
    res.outputFiles[0].text.replace(/[ \t]*\n[ \t]*/g, ' ').replace(/ {2,}/g, ' '),
  );
  manifest.set('/static/js/app.js', writeHashed('js', 'app', '.js', js));
}

// ── 3. Bundle + minify the non-critical CSS (index.html order) ────────────────
// Derive the non-critical list from every .css file in static/css/ except critical.css.
const NONCRIT = readdirSync(join(SRC, 'css'))
  .filter((f) => f.endsWith('.css') && f !== 'critical.css')
  .map((f) => f.replace(/\.css$/, ''));
{
  const concat = NONCRIT.map((n) => readFileSync(join(SRC, 'css', `${n}.css`))).join('\n');
  const min = (await esbuild.transform(concat, { loader: 'css', minify: true })).code;
  manifest.set('/static/css/app.css', writeHashed('css', 'app', '.css', rewriteRefs(min)));
}

// ── 4. Minify critical.css, rewrite its url() refs (font + bar-top), hash ─────
{
  const raw = readFileSync(join(SRC, 'css', 'critical.css'), 'utf8');
  const min = (await esbuild.transform(raw, { loader: 'css', minify: true })).code;
  manifest.set('/static/css/critical.css',
    writeHashed('css', 'critical', '.css', rewriteRefs(min)));
}

// ── 4b. Rewrite the web-app manifest's icon refs, then hash it ────────────────
// Icons were fingerprinted in step 1, so rewriteRefs points them at the hashed
// paths; recording the manifest in the map lets step 5 rewrite its <link> href.
{
  const raw = readFileSync(join(SRC, 'manifest.webmanifest'), 'utf8');
  manifest.set('/static/manifest.webmanifest',
    writeHashed('', 'manifest', '.webmanifest', rewriteRefs(raw)));
}

// ── 5. Rewrite index.html ─────────────────────────────────────────────────────
let html = readFileSync(join(SRC, 'index.html'), 'utf8');
html = rewriteRefs(html); // images, fonts, critical.css link

// collapse the 9 non-critical stylesheet links into one bundled link
html = html.replace(
  /  <!-- Non-critical CSS[^]*\.css">\n/,
  `  <link rel="stylesheet" href="${manifest.get('/static/css/app.css')}">`,
);
// drop the modulepreload graph (single self-contained bundle now)
html = html.replace(/  <!-- Preload the whole module graph[^]*\.js">\n/, '');
// point the entry script at the hashed bundle
html = html.replace('/static/js/app.js', manifest.get('/static/js/app.js'));

while (/<!--[\s\S]*?-->/.test(html)) html = html.replace(/<!--[\s\S]*?-->/g, '');
html = html.split('\n').map((l) => l.trim()).filter(Boolean).join('');
writeFileSync(join(DIST, 'index.html'), html);

// ── 6. Pre-compress text assets for nginx gzip_static ─────────────────────────
let gz = 0;
for (const file of walk(DIST)) {
  if (/\.(js|css|html|svg|webmanifest)$/.test(file)) {
    writeFileSync(`${file}.gz`, gzipSync(readFileSync(file), { level: 9 }));
    gz++;
  }
}

console.log(`built dist/: ${manifest.size} fingerprinted assets, ${gz} gzipped`);
console.log(`  js  -> ${manifest.get('/static/js/app.js')}`);
console.log(`  css -> ${manifest.get('/static/css/app.css')}`);
console.log(`  crit-> ${manifest.get('/static/css/critical.css')}`);
