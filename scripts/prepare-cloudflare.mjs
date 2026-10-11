#!/usr/bin/env node
// Prepare la sortie du build upstream pour Cloudflare Workers Static Assets.
// 1. Convertit security-headers.conf (genere par le build) en dist/_headers.
// 2. Injecte la CSP dans worker.js (placeholder __APP_CSP__).
// Usage: node prepare-cloudflare.mjs <upstreamDir> <workerSrc> <wranglerSrc>
import { readFileSync, writeFileSync, copyFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const [upstreamDir, workerSrc, wranglerSrc] = process.argv.slice(2);
if (!upstreamDir || !workerSrc || !wranglerSrc) {
  console.error("Usage: node prepare-cloudflare.mjs <upstreamDir> <workerSrc> <wranglerSrc>");
  process.exit(1);
}

const confPath = join(upstreamDir, "security-headers.conf");
if (!existsSync(confPath)) {
  console.error(`Missing ${confPath} (le build upstream a-t-il tourne ?).`);
  process.exit(1);
}

const headers = [];
for (const line of readFileSync(confPath, "utf8").split("\n")) {
  const m = line.match(/^add_header\s+(\S+)\s+"(.*)"\s+always;$/);
  if (m) headers.push([m[1], m[2]]);
}
if (headers.length === 0) {
  console.error(`Aucun header parse depuis ${confPath}.`);
  process.exit(1);
}
const csp = (headers.find(([name]) => name === "Content-Security-Policy") || [])[1] || "";

// dist/_headers : memes headers que nginx, appliques aux hits directs.
const blocks = ["/*"];
for (const [name, value] of headers) blocks.push(`  ${name}: ${value}`);
blocks.push("", "/assets/*", "  Cache-Control: public, max-age=31536000, immutable", "");
writeFileSync(join(upstreamDir, "dist", "_headers"), blocks.join("\n"));
console.log(`[_headers] ${headers.length} headers + cache /assets/*`);

// worker.js : injecte la CSP du build courant.
const worker = readFileSync(workerSrc, "utf8");
if (!worker.includes("__APP_CSP__")) {
  console.error(`Placeholder __APP_CSP__ introuvable dans ${workerSrc}.`);
  process.exit(1);
}
if (!csp) {
  console.error("CSP vide dans security-headers.conf.");
  process.exit(1);
}
writeFileSync(join(upstreamDir, "worker.js"), worker.replace("__APP_CSP__", () => csp));
console.log(`[worker.js] CSP injectee (${csp.length} chars)`);

copyFileSync(wranglerSrc, join(upstreamDir, "wrangler.jsonc"));
console.log("[wrangler.jsonc] copie");
