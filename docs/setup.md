# Setup Reference for AI Agents

`README.md` is the canonical Windows deployment runbook. This page is the execution contract for an AI agent completing a real deployment from a fresh clone.

The installation root is the directory created by `git clone`. Every relative command and every launcher in this document resolves from that directory. Files in a parent directory or from an older local layout are not part of the installation.

The agent performs non-secret inspection and safe local steps. The user performs actions that expose an Owner password or Cloudflare Tunnel token, require their Cloudflare account, or require an independent elevated terminal.

## Completion boundary

Use this workflow for Windows 10/11 when the user wants a stable remote MCP endpoint through a dashboard-managed Cloudflare Named Tunnel. A complete deployment has:

- DevSpace built and healthy on its configured loopback port;
- a Cloudflare Published application route targeting that same port;
- `publicBaseUrl` set to the public HTTPS origin without `/mcp`;
- DevSpace registered to start when the intended Windows user logs in;
- cloudflared installed as an automatic Windows service;
- a fresh remote MCP client session connected and authorized.

Preserve a healthy existing installation. Reuse working configuration, tunnels, routes, and services when they already satisfy this contract.

## 1. Verify prerequisites and repository contents

For a new machine, clone the distribution and enter the repository root:

```powershell
Set-Location -LiteralPath '<parent-directory>'
git clone https://github.com/zhenchuan199/devspace-aiagent.git
Set-Location -LiteralPath '.\devspace-aiagent'
```

For an existing checkout, start in its Git root:

```powershell
Set-Location -LiteralPath (git rev-parse --show-toplevel)
```

Inspect prerequisites and the files required by the installation:

```powershell
$PSVersionTable.PSVersion
node --version
npm.cmd --version
git --version
Get-Command node.exe, npm.cmd, git.exe
Get-Item .\package.json, .\package-lock.json, .\start-devspace.mjs, .\start-devspace.ps1, .\register-devspace-task.ps1
```

Continue when Node satisfies the `package.json` engine range, Git for Windows is installed, and all listed repository files exist. The three launcher files in the clone are the supported launchers. Do not use similarly named files outside the repository.

## 2. Install dependencies and build

Run from the repository root:

```powershell
npm.cmd ci --include=dev
npm.cmd run build
Get-Item .\dist\cli.js, .\dist\config.js
```

Completion criterion: both generated files exist and the build command succeeds. `node_modules` and `dist` are generated locally and are not expected in a fresh clone.

## 3. Inspect or initialize local state

Check state existence without reading credential contents:

```powershell
$devspaceStateDir = Join-Path $env:USERPROFILE '.devspace'
Test-Path -LiteralPath (Join-Path $devspaceStateDir 'config.json')
Test-Path -LiteralPath (Join-Path $devspaceStateDir 'auth.json')
node .\dist\cli.js config get
```

If either state file is absent, ask the user to run this command in a local interactive PowerShell window under the Windows account that will run DevSpace:

```powershell
node .\dist\cli.js init
```

The user selects narrow `allowedRoots`, keeps the host at `127.0.0.1`, selects the local port, and enters `none` for the public URL until the final hostname is known. `init` displays the Owner password; keep that output in the user's local terminal. The agent must not read, transcribe, log, or commit it.

Run `config get` again and retain the reported host and port for the remaining steps. Commands below use `<configured-port>` as a placeholder. `7676` is the default, not a required value.

## 4. Prove the local service path

In an independent local PowerShell window under the same Windows account, start the foreground diagnostic launcher:

```powershell
.\start-devspace.ps1
```

From a second PowerShell window, verify the configured port:

```powershell
Invoke-WebRequest -Uri 'http://127.0.0.1:<configured-port>/healthz' -UseBasicParsing
```

Completion criterion: the response status is HTTP 200. The local MCP endpoint is:

```text
http://127.0.0.1:<configured-port>/mcp
```

After this check, stop the foreground launcher with `Ctrl+C` and confirm the port is no longer listening before registering the Scheduled Task:

```powershell
Get-NetTCPConnection -LocalAddress 127.0.0.1 -LocalPort <configured-port> -State Listen -ErrorAction SilentlyContinue
```

An empty result is expected. Identify an unexpected listener before changing or terminating it. This handoff prevents a manually started process from being mistaken for the Scheduled Task.

## 5. Create or reuse a dashboard-managed Cloudflare Tunnel

Cloudflare Tunnel supplies remote ingress only; it does not start DevSpace. First inspect local connector state without printing the service command line:

```powershell
Get-Command cloudflared.exe -ErrorAction SilentlyContinue
Get-CimInstance Win32_Service -Filter "Name='Cloudflared'" -ErrorAction SilentlyContinue |
  Select-Object Name, State, StartMode
```

If a healthy Named Tunnel and automatic `Cloudflared` service already exist, reuse them when appropriate. One Named Tunnel can publish multiple application routes.

If a new tunnel or connector is required:

1. In the Cloudflare dashboard, open `Networking -> Tunnels` and select `Create Tunnel`.
2. Name the tunnel and select the Windows connector instructions.
3. Cloudflare displays an installation command containing a Tunnel token.
4. Ask the user to run that generated command themselves in an elevated local terminal. Do not copy the command through agent tools or chat.
5. Continue only after the dashboard reports a healthy connector/replica and the Windows service reports `State = Running` and `StartMode = Auto`.

