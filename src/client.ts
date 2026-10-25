import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { UnauthorizedError, type OAuthClientProvider } from "@modelcontextprotocol/sdk/client/auth.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { provider, serverUrl } from "./auth.js";
import { readCredentials } from "./credentials.js";
import { CliError, EXIT } from "./errors.js";
import { t } from "./i18n.js";
import { VERSION } from "./version.js";

export interface ToolResult<T = Record<string, unknown>> {
  summary: string;
  data: T;
}

interface TextContent {
  type: string;
  text?: string;
}

// The CLI speaks MCP to the same server and tools as the AI, so rights and
// checks live in one place (ADR 0010).
export class Spaicely {
  private constructor(private readonly client: Client) {}

  static async connect(authProvider?: OAuthClientProvider): Promise<Spaicely> {
    const client = new Client({ name: "spaicely-cli", version: VERSION });
    // A token from the environment (CI) goes as is; nothing to register or
    // refresh, and a 401 means it is wrong or expired.
    const token = authProvider ? undefined : process.env.SPAICELY_TOKEN;
    if (!authProvider && !token && !readCredentials(serverUrl()).tokens) throw new CliError(t("not_logged_in"), EXIT.notLoggedIn);
    const transport = new StreamableHTTPClientTransport(
      new URL(serverUrl()),
      token ? { requestInit: { headers: { authorization: `Bearer ${token}` } } } : { authProvider: authProvider ?? provider() },
    );
    try {
      await client.connect(transport);
    } catch (error) {
      throw translate(error);
    }
    return new Spaicely(client);
  }

  async call<T = Record<string, unknown>>(name: string, args: Record<string, unknown> = {}): Promise<ToolResult<T>> {
    let result;
    try {
      result = await this.client.callTool({ name, arguments: args });
    } catch (error) {
      throw translate(error);
    }
    const texts = ((result.content ?? []) as TextContent[]).filter((part) => part.type === "text").map((part) => part.text ?? "");
    if (result.isError) {
      const details = parseJson(texts[1]);
      const conflict = name === "sites.publish" && details && "problems" in details;
      throw new CliError(texts[0] || name, conflict ? EXIT.conflict : EXIT.failure, details);
    }
    const data = (result.structuredContent ?? parseJson(texts[1]) ?? {}) as T;
    return { summary: texts[0] ?? "", data };
  }

  async tools() {
    const { tools } = await this.client.listTools();
    return tools;
  }

  async close(): Promise<void> {
    await this.client.close();
  }
}

function parseJson(text: string | undefined): Record<string, unknown> | undefined {
  if (!text) return undefined;
  try {
    const value = JSON.parse(text);
    return value && typeof value === "object" ? value : undefined;
  } catch {
    return undefined;
  }
}

function translate(error: unknown): unknown {
  if (error instanceof CliError) return error;
  if (error instanceof UnauthorizedError || (error as { code?: unknown })?.code === 401) {
    return new CliError(t(process.env.SPAICELY_TOKEN ? "token_rejected" : "not_logged_in"), EXIT.notLoggedIn);
  }
  return error;
}

export async function withSpaicely<T>(work: (spaicely: Spaicely) => Promise<T>): Promise<T> {
  const spaicely = await Spaicely.connect();
  try {
    return await work(spaicely);
  } finally {
    await spaicely.close().catch(() => {});
  }
}
