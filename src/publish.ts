import type { Spaicely } from "./client.js";
import { t } from "./i18n.js";
import { say } from "./output.js";

export interface Version {
  number: number;
  status: string;
  files: number;
  bytes: number;
  created_at: string;
  published_at?: string;
  created_by?: string;
  client?: string;
  based_on?: number;
  error?: string;
}

export async function versions(spaicely: Spaicely, siteId: number) {
  return (await spaicely.call<{ live?: number; versions: Version[] }>("sites.versions", { site_id: siteId })).data;
}

// Publishing runs on the server and takes up to half a minute; wait until
// sites.versions shows the version live, so a script knows it is done.
export async function publish(
  spaicely: Spaicely,
  siteId: number,
  target: { deployment?: number; rollback?: boolean },
  timeoutSeconds = 90,
): Promise<{ version: Version; live: boolean }> {
  const { data } = await spaicely.call<Version>("sites.publish", { site_id: siteId, ...target });
  say(t("publishing", { number: data.number }));

  const deadline = Date.now() + timeoutSeconds * 1000;
  let version = data;
  while (version.status !== "live" && version.status !== "failed" && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    const listed = await versions(spaicely, siteId);
    version = listed.versions.find((entry) => entry.number === data.number) ?? version;
  }
  return { version, live: version.status === "live" };
}
