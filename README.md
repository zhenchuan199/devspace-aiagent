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
  -> http://127.0.0.1:<configured-port>/mcp
  -> DevSpace
```

No public hostname, Cloudflare account, or tunnel is required.

### Mode B — remote HTTPS

```text
remote MCP host
  -> https://<public-origin>/mcp
  -> user-controlled HTTPS tunnel/reverse proxy
  -> http://127.0.0.1:<configured-port>/mcp
  -> DevSpace
```

Cloudflare Named Tunnel is one supported Windows option, not a DevSpace requirement. A different HTTPS reverse proxy/tunnel may be used if it preserves the required MCP/OAuth behavior.

## 1. Inspect the Windows host

The repository root is the directory created by `git clone`. Run from PowerShell in that directory:

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
Get-Item .\package.json, .\package-lock.json, .\start-devspace.mjs, .\start-devspace.ps1, .\register-devspace-task.ps1
```

Requirements:

- Node satisfies `>=22.19 <27`.
- Git for Windows is installed.
- All listed repository files exist in the clone.
- Existing uncommitted work is preserved.

The three launcher files in the clone are the supported launchers. Files with the same names outside the Git root belong to another layout and are not installation dependencies. The launchers discover Git Bash automatically. `DEVSPACE_GIT_BASH` is only an override when automatic discovery cannot find the intended Git Bash executable.

## 2. Install and build

For a fresh clone, enter the target parent directory, clone the distribution, and build from the new Git root:

```powershell
Set-Location -LiteralPath '<parent-directory>'
git clone https://github.com/zhenchuan199/devspace-aiagent.git
Set-Location -LiteralPath '.\devspace-aiagent'
npm.cmd ci --include=dev
npm.cmd run build
Get-Item .\dist\cli.js, .\dist\config.js
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

Inspect existing state first without reading credential contents:

```powershell
$devspaceStateDir = Join-Path $env:USERPROFILE '.devspace'
Test-Path -LiteralPath (Join-Path $devspaceStateDir 'config.json')
Test-Path -LiteralPath (Join-Path $devspaceStateDir 'auth.json')
node .\dist\cli.js config get
```

If either state file is absent, the user runs this once in a local interactive PowerShell window under the Windows account that will run DevSpace:

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

`init` displays the Owner password. Keep that output in the user's local terminal; an agent must not read, transcribe, log, or commit it. Do not rerun `init` on every startup or update.

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

From another PowerShell process, use the port reported by `config get`:

```powershell
Invoke-WebRequest -Uri 'http://127.0.0.1:<configured-port>/healthz' -UseBasicParsing
```

Expected: HTTP 200.

For a local MCP client, the endpoint is:

```text
http://127.0.0.1:<configured-port>/mcp
```

If another process already occupies the configured port, identify it before changing or terminating anything. An old/global DevSpace installation may remain installed, but two active instances cannot bind the same address and port. After the foreground check, stop this launcher with `Ctrl+C` before registering the Scheduled Task; otherwise the task bootstrap sees the occupied port and exits instead of owning the persistent process.

## 6. Optional remote HTTPS exposure

Skip this section for local-only operation.

DevSpace does not own tunnel lifecycle. The user chooses and controls the remote ingress.

The remote proxy/tunnel should forward the public origin to:

```text
http://127.0.0.1:<configured-port>
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
Invoke-WebRequest -Uri 'http://127.0.0.1:<configured-port>/healthz' -UseBasicParsing
Invoke-WebRequest -Uri 'https://<public-origin>/healthz' -UseBasicParsing
```

### Optional Cloudflare Named Tunnel example

Cloudflare is not mandatory. Use this only when the user selects Cloudflare.

Inspect first:

```powershell
Get-Command cloudflared.exe -ErrorAction SilentlyContinue
Get-CimInstance Win32_Service -Filter "Name='Cloudflared'" -ErrorAction SilentlyContinue |
  Select-Object Name, State, StartMode
```

Create or select a dashboard-managed Named Tunnel. Cloudflare's generated Windows connector command contains a Tunnel token, so the user runs it in an elevated local terminal; do not pass that command through agent tools or chat. Publish a route whose service is:

```text
http://127.0.0.1:<configured-port>
```

Use the user's chosen hostname as the DevSpace `publicBaseUrl`. The generated connector installation should leave `Cloudflared` running as an automatic Windows service. Keep this dashboard-managed token flow separate from the locally-managed `config.yml` flow.

Never store the tunnel token in this repository, documentation, logs, or chat.

Official references:

- <https://developers.cloudflare.com/tunnel/get-started/>
- <https://developers.cloudflare.com/cloudflare-one/networks/routes/add-routes/>

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

After a successful build and after stopping the foreground diagnostic process, run from elevated PowerShell under the same Windows identity that owns `~/.devspace/config.json` and `~/.devspace/auth.json`:

```powershell
.\register-devspace-task.ps1
```

The current script requires that identity to be an administrator. If elevation switches to another account, stop instead of registering the task against the wrong profile. Verify the task, configured listener, and health endpoint separately:

```powershell
Get-ScheduledTask -TaskName 'DevSpace MCP' | Select-Object TaskName, State
Get-ScheduledTaskInfo -TaskName 'DevSpace MCP' | Select-Object LastRunTime, LastTaskResult
Get-NetTCPConnection -LocalAddress 127.0.0.1 -LocalPort <configured-port> -State Listen
Invoke-WebRequest -Uri 'http://127.0.0.1:<configured-port>/healthz' -UseBasicParsing
```

The task uses an `AtLogOn` trigger and starts after this Windows user logs in; it is not a pre-login system service. If the repository is moved or renamed, or the Node installation path changes, rerun the registration script from the new location.

For a dashboard-managed Cloudflare connector, verify automatic service state without printing its command line, which may contain a Tunnel token:

```powershell
Get-CimInstance Win32_Service -Filter "Name='Cloudflared'" |
  Select-Object Name, State, StartMode
```

Expected: `State` is `Running` and `StartMode` is `Auto`. A full restart test proves that cloudflared starts before login and DevSpace becomes available after the intended user logs in. If no restart test was performed, report startup as configured but not reboot-verified.

Do not restart this task from a ChatGPT session currently connected through that same DevSpace instance.

## 8. Connect an MCP host

Use the endpoint matching the selected deployment mode:

```text
local:  http://127.0.0.1:<configured-port>/mcp
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
