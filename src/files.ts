import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

export interface LocalFile {
  path: string;
  absolute: string;
  size: number;
  sha256: string;
}

// Never uploaded, whatever spaicely.toml says.
export const ALWAYS_IGNORED = [".git/**", "node_modules/**", "spaicely.toml", ".DS_Store", "Thumbs.db", ".spaicely/**"];

// Glob as in .gitignore, simplified: `*` stays within a folder, `**` crosses
// folders, and a pattern without a slash matches a name at any depth.
export function globToRegExp(pattern: string): RegExp {
  const anchored = pattern.includes("/") && !pattern.startsWith("**/");
  let source = "";
  for (let i = 0; i < pattern.length; i++) {
    const char = pattern[i];
    if (char === "*" && pattern[i + 1] === "*") {
      if (pattern[i + 2] === "/") {
        source += "(?:.*/)?";
        i += 2;
      } else {
        source += ".*";
        i += 1;
      }
    } else if (char === "*") {
      source += "[^/]*";
    } else if (char === "?") {
      source += "[^/]";
    } else {
      source += char.replace(/[.+^${}()|[\]\\]/g, "\\$&");
    }
  }
  const prefix = anchored ? "^" : "^(?:.*/)?";
  return new RegExp(`${prefix}${source.replace(/^\//, "")}$`);
}

export function ignorer(patterns: string[]): (path: string) => boolean {
  const expressions = [...ALWAYS_IGNORED, ...patterns].map(globToRegExp);
  return (path) => expressions.some((expression) => expression.test(path));
}

export function collectFiles(root: string, patterns: string[] = []): LocalFile[] {
  const ignored = ignorer(patterns);
  const files: LocalFile[] = [];

  const walk = (folder: string) => {
    for (const entry of readdirSync(folder, { withFileTypes: true })) {
      const absolute = join(folder, entry.name);
      const path = relative(root, absolute).split(sep).join("/");
      if (entry.name === ".git" || entry.name === "node_modules") continue;
      const stats = statSync(absolute, { throwIfNoEntry: false });
      if (!stats) continue;
      if (stats.isDirectory()) {
        walk(absolute);
      } else if (stats.isFile() && !ignored(path)) {
        const content = readFileSync(absolute);
        files.push({ path, absolute, size: stats.size, sha256: createHash("sha256").update(content).digest("hex") });
      }
    }
  };
  walk(root);
  return files.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
}

export interface RemoteFile {
  path: string;
  sha256: string;
  size: number;
}

export interface Changes {
  added: string[];
  changed: string[];
  removed: string[];
  same: number;
}

export function compare(local: LocalFile[], live: RemoteFile[]): Changes {
  const remote = new Map(live.map((file) => [file.path, file.sha256]));
  const changes: Changes = { added: [], changed: [], removed: [], same: 0 };
  for (const file of local) {
    const sha = remote.get(file.path);
    if (sha === undefined) changes.added.push(file.path);
    else if (sha !== file.sha256) changes.changed.push(file.path);
    else changes.same += 1;
    remote.delete(file.path);
  }
  changes.removed = [...remote.keys()].sort();
  return changes;
}

export function humanSize(bytes: number): string {
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${unit === 0 ? value : value.toFixed(1)} ${units[unit]}`;
}
