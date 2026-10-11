<img src="assets/icon.svg" width="64" height="64" alt="">

# artpdf

Self-hosted [BentoPDF](https://github.com/alam00000/bentopdf) on Cloudflare **Workers + Static Assets**, automatically rebuilt from upstream every day.

BentoPDF is a privacy-first, fully client-side PDF toolkit. This repo contains only the deployment wrapper: a scheduled workflow checks out the latest upstream release, builds it, and deploys it to your Cloudflare account. No fork syncing required.

## How it works

The `.github/workflows/deploy.yml` workflow runs daily at 06:00 UTC (and manually via `workflow_dispatch`):

1. Checks out this repo (`self`) for the deploy configuration.
2. Checks out `alam00000/bentopdf@main` into `upstream/` — always fresh, so upstream updates never overwrite anything here.
3. `scripts/select-languages.mjs` trims the UI languages (`LANGUAGES`, default `"en fr"`).
4. Builds with `VITE_USE_CDN=true` (large WASM modules load from jsDelivr CDN with local fallback), `VITE_DEFAULT_LANGUAGE=fr`, and `SIMPLE_MODE=true` (homepage reduced to the tools grid, no marketing pages).
5. `scripts/prune-large-assets.mjs` drops files over 25 MiB from `dist` (per-file Cloudflare limit; the CDN covers them online).
6. `scripts/prepare-cloudflare.mjs` converts the build's `security-headers.conf` into `dist/_headers`, injects the current CSP into `worker.js`, and stages `wrangler.jsonc`.
7. `wrangler deploy`.

The `worker.js` edge worker adds clean URLs (`/merge-pdf` → `/merge-pdf.html`, `/fr/` → `/fr/index.html`), serves the nearest `404.html`, and sets isolation headers (`COOP/COEP`, required for SharedArrayBuffer) plus security headers.

## Setup

**1. Get your Cloudflare credentials**

| Secret | Where to find it |
| --- | --- |
| `CLOUDFLARE_API_TOKEN` | Dash → My Profile → API Tokens → Create Token → `Edit Cloudflare Workers` template |
| `CLOUDFLARE_ACCOUNT_ID` | Dash → Workers & Pages → Overview (right column) |

**2. Add them to this repo**

Repo → Settings → Secrets and variables → Actions → New repository secret. Add both secrets above.

**3. Run the first deploy**

Repo → Actions → Deploy BentoPDF to Cloudflare Worker → Run workflow. The build takes several minutes (large Vite project). Your instance will be live at `https://artpdf.<your-account>.workers.dev`.

Subsequent deploys run automatically every day.

## Configuration

| Setting | Where | Default | Effect |
| --- | --- | --- | --- |
| `LANGUAGES` | top of `deploy.yml` | `"en fr"` | UI languages included in the build. Upstream ships ~22; trimming shrinks `dist` and build time. `"en"` is always kept (fallback). Fails loudly if upstream restructures its i18n files. |
| Custom domain | `wrangler.jsonc` | — | Add a `routes` entry, e.g. `{ "pattern": "pdf.example.com/*", "zone_name": "example.com" }` |
| Worker name | `wrangler.jsonc` → `name` | `"artpdf"` | Also sets the `artpdf.<account>.workers.dev` subdomain |

## Files

| File | Role |
| --- | --- |
| `wrangler.jsonc` | Worker + Static Assets config (copied to the build root before deploy) |
| `worker.js` | Clean-URL fallback, 404 handling, headers (`__APP_CSP__` is injected at deploy time) |
| `scripts/select-languages.mjs` | Trims UI languages before the build |
| `scripts/prune-large-assets.mjs` | Drops files over 25 MiB from the deploy (Cloudflare limit) |
| `scripts/prepare-cloudflare.mjs` | Bridges the upstream build output to Cloudflare files |
| `.github/workflows/deploy.yml` | Daily cron + deploy |

## Notes

- **No state on the edge.** The worker is stateless: no KV, D1, R2, or Durable Objects. All PDF processing happens in the visitor's browser.
- **Large files stay on the CDN.** Local LibreOffice WASM fallbacks exceed the 25 MiB per-file limit and are excluded from the deploy; Office conversions load them from jsDelivr instead. Fully offline/air-gapped use is not covered by this setup.
- **Removed languages degrade gracefully.** The language switcher only lists built languages; stale `/xx/` URLs serve the 404 page, and missing locale JSON falls back to English in-app.
- **License.** BentoPDF itself is [AGPL-3.0](https://github.com/alam00000/bentopdf/blob/main/LICENSE). This repo ships its build unmodified; check the upstream license if you customize the source.
