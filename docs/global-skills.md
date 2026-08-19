# Global Skills in ChatGPT

DevSpace can expose user-global Agent Skills to ChatGPT without opening a
project workspace.

## Discovery roots

The default global catalog includes:

- `~/.agents/skills`
- `~/.codex/skills`

`DEVSPACE_AGENT_DIR` can relocate the Codex/agent directory, and
`DEVSPACE_SKILL_PATHS` can add explicit extra catalogs. DevSpace does not use
`~/.devspace/skills` as a Skill catalog.

Project-local `.agents/skills` remain workspace-scoped and are still returned
by `open_workspace`.

On the Windows account:

```text
C:\Users\<username>\.agents\skills
C:\Users\<username>\.codex\skills
```

are therefore discovered automatically with the default configuration.

## Tools

When `DEVSPACE_SKILLS` is enabled, DevSpace exposes two read-only tools that do
not require a `workspaceId`:

- `list_skills` — list all global skills or filter them by name/description.
- `read_skill` — read a selected skill's `SKILL.md` or a relative resource
  inside that skill directory.

`read_skill` rejects absolute resource paths and `..` traversal outside the
selected skill directory.

## Dollar-command behavior

The DevSpace MCP instructions define:

```text
$                       -> list_skills
$browser                -> discover/search matching skills
$agent-browser          -> read_skill("agent-browser")
$agent-browser <task>   -> read the skill, then use <task> as the request
```

Skills with `disable-model-invocation: true` remain visible in discovery but
must not be chosen automatically. An explicit `$skill-name` from the user may
still invoke them.

## ChatGPT picker UI

With `DEVSPACE_WIDGETS=full` (the default), `list_skills` renders an interactive
skill picker inside the ChatGPT conversation. Selecting a row uses the MCP Apps
`ui/message` bridge to send `$skill-name` back to the chat. The picker also
accepts optional task text and can send `$skill-name <task>`.

This is intentionally a chat-embedded picker. Third-party MCP apps do not have
an API to intercept the ChatGPT composer's `$` key before a message is sent, so
the first `$` must be submitted to ChatGPT. After submission, the resulting
picker provides the closest portable interaction to Codex's native composer
skill menu.

## Example

Send:

```text
$
```

Choose `agent-browser`, or directly send:

```text
$agent-browser open example.com and inspect the page
```
