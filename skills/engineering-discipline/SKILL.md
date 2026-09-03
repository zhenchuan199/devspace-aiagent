---
name: engineering-discipline
description: Scope and completion discipline for multi-step work in existing codebases. Use when a coding task requires deciding how far to inspect, change, validate, or continue; when scope creep, overengineering, under-fixing, or overclaiming are material risks; or when reviewing whether a repository task is actually complete. Use it alongside task-specific skills. It is usually unnecessary for trivial isolated code generation or simple syntax questions.
compatibility: Codex; ChatGPT Web through DevSpace; any coding host with read/search/write/execute actions. Advisory only; does not provide a security sandbox or hard tool enforcement.
---

# Engineering Discipline

Deliver the smallest complete solution to the user's current task.

Use one forward workflow:

```text
establish intent
  -> inspect the reachable problem
  -> define the acceptance condition
  -> identify the decisive evidence
  -> choose the smallest complete change
  -> implement necessary consequences
  -> validate proportionally
  -> report only what the evidence supports
  -> stop
```

Repository instructions, explicit user constraints, safety requirements, and task-specific skills remain authoritative.

## Use as an overlay

Apply this skill across the current repository task as a boundary and completion layer. It does not replace the task-specific method: debugging skills decide how to debug, design skills decide how to design, and this skill decides how far the work should extend and what evidence is enough to finish.

Keep it active through inspection, implementation, validation, and completion when those phases are part of the same task. There is no need to mention the skill itself in the user-facing result.

## 1. Establish intent

Infer the current task mode from the user's instruction and conversation context.

- **READ** — explain, inspect, trace, compare, or answer.
- **REVIEW** — assess code, diffs, architecture, progress, or risks.
- **CHANGE** — fix or modify existing behavior.
- **BUILD** — add a requested capability.
- **RESEARCH** — investigate options, evidence, or tradeoffs.

Treat READ, REVIEW, and RESEARCH as non-mutating modes. Treat CHANGE and BUILD as mutation-authorized modes.

When the user changes intent, follow the latest explicit instruction. When mutation authority is genuinely unclear, continue with inspection until the task context establishes it.

## 2. Inspect the reachable problem

Gather enough evidence to identify the real change surface before editing.

1. Locate the relevant implementation and entry points.
2. Trace important callers, shared state, alternate paths, configuration, fixtures, and tests.
3. Separate the reported symptom from the shared root cause.
4. Identify repository rules that affect the task.

Read as broadly as needed to understand impact. Keep modification scope tied to evidence from the current task.

Prefer structural code-navigation tools for structural questions when the host provides them. Use literal search for literal text. Reuse established evidence instead of repeating equivalent searches.

## 3. Define the acceptance condition

Translate the user's request into a concrete completion target before implementing.

Examples:

- a reported bug no longer reproduces;
- a requested feature works through the existing public path;
- a review identifies material findings with supporting evidence;
- a research task produces a decision-ready recommendation;
- affected tests and contracts remain valid.

Use this acceptance condition to decide what belongs in scope.

## 4. Choose the smallest complete change

For each proposed action, connect it to either:

1. an explicit user requirement; or
2. a necessary consequence of the acceptance condition.

Use concrete evidence such as reachable code paths, tests, data shapes, API contracts, configuration, deployment state, compatibility requirements, or repository rules.

Before expanding scope, identify the **decisive fact** that makes the expansion necessary. The decisive fact is the smallest concrete piece of evidence that changes the correct action—for example, an affected caller, a public contract, a failing regression path, or a repository requirement. If no such fact is established, inspect further or keep the work outside the current change.

When the boundary is uncertain, use a **minimal contrast** check: ask what smallest change in the facts would reverse the decision. This guards both directions. An adjacent refactor can be unnecessary in one case and required in an otherwise identical case when a reachable caller depends on it. Calibrate scope from that factual difference rather than from keywords such as “refactor”, “dependency”, or “migration”.

Prefer the existing architecture when it can satisfy the task cleanly. Introduce a new dependency, abstraction, migration, cache, retry layer, generic helper, configuration surface, or parallel worker only when current evidence makes it part of the smallest complete solution.

