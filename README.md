# DevSpace Windows — AI Agent Deployment Runbook

This file is written primarily for an AI coding/operations agent configuring this repository on a user's Windows machine.

Target platforms:

- Windows 10
- Windows 11
- Node.js `>=22.19 <27`
- Git for Windows with Git Bash

This repository is a complete distribution derived from `Waishnav/devspace`. Do **not** download a second upstream DevSpace checkout and do **not** depend on a global npm installation or Junction.

Expected connection path:

```text
ChatGPT
  -> https://<public-hostname>/mcp
  -> Cloudflare Named Tunnel
  -> http://127.0.0.1:7676/mcp
  -> DevSpace on Windows
```

## Agent operating rules

Before changing the machine:

1. Read `AGENTS.md`.
2. Treat the current repository directory as the DevSpace installation root.
3. Preserve existing Git changes and existing DevSpace configuration.
4. Discover executable paths instead of assuming drive letters or usernames.
5. Never read, print, copy, or commit DevSpace owner credentials or Cloudflare tunnel tokens.
6. Keep DevSpace bound to loopback unless the user explicitly requests another topology.
7. Do not create a Cloudflare Quick Tunnel when a persistent ChatGPT endpoint is required.
8. Do not stop the DevSpace instance that is carrying the current remote MCP session; perform lifecycle operations from an independent local terminal or management channel.

## Desired end state

The deployment is complete only when all of the following are true:

- dependencies install successfully;
- typecheck, tests, and production build pass;
- DevSpace configuration exists and uses intentional allowed roots;
- `127.0.0.1:<port>` serves `/healthz`;
- a fixed Cloudflare hostname routes to that local service;
- `cloudflared` survives reboot as a Windows service;
- `DevSpace MCP` survives user logon as a Windows Scheduled Task;
- the public `/healthz` endpoint responds;
- ChatGPT can authenticate to `<public-hostname>/mcp` and call a real DevSpace tool.

## 1. Inspect the Windows host

Run from PowerShell in the repository root.

```powershell
$PSVersionTable.PSVersion
Get-ComputerInfo | Select-Object WindowsProductName, WindowsVersion, OsArchitecture
Get-Command node.exe
Get-Command npm.cmd
Get-Command git.exe
node --version
npm.cmd --version
git --version
git status --short
```

Requirements:

- Node must satisfy `>=22.19 <27`.
- Git for Windows must be installed.
- Existing uncommitted work must not be reset or overwritten.

If an upstream/global DevSpace installation already exists on the machine, do not uninstall it by default. This repository is self-contained at the source/build level and should be invoked through its own `dist\cli.js` and repository launchers. Avoid the bare global `devspace` command during deployment because it may resolve to a different installation.

The included launchers discover Git Bash automatically. `DEVSPACE_GIT_BASH` may be used only when automatic discovery cannot find the intended Bash executable.

## 2. Install and build the repository

```powershell
npm.cmd ci --include=dev
npm.cmd run build
```

For a normal first-time deployment, these are the required repository preparation steps. `node_modules/` and `dist/` are intentionally not committed, so a fresh clone must install dependencies and build the runtime before it can start.

Do not make `npm test` or `npm run typecheck` part of routine deployment. They are development/release verification commands.

Do not continue past a failed install or build without diagnosing it.

The built runtime entry point is:

```text
dist\cli.js
```

Use repository-local commands such as `node .\dist\cli.js ...`; do not depend on a globally installed `@waishnav/devspace` package.

## 3. Configure DevSpace

Inspect existing configuration first:

```powershell
node .\dist\cli.js config get
```

If DevSpace has not been initialized, run:

```powershell
node .\dist\cli.js init
```

`init` is required once on each Windows account/machine unless valid DevSpace configuration and authentication state already exist. It creates the local configuration and Owner credential used by the MCP OAuth flow. It is not a build step and should not be rerun on every startup or update.

Before running `init`, know the final public HTTPS hostname that will be used by the Cloudflare Named Tunnel. If that hostname does not exist yet, configure the Cloudflare tunnel first, then return here.

Normal Windows values:

```text
host: 127.0.0.1
port: 7676
allowedRoots: only directories the user intentionally authorizes
publicBaseUrl: https://<public-hostname>
```

`publicBaseUrl` is the HTTPS origin **without** `/mcp`.

Configuration and authentication state live under the user's DevSpace config directory, normally:

```text
~/.devspace/config.json
~/.devspace/auth.json
```

`~/.devspace` is configuration/state. It is **not** a global Skill catalog.

### Skill locations

Default global Agent Skills are:

```text
~/.agents/skills
~/.codex/skills
```

Workspace-local Skills are:

```text
<workspace>/.agents/skills
```

Optional explicit extra catalogs may be supplied through `DEVSPACE_SKILL_PATHS`. `DEVSPACE_AGENT_DIR` can relocate the Codex/agent directory when intentionally configured.

Do not create or document `~/.devspace/skills` as a Skill source.

## 4. Verify DevSpace locally

Use the foreground launcher for diagnostics:

```powershell
.\start-devspace.ps1
```

From another PowerShell process:

```powershell
Invoke-WebRequest -Uri 'http://127.0.0.1:7676/healthz' -UseBasicParsing
```

Expected status: HTTP 200.

If the configured port is not `7676`, use the configured value instead.

## 5. Configure a Cloudflare Named Tunnel

The intended deployment uses a persistent Cloudflare Named Tunnel, not a temporary `trycloudflare.com` Quick Tunnel.

First inspect the local connector:

