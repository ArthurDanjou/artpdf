#!/usr/bin/env node
// Restreint les langues UI du build upstream (pas d'option native :
// upstream hardcode 22 langues et genere ~100 pages par langue).
// Usage: node select-languages.mjs <upstreamDir> "en fr"
// - supprime les dossiers public/locales non retenus ("en" toujours garde)
// - reecrit supportedLanguages + languageNames dans src/js/i18n/i18n.ts
//   (le selecteur de langue les lit dynamiquement)
// Echec bruyant si la structure upstream change.
import {
  readdirSync,
  statSync,
  rmSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";

const [upstreamDir, langsArg] = process.argv.slice(2);
if (!upstreamDir || !langsArg) {
  console.error('Usage: node select-languages.mjs <upstreamDir> "en fr"');
  process.exit(1);
}

const localesDir = join(upstreamDir, "public", "locales");
const available = readdirSync(localesDir).filter((f) =>
  statSync(join(localesDir, f)).isDirectory()
);
const wanted = [
  ...new Set(
    langsArg
      .split(/[,\s]+/)
      .map((s) => s.trim())
      .filter(Boolean)
  ),
];
if (!wanted.includes("en")) wanted.push("en");
for (const lang of wanted) {
  if (!available.includes(lang)) {
    console.error(
      `Langue inconnue: ${lang} (disponibles: ${available.join(", ")})`
    );
    process.exit(1);
  }
}

for (const lang of available) {
  if (!wanted.includes(lang)) {
    rmSync(join(localesDir, lang), { recursive: true, force: true });
  }
}
console.log(
  `[locales] gardees: ${wanted.join(", ")} (${available.length - wanted.length} supprimees)`
);

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const i18nPath = join(upstreamDir, "src", "js", "i18n", "i18n.ts");
const src = readFileSync(i18nPath, "utf8");

const arrMatch = src.match(
  /export const supportedLanguages = \[(.*?)\] as const;/s
);
if (!arrMatch) {
  console.error("Motif supportedLanguages introuvable dans src/js/i18n/i18n.ts");
  process.exit(1);
}

const namesMatch = src.match(
  /export const languageNames: Record<SupportedLanguage, string> = \{.*?\};/s
);
if (!namesMatch) {
  console.error("Motif languageNames introuvable dans src/js/i18n/i18n.ts");
  process.exit(1);
}

const names = {};
for (const lang of wanted) {
  const m = src.match(
    new RegExp(`^\\s*['"]?${esc(lang)}['"]?\\s*:\\s*('[^']*'|"[^"]*")`, "m")
  );
  if (!m) {
    console.error(`Nom de langue introuvable pour: ${lang}`);
    process.exit(1);
  }
  names[lang] = m[1];
}

let out = src.replace(
  arrMatch[0],
  "export const supportedLanguages = [\n" +
    wanted.map((l) => `  '${l}',`).join("\n") +
    "\n] as const;"
);
out = out.replace(
  namesMatch[0],
  "export const languageNames: Record<SupportedLanguage, string> = {\n" +
    wanted.map((l) => `  ${l.includes("-") ? `'${l}'` : l}: ${names[l]},`).join("\n") +
    "\n};"
);
writeFileSync(i18nPath, out);
console.log(`[i18n] supportedLanguages + languageNames restreints`);
