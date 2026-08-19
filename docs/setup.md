# Setup Reference for AI Agents

`README.md` is the canonical Windows deployment runbook. This page only summarizes setup contracts so they do not drift into a second competing installation guide.

## Repository preparation

Fresh clone:

```powershell
npm.cmd ci --include=dev
npm.cmd run build
```

Use the repository-local CLI:

```powershell
node .\dist\cli.js <command>
```

Do not install or invoke `npx @waishnav/devspace` for this distribution.

## Initialization

First deployment on a Windows account:

```powershell
node .\dist\cli.js init
```

`publicBaseUrl` is optional:

- `none` / `null` -> local-only MCP operation;
- `https://<public-origin>` -> remote HTTPS operation.

The local endpoint remains:

```text
http://127.0.0.1:7676/mcp
```

Remote ingress is a separate deployment layer. Cloudflare Named Tunnel is one option, not a requirement.

## Persistent Windows startup

When requested:

```powershell
.\register-devspace-task.ps1
```

This registers the repository-local `DevSpace MCP` Scheduled Task. It does not configure or manage a tunnel.

For detailed sequencing, verification, and optional Cloudflare guidance, use `README.md`.
