# DevSpace AI Agent — Windows Deployment Runbook

This repository is a directly usable Windows distribution derived from `Waishnav/devspace`. This README is written primarily for an AI coding/operations agent deploying the repository on Windows 10 or Windows 11.

Do not download a second upstream checkout. Do not depend on a globally installed `@waishnav/devspace`. Use this repository's build and launchers.

## Supported shape

- Windows 10 / Windows 11
- Node.js `>=22.19 <27`
- Git for Windows with Git Bash
- fixed Codex-style MCP tool surface
- local-only operation or optional remote HTTPS exposure

The normal MCP tool surface is fixed to:

```text
open_workspace
read
apply_patch
exec_command
write_stdin
```

Global Skills additionally expose:

```text
list_skills
read_skill
```

There is no deployment choice between `minimal`, `full`, and `codex` modes in this distribution. Codex mode is the default and supported mode.

## Agent rules

Before changing the machine:

1. Read `AGENTS.md`.
2. Treat the current checkout as the DevSpace installation root.
3. Preserve existing Git changes and existing DevSpace configuration.
4. Discover executable paths; never assume a drive letter or username.
5. Never read, print, copy, or commit `auth.json`, tunnel tokens, or other credentials.
6. Do not uninstall an existing upstream/global DevSpace unless the user explicitly requests removal.
7. Do not use the bare global `devspace` command for this distribution. Use `node .\dist\cli.js ...` and the repository launchers.
8. Do not stop the DevSpace process carrying the current MCP session. Lifecycle operations belong in an independent local terminal or management channel.

## Deployment modes

DevSpace and remote ingress are separate concerns.

### Mode A — local only

```text
MCP client on the same machine
  -> http://127.0.0.1:7676/mcp
  -> DevSpace
```

No public hostname, Cloudflare account, or tunnel is required.

### Mode B — remote HTTPS

```text
remote MCP host
  -> https://<public-origin>/mcp
  -> user-controlled HTTPS tunnel/reverse proxy
  -> http://127.0.0.1:7676/mcp
  -> DevSpace
```

Cloudflare Named Tunnel is one supported Windows option, not a DevSpace requirement. A different HTTPS reverse proxy/tunnel may be used if it preserves the required MCP/OAuth behavior.

## 1. Inspect the Windows host

Run from PowerShell in the repository root:

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

- Node satisfies `>=22.19 <27`.
- Git for Windows is installed.
- Existing uncommitted work is preserved.

The launchers discover Git Bash automatically. `DEVSPACE_GIT_BASH` is only an override when automatic discovery cannot find the intended Git Bash executable.

## 2. Install and build

For a fresh clone:

```powershell
npm.cmd ci --include=dev
npm.cmd run build
```

`node_modules/` and `dist/` are not committed, so both steps are required after a fresh clone.

Routine deployment does not require running the full test suite. For development or release verification, use:

```powershell
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
```

The runtime entry point is:

```text
dist\cli.js
```

## 3. Initialize local state

Inspect existing state first:

```powershell
node .\dist\cli.js config get
```

If configuration/authentication state does not exist, run once:

```powershell
node .\dist\cli.js init
```

Normal values:

```text
host: 127.0.0.1
port: 7676
allowedRoots: only directories intentionally authorized
publicBaseUrl: none for local-only mode, or https://<public-origin> for remote mode
```

`init` creates local state under the current Windows account, normally:

```text
~/.devspace/config.json
~/.devspace/auth.json
```

Do not rerun `init` on every startup or update. Do not expose the Owner credential from `auth.json`.

If remote HTTPS is configured later, update only the public origin:

```powershell
node .\dist\cli.js config set publicBaseUrl 'https://<public-origin>'
```

To return to local-only mode:

```powershell
node .\dist\cli.js config set publicBaseUrl null
```

Never append `/mcp` to `publicBaseUrl`.

## 4. Skill locations

Default global Agent Skills:

```text
~/.agents/skills
~/.codex/skills
```

Workspace-local Skills:

```text
<workspace>/.agents/skills
```

`DEVSPACE_SKILL_PATHS` may add explicit extra catalogs. `DEVSPACE_AGENT_DIR` may intentionally relocate the Codex/agent directory.

`~/.devspace/skills` is not a Skill catalog.

## 5. Verify local DevSpace

Foreground diagnostic run:

```powershell
.\start-devspace.ps1
```

From another PowerShell process:

```powershell
Invoke-WebRequest -Uri 'http://127.0.0.1:7676/healthz' -UseBasicParsing
```

Expected: HTTP 200.

For a local MCP client, the endpoint is:

```text
http://127.0.0.1:7676/mcp
```

If another process already occupies the configured port, identify it before changing or terminating anything. An old/global DevSpace installation may remain installed, but two active instances cannot bind the same address and port.

## 6. Optional remote HTTPS exposure

