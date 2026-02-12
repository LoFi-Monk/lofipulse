---
created: 2026-02-11T14:48:00-06:00
modified: 2026-02-11T14:48:00-06:00
---

# 8. Deprecate Lofi Gate

- Status: Accepted
- Deciders: LoFi Monk, CTO (Agent)
- Tags: tooling process developer-experience

## Context and Problem Statement

Lofi Gate is a custom pre-commit verification skill that enforces a 7-step self-judgment process: gathering diffs, recalling the mission, running anti-cheat checks (test modification, test weakening, test deletion), scope validation, verdict delivery, and Python-based logging. It was introduced to enforce strict TDD discipline and prevent agents from "cheating" by manipulating tests.

The overhead is not justified at the current stage of the project. The monorepo has no application code yet. Running a multi-step introspection ritual before every commit slows velocity when the priority is standing up foundational infrastructure.

## Decision Drivers

- **Velocity** — we are in infrastructure standup mode, not feature delivery. The gate adds friction to every commit without proportional value.
- **Complexity** — the skill depends on a Python logger script, a `lofi.toml` config, and a `verification_history.md` log. That is three artifacts to maintain for a pre-commit check.
- **Python dependency** — Lofi Gate's logger requires Python, but the project is a Node.js/TypeScript monorepo. This is an unnecessary runtime dependency.
- **Premature process** — anti-cheat checks (test manipulation detection, scope creep detection) solve a problem we don't have yet. When we have real feature code and multiple agents working in parallel, this becomes valuable. Not today.

## Considered Options

- **Keep Lofi Gate as-is** — continue enforcing the full 7-step ritual.
- **Simplify Lofi Gate** — strip it down to just "run tests, check diff."
- **Deprecate Lofi Gate** — remove from workflow, revisit when the codebase has real feature code.

## Decision Outcome

**Deprecate Lofi Gate.** Remove it from the mandatory pre-commit workflow. The skill files remain in the repository for future reactivation — this is a suspension, not a deletion.

Keeping it was rejected: the overhead is disproportionate to the current codebase complexity (zero application code).

Simplifying it was rejected: even a reduced gate still requires maintaining the Python logger and `lofi.toml`. The simpler alternative is just running `turbo run test` in CI, which Turborepo (ADR 0006) already handles.

### Positive Consequences

- Faster commit cycles during infrastructure standup.
- One fewer runtime dependency (Python logger removed from critical path).
- Reduces cognitive overhead — developers focus on building, not ceremony.
- CI tests via Turborepo provide the same safety net without manual steps.

### Negative Consequences

- Agents lose the self-inspection ritual. Risk of scope creep or test manipulation increases slightly.
- Must be consciously reintroduced when feature development begins and multiple agents are active.

## Deprecation Checklist

- [x] Set `strict_tdd = false` in `lofi.toml` (or remove file).
- [x] Remove Lofi Gate references from `GEMINI.md` recent decisions.
- [x] Update `team-workflow.md` to remove "Lofi Gate must be green before Review."
- [x] Keep `.agent/skills/lofi-gate/` directory intact for future reactivation.

## Reactivation Criteria

Revisit Lofi Gate when **all** of these are true:

1. The monorepo has at least one package with real feature code and tests.
2. Multiple agents are working in parallel on different issues.
3. The Python logger is rewritten in Node.js (to eliminate the runtime dependency).

## Architectural Context

- Referenced Architecture Document(s):
  - [ADR 0006: Use Turborepo](./0006-use-turborepo.md) — `turbo run test` in CI replaces the gate's test verification role.

- Impacted Components:
  - **Workflow** (`team-workflow.md`) — Lofi Gate reference removed from Definition of Done.
  - **Root config** (`lofi.toml`) — deprecated or removed.
  - **GEMINI.md** — `strict_tdd` decision updated.
