import { mkdirSync, mkdtempSync, realpathSync, writeFileSync } from "node:fs";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { notFoundPage, resolveRequest, serve } from "../src/serve.js";

const root = realpathSync(mkdtempSync(join(tmpdir(), "spaicely-serve-")));
mkdirSync(join(root, "blog"));
mkdirSync(join(root, "_spaicely"));
writeFileSync(join(root, "index.html"), '<html lang="nl"><h1>Home</h1>');
writeFileSync(join(root, "blog", "index.html"), "blog");
writeFileSync(join(root, "style.css"), "body{}");
writeFileSync(join(root, "_spaicely", "secret.html"), "no");

describe("resolveRequest", () => {
  it("serves files and folder indexes", () => {
    expect(resolveRequest(root, "/")).toBe(join(root, "index.html"));
    expect(resolveRequest(root, "/blog/")).toBe(join(root, "blog", "index.html"));
    expect(resolveRequest(root, "/style.css?v=2")).toBe(join(root, "style.css"));
  });

  it("refuses paths outside the folder and the reserved folder", () => {
    expect(resolveRequest(root, "/../etc/passwd")).toBeUndefined();
    expect(resolveRequest(root, "/%2e%2e/%2e%2e/etc/passwd")).toBeUndefined();
    expect(resolveRequest(root, "/_spaicely/secret.html")).toBeUndefined();
    expect(resolveRequest(root, "/missing.html")).toBeUndefined();
  });
});

describe("notFoundPage", () => {
  it("speaks the language of index.html when the site has no 404.html", () => {
    expect(notFoundPage(root)).toContain("Pagina niet gevonden");
  });
});

describe("serve", () => {
  let base = "";
  let close = () => {};
  beforeAll(async () => {
    const server = await serve(root, 0);
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    close = () => server.close();
  });
  afterAll(() => close());

  it("answers like the CDN", async () => {
    const home = await fetch(`${base}/`);
    expect(home.status).toBe(200);
    expect(home.headers.get("content-type")).toContain("text/html");

    const folder = await fetch(`${base}/blog`, { redirect: "manual" });
    expect(folder.status).toBe(301);
    expect(folder.headers.get("location")).toBe("/blog/");

    const missing = await fetch(`${base}/nope`);
    expect(missing.status).toBe(404);
    expect(await missing.text()).toContain('lang="nl"');

    expect((await fetch(`${base}/_spaicely/secret.html`)).status).toBe(404);
  });
});
