#!/usr/bin/env node
import { resolve } from "node:path";
import { Command, Option } from "commander";
import { login, logout, openInBrowser, serverUrl } from "./auth.js";
import { Spaicely, withSpaicely } from "./client.js";
import { detectGenerator, loadConfig, writeConfig, type Config } from "./config.js";
import { readCredentials } from "./credentials.js";
import { build, hasChanges, plan, upload } from "./deploy.js";
import { connect, connectionText, dnsLines, foundRecordLines, newRecord, search, searchLines, type Connection, type DnsRecord } from "./domains.js";
import { CliError, EXIT } from "./errors.js";
import { humanSize } from "./files.js";
import { setLocale, t } from "./i18n.js";
import { confirm, jsonMode, result, say, setJson } from "./output.js";
import { publish, versions } from "./publish.js";
import { serve } from "./serve.js";
import { resolveSite, whoami, type SiteEntry } from "./sites.js";
import { VERSION } from "./version.js";

setLocale(readCredentials(serverUrl()).user?.locale);

const program = new Command("spaicely")
  .description("Preview, deploy and manage sites hosted on Spaicely. https://spaicely.com/developers/")
  .version(VERSION)
  .option("--json", "machine-readable output on stdout")
  .hook("preAction", (command) => setJson(Boolean(command.opts().json)));

const siteOption = () => new Option("-s, --site <site>", "site number or domain (default: site in spaicely.toml)");

function siteFrom(options: { site?: string }, config: Config): number | string | undefined {
  return options.site ?? config.site;
}

program
  .command("login")
  .description("sign in through the browser")
  .option("--no-browser", "print the address instead of opening the browser")
  .action(async (options: { browser: boolean }) => {
    const authProvider = await login({ openBrowser: options.browser });
    const spaicely = await Spaicely.connect(authProvider);
    try {
      const me = await whoami(spaicely);
      authProvider.remember({ user: me.user, account: { id: me.account.id, name: me.account.name } });
      setLocale(me.user.locale);
      result(t("login_done", { name: me.user.name, account: me.account.name }), { user: me.user, account: me.account });
    } finally {
      await spaicely.close();
    }
  });

program
  .command("logout")
  .description("forget the sign-in on this machine")
  .action(async () => {
    await logout();
    result(t("logout_done"), { ok: true });
  });

program
  .command("whoami")
  .description("who you are signed in as, and your sites")
  .action(() =>
    withSpaicely(async (spaicely) => {
      const { summary, data } = await spaicely.call("account.whoami");
      result(summary, data);
    }),
  );

const sites = program.command("sites").description("list or create sites");

sites
  .command("list", { isDefault: true })
  .description("the sites you can work on")
  .action(() =>
    withSpaicely(async (spaicely) => {
      const me = await whoami(spaicely);
      const lines = me.sites.map((site) => {
        const domains = site.domains.map((domain) => domain.name).join(", ");
        return `${String(site.id).padStart(5)}  ${site.name}${domains ? `  (${domains})` : ""}  ${site.role}`;
      });
      result(lines.join("\n"), me.sites);
    }),
  );

sites
  .command("create <name>")
  .description("make a new, empty site")
  .action((name: string) =>
    withSpaicely(async (spaicely) => {
      const { summary, data } = await spaicely.call("sites.create", { name });
      result(summary, data);
    }),
  );

program
  .command("init")
  .description("write spaicely.toml for this folder")
  .addOption(siteOption())
  .action((options: { site?: string }) => {
    const root = process.cwd();
    const generator = detectGenerator(root);
    const site = options.site && /^\d+$/.test(options.site) ? Number(options.site) : options.site;
    const file = writeConfig(root, { site, dir: generator.dir, build: generator.build });
    result(t("init_written", { generator: generator.name }), { file, generator });
  });

