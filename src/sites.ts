import type { Spaicely } from "./client.js";
import { CliError, EXIT } from "./errors.js";
import { t } from "./i18n.js";

export interface SiteEntry {
  id: number;
  name: string;
  status: string;
  role: string;
  permissions: Record<string, boolean>;
  live_version?: number;
  domains: { name: string; connection: string }[];
}

export interface Whoami {
  user: { name: string; email: string; locale?: string };
  account: { id: number; name: string; kind: string; role: string };
  client: string;
  scopes: string[];
  sites: SiteEntry[];
}

export async function whoami(spaicely: Spaicely): Promise<Whoami> {
  return (await spaicely.call<Whoami>("account.whoami")).data;
}

interface VersionsData {
  site_id: number;
  name?: string;
  live?: number | null;
}

// A site by number or by one of its domains (with or without www). A number
// only needs sites.versions, so a CI key without account:read can deploy.
export async function resolveSite(spaicely: Spaicely, wanted: number | string | undefined): Promise<SiteEntry> {
  if (wanted === undefined || wanted === "") throw new CliError(t("no_site"), EXIT.usage);
  const text = String(wanted).trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "");
  if (/^\d+$/.test(text)) return siteByNumber(spaicely, Number(text));
  const { sites } = await whoami(spaicely);
  const found = sites.find((site) => site.domains.some((domain) => domain.name.toLowerCase() === text));
  if (!found) throw new CliError(t("site_unknown", { site: String(wanted) }), EXIT.usage);
  return found;
}

async function siteByNumber(spaicely: Spaicely, id: number): Promise<SiteEntry> {
  const { data } = await spaicely.call<VersionsData>("sites.versions", { site_id: id });
  return { id, name: data.name ?? `#${id}`, status: "", role: "", permissions: {}, live_version: data.live ?? undefined, domains: [] };
}