This is the dashboard-managed token workflow. Do not add a locally-managed `config.yml`, credentials JSON file, or second Scheduled Task to the same connector.

Current Cloudflare references:

- <https://developers.cloudflare.com/tunnel/get-started/>
- <https://developers.cloudflare.com/cloudflare-one/networks/routes/add-routes/>

## 6. Publish the DevSpace route

Inside the selected tunnel, open `Routes -> Add route -> Published application` and configure:

```text
Hostname:    devspace.example.com
Service URL: http://127.0.0.1:<configured-port>
```

Use the user's hostname and the port reported by `config get`. For a Cloudflare-managed DNS zone, saving the Published application route creates the tunnel DNS association; do not add a duplicate manual DNS record unless the user's DNS design requires one.

Completion criterion: the tunnel is healthy, at least one connector is active, and the saved route maps the intended hostname to the exact loopback service URL.

## 7. Persist the public DevSpace origin

Set the public origin from the repository root:

```powershell
node .\dist\cli.js config set publicBaseUrl 'https://devspace.example.com'
node .\dist\cli.js config get
```

Use the real hostname and omit `/mcp`. Completion criterion: `config get` shows the exact HTTPS origin. DevSpace reads this setting at process startup, so a process that was already running must be restarted from an independent local terminal before public acceptance testing.

## 8. Register DevSpace logon startup

Confirm the foreground diagnostic process from step 4 is stopped. Then, from an elevated PowerShell window in the repository root, run:

```powershell
.\register-devspace-task.ps1
```

Run the script under the same Windows identity that owns `~/.devspace/config.json` and `~/.devspace/auth.json`. The current script requires that identity to be an administrator. If elevation changes to a different Windows account, stop and report the account mismatch instead of registering a task against the wrong profile.

The script registers and starts the per-user `DevSpace MCP` task. It resolves `node.exe` and all paths from the current clone. Verify the task, listener, and local service separately:

```powershell
Get-ScheduledTask -TaskName 'DevSpace MCP' |
  Select-Object TaskName, State
Get-ScheduledTaskInfo -TaskName 'DevSpace MCP' |
  Select-Object LastRunTime, LastTaskResult
Get-NetTCPConnection -LocalAddress 127.0.0.1 -LocalPort <configured-port> -State Listen
Invoke-WebRequest -Uri 'http://127.0.0.1:<configured-port>/healthz' -UseBasicParsing
```

Completion criterion: the task is `Running`, the configured port has a listener, and local health returns HTTP 200. A listening foreground process is not sufficient evidence; it must already have been stopped before registration.

The task uses an `AtLogOn` trigger. DevSpace becomes available after that Windows user logs in; it is not a pre-login system service. Rerun the registration script after moving the repository or changing the Node installation path.

## 9. Verify cloudflared startup and the remote path

Verify the connector without displaying its `PathName`:

```powershell
Get-CimInstance Win32_Service -Filter "Name='Cloudflared'" |
  Select-Object Name, State, StartMode
```

Expected steady state:

```text
Name:      Cloudflared
State:     Running
StartMode: Auto
```

Then verify the public route:

```powershell
Invoke-WebRequest -Uri 'https://devspace.example.com/healthz' -UseBasicParsing
```

Configure the remote MCP host with:

```text
https://devspace.example.com/mcp
```

Complete Owner authorization in the remote host and validate a real tool call from a fresh client session.

When the user authorizes a restart test, restart Windows and verify this sequence:

1. Before user login, `Cloudflared` is running automatically; DevSpace is not expected to be available yet.
2. After the intended user logs in, `DevSpace MCP` becomes `Running`.
3. Local and public `/healthz` return HTTP 200.
4. A fresh remote MCP session connects and completes a tool call.

If no restart/login test was performed, report startup as configured but not reboot-verified.

## 10. Diagnose by boundary

| Observation | Inspect next |
| --- | --- |
| Build output missing | Node engine, `npm.cmd ci`, build output |
| Local `/healthz` fails | task/process state, actual configured port, stderr log |
| Task exits immediately | foreground or legacy listener occupying the configured port; task result and stderr log |
| Tunnel is healthy but public health fails | Published application service URL and local listener |
| Public health works but MCP/OAuth fails | `publicBaseUrl`, `/mcp` client URL, Owner authorization |
| DevSpace works manually but not after login | task identity, trigger, registered repository path, registered Node path |
| Tunnel works manually but not after restart | `Cloudflared` service state and startup mode |

Only expose the DevSpace public origin. Keep munder-memory and every other localhost-only backend off the public tunnel.

## Agent completion condition

Report the deployment complete only when all of these checks have evidence:

1. fresh-clone prerequisites and repository launcher files are present;
2. build output exists;
3. local health succeeds on the configured port;
4. the dashboard-managed tunnel is healthy and its route targets that port;
5. `publicBaseUrl` equals the chosen HTTPS origin;
6. `DevSpace MCP` is running under the intended user and owns the persistent local service path;
7. `Cloudflared` is a running automatic Windows service;
8. public health succeeds;
9. a fresh remote MCP session connects, authorizes, and completes a real tool call;
10. restart/login behavior is either verified or explicitly reported as unverified.