program
  .command("deploy")
  .description("build, then upload the folder as a new version")
  .addOption(siteOption())
  .option("-d, --dir <dir>", "folder to upload (default: dir in spaicely.toml)")
  .option("--no-build", "skip the build command")
  .option("--dry-run", "only show what would change")
  .option("--force", "upload even when nothing changed")
  .option("--publish", "put the new version live right away")
  .option("-y, --yes", "do not ask before publishing")
  .action(
    async (options: { site?: string; dir?: string; build: boolean; dryRun?: boolean; force?: boolean; publish?: boolean; yes?: boolean }) => {
      const config = loadConfig();
      if (options.dir) Object.assign(config, { dir: resolve(options.dir), root: process.cwd() });
      if (options.build) await build(config);

      await withSpaicely(async (spaicely) => {
        const site = await resolveSite(spaicely, siteFrom(options, config));
        const planned = await plan(spaicely, config, site);
        const { changes } = planned;
        say(t("changes", { added: changes.added.length, changed: changes.changed.length, removed: changes.removed.length, same: changes.same }));

        if (options.dryRun) {
          const lines = [
            ...changes.added.map((path) => `+ ${path}`),
            ...changes.changed.map((path) => `~ ${path}`),
            ...changes.removed.map((path) => `- ${path}`),
          ];
          result(lines.join("\n"), changes);
          return;
        }
        if (!hasChanges(changes) && !options.force) {
          result(t("no_changes"), { changes, deployment: null });
          return;
        }

        const version = await upload(spaicely, site, planned);
        if (!options.publish) {
          result(t("uploaded", { number: version.number }), { changes, deployment: version });
          return;
        }
        await publishVersion(spaicely, site, { deployment: version.number }, Boolean(options.yes));
      });
    },
  );

program
  .command("publish [version]")
  .description("put a version live (default: the newest)")
  .addOption(siteOption())
  .option("-y, --yes", "do not ask")
  .action((wanted: string | undefined, options: { site?: string; yes?: boolean }) =>
    withSpaicely(async (spaicely) => {
      const site = await resolveSite(spaicely, siteFrom(options, loadConfig()));
      if (wanted !== undefined && !/^\d+$/.test(wanted)) throw new CliError(`version: ${wanted}`, EXIT.usage);
      const number = wanted ? Number(wanted) : (await versions(spaicely, site.id)).versions[0]?.number;
      if (!number) throw new CliError(t("no_changes"), EXIT.usage);
      await publishVersion(spaicely, site, { deployment: number }, Boolean(options.yes));
    }),
  );

program
  .command("rollback")
  .description("bring back the version that was live before")
  .addOption(siteOption())
  .option("-y, --yes", "do not ask")
  .action((options: { site?: string; yes?: boolean }) =>
    withSpaicely(async (spaicely) => {
      const site = await resolveSite(spaicely, siteFrom(options, loadConfig()));
      await publishVersion(spaicely, site, { rollback: true }, Boolean(options.yes));
    }),
  );

program
  .command("versions")
  .description("the versions of a site, newest first")
  .addOption(siteOption())
  .action((options: { site?: string }) =>
    withSpaicely(async (spaicely) => {
      const site = await resolveSite(spaicely, siteFrom(options, loadConfig()));
      const listed = await versions(spaicely, site.id);
      const lines = listed.versions.map(
        (version) =>
          `${String(version.number).padStart(4)}  ${version.status.padEnd(10)} ${String(version.files).padStart(5)} files ${humanSize(version.bytes).padStart(9)}  ${localTime(version.created_at)}  ${version.created_by ?? ""}${version.client ? ` (${version.client})` : ""}`,
      );
      result(lines.join("\n"), listed);
    }),
  );

program
  .command("serve [dir]")
  .description("show the site on this machine, as it will be served")
  .option("-p, --port <port>", "port", "4000")
  .option("--build", "run the build command first")
  .action(async (dir: string | undefined, options: { port: string; build?: boolean }) => {
    const config = loadConfig();
    if (options.build) await build(config);
    const root = resolve(dir ?? resolve(config.root, config.dir));
    await serve(root, Number(options.port));
    const url = `http://localhost:${options.port}`;
    say(t("serving", { dir: dir ?? config.dir, url }));
    if (jsonMode()) result("", { url, root });
  });

const domains = program.command("domains").description("search, register, move and connect domains");

domains
  .command("search <names...>")
  .description("is a name free? Works without signing in")
  .option("-e, --ext <extensions>", "extensions, such as nl,com,eu")
  .option("--verify", "ask the registry too (at most 10 domains)")
  .action(async (names: string[], options: { ext?: string; verify?: boolean }) => {
    const results = await search(names, { extensions: options.ext, verify: options.verify });
    result(searchLines(results), results);
    if (!options.verify && results.some((found) => found.reason === "dns_only")) {
      say(`\n${t("search_verify_hint", { names: [...names, ...(options.ext ? ["-e", options.ext] : [])].join(" ") })}`);
    }
  });

