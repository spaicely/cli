import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { createServer, type Server } from "node:http";
import { hostname } from "node:os";
import { auth, type OAuthClientProvider } from "@modelcontextprotocol/sdk/client/auth.js";
import type {
  OAuthClientInformationMixed,
  OAuthClientMetadata,
  OAuthTokens,
} from "@modelcontextprotocol/sdk/shared/auth.js";
import { forgetCredentials, readCredentials, writeCredentials, type Credentials } from "./credentials.js";
import { CliError, EXIT } from "./errors.js";
import { t } from "./i18n.js";

export function serverUrl(env = process.env): string {
  return env.SPAICELY_MCP_URL || "https://mcp.spaicely.com/mcp";
}

// The same OAuth as every AI client (dynamic registration, PKCE, the
// consent screen), with a redirect to a port on this machine (RFC 8252).
// Outside `spaicely login` it never opens a browser: an expired session is
// an error with exit code 3, so a script does not hang.
export class CliAuthProvider implements OAuthClientProvider {
  private credentials: Credentials;
  private verifier?: string;
  private expectedState?: string;

  constructor(
    private readonly server: string,
    private readonly redirect?: string,
    private readonly onAuthorize?: (url: URL) => void,
  ) {
    this.credentials = readCredentials(server);
  }

  // Also needed outside login: without a redirect URL the SDK takes this
  // for a client-credentials client and never refreshes.
  get redirectUrl(): string {
    const registered = this.credentials.client && "redirect_uris" in this.credentials.client ? this.credentials.client.redirect_uris : [];
    return this.redirect ?? registered?.[0] ?? "http://127.0.0.1/callback";
  }

  get clientMetadata(): OAuthClientMetadata {
    return {
      client_name: `Spaicely CLI (${hostname()})`.slice(0, 100),
      redirect_uris: [this.redirectUrl],
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
    };
  }

  state(): string {
    this.expectedState = randomBytes(16).toString("hex");
    return this.expectedState;
  }

  stateMatches(state: string | null): boolean {
    return Boolean(this.expectedState) && state === this.expectedState;
  }

  clientInformation(): OAuthClientInformationMixed | undefined {
    return this.credentials.client;
  }

  saveClientInformation(client: OAuthClientInformationMixed): void {
    this.credentials.client = client;
    writeCredentials(this.credentials);
  }

  tokens(): OAuthTokens | undefined {
    return this.credentials.tokens;
  }

  saveTokens(tokens: OAuthTokens): void {
    this.credentials.tokens = tokens;
    writeCredentials(this.credentials);
  }

  redirectToAuthorization(url: URL): void {
    if (!this.onAuthorize) throw new CliError(t("not_logged_in"), EXIT.notLoggedIn);
    this.onAuthorize(url);
  }

  saveCodeVerifier(verifier: string): void {
    this.verifier = verifier;
  }

  codeVerifier(): string {
    if (!this.verifier) throw new CliError(t("not_logged_in"), EXIT.notLoggedIn);
    return this.verifier;
  }

  invalidateCredentials(scope: "all" | "client" | "tokens" | "verifier"): void {
    if (scope === "all" || scope === "client") delete this.credentials.client;
    if (scope === "all" || scope === "tokens") delete this.credentials.tokens;
    if (scope !== "verifier") writeCredentials(this.credentials);
  }

  remember(identity: Pick<Credentials, "user" | "account">): void {
    Object.assign(this.credentials, identity);
    writeCredentials(this.credentials);
  }
}

export function provider(env = process.env): OAuthClientProvider {
  return new CliAuthProvider(serverUrl(env));
}

export async function login(options: { openBrowser: boolean }): Promise<CliAuthProvider> {
  const server = serverUrl();
  const { listener, port } = await listen();
  try {
    const redirect = `http://127.0.0.1:${port}/callback`;
    const callback = waitForCallback(listener);
    const authProvider = new CliAuthProvider(server, redirect, (url) => {
      const intro = options.openBrowser ? t("login_opening") : t("login_open");
      process.stderr.write(`${intro}\n\n  ${url.toString()}\n\n${t("login_waiting")}\n`);
      if (options.openBrowser) openInBrowser(url.toString());
    });
    // A fresh login asks again, whatever tokens were there.
    authProvider.invalidateCredentials("tokens");

    const first = await auth(authProvider, { serverUrl: server });
    if (first === "AUTHORIZED") return authProvider;

    const { code, state } = await callback;
    if (!authProvider.stateMatches(state)) throw new CliError(t("login_failed", { reason: "state" }));
    await auth(authProvider, { serverUrl: server, authorizationCode: code });
    return authProvider;
  } finally {
    listener.close();
  }
}

function listen(): Promise<{ listener: Server; port: number }> {
  return new Promise((resolve, reject) => {
    const listener = createServer();
    listener.on("error", reject);
    listener.listen(0, "127.0.0.1", () => {
      const address = listener.address();
      if (address && typeof address === "object") resolve({ listener, port: address.port });
    });
  });
}

function waitForCallback(listener: Server): Promise<{ code: string; state: string | null }> {
  return new Promise((resolve, reject) => {
    listener.on("request", (request, response) => {
      const url = new URL(request.url ?? "/", "http://127.0.0.1");
      if (url.pathname !== "/callback") {
        response.writeHead(404).end();
        return;
      }
      const code = url.searchParams.get("code");
      const error = url.searchParams.get("error_description") || url.searchParams.get("error");
      response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      response.end(callbackPage(code ? "Spaicely CLI ✓" : `Spaicely CLI: ${error ?? "?"}`));
      if (code) resolve({ code, state: url.searchParams.get("state") });
      else reject(new CliError(t("login_failed", { reason: error ?? "no code" })));
    });
  });
}

function callbackPage(text: string): string {
  const escaped = text.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);
  return `<!doctype html><meta charset="utf-8"><title>Spaicely</title>
<body style="font:16px system-ui;display:grid;place-items:center;height:90vh;color:#1E2A78">
<p>${escaped}</p><script>setTimeout(() => window.close(), 1500)</script>`;
}

export function openInBrowser(url: string): void {
  const [command, args] =
    process.platform === "darwin"
      ? ["open", [url]]
      : process.platform === "win32"
        ? ["cmd", ["/c", "start", "", url.replace(/&/g, "^&")]]
        : ["xdg-open", [url]];
  try {
    spawn(command, args, { stdio: "ignore", detached: true }).on("error", () => {}).unref();
  } catch {
    // The address is on screen; that is enough.
  }
}

// Revokes the refresh token (and with it the access token) at the server,
// then forgets them here. Forgetting happens even when the server cannot
// be reached; the connection then stays listed in the dashboard.
export async function logout(): Promise<void> {
  const { client, tokens } = readCredentials(serverUrl());
  const issuer = (tokens as { issuer?: string } | undefined)?.issuer;
  try {
    if (client && tokens && issuer) {
      const metadata = (await (await fetch(new URL("/.well-known/oauth-authorization-server", issuer))).json()) as { revocation_endpoint?: string };
      if (metadata.revocation_endpoint) {
        await fetch(metadata.revocation_endpoint, {
          method: "POST",
          headers: { "content-type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({ token: tokens.refresh_token ?? tokens.access_token, client_id: client.client_id }),
        });
      }
    }
  } finally {
    forgetCredentials();
  }
}
