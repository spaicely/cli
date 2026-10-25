import { spawn } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { create } from "tar";
import type { Spaicely } from "./client.js";
import type { Config } from "./config.js";
import { CliError, EXIT } from "./errors.js";
import { collectFiles, compare, humanSize, type Changes, type LocalFile, type RemoteFile } from "./files.js";
import { t } from "./i18n.js";
import { say } from "./output.js";
import type { SiteEntry } from "./sites.js";
import type { Version } from "./publish.js";

export async function build(config: Config): Promise<void> {
  if (!config.build) return;
  say(t("building", { command: config.build }));
  const code = await new Promise<number>((done, fail) => {
    const child = spawn(config.build!, { cwd: config.root, shell: true, stdio: ["ignore", "inherit", "inherit"] });
    child.on("error", fail);
    child.on("exit", (exit) => done(exit ?? 1));
  });
  if (code !== 0) throw new CliError(t("build_failed", { code }));
}

export function siteFolder(config: Config): string {
  const folder = resolve(config.root, config.dir);
  if (!existsSync(folder) || !statSync(folder).isDirectory()) throw new CliError(t("dir_missing", { dir: config.dir }), EXIT.usage);
  if (!existsSync(join(folder, "index.html"))) throw new CliError(t("no_index", { dir: config.dir }), EXIT.usage);
  return folder;
}

export async function liveFiles(spaicely: Spaicely, site: SiteEntry): Promise<RemoteFile[]> {
  if (!site.live_version) return [];
  const { data } = await spaicely.call<{ files: RemoteFile[] }>("sites.files.list", { site_id: site.id });
  return data.files;
}

export interface Plan {
  folder: string;
  files: LocalFile[];
  changes: Changes;
}

export async function plan(spaicely: Spaicely, config: Config, site: SiteEntry): Promise<Plan> {
  const folder = siteFolder(config);
  const files = collectFiles(folder, config.ignore);
  const changes = compare(files, await liveFiles(spaicely, site));
  return { folder, files, changes };
}

export function hasChanges(changes: Changes): boolean {
  return changes.added.length + changes.changed.length + changes.removed.length > 0;
}

// The whole site as one tar.gz to a one-time address (sites.upload_url);
// the server keeps every file by its SHA-256, so unchanged files cost
// nothing there.
export async function upload(spaicely: Spaicely, site: SiteEntry, { folder, files }: Plan): Promise<Version> {
  const bytes = files.reduce((sum, file) => sum + file.size, 0);
  say(t("uploading", { files: files.length, size: humanSize(bytes) }));

  const archive = await pack(folder, files.map((file) => file.path));
  const { data } = await spaicely.call<{ url: string }>("sites.upload_url", { site_id: site.id });
  const response = await fetch(data.url, {
    method: "PUT",
    headers: { "content-type": "application/gzip" },
    body: new Uint8Array(archive),
  });
  const answer = (await response.json().catch(() => ({}))) as { message?: string; error?: string; deployment?: Version; problems?: unknown };
  if (!response.ok || !answer.deployment) {
    throw new CliError(answer.message || answer.error || `HTTP ${response.status}`, EXIT.failure, answer.problems);
  }
  return answer.deployment;
}

async function pack(folder: string, paths: string[]): Promise<Buffer> {
  const chunks: Buffer[] = [];
  const stream = create({ gzip: true, cwd: folder, portable: true, noDirRecurse: true }, paths);
  for await (const chunk of stream) chunks.push(Buffer.from(chunk as Uint8Array));
  return Buffer.concat(chunks);
}
