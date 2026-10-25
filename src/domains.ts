import { serverUrl } from "./auth.js";
import type { Spaicely } from "./client.js";
import { CliError, EXIT } from "./errors.js";
import { t, type MessageKey } from "./i18n.js";
import { say } from "./output.js";
import { VERSION } from "./version.js";

export interface SearchResult {
  domain: string;
  extension: string;
  status: "available" | "likely_available" | "taken" | "unknown" | "invalid" | "unsupported";
  reason?: string;
  checked_via?: string;
  register_url?: string;
  transfer_url?: string;
}

export interface FoundRecord {
  index: number;
  host: string;
  type: string;
  value: string;
  keep: boolean;
  reason?: string;
}

export interface DnsRecord {
  id: number;
  type: string;
  name: string;
  value: string;
  ttl?: number;
  priority?: number;
  weight?: number;
  port?: number;
  flags?: number;
  tag?: string;
  pull_zone_id?: number;
}

export interface Connection {
  domain: string;
  site_id: number;
  status: "scanning" | "confirming" | "waiting_for_nameservers" | "securing" | "connected" | "detached";
  problem?: "dnssec" | "scan_failed" | string;
  nameservers: string[];
  nameservers_checked_at?: string;
  records_to_confirm?: FoundRecord[];
  address?: string;
  dkim_mail?: { to: string; subject: string };
  current_nameservers?: string[];
  records?: DnsRecord[];
  failed_records?: unknown[];
}

// The search is public: no sign-in, the same HTTP API spaicely.com uses.
export function appUrl(): string {
  if (process.env.SPAICELY_APP_URL) return process.env.SPAICELY_APP_URL.replace(/\/$/, "");
  const mcp = new URL(serverUrl());
  return mcp.host === "mcp.spaicely.com" ? "https://app.spaicely.com" : mcp.origin;
}

export async function search(names: string[], options: { extensions?: string; verify?: boolean }): Promise<SearchResult[]> {
  const url = new URL(`${appUrl()}/api/domains/search`);
  url.searchParams.set("names", names.join(","));
  if (options.extensions) url.searchParams.set("extensions", options.extensions);
  if (options.verify) url.searchParams.set("deep", "true");
  const response = await fetch(url, { headers: { accept: "application/json", "user-agent": `spaicely-cli/${VERSION}` } });
  const body = (await response.json().catch(() => ({}))) as { results?: SearchResult[]; error?: string; message?: string };
  if (!response.ok) throw new CliError(body.error ?? body.message ?? `HTTP ${response.status}`, EXIT.failure, body);
  return body.results ?? [];
}

const STATUSES = ["available", "likely_available", "taken", "unknown", "invalid", "unsupported"];

export function statusLabel(status: string): string {
  return STATUSES.includes(status) ? t(`domain_${status}` as MessageKey) : status;
}

export function searchLines(results: SearchResult[]): string {
  const width = Math.max(0, ...results.map((result) => result.domain.length));
  return results.map((result) => `${result.domain.padEnd(width)}  ${statusLabel(result.status)}`).join("\n");
}

// Asks again while Spaicely reads the records the domain has now; that
// takes about half a minute.
export async function connect(
  spaicely: Spaicely,
  args: { site_id: number; domain: string; confirm?: boolean; skip?: number[] },
  wait = { tries: 12, delay: 10_000 },
): Promise<Connection> {
  let { data } = await spaicely.call<Connection>("sites.domains.connect", args);
  for (let tries = 0; data.status === "scanning" && tries < wait.tries; tries += 1) {
    if (tries === 0) say(t("connect_scanning", { domain: data.domain }));
    await new Promise((done) => setTimeout(done, wait.delay));
    ({ data } = await spaicely.call<Connection>("sites.domains.connect", { site_id: args.site_id, domain: args.domain }));
  }
  return data;
}

export function foundRecordLines(records: FoundRecord[]): string {
  const host = Math.max(0, ...records.map((record) => record.host.length));
  return records
    .map((record) => {
      const mark = record.keep ? t("record_keep") : t(record.reason === "certificate" ? "record_certificate" : "record_site");
      return `${String(record.index).padStart(3)}  ${mark.padEnd(12)} ${record.type.padEnd(6)} ${record.host.padEnd(host)}  ${record.value}`;
    })
    .join("\n");
}

export function connectionText(connection: Connection): string {
  const values = {
    domain: connection.domain,
    nameservers: connection.nameservers.join(" "),
    address: connection.address ?? `https://${connection.domain}`,
  };
  const texts = [t(`connection_${connection.status}` as MessageKey, values)];
  if (connection.problem === "dnssec" || connection.problem === "scan_failed") texts.push(t(`problem_${connection.problem}`, values));
  if (connection.dkim_mail) texts.push(t("dkim_mail", { ...values, to: connection.dkim_mail.to, subject: connection.dkim_mail.subject }));
  if (connection.current_nameservers?.length) texts.push(t("current_nameservers", { nameservers: connection.current_nameservers.join(" ") }));
  return texts.join("\n\n");
}

export function dnsLines(records: DnsRecord[]): string {
  const name = Math.max(1, ...records.map((record) => (record.name || "@").length));
  return records
    .map((record) => {
      const value = record.type === "PullZone" ? t("record_site_value") : record.value;
      // Bunny gives every record a priority, weight and port; only these use them.
      const extra = record.type === "MX" ? String(record.priority ?? "") : record.type === "SRV" ? `${record.priority} ${record.weight} ${record.port}` : "";
      return `${String(record.id).padStart(9)}  ${record.type.padEnd(8)} ${(record.name || "@").padEnd(name)}  ${extra ? `${extra} ` : ""}${value}${record.ttl ? `  (ttl ${record.ttl})` : ""}`;
    })
    .join("\n");
}

const RECORD_TYPES = ["A", "AAAA", "CNAME", "TXT", "MX", "SRV", "CAA"];

export function newRecord(
  type: string,
  name: string,
  value: string,
  options: { ttl?: string; priority?: string; weight?: string; port?: string; flags?: string; tag?: string },
): Record<string, unknown> {
  const upper = type.toUpperCase();
  if (!RECORD_TYPES.includes(upper)) throw new CliError(t("record_type", { types: RECORD_TYPES.join(", ") }), EXIT.usage);
  const record: Record<string, unknown> = { type: upper, name: name === "@" ? "" : name, value };
  for (const field of ["ttl", "priority", "weight", "port", "flags"] as const) {
    const given = options[field];
    if (given === undefined) continue;
    if (!/^\d+$/.test(given)) throw new CliError(`--${field}: ${given}`, EXIT.usage);
    record[field] = Number(given);
  }
  if (options.tag) record.tag = options.tag;
  return record;
}
