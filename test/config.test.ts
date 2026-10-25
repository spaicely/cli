import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { detectGenerator, loadConfig, writeConfig } from "../src/config.js";
import { VERSION } from "../src/version.js";

describe("detectGenerator", () => {
  it("recognises Jekyll with a Gemfile", () => {
    const root = mkdtempSync(join(tmpdir(), "spaicely-jekyll-"));
    writeFileSync(join(root, "_config.yml"), "title: x");
    writeFileSync(join(root, "Gemfile"), "");
    expect(detectGenerator(root)).toEqual({ name: "Jekyll", dir: "_site", build: "bundle exec jekyll build" });
  });

  it("falls back to the folder itself", () => {
    expect(detectGenerator(mkdtempSync(join(tmpdir(), "spaicely-plain-")))).toEqual({ name: "static", dir: "." });
  });
});

describe("spaicely.toml", () => {
  it("round-trips what init writes", () => {
    const root = mkdtempSync(join(tmpdir(), "spaicely-toml-"));
    writeConfig(root, { site: 12, dir: "_site", build: "jekyll build" });
    expect(loadConfig(root)).toMatchObject({ site: 12, dir: "_site", build: "jekyll build", ignore: [], root });
    expect(() => writeConfig(root, { dir: "." })).toThrow();
  });
});

describe("version", () => {
  it("matches package.json", () => {
    expect(VERSION).toBe(JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version);
  });
});