domains
  .command("register <domain>")
  .description("register a domain in the name of your account")
  .option("--holder-name <name>", "holder, as the registry records it (only needed the first time)")
  .option("--organization <organization>")
  .option("--email <email>")
  .option("--phone <phone>", "with country code, such as +31 6 12345678")
  .option("--street <street>", "street and house number")
  .option("--postal-code <code>")
  .option("--city <city>")
  .option("--country <code>", "two letters, such as NL")
  .option("-y, --yes", "do not ask")
  .action((domain: string, options: Record<string, string | boolean | undefined>) =>
    withSpaicely(async (spaicely) => {
      const fields = { name: "holderName", organization: "organization", email: "email", phone: "phone", street: "street", postal_code: "postalCode", city: "city", country_code: "country" };
      const contact = Object.fromEntries(Object.entries(fields).flatMap(([field, option]) => (options[option] ? [[field, options[option]]] : [])));
      const quote = await spaicely.call<{ name: string; holder_account: string; holder: Record<string, string>; confirmation: string }>(
        "domains.register",
        { name: domain, ...(Object.keys(contact).length ? { contact } : {}) },
      );
      const { name, holder_account: account, holder, confirmation } = quote.data;
      say(t("register_holder", { holder: [holder.name, holder.organization].filter(Boolean).join(", "), account }));
      if (!(await confirm(t("register_confirm", { domain: name }), Boolean(options.yes)))) {
        result(t("aborted"), { registered: false });
        return;
      }
      const { summary, data } = await spaicely.call("domains.register", { name, confirmation });
      result(summary, data);
    }),
  );

domains
  .command("transfer <domain>")
  .description("move a domain to Spaicely; the transfer code goes in the browser, not here")
  .option("--no-browser", "print the address instead of opening the browser")
  .action((domain: string, options: { browser: boolean }) =>
    withSpaicely(async (spaicely) => {
      const { data } = await spaicely.call<{ name: string; url: string }>("domains.transfer", { name: domain });
      if (options.browser && !jsonMode()) openInBrowser(data.url);
      result(`${t("transfer_open")}\n${data.url}`, data);
    }),
  );

domains
  .command("connect <domain>")
  .description("put a site on its domain; run again to see where it stands")
  .addOption(siteOption())
  .option("--skip <indexes>", "found records to leave out, such as 2,5")
  .option("-y, --yes", "take the found records over without asking")
  .action((domain: string, options: { site?: string; skip?: string; yes?: boolean }) =>
    withSpaicely(async (spaicely) => {
      const site = await resolveSite(spaicely, siteFrom(options, loadConfig()));
      let connection = await connect(spaicely, { site_id: site.id, domain });
      if (connection.status === "confirming" && connection.records_to_confirm) {
        const skip = (options.skip ?? "").split(",").filter(Boolean).map(Number);
        say(`${t("records_found", { domain: connection.domain })}\n${foundRecordLines(connection.records_to_confirm)}\n\n${t("records_missing")}`);
        if (connection.dkim_mail) say(`\n${t("dkim_mail", { domain: connection.domain, to: connection.dkim_mail.to, subject: connection.dkim_mail.subject })}`);
        if (!(await confirm(t("records_confirm"), Boolean(options.yes)))) {
          result(t("aborted"), connection);
          return;
        }
        connection = await connect(spaicely, { site_id: site.id, domain, confirm: true, skip });
      }
      result(connectionText(connection), connection);
    }),
  );

domains
  .command("status <domain>")
  .description("where the connection stands, and the DNS records")
  .action((domain: string) =>
    withSpaicely(async (spaicely) => {
      const { data } = await spaicely.call<Connection>("domains.status", { domain });
      const records = data.records?.length ? `\n\n${dnsLines(data.records)}` : "";
      result(`${connectionText(data)}${records}`, data);
    }),
  );

domains
  .command("disconnect <domain>")
  .description("take the site off the domain; other records stay")
  .option("-y, --yes", "do not ask")
  .action((domain: string, options: { yes?: boolean }) =>
    withSpaicely(async (spaicely) => {
      if (!(await confirm(t("disconnect_confirm", { domain }), Boolean(options.yes)))) {
        result(t("aborted"), { disconnected: false });
        return;
      }
      const { data } = await spaicely.call<{ domain: string }>("sites.domains.disconnect", { domain });
      result(t("disconnected", { domain: data.domain }), data);
    }),
  );

