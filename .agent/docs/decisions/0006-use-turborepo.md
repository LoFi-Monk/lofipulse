---
created: 2026-02-11T12:52:00-06:00
modified: 2026-02-11T13:01:00-06:00
---

# 6. Use Turborepo as Monorepo Task Runner

- Status: Accepted
- Deciders: LoFi Monk, CTO (Agent)
- Tags: architecture monorepo build-system

## Context and Problem Statement

LofiPulse uses a `pnpm` workspace monorepo (ADR 0004). `pnpm` handles dependency resolution and workspace linking, but provides no task caching, orchestration, or container-optimized builds. As packages grow, raw `pnpm -r` commands will not scale.

We need a **task runner** that layers on top of `pnpm` to handle build/test/lint orchestration, caching, and Docker image optimization for our Incus deployment target.

## Decision Drivers

- Team is new to monorepos — low cognitive overhead is essential.
- Agents deploy as Incus/Docker containers — lean, pruned image builds are critical.
- $0 budget — no paid cloud dependencies.
- Must complement `pnpm`, not replace it.
- Repo has < 5 packages — enterprise-scale tooling is unnecessary.

## Considered Options

- **Raw pnpm workspaces** — no task runner, manual `pnpm -r` scripts.
- **Turborepo** — lightweight task runner with caching, layered on pnpm workspaces.
- **Nx** — full build platform with plugin system, code generators, and graph visualization.

## Decision Outcome

**Turborepo.** It gives us caching and task orchestration with a single `turbo.json` file. Its `turbo prune` command produces minimal workspace subsets purpose-built for Docker multi-stage builds — directly serving our Incus deployment model.

Nx was rejected: its plugin system, code generators, and configuration weight are designed for large multi-team repos. That overhead is not justified at our scale.

Raw pnpm was rejected: no caching means every CI run rebuilds everything. That cost grows with every package we add.

> **Relationship to pnpm (ADR 0004):** Turborepo is NOT a package manager. `pnpm` still owns dependency installation, workspace linking, and version resolution. Turborepo sits above it as the orchestration layer. Both are required.

### Positive Consequences

- Local and optional remote caching — no task runs twice with the same inputs.
- Declarative task pipelines via `turbo.json`.
- `turbo prune` generates minimal workspace subsets for lean Docker images.
- Zero disruption to existing `pnpm` setup — `package.json`, `pnpm-workspace.yaml`, and lockfile are untouched.

### Negative Consequences

- Basic code generation compared to Nx plugin generators.
- No built-in module boundary enforcement — would require additional tooling (e.g., ESLint boundaries plugin) if needed later.

## Architectural Context

- Referenced Architecture Document(s):
  - [001-system-metaphor.md](../architecture/001-system-metaphor.md) — "The Body" (container) requires optimized image builds.
  - [ADR 0004: Use pnpm](./0004-use-pnpm.md) — Turborepo layers on top of the pnpm decision.

- Impacted Components:
  - **Workspace Root** — `turbo.json` added, root `package.json` gains `turbo` devDependency.
  - **CI Pipeline** (`.github/workflows`) — tasks switch from `pnpm -r test` to `turbo run test`.
  - **Docker builds** — Dockerfiles will use `turbo prune` for optimized multi-stage builds.
