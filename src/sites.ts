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

// A site by number or by one of its domains (with or without www).
export async function resolveSite(spaicely: Spaicely, wanted: number | string | undefined): Promise<SiteEntry> {
  if (wanted === undefined || wanted === "") throw new CliError(t("no_site"), EXIT.usage);
  const { sites } = await whoami(spaicely);
  const text = String(wanted).trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "");
  const found = /^\d+$/.test(text)
    ? sites.find((site) => site.id === Number(text))
    : sites.find((site) => site.domains.some((domain) => domain.name.toLowerCase() === text));
  if (!found) throw new CliError(t("site_unknown", { site: String(wanted) }), EXIT.usage);
  return found;
}
