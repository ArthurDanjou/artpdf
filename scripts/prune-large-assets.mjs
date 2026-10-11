#!/usr/bin/env node
// Supprime de dist les fichiers depassant la limite Cloudflare Workers
// Static Assets (25 MiB par fichier). En pratique : fallbacks WASM locaux
// volumineux (ex. LibreOffice). Sans impact en ligne car avec
// VITE_USE_CDN=true le navigateur charge le CDN en priorite.
// Usage: node prune-large-assets.mjs <distDir> [maxMiB=25]
import { readdirSync, statSync, rmSync } from "node:fs";
import { join } from "node:path";

const [distDir, maxArg] = process.argv.slice(2);
if (!distDir) {
  console.error("Usage: node prune-large-assets.mjs <distDir> [maxMiB=25]");
  process.exit(1);
}
const maxBytes = parseFloat(maxArg || "25") * 1024 * 1024;

let removed = 0;
const walk = (dir) => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(p);
      continue;
    }
    const size = statSync(p).size;
    if (size > maxBytes) {
      rmSync(p);
      removed++;
      console.log(`[prune] supprime ${(size / 1048576).toFixed(1)} MiB: ${p}`);
    }
  }
};
walk(distDir);
console.log(`[prune] ${removed} fichier(s) supprime(s) (limite ${maxArg || "25"} MiB)`);