Skip this section for local-only operation.

DevSpace does not own tunnel lifecycle. The user chooses and controls the remote ingress.

The remote proxy/tunnel should forward the public origin to:

```text
http://127.0.0.1:7676
```

The MCP client then uses:

```text
https://<public-origin>/mcp
```

After choosing the final public origin, persist it:

```powershell
node .\dist\cli.js config set publicBaseUrl 'https://<public-origin>'
```

Verify both boundaries:

```powershell
Invoke-WebRequest -Uri 'http://127.0.0.1:7676/healthz' -UseBasicParsing
Invoke-WebRequest -Uri 'https://<public-origin>/healthz' -UseBasicParsing
```

### Optional Cloudflare Named Tunnel example

Cloudflare is not mandatory. Use this only when the user selects Cloudflare.

Inspect first:

```powershell
Get-Command cloudflared.exe -ErrorAction SilentlyContinue
Get-Service Cloudflared -ErrorAction SilentlyContinue
```

Create/select a persistent Named Tunnel in the Cloudflare dashboard, install its Windows connector using Cloudflare's generated command, and publish a route whose service is:

```text
http://127.0.0.1:7676
```

Use the user's chosen hostname as the DevSpace `publicBaseUrl`. Run `cloudflared` as a Windows service when the user wants the remote endpoint to survive reboot.

Never store the tunnel token in this repository, documentation, logs, or chat.

Official references:

- <https://developers.cloudflare.com/tunnel/setup/>
- <https://developers.cloudflare.com/tunnel/advanced/local-management/as-a-service/windows/>

## 7. Optional DevSpace logon auto-start

The repository includes:

```text
start-devspace.mjs
start-devspace.ps1
register-devspace-task.ps1
```

Roles:

- `start-devspace.mjs` — background bootstrap used by Task Scheduler.
- `start-devspace.ps1` — foreground diagnostic launcher.
- `register-devspace-task.ps1` — registers the per-user `DevSpace MCP` Scheduled Task.

After a successful build, run from elevated PowerShell when the user wants automatic startup:

```powershell
.\register-devspace-task.ps1
```

Verify:

```powershell
Get-ScheduledTask -TaskName 'DevSpace MCP'
Get-ScheduledTaskInfo -TaskName 'DevSpace MCP'
```

If the repository is moved or renamed, rerun the registration script from the new location.

Do not restart this task from a ChatGPT session currently connected through that same DevSpace instance.

## 8. Connect an MCP host

Use the endpoint matching the selected deployment mode:

```text
local:  http://127.0.0.1:7676/mcp
remote: https://<public-origin>/mcp
```

For ChatGPT remote use, follow the current OpenAI Developer mode/custom MCP app flow and complete DevSpace Owner authorization. UI wording and plan availability may change; prefer current OpenAI documentation if the interface differs.

Validate the real path with a fresh client session. Useful checks:

```text
Call list_skills and show the available global Skills.
```

```text
Open C:\path\to\an\allowed\project as a workspace.
```

Expected coding tools include `open_workspace`, `read`, `apply_patch`, `exec_command`, and `write_stdin`.

## 9. Logs and diagnosis

Background launcher logs:

```text
devspace-named.stdout.log
devspace-named.stderr.log
```

Read only what is needed:

```powershell
Get-Content .\devspace-named.stdout.log -Tail 100
Get-Content .\devspace-named.stderr.log -Tail 100
```

Diagnose by boundary:

| Symptom | Check first |
| --- | --- |
| Local `/healthz` fails | process, config, build, port |
| Local MCP works but remote fails | chosen tunnel/reverse proxy |
| Remote endpoint works but OAuth fails | DevSpace publicBaseUrl and authorization |
| ChatGPT connects but tools fail | DevSpace logs and tool-specific error |
| Skills missing | `~/.agents/skills`, `~/.codex/skills`, optional configured paths |
| Scheduled Task runs but port is closed | task result and DevSpace stderr |

Do not publish raw logs without checking for sensitive URLs, paths, or authentication metadata.

## 10. Updating

Normal deployment update:

```powershell
git pull
npm.cmd ci --include=dev
npm.cmd run build
```

Restart the local DevSpace process from an independent management channel if required. Remote tunnel configuration normally does not need to change when the repository updates.

Release/development verification:

```powershell
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
```

## Security invariants

- Keep `allowedRoots` narrow.
- Keep the normal server bound to loopback.
- Public ingress is optional and user-controlled.
- Forwarded headers are trusted only from the local proxy boundary when proxy trust is enabled.
- Filesystem containment is not a shell sandbox.
- Commands execute with the Windows user's authority.
- Never commit credentials, tunnel tokens, or runtime logs.

## Upstream attribution

This project is derived from <https://github.com/Waishnav/devspace>. Preserve the upstream license and required attribution when redistributing it.
