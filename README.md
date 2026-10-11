<img src="assets/icon.svg" width="64" height="64" alt="">

# artpdf

Deploiement auto de [BentoPDF](https://github.com/alam00000/bentopdf) sur Cloudflare **Worker + Static Assets**, resynchronise avec upstream chaque jour.

## Fonctionnement

Le workflow `.github/workflows/deploy.yml` tourne chaque jour a 06:00 UTC (plus lancement manuel) :

1. Checkout ce repo (`self`) pour la config de deploy.
2. Checkout `alam00000/bentopdf@main` (`upstream`).
3. Build avec `VITE_USE_CDN=true` (WASM via jsDelivr + fallback local).
4. `scripts/prepare-cloudflare.mjs` convertit `security-headers.conf` du build en `dist/_headers`, injecte la CSP dans `worker.js`, copie `wrangler.jsonc`.
5. `wrangler deploy`.

Le `worker.js` ajoute les URLs propres (`/merge-pdf` vers `/merge-pdf.html`, `/fr/` vers `/fr/index.html`), la page 404 et les headers d'isolation (`COOP/COEP`, requis pour SharedArrayBuffer) + securite.

## Configuration

Secrets requis (`Settings > Secrets and variables > Actions`) :

| Secret | Ou le trouver |
| --- | --- |
| `CLOUDFLARE_API_TOKEN` | Dash Cloudflare > My Profile > API Tokens > Create Token > modele `Edit Cloudflare Workers` |
| `CLOUDFLARE_ACCOUNT_ID` | Dash Cloudflare > Workers & Pages > Overview (colonne droite) |

Premier deploy : `Actions > Deploy BentoPDF to Cloudflare Worker > Run workflow`. L'URL sera `https://artpdf.<ton-compte>.workers.dev`.

Domaine custom : ajoute un `routes` dans `wrangler.jsonc`.

## Fichiers

| Fichier | Role |
| --- | --- |
| `wrangler.jsonc` | Config Worker + Static Assets |
| `worker.js` | Fallback URLs propres, 404, headers (`__APP_CSP__` injecte au deploy) |
| `scripts/prepare-cloudflare.mjs` | Pont build upstream vers fichiers Cloudflare |
| `.github/workflows/deploy.yml` | Cron quotidien + deploy |
