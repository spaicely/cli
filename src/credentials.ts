import { chmodSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { OAuthClientInformationMixed, OAuthTokens } from "@modelcontextprotocol/sdk/shared/auth.js";

// What `spaicely login` keeps between runs: the client registration of this
// machine, the tokens, and who they belong to. One file, readable by the
// owner only.
export interface Credentials {
  server: string;
  client?: OAuthClientInformationMixed;
  tokens?: OAuthTokens;
  user?: { name: string; email: string; locale?: string };
  account?: { id: number; name: string };
}

export function configDir(env = process.env): string {
  if (env.SPAICELY_CONFIG_DIR) return env.SPAICELY_CONFIG_DIR;
  if (process.platform === "win32" && env.APPDATA) return join(env.APPDATA, "spaicely");
  return join(env.XDG_CONFIG_HOME || join(homedir(), ".config"), "spaicely");
}

function path(): string {
  return join(configDir(), "credentials.json");
}

export function readCredentials(server: string): Credentials {
  try {
    const stored = JSON.parse(readFileSync(path(), "utf8")) as Credentials;
    // Tokens of another server (a development setup) are no use here.
    if (stored.server === server) return stored;
  } catch {
    // No file yet, or one we cannot read: start over.
  }
  return { server };
}

export function writeCredentials(credentials: Credentials): void {
  mkdirSync(configDir(), { recursive: true, mode: 0o700 });
  writeFileSync(path(), JSON.stringify(credentials, null, 2), { mode: 0o600 });
  chmodSync(path(), 0o600);
}

export function forgetCredentials(): void {
  if (existsSync(path())) rmSync(path());
}
