import assert from "node:assert/strict";
import { once } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { loadConfig } from "./config.js";
import { SingleUserOAuthProvider } from "./oauth-provider.js";
import { createServer } from "./server.js";

test("authenticated tool calls without an MCP session use the stateless fallback", async () => {
  const root = await mkdtemp(join(tmpdir(), "devspace-http-test-"));
  const config = loadConfig({
    DEVSPACE_CONFIG_DIR: join(root, ".config"),
    DEVSPACE_STATE_DIR: join(root, ".state"),
    DEVSPACE_ALLOWED_ROOTS: root,
    DEVSPACE_PUBLIC_BASE_URL: "https://devspace.example",
    DEVSPACE_OAUTH_OWNER_TOKEN: "test-owner-token-that-is-long-enough",
    DEVSPACE_WIDGETS: "off",
    DEVSPACE_SUBAGENTS: "false",
    DEVSPACE_LOG_REQUESTS: "false",
    PORT: "7676",
  });
  const mcpUrl = new URL("/mcp", config.publicBaseUrl);
  const provider = new SingleUserOAuthProvider(config.oauth, mcpUrl, config.stateDir);
  const redirectUri = "https://chatgpt.com/connector_platform_oauth_redirect";
  const client = await provider.clientsStore.registerClient?.({
    redirect_uris: [redirectUri],
    client_name: "ChatGPT",
  });
  assert.ok(client);

  const code = "stateless-fallback-test-code";
  provider["codes"].set(code, {
    clientId: client.client_id,
    params: {
      redirectUri,
      codeChallenge: "challenge",
      scopes: ["devspace"],
      resource: mcpUrl,
    },
    expiresAtMs: Date.now() + 60_000,
  });
  const tokens = await provider.exchangeAuthorizationCode(
    client,
    code,
    undefined,
    redirectUri,
    mcpUrl,
  );
  provider.close();

  const running = createServer(config);
  const listener = running.app.listen(0, "127.0.0.1");

  try {
    await once(listener, "listening");
    const address = listener.address();
    assert.ok(address && typeof address === "object");

    const response = await fetch(`http://127.0.0.1:${address.port}/mcp`, {
      method: "POST",
      headers: {
        accept: "application/json, text/event-stream",
        authorization: `Bearer ${tokens.access_token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/list",
        params: {},
      }),
    });

    assert.equal(response.status, 200);
    assert.match(await response.text(), /open_workspace/);
  } finally {
    listener.close();
    await running.close();
    await rm(root, { recursive: true, force: true });
  }
});