const dns = program.command("dns").description("the DNS records of a domain hosted at Spaicely");

dns
  .command("list <domain>", { isDefault: true })
  .alias("ls")
  .description("the records Spaicely serves for the domain")
  .action((domain: string) =>
    withSpaicely(async (spaicely) => {
      const { data } = await spaicely.call<Connection>("domains.status", { domain });
      const records = data.records ?? [];
      result(records.length ? dnsLines(records) : t("no_records"), records);
    }),
  );

dns
  .command("add <domain> <type> <name> <value>")
  .description("add a record; name @ is the domain itself, such as: spaicely dns add example.nl TXT @ \"v=spf1 ...\"")
  .option("--ttl <seconds>")
  .option("--priority <number>", "MX and SRV")
  .option("--weight <number>", "SRV")
  .option("--port <number>", "SRV")
  .option("--flags <number>", "CAA")
  .option("--tag <tag>", "CAA, such as issue")
  .action((domain: string, type: string, name: string, value: string, options: Record<string, string | undefined>) =>
    withSpaicely(async (spaicely) => {
      const record = newRecord(type, name, value, options);
      const { data } = await spaicely.call<{ domain: string; records: DnsRecord[] }>("domains.dns.update", { domain, add: [record] });
      result(`${t("dns_updated", { domain: data.domain, count: data.records.length })}\n\n${dnsLines(data.records)}`, data);
    }),
  );

dns
  .command("delete <domain> <ids...>")
  .alias("rm")
  .description("delete records by the number spaicely dns list shows")
  .option("-y, --yes", "do not ask")
  .action((domain: string, ids: string[], options: { yes?: boolean }) =>
    withSpaicely(async (spaicely) => {
      if (ids.some((id) => !/^\d+$/.test(id))) throw new CliError(`id: ${ids.join(" ")}`, EXIT.usage);
      if (!(await confirm(t("dns_delete_confirm", { domain, count: ids.length }), Boolean(options.yes)))) {
        result(t("aborted"), { deleted: false });
        return;
      }
      const { data } = await spaicely.call<{ domain: string; records: DnsRecord[] }>("domains.dns.update", { domain, delete: ids.map(Number) });
      result(`${t("dns_updated", { domain: data.domain, count: data.records.length })}\n\n${dnsLines(data.records)}`, data);
    }),
  );

program
  .command("tools")
  .description("every tool the server offers, also those without a command here")
  .action(() =>
    withSpaicely(async (spaicely) => {
      const tools = await spaicely.tools();
      result(tools.map((tool) => `${tool.name.padEnd(28)} ${tool.title ?? ""}`).join("\n"), tools);
    }),
  );

program
  .command("call <tool> [arguments]")
  .description("call any tool with JSON arguments, such as: spaicely call sites.versions '{\"site_id\": 12}'")
  .action((tool: string, args: string | undefined) =>
    withSpaicely(async (spaicely) => {
      let parsed: Record<string, unknown> = {};
      if (args) {
        try {
          parsed = JSON.parse(args);
        } catch (error) {
          throw new CliError(`JSON: ${(error as Error).message}`, EXIT.usage);
        }
      }
      const { summary, data } = await spaicely.call(tool, parsed);
      result(`${summary}\n${JSON.stringify(data, null, 2)}`, data);
    }),
  );

function localTime(iso: string): string {
  const date = new Date(iso);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

async function publishVersion(spaicely: Spaicely, site: SiteEntry, target: { deployment?: number; rollback?: boolean }, yes: boolean) {
  const label = target.rollback ? "rollback" : String(target.deployment);
  if (!(await confirm(t("publish_confirm", { number: label, site: site.name }), yes))) {
    result(t("aborted"), { published: false });
    return;
  }
  const { version, live } = await publish(spaicely, site.id, target);
  result(t(live ? "published" : "publish_slow", { number: version.number }), { published: live, deployment: version });
}

program.parseAsync().catch((error: unknown) => {
  if (error instanceof CliError) {
    if (jsonMode()) process.stdout.write(`${JSON.stringify({ error: error.message, details: error.details }, null, 2)}\n`);
    else {
      process.stderr.write(`${error.message}\n`);
      if (error.details) process.stderr.write(`${JSON.stringify(error.details, null, 2)}\n`);
    }
    process.exit(error.exitCode);
  }
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(EXIT.failure);
});