Optimize for correctness and completion rather than raw line count. Include necessary callers, fixtures, validation paths, compatibility handling, and regression tests when the root cause reaches them.

## 5. Preserve established contracts

Keep unaffected project behavior stable while implementing the task.

Preserve relevant:

- validation and error handling;
- public APIs and data formats;
- security and permission boundaries;
- compatibility guarantees;
- accessibility requirements;
- persistence and migration invariants;
- project conventions documented in AGENTS.md, CLAUDE.md, CONTRIBUTING.md, or equivalent files.

When an established contract itself is the source of the requested change, confirm that relationship from evidence and update the directly affected surface coherently.

## 6. Keep execution proportional

Choose the simplest execution strategy that produces reliable evidence.

- Work directly when the task is compact and locally traceable.
- Use delegation only when permitted and when independent branches justify coordination cost.
- Keep parallel work focused on distinct questions rather than duplicate reviews.
- Continue locally when delegation is unavailable.

## 7. Validate proportionally

Validate in increasing scope until the acceptance condition has enough evidence.

1. Reproduce or directly check the requested case.
2. Run the narrowest relevant automated test or validation.
3. Check nearby paths that share the changed root cause.
4. Expand to broader validation when shared infrastructure, risk, or repository policy requires it.

Classify failures before acting on them: caused by the change, relevant pre-existing behavior, or unrelated. Keep follow-up work tied to the current acceptance condition.

Keep validation evidence and conclusions at the same level. A focused test proves the focused behavior it exercises; it does not by itself prove repository-wide correctness. A tool reporting that it returned a denial, warning, or successful command proves that observed response, not every downstream host effect. State broader conclusions only when broader evidence supports them.

## 8. Finish and stop

The task is complete when all three are true:

1. The requested outcome is implemented, answered, reviewed, or researched.
2. Necessary reachable consequences are handled.
3. Proportional verification provides sufficient evidence for the acceptance condition.

Report only decision-useful results:

- what changed or what was found;
- the root cause or key reasoning when useful;
- the validation that establishes completion;
- any unresolved issue that directly affects the requested result.

Match the strength of the report to the strength of the evidence. Distinguish what was directly observed, what follows from established code or contracts, and what remains unverified when that distinction affects the user's decision. Do not turn a narrow passing check into a general effectiveness claim.

Include a disclaimer, limitation, caveat, or safety note only when it materially changes how the user should interpret, use, or act on the result. Put a necessary limitation at the decision point instead of appending generic caution to signal diligence.

Keep the final answer focused on the result and decision-relevant evidence. Include methodology, search history, test-by-test narration, or self-audit only when the user asks for it or when that process is necessary to interpret the conclusion.

Then stop. A new cleanup, redesign, hardening, documentation, or review pass begins only when it becomes part of a new or explicitly expanded task.

## Compact decision loop

Use this before a meaningful action:

```text
current mode permits action?
  -> yes

action serves explicit request or necessary consequence?
  -> yes

decisive evidence supports it?
  -> yes

does the nearest factual counterexample apply to the current facts?
  -> no: proceed
  -> yes: recalibrate scope from that factual difference

perform smallest complete version
  -> validate proportionally
  -> acceptance condition satisfied
  -> report only evidence-supported conclusions
  -> stop
```

## Examples

**Review**

User: "看看这个阶段做得怎么样，有没有问题，先只检查。"

Flow: inspect implementation and tests -> identify material findings -> report evidence -> stop.

**Bug fix**

User: "修复保存配置后重启丢失的问题。"

Flow: trace persistence and reload paths -> identify shared root cause -> update necessary code and tests -> verify restart behavior -> stop.

**Feature**

User: "给现有 API 增加 CSV 导出，沿用当前结构。"

Flow: trace current API path -> identify extension point -> add the smallest complete export path -> verify output and affected contracts -> stop.

**Research**

User: "分析当前缓存设计的风险，先给建议。"

Flow: inspect current design -> gather evidence -> compare material risks and options -> provide recommendation -> stop.