```powershell
Get-Command cloudflared.exe -ErrorAction SilentlyContinue
Get-Service Cloudflared -ErrorAction SilentlyContinue
```

If no persistent tunnel exists, create one in Cloudflare Dashboard. The current dashboard flow is generally:

```text
Networking
  -> Tunnels
  -> Create Tunnel
```

For a remotely managed tunnel, select the Windows connector and use Cloudflare's generated installation command from an elevated terminal. Never copy its token into this repository, logs, documentation, or chat.

Configure the public route under the tunnel:

```text
Tunnel
  -> Routes
  -> Add route
  -> Published application
```

Use:

```text
Hostname: <public-hostname>
Service URL: http://127.0.0.1:7676
```

If DevSpace uses another port, change only the port in the Service URL.

The `cloudflared` connector should run as a Windows service so the tunnel reconnects after reboot.

Verify:

```powershell
Get-Service Cloudflared
Invoke-WebRequest -Uri 'https://<public-hostname>/healthz' -UseBasicParsing
```

Expected:

- service state `Running`;
- public `/healthz` returns HTTP 200.

If the hostname changed, update DevSpace:

```powershell
node .\dist\cli.js config set publicBaseUrl 'https://<public-hostname>'
```

Do not append `/mcp` to `publicBaseUrl`.

Cloudflare references:

- <https://developers.cloudflare.com/tunnel/setup/>
- <https://developers.cloudflare.com/tunnel/advanced/local-management/as-a-service/windows/>

## 6. Configure Windows logon auto-start

The repository contains:

```text
start-devspace.mjs
start-devspace.ps1
register-devspace-task.ps1
```

Roles:

- `start-devspace.mjs` — background bootstrap used by Task Scheduler;
- `start-devspace.ps1` — foreground diagnostic launcher;
- `register-devspace-task.ps1` — registers the per-user Scheduled Task.

After a successful production build, run from an **elevated PowerShell**:

```powershell
.\register-devspace-task.ps1
```

The task name is:

```text
DevSpace MCP
```

The registration script resolves the current checkout and Node executable dynamically. Do not replace those paths with developer-specific hard-coded values.

Verify:

```powershell
Get-ScheduledTask -TaskName 'DevSpace MCP'
Get-ScheduledTaskInfo -TaskName 'DevSpace MCP'
Get-NetTCPConnection -LocalAddress 127.0.0.1 -LocalPort 7676 -State Listen -ErrorAction SilentlyContinue
```

If the repository is later moved or renamed, rerun `register-devspace-task.ps1` from the new repository location.

Lifecycle commands:

```powershell
Start-ScheduledTask -TaskName 'DevSpace MCP'
Stop-ScheduledTask -TaskName 'DevSpace MCP'
```

Do not stop/restart this task from a ChatGPT session whose active MCP transport depends on it.

## 7. Connect ChatGPT

Use the public MCP endpoint:

```text
https://<public-hostname>/mcp
```

In ChatGPT, use the current Developer mode / custom MCP app flow. UI wording and plan availability may change; prefer current OpenAI documentation when the interface differs.

The connection must complete DevSpace owner authorization. Do not expose the owner password to the agent transcript or repository.

After connecting, validate with a fresh ChatGPT conversation.

Skill path test:

```text
Call list_skills and show the available global Skills.
```

Workspace path test:

```text
Open C:\path\to\an\allowed\project as a workspace.
```

Expected global Skill defaults:

```text
~/.agents/skills
~/.codex/skills
```

OpenAI reference:

- <https://help.openai.com/en/articles/12584461-developer-mode-and-full-mcp-connectors-in-chatgpt-beta>

## 8. Logs and diagnosis

Background logs are written next to the repository launchers:

```text
devspace-named.stdout.log
devspace-named.stderr.log
```

Read only the amount needed for diagnosis:

```powershell
Get-Content .\devspace-named.stdout.log -Tail 100
Get-Content .\devspace-named.stderr.log -Tail 100
```

Do not publish raw logs without checking for sensitive URLs, paths, or authentication metadata.

Diagnose by boundary:

| Symptom | Check first |
| --- | --- |
| Local `/healthz` fails | DevSpace process, build, config, port |
| Local works, public fails | `cloudflared` service and Published application route |
| Public works, ChatGPT unauthorized | MCP/OAuth authorization |
| ChatGPT connects but tools fail | DevSpace logs and tool-specific error |
| Skills missing | `~/.agents/skills`, `~/.codex/skills`, optional configured paths |
| Scheduled Task is ready but port is closed | task result and DevSpace stderr |

## 9. Updating this deployment

For a normal deployment update after source changes:

```powershell
npm.cmd ci --include=dev
npm.cmd run build
```

Then restart `DevSpace MCP` from an independent local management channel and repeat local/public/MCP verification appropriate to the change.

For development work or before publishing a release, run the full verification sequence:

```powershell
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
```

For repository architecture, coding rules, compatibility contracts, and configuration invariants, follow `AGENTS.md`.

## Security invariants

- `allowedRoots` stays narrow.
- Normal HTTP bind stays on loopback.
- Cloudflare owns the public ingress; DevSpace does not manage tunnel credentials.
- Forwarded headers are trusted only from the local proxy boundary.
- Filesystem containment is not a shell sandbox.
- Shell commands execute with the Windows user's authority.
- Never commit `auth.json`, tunnel tokens, logs, or machine-specific secrets.

## Upstream attribution

This project is derived from <https://github.com/Waishnav/devspace>. Preserve the upstream license and required attribution when redistributing it.
