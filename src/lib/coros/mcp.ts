import { COROS } from "./auth.ts";

/**
 * Just enough of an MCP client (Streamable HTTP, JSON-RPC) to call COROS read tools:
 * initialize once, then tools/call. Replies may come as JSON or as server-sent events.
 */
export async function corosSession(token: string) {
  let sessionId: string | undefined;
  let id = 0;

  async function rpc(method: string, params: object = {}) {
    const notification = method.startsWith("notifications/");
    const res = await fetch(`${COROS}/mcp`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
        ...(sessionId && { "Mcp-Session-Id": sessionId }),
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method,
        params,
        ...(!notification && { id: ++id }),
      }),
    });
    sessionId = res.headers.get("Mcp-Session-Id") ?? sessionId;
    const text = await res.text();
    if (!res.ok) throw new Error(`COROS MCP ${method} ${res.status}: ${text.slice(0, 200)}`);
    if (notification) return undefined;
    // Server-sent events may carry other messages first; keep the reply to this request.
    const reply = res.headers.get("content-type")?.includes("text/event-stream")
      ? text
          .split("\n")
          .filter((line) => line.startsWith("data:"))
          .map((line) => JSON.parse(line.slice(5)))
          .find((message) => message.id === id)
      : JSON.parse(text);
    if (!reply) throw new Error(`COROS MCP ${method}: no reply in event stream`);
    if (reply.error) throw new Error(`COROS MCP ${method}: ${reply.error.message}`);
    return reply.result;
  }

  await rpc("initialize", {
    protocolVersion: "2025-06-18",
    capabilities: {},
    clientInfo: { name: "pulse", version: "1" },
  });
  await rpc("notifications/initialized");

  /** Calls a tool and returns its text. Tool errors throw. */
  return async function tool(name: string, args: Record<string, string | number> = {}) {
    const result = await rpc("tools/call", { name, arguments: args });
    const raw: string = result?.content?.[0]?.text ?? "";
    // COROS wraps the text in a JSON string literal.
    const text: string = raw.startsWith('"') ? JSON.parse(raw) : raw;
    if (result?.isError) throw new Error(`COROS ${name}: ${text.slice(0, 200)}`);
    return text;
  };
}
