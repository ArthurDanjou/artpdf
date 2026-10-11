// BentoPDF edge worker: clean-URL fallback + security headers.
//
// Deploye avec Workers Static Assets (binding ASSETS). La edge sert les
// fichiers exacts sans invoquer ce worker. Il ne voit que les requetes
// sans match : il resout les URLs propres (/merge-pdf -> /merge-pdf.html,
// /fr/ -> /fr/index.html) et sert 404.html sinon.
//
// Le placeholder __APP_CSP__ est remplace au moment du deploy par la CSP
// generee par le build upstream (security-headers.conf). Voir
// scripts/prepare-cloudflare.mjs.

const CSP = "__APP_CSP__";

const SECURITY_HEADERS = {
  "X-Frame-Options": "SAMEORIGIN",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy":
    "geolocation=(), camera=(), microphone=(), payment=(), usb=(), interest-cohort=()",
  // Requis pour SharedArrayBuffer (conversion LibreOffice WASM).
  // credentialless = meme choix que le nginx.conf upstream.
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Embedder-Policy": "credentialless",
  "Cross-Origin-Resource-Policy": "cross-origin",
};

function withHeaders(response) {
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    headers.set(name, value);
  }
  if (
    typeof CSP === "string" &&
    CSP.length > 0 &&
    !CSP.startsWith("__APP_CSP__") &&
    !headers.has("Content-Security-Policy")
  ) {
    headers.set("Content-Security-Policy", CSP);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function hasFileExtension(pathname) {
  const last = pathname.split("/").pop() || "";
  return last.includes(".");
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method !== "GET" && request.method !== "HEAD") {
      return withHeaders(await env.ASSETS.fetch(request));
    }

    if (!hasFileExtension(url.pathname)) {
      const clean = url.pathname.endsWith("/")
        ? url.pathname.slice(0, -1)
        : url.pathname;
      const candidates =
        clean === "" ? ["/index.html"] : [`${clean}.html`, `${clean}/index.html`];
      for (const candidate of candidates) {
        const candidateResponse = await env.ASSETS.fetch(
          new Request(new URL(candidate + url.search, url), request),
        );
        if (candidateResponse.status !== 404) {
          return withHeaders(candidateResponse);
        }
      }
    }

    const notFound = await env.ASSETS.fetch(
      new Request(new URL("/404.html", url), request),
    );
    if (notFound.status !== 404) {
      return withHeaders(
        new Response(notFound.body, { status: 404, headers: notFound.headers }),
      );
    }
    // Securite si le worker est invoque sur un fichier existant
    // (ex. run_worker_first actif) : sert le fichier tel quel.
    const exact = await env.ASSETS.fetch(request);
    return withHeaders(exact);
  },
};
