import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { parse, stringify } from "smol-toml";
import { CliError, EXIT } from "./errors.js";
import { t } from "./i18n.js";

export const CONFIG_FILE = "spaicely.toml";

// spaicely.toml: which site, which folder goes up, how it is built.
export interface Config {
  site?: number | string;
  dir: string;
  build?: string;
  ignore: string[];
  // Where spaicely.toml lives; dir and build are relative to it.
  root: string;
}

export function findConfig(start = process.cwd()): string | undefined {
  let current = resolve(start);
  for (;;) {
    const candidate = join(current, CONFIG_FILE);
    if (existsSync(candidate)) return candidate;
    const parent = dirname(current);
    if (parent === current) return undefined;
    current = parent;
  }
}

export function loadConfig(start = process.cwd()): Config {
  const file = findConfig(start);
  if (!file) return { dir: ".", ignore: [], root: resolve(start) };

  const raw = parse(readFileSync(file, "utf8")) as Record<string, unknown>;
  const site = raw.site;
  if (site !== undefined && typeof site !== "number" && typeof site !== "string") {
    throw new CliError(`${CONFIG_FILE}: site`, EXIT.usage);
  }
  return {
    site,
    dir: typeof raw.dir === "string" ? raw.dir : ".",
    build: typeof raw.build === "string" && raw.build.trim() ? raw.build : undefined,
    ignore: Array.isArray(raw.ignore) ? raw.ignore.map(String) : [],
    root: dirname(file),
  };
}

export interface Generator {
  name: string;
  dir: string;
  build?: string;
}

// Recognises the common site generators by the files they leave in a
// project, so `spaicely init` can fill in dir and build.
export function detectGenerator(root: string): Generator {
  const has = (...names: string[]) => names.some((name) => existsSync(join(root, name)));

  if (has("_config.yml", "_config.yaml", "_config.toml")) {
    return { name: "Jekyll", dir: "_site", build: has("Gemfile") ? "bundle exec jekyll build" : "jekyll build" };
  }
  if (has("hugo.toml", "hugo.yaml", "hugo.json") || (has("config.toml") && has("content", "archetypes"))) {
    return { name: "Hugo", dir: "public", build: "hugo --minify" };
  }
  if (has(".eleventy.js", "eleventy.config.js", "eleventy.config.mjs", "eleventy.config.cjs")) {
    return { name: "Eleventy", dir: "_site", build: "npx @11ty/eleventy" };
  }
  if (has("astro.config.mjs", "astro.config.ts", "astro.config.js")) {
    return { name: "Astro", dir: "dist", build: "npm run build" };
  }
  if (has("vite.config.js", "vite.config.ts", "vite.config.mjs")) {
    return { name: "Vite", dir: "dist", build: "npm run build" };
  }
  return { name: "static", dir: "." };
}

export function writeConfig(root: string, values: { site?: number | string; dir: string; build?: string }): string {
  const file = join(root, CONFIG_FILE);
  if (existsSync(file)) throw new CliError(t("init_exists"), EXIT.usage);

  const body: Record<string, unknown> = {};
  if (values.site !== undefined) body.site = values.site;
  body.dir = values.dir;
  if (values.build) body.build = values.build;
  body.ignore = [];
  writeFileSync(file, `${stringify(body)}\n`);
  return file;
}
