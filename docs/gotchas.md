# Troubleshooting — Windows Distribution

Use repository-local commands throughout:

```powershell
node .\dist\cli.js <command>
```

Do not fall back to `npx @waishnav/devspace` or a bare global `devspace` command while diagnosing this distribution.

## `dist\cli.js` is missing

Fresh clones do not contain `dist/` or `node_modules/`.

```powershell
npm.cmd ci --include=dev
npm.cmd run build
```

## Unsupported Node version

```powershell
node --version
```

Required: `>=22.19 <27`.

## `better-sqlite3` cannot load

First make sure dependencies were installed using the same active Node runtime:

```powershell
npm.cmd rebuild better-sqlite3
node .\dist\cli.js doctor
```

## Local-only operation

No tunnel is required. Persist local-only mode with:

```powershell
node .\dist\cli.js config set publicBaseUrl null
```

Then verify:

```powershell
Invoke-WebRequest -Uri 'http://127.0.0.1:7676/healthz' -UseBasicParsing
```

## Public URL includes `/mcp`

Wrong:

```text
https://example.com/mcp
```

Correct `publicBaseUrl`:

```text
https://example.com
```

Client endpoint:

```text
https://example.com/mcp
```

Fix:

```powershell
node .\dist\cli.js config set publicBaseUrl 'https://example.com'
```

## Remote URL changed

Update only the public origin and restart DevSpace if required:

```powershell
node .\dist\cli.js config set publicBaseUrl 'https://<new-public-origin>'
```

The tunnel/reverse proxy itself is user-controlled infrastructure. Do not assume Cloudflare unless the user selected it.

## Host header / 403 problems

```powershell
node .\dist\cli.js doctor
node .\dist\cli.js config get
```

Check that the configured public hostname is correct. `DEVSPACE_ALLOWED_HOSTS=*` is an advanced debugging escape hatch and should not be used as a normal fix.

## Owner password not accepted

Do not print `auth.json` into chat. Confirm the operator is using the Owner credential for the same Windows account/config directory as the running DevSpace instance.

Only rerun `init` when the user intentionally wants to reconfigure local state.

## Unknown `workspaceId`

Call `open_workspace` again and continue with the returned ID. Reuse a valid existing `workspaceId` instead of repeatedly reopening the same checkout.

## Workspace path rejected

Inspect configured roots:

```powershell
node .\dist\cli.js config get
```

Open a project inside an allowed root or intentionally update the configuration. Do not broaden allowed roots merely to bypass an error.

## Worktree mode fails

Check:

- Git is installed;
- the source path is a Git repository;
- the repository has at least one commit;
- `baseRef`, when supplied, resolves to a commit.

Uncommitted source checkout changes are not copied into a managed worktree.

## Windows commands fail

The supported command path uses Git Bash semantics. Check:

```powershell
Get-Command git.exe
node .\dist\cli.js doctor
```

The repository launchers automatically discover Git Bash. Use `DEVSPACE_GIT_BASH` only as an explicit override.

## Skills do not appear

Check the real default catalogs:

```text
~/.agents/skills
~/.codex/skills
```

Workspace-local Skills live at:

```text
<workspace>/.agents/skills
```

`~/.devspace/skills` is not loaded. Additional paths require explicit `DEVSPACE_SKILL_PATHS` configuration.

## Wrong tools appear

This distribution supports the Codex tool surface. Expected coding tools include:

```text
open_workspace
read
apply_patch
exec_command
write_stdin
```

If an MCP host still shows `write`, `edit`, `bash`, `grep`, `glob`, or `ls`, verify that it is connected to this repository's running build rather than an old/global DevSpace process, then refresh the MCP connection after restarting the correct instance.

## Subagent commands are not found

Subagents are experimental and disabled by default. Their current delegation Skill uses `devspace agents ...`. A clean repository-only install does not guarantee a global `devspace` executable.

Do not install upstream DevSpace merely to hide this mismatch. Either keep Subagents disabled or explicitly provide a CLI entry point when testing that experimental feature.

## Scheduled Task is running but the port belongs to another process

An old/global DevSpace instance may still be active. Identify the listener before terminating anything:

```powershell
Get-NetTCPConnection -LocalPort 7676 -State Listen -ErrorAction SilentlyContinue
```

The package may remain installed; only conflicting active instances must be resolved.
