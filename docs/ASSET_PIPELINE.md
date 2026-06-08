# Asset Pipeline

In dev, the frontend is vanilla ES modules loaded straight from the browser. No build step, no bundler, hot reload on save. In prod that becomes 39 requests to load a page that could be 7.

The pipeline runs during the Docker image build. It takes the source tree and produces a fully static `dist/` that nginx serves from disk. The final images carry no Node toolchain. Nothing touches assets at runtime.

---

## What it does

All of it runs in `scripts/build_assets.mjs`, in the Docker builder stage, before either service image assembles.

1. Images and fonts get a content hash baked into the filename (`logo-eae59c27.svg`). A manifest maps the original paths to the hashed ones so everything downstream can find them.

2. The 24 JS modules get bundled into a single file with esbuild. `minify: true` handles identifier mangling, syntax compression, and whitespace removal, including collapsing the newlines in HTML template strings that esbuild normally leaves alone. Asset references get rewritten, then the whole thing gets content-hashed.

3. The 10 CSS files get concatenated and run through esbuild's CSS transformer. Non-critical styles (everything except `critical.css`) merge into a single `app.css`. Both get content-hashed.

4. `index.html` gets rewritten: the 9 non-critical `<link>` tags collapse to one, the modulepreload graph (24 entries) drops, every URL swaps to its hashed equivalent, and the HTML gets stripped of comments and collapsed to a single line.

5. Every text asset (JS, CSS, HTML, SVG) gets a `.gz` sibling at level 9 compression. nginx's `gzip_static` serves the pre-compressed file directly. No CPU cost per request.

6. The output splits across two images. nginx gets `dist/static/` with all the hashed assets. The Python app gets `dist/index.html`, the one document it ever serves. Neither carries the Node toolchain.

---

## Before and after

Numbers from a Playwright session: first load on dev (localhost, no cache) and first load on prod (Cloudflare tunnel, no cache).

### Requests

```
Dev  ████████████████████████████████████████  39 requests
Prod ███████                                    7 requests
```

| Type    | Dev                    | Prod         |
|---------|------------------------|--------------|
| HTML    | 1 (unminified)         | 1 (minified) |
| CSS     | 10 individual files    | 2 bundles    |
| JS      | 24 individual modules  | 1 bundle     |
| Font    | 1                      | 1            |
| Images  | 3                      | 3            |
| **Total** | **39**               | **7**        |

### Transfer size (JS + CSS + HTML, excluding images)

```
Dev  ████████████████████████████████████████████████████  ~132 KB
Prod █████████                                             ~21 KB
```

| Asset | Dev      | Prod              | Ratio |
|-------|----------|-------------------|-------|
| JS    | 76.4 KB  | 12.5 KB (gzipped) | 6x    |
| CSS   | 49.9 KB  | 7.9 KB (gzipped)  | 6x    |
| HTML  | 6.1 KB   | 0.6 KB (gzipped)  | 10x   |
| **Total** | **~132 KB** | **~21 KB**   | **6x** |

Dev's JS transfer (76.4 KB) is actually larger than its decoded size (69.3 KB). The Performance API includes HTTP response headers in `transferSize`, so 24 separate module requests adds a few KB of overhead before a single byte of application code moves.

### Cache behavior

On repeat loads, prod assets serve from disk cache in 0ms. Content-hashed filenames plus `Cache-Control: immutable` mean the browser never rechecks them. Change any source file and the hash changes; the old version stays cached forever, which is fine because nothing will ever request it again.

Dev uses `?v=<hash>` appended to every URL at server startup. It works, but busting it requires a restart.

---

## Where to find things

- Build script: `scripts/build_assets.mjs`
- Dockerfile stages: `assets` (builder), `nginx` (static files), `web` (app + index.html)
- nginx config: `ops/nginx.conf` (`gzip_static on`, `expires max`, `add_header Cache-Control immutable`)
- Compose: `docker-compose.prod.yml` targets the `nginx` stage via `target: nginx`

To rebuild after changing any source asset:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build nginx web
```
