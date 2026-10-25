import { createReadStream, existsSync, readFileSync, statSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { extname, join, normalize, sep } from "node:path";

const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".htm": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
  ".pdf": "application/pdf",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mp3": "audio/mpeg",
  ".webmanifest": "application/manifest+json",
};

// Our folder for versions on the CDN; never reachable from outside.
const RESERVED = "_spaicely";

// The file a request path maps to, the way the CDN serves a version: a
// folder answers with its index.html; anything outside the folder or under
// _spaicely/ does not exist.
export function resolveRequest(root: string, urlPath: string): string | undefined {
  let decoded: string;
  try {
    decoded = decodeURIComponent(urlPath.split("?")[0].split("#")[0]);
  } catch {
    return undefined;
  }
  if (decoded.includes("\0")) return undefined;
  const relative = normalize(decoded).replace(/^[/\\]+/, "");
  if (relative.split(/[/\\]/)[0] === RESERVED || relative.startsWith("..")) return undefined;

  const candidate = join(root, relative);
  if (candidate !== root && !candidate.startsWith(root + sep)) return undefined;

  const stats = statSync(candidate, { throwIfNoEntry: false });
  if (stats?.isFile()) return candidate;
  if (stats?.isDirectory()) {
    const index = join(candidate, "index.html");
    if (existsSync(index)) return index;
  }
  return undefined;
}

// Same rule as the server (Hosting::NotFoundPage): the site's own 404.html,
// else a plain page in the language of index.html.
export function notFoundPage(root: string): string {
  const own = join(root, "404.html");
  if (existsSync(own)) return readFileSync(own, "utf8");

  const index = join(root, "index.html");
  const lang = existsSync(index) ? /<html[^>]*\blang=["']?([a-z]{2})/i.exec(readFileSync(index, "utf8"))?.[1]?.toLowerCase() : undefined;
  const texts: Record<string, [string, string]> = {
    nl: ["Pagina niet gevonden", "Deze pagina bestaat niet (meer)."],
    de: ["Seite nicht gefunden", "Diese Seite gibt es nicht (mehr)."],
    fr: ["Page introuvable", "Cette page n'existe pas (ou plus)."],
    en: ["Page not found", "This page does not exist (any more)."],
  };
  const [title, text] = texts[lang ?? "en"] ?? texts.en;
  return `<!doctype html><html lang="${lang ?? "en"}"><meta charset="utf-8"><meta name="viewport" content="width=device-width">
<title>${title}</title><body style="font:18px system-ui;max-width:32rem;margin:15vh auto;padding:0 1rem;color:#1E2A78">
<h1>${title}</h1><p>${text}</p><p><a href="/">/</a></p></body></html>`;
}

export function serve(root: string, port: number, host = "127.0.0.1"): Promise<Server> {
  const server = createServer((request, response) => {
    if (request.method !== "GET" && request.method !== "HEAD") {
      response.writeHead(405, { allow: "GET, HEAD" }).end();
      return;
    }
    const url = request.url ?? "/";
    const file = resolveRequest(root, url);
    const headers = { "cache-control": "no-store", "x-content-type-options": "nosniff" };

    // A folder without its slash goes on to the slash, so relative links
    // in its index.html resolve as they will live.
    if (file && file.endsWith(`${sep}index.html`) && !url.split("?")[0].endsWith("/") && !url.split("?")[0].endsWith("index.html")) {
      const [path, query] = url.split("?");
      response.writeHead(301, { ...headers, location: `${path}/${query ? `?${query}` : ""}` }).end();
      return;
    }
    if (!file) {
      response.writeHead(404, { ...headers, "content-type": TYPES[".html"] });
      response.end(request.method === "HEAD" ? undefined : notFoundPage(root));
      return;
    }
    response.writeHead(200, {
      ...headers,
      "content-type": TYPES[extname(file).toLowerCase()] ?? "application/octet-stream",
      "content-length": statSync(file).size,
    });
    if (request.method === "HEAD") response.end();
    else createReadStream(file).pipe(response);
  });

  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, () => resolve(server));
  });
}
