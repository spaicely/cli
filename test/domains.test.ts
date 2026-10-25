import { afterEach, describe, expect, it } from "vitest";
import type { Spaicely } from "../src/client.js";
import { appUrl, connect, connectionText, dnsLines, foundRecordLines, newRecord, type Connection } from "../src/domains.js";
import { setLocale } from "../src/i18n.js";
import { setJson } from "../src/output.js";

function fakeSpaicely(answers: Partial<Connection>[]) {
  const calls: Record<string, unknown>[] = [];
  const spaicely = {
    async call(_name: string, args: Record<string, unknown>) {
      calls.push(args);
      return { summary: "", data: { domain: "example.nl", site_id: 2, nameservers: ["kiki.bunny.net", "coco.bunny.net"], ...answers.shift() } };
    },
  } as unknown as Spaicely;
  return { spaicely, calls };
}

describe("domains", () => {
  afterEach(() => {
    delete process.env.SPAICELY_MCP_URL;
    delete process.env.SPAICELY_APP_URL;
    setLocale("en");
  });

  it("searches on the app next to the MCP server", () => {
    expect(appUrl()).toBe("https://app.spaicely.com");
    process.env.SPAICELY_MCP_URL = "http://localhost:3000/mcp";
    expect(appUrl()).toBe("http://localhost:3000");
    process.env.SPAICELY_APP_URL = "https://staging.example.test/";
    expect(appUrl()).toBe("https://staging.example.test");
  });

  it("asks again while the records are being read", async () => {
    setJson(true);
    const { spaicely, calls } = fakeSpaicely([{ status: "scanning" }, { status: "scanning" }, { status: "confirming", records_to_confirm: [] }]);
    const connection = await connect(spaicely, { site_id: 2, domain: "example.nl" }, { tries: 5, delay: 1 });
    expect(connection.status).toBe("confirming");
    expect(calls).toHaveLength(3);
    expect(calls[2]).toEqual({ site_id: 2, domain: "example.nl" });
    setJson(false);
  });

  it("stops asking after a while", async () => {
    setJson(true);
    const { spaicely, calls } = fakeSpaicely(Array.from({ length: 10 }, () => ({ status: "scanning" as const })));
    const connection = await connect(spaicely, { site_id: 2, domain: "example.nl" }, { tries: 2, delay: 1 });
    expect(connection.status).toBe("scanning");
    expect(calls).toHaveLength(3);
    setJson(false);
  });

  it("shows which found records come along", () => {
    const lines = foundRecordLines([
      { index: 0, host: "example.nl", type: "A", value: "1.2.3.4", keep: false, reason: "site" },
      { index: 1, host: "example.nl", type: "MX", value: "mail.example.net", keep: true },
    ]);
    expect(lines).toContain("becomes site");
    expect(lines.split("\n")[1]).toMatch(/^\s+1\s+keep\s+MX/);
  });

  it("tells what to do next, with the nameservers", () => {
    setLocale("nl");
    const text = connectionText({
      domain: "example.nl", site_id: 2, status: "waiting_for_nameservers", problem: "dnssec",
      nameservers: ["kiki.bunny.net", "coco.bunny.net"],
    });
    expect(text).toContain("kiki.bunny.net coco.bunny.net");
    expect(text).toContain("DNSSEC");
  });

  it("lists records with @ for the domain itself", () => {
    const lines = dnsLines([
      { id: 11, type: "PullZone", name: "", value: "", pull_zone_id: 5 },
      { id: 12, type: "MX", name: "", value: "mail.example.net", priority: 10, ttl: 300 },
    ]);
    expect(lines).toMatch(/11\s+PullZone\s+@\s+\(the site\)/);
    expect(lines).toMatch(/12\s+MX\s+@\s+10 mail.example.net\s+\(ttl 300\)/);
  });

  it("builds a record from the command line", () => {
    expect(newRecord("mx", "@", "mail.example.net", { priority: "10" })).toEqual({ type: "MX", name: "", value: "mail.example.net", priority: 10 });
    expect(() => newRecord("NS", "x", "y", {})).toThrow();
    expect(() => newRecord("A", "x", "1.2.3.4", { ttl: "soon" })).toThrow();
  });
});
