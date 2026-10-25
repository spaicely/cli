import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { collectFiles, compare, globToRegExp, ignorer } from "../src/files.js";

describe("globToRegExp", () => {
  it("keeps * within a folder and lets ** cross folders", () => {
    expect(globToRegExp("drafts/*").test("drafts/a.html")).toBe(true);
    expect(globToRegExp("drafts/*").test("drafts/x/a.html")).toBe(false);
    expect(globToRegExp("drafts/**").test("drafts/x/a.html")).toBe(true);
    expect(globToRegExp("drafts/**").test("blog/drafts/a.html")).toBe(false);
  });

  it("matches a pattern without a slash at any depth", () => {
    expect(globToRegExp("*.map").test("app.js.map")).toBe(true);
    expect(globToRegExp("*.map").test("assets/js/app.js.map")).toBe(true);
    expect(globToRegExp("**/secret.txt").test("a/b/secret.txt")).toBe(true);
  });

  it("treats dots literally", () => {
    expect(globToRegExp("a.b").test("axb")).toBe(false);
  });
});

describe("collectFiles", () => {
  it("lists files with hashes and skips what is ignored", () => {
    const root = mkdtempSync(join(tmpdir(), "spaicely-"));
    mkdirSync(join(root, "blog"));
    mkdirSync(join(root, ".git"));
    writeFileSync(join(root, "index.html"), "<h1>Hoi</h1>");
    writeFileSync(join(root, "blog", "post.html"), "post");
    writeFileSync(join(root, "app.js.map"), "{}");
    writeFileSync(join(root, ".git", "HEAD"), "ref");
    writeFileSync(join(root, "spaicely.toml"), "dir = '.'");

    const files = collectFiles(root, ["*.map"]);
    expect(files.map((file) => file.path)).toEqual(["blog/post.html", "index.html"]);
    expect(files[1].sha256).toBe(createHash("sha256").update("<h1>Hoi</h1>").digest("hex"));
    expect(files[1].size).toBe(12);
  });
});

describe("compare", () => {
  it("sorts files into added, changed, removed and the same", () => {
    const local = [
      { path: "index.html", absolute: "", size: 1, sha256: "a" },
      { path: "new.html", absolute: "", size: 1, sha256: "b" },
      { path: "same.css", absolute: "", size: 1, sha256: "c" },
    ];
    const live = [
      { path: "index.html", size: 1, sha256: "x" },
      { path: "old.html", size: 1, sha256: "y" },
      { path: "same.css", size: 1, sha256: "c" },
    ];
    expect(compare(local, live)).toEqual({ added: ["new.html"], changed: ["index.html"], removed: ["old.html"], same: 1 });
  });
});

describe("ignorer", () => {
  it("always skips the config file and system clutter", () => {
    const ignored = ignorer([]);
    expect(ignored("spaicely.toml")).toBe(true);
    expect(ignored("img/.DS_Store")).toBe(true);
    expect(ignored("index.html")).toBe(false);
  });
});
