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
//     string references (e.g. logo-loser.svg used from JS, the font + poster
//     url() in critical.css) rewritten to the hashed paths before *their* hash
//     is taken. esbuild does not rewrite string-literal URLs, so we do it.
//   * critical.css is inlined as a <style> in dist/index.html — first paint (the
//     inline #loading screen) shouldn't depend on a second network round trip on
//     top of the document itself. The CSP is `style-src 'self'` with no
//     'unsafe-inline', so this only stays policy-compliant because we pin the
//     exact inlined bytes: their sha256 goes to dist/csp.json, and
//     server/security.py adds it to style-src as 'sha256-<hash>' — a narrow,
//     content-specific allowance, not a general inline-style exemption.
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

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Replace every known original asset URL in a text blob with its hashed URL,
// dropping any dev-only cache-bust query (e.g. `landing-mich.webp?v=2`): the
// content hash in the filename is the version in prod, so the query is redundant
// there — and leaving it would point at a nonexistent `…-HASH.webp?v=2` file.
function rewriteRefs(text) {
  for (const [from, to] of manifest) {
    text = text.replace(new RegExp(escapeRe(from) + '(?:\\?[^"\'\\s)]*)?', 'g'), () => to);
  }
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
  let s = text;
  while (/<!--[\s\S]*?-->/.test(s)) s = s.replace(/<!--[\s\S]*?-->/g, '');
  s = s.replace(/[ \t]*\n[ \t]*/g, ' ');
  while (/ {2}/.test(s)) s = s.replace(/ {2,}/g, ' ');
  return s.trim();
};

for (const sub of ['images', 'fonts', 'video']) {
  const dir = join(SRC, sub);
  for (const file of walk(dir)) {
    const ext = extname(file);
    const name = basename(file, ext);
    const raw = readFileSync(file);
    const contents = ext === '.svg' ? minifySvg(raw.toString()) : raw;
    // Preserve subdirectory structure (e.g. images/splash/foo.png)
    const relFromSrc = file.slice(dir.length + 1);  // "splash/foo.png" or "foo.png"
    const relDir = join(sub, dirname(relFromSrc)).replace(/\/+$/, '');
    const url = writeHashed(relDir, name, ext, contents);
    manifest.set(`/static/${sub}/${relFromSrc}`, url);
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

// ── 3. Bundle + minify the non-critical CSS (index.html <link> order) ─────────
// Concatenation order IS cascade order: same-specificity rules in the same
// @layer break ties by source order, so the bundle must match the per-file
// <link> order the browser applies in dev (index.html) — NOT readdirSync's
// alphabetical order, which silently flips those ties (e.g. it drops shell.css
// last, so its .screen-body padding beats lobby.css's .lobby-body and the lobby
// title collides with the floating Back chip). Derive the order from index.html
// itself so it stays self-maintaining; append any stray .css not linked there (a
// forgotten <link>) at the end so it's still bundled, with a warning.
const indexHtml = readFileSync(join(SRC, 'index.html'), 'utf8');
// Standalone pages served outside the app document (their own <link>, no
// @layer): each asset is fingerprinted on its own, never concatenated into
// app.css. Declared once here so the bundle-exclusion filters below AND the
// step-4c hashing loop stay in sync — add a page's assets here and they're both
// excluded from the bundle and fingerprinted. `critical` is handled separately
// in step 4 — inlined into index.html, not fingerprinted as its own file.
const STANDALONE_ASSETS = [
  ['css', 'widget', '.css', 'css'],
  ['js', 'widget', '.js', 'js'],
];
const STANDALONE = ['critical',
  ...STANDALONE_ASSETS.filter(([sub]) => sub === 'css').map(([, name]) => name)];
const linked = [...new Set(
  [...indexHtml.matchAll(/\/static\/css\/([\w-]+)\.css/g)].map((m) => m[1]),
)].filter((n) => !STANDALONE.includes(n));
const unlinked = readdirSync(join(SRC, 'css'))
  .filter((f) => f.endsWith('.css') && !STANDALONE.includes(f.replace(/\.css$/, '')))
  .map((f) => f.replace(/\.css$/, ''))
  .filter((n) => !linked.includes(n));
if (unlinked.length) {
  console.warn(`  warn: ${unlinked.map((n) => `${n}.css`).join(', ')} not <link>ed in index.html; appended last`);
}
const NONCRIT = [...linked, ...unlinked];
{
  const concat = NONCRIT.map((n) => readFileSync(join(SRC, 'css', `${n}.css`))).join('\n');
  const min = (await esbuild.transform(concat, { loader: 'css', minify: true })).code;
  manifest.set('/static/css/app.css', writeHashed('css', 'app', '.css', rewriteRefs(min)));
}

// ── 4. Minify critical.css, rewrite its url() refs (font + poster) ────────────
// Not written to a hashed file / not added to `manifest`: it's inlined straight
// into index.html below (step 5), not linked, so there's no URL to rewrite refs
// to and no fingerprinted file to serve. Its sha256 goes to dist/csp.json so
// server/security.py can allow exactly this content in the CSP's style-src.
let criticalCss;
{
  const raw = readFileSync(join(SRC, 'css', 'critical.css'), 'utf8');
  const min = (await esbuild.transform(raw, { loader: 'css', minify: true })).code;
  // Flattened to one line so the later whole-document `split('\n').map(trim)`
  // pass (step 5) can't touch anything inside the <style> tag's text — the CSP
  // hash below is taken over these exact bytes, so nothing may reshape them.
  criticalCss = rewriteRefs(min).replace(/[ \t]*\n[ \t]*/g, ' ').trim();
}
const criticalCssSha256 = createHash('sha256').update(criticalCss, 'utf8').digest('base64');

// ── 4c. Minify the standalone pages' assets (never part of the app bundle),
// rewrite refs (wood poster in the CSS), hash. The app resolves the hashed URLs
// at runtime via the asset manifest written in step 7. Driven by the single
// STANDALONE_ASSETS declaration above so a new page can't be excluded from the
// bundle without also being fingerprinted here.
for (const [sub, name, ext, loader] of STANDALONE_ASSETS) {
  const raw = readFileSync(join(SRC, sub, `${name}${ext}`), 'utf8');
  const min = (await esbuild.transform(raw, { loader, minify: true })).code;
  manifest.set(`/static/${sub}/${name}${ext}`,
    writeHashed(sub, name, ext, rewriteRefs(min)));
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
html = rewriteRefs(html); // images, fonts, manifest link

// inline critical.css — first paint (the inline #loading screen) shouldn't
// wait on a second network round trip beyond the document itself. Its CSP
// hash (dist/csp.json) is what keeps this compliant with style-src 'self'.
html = html.replace(
  '<link rel="stylesheet" href="/static/css/critical.css">',
  `<style>${criticalCss}</style>`,
);

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

// ── 7. Asset manifest: original URL -> hashed URL, for server-rendered pages
// outside index.html (e.g. /api/widget) to resolve their assets at runtime.
writeFileSync(join(DIST, 'manifest.json'),
  JSON.stringify(Object.fromEntries(manifest), null, 1));

// ── 7b. CSP hash for the inlined critical.css <style>, for server/security.py
// to add to style-src (a content-pinned allowance, not a general 'unsafe-inline').
writeFileSync(join(DIST, 'csp.json'),
  JSON.stringify({ 'style-src-sha256': criticalCssSha256 }, null, 1));

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
console.log(`  crit-> inlined, sha256-${criticalCssSha256}`);
