import { describe, expect, it } from "vitest";
import type { Spaicely } from "../src/client.js";
import { resolveSite } from "../src/sites.js";

function fake(answers: Record<string, unknown>): { spaicely: Spaicely; calls: string[] } {
  const calls: string[] = [];
  const spaicely = {
    call: async (name: string) => {
      calls.push(name);
      return { summary: "", data: answers[name] };
    },
  } as unknown as Spaicely;
  return { spaicely, calls };
}

describe("resolveSite", () => {
  it("finds a site by number with sites.versions only, so a CI key needs no account:read", async () => {
    const { spaicely, calls } = fake({ "sites.versions": { site_id: 14, name: "Bakkerij Jansen", live: 2, versions: [] } });
    const site = await resolveSite(spaicely, 14);
    expect(calls).toEqual(["sites.versions"]);
    expect(site).toMatchObject({ id: 14, name: "Bakkerij Jansen", live_version: 2 });
  });

  it("has no live version for a site that never went live", async () => {
    const { spaicely } = fake({ "sites.versions": { site_id: 3, live: null, versions: [] } });
    expect(await resolveSite(spaicely, "3")).toMatchObject({ id: 3, name: "#3", live_version: undefined });
  });

  it("finds a site by domain through account.whoami", async () => {
    const site = { id: 9, name: "Talent", status: "live", role: "admin", permissions: {}, domains: [{ name: "talentshare.nl", connection: "connected" }] };
    const { spaicely, calls } = fake({ "account.whoami": { sites: [site] } });
    expect(await resolveSite(spaicely, "https://www.talentshare.nl/")).toEqual(site);
    expect(calls).toEqual(["account.whoami"]);
  });
});
