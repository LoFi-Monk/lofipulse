---
created: 2026-02-11T14:25:00-06:00
modified: 2026-02-11T14:25:00-06:00
---

# 7. Use Biome for Formatting and Linting

- Status: Accepted
- Deciders: LoFi Monk, CTO (Agent)
- Tags: tooling code-quality developer-experience

## Context and Problem Statement

LofiPulse needs a single tool for code formatting and linting across all workspace packages. The traditional approach — ESLint for linting plus Prettier for formatting — requires maintaining two tools, two config files, and resolving conflicts between them. As a monorepo with Turborepo (ADR 0006) orchestrating tasks, every tool in the pipeline must be fast and simple to configure.

## Decision Drivers

- One tool, not two — eliminate the ESLint/Prettier config dance.
- Speed — formatting and linting run on every commit (Husky) and in CI.
- Monorepo-friendly — single root config with per-package overrides if needed.
- Zero runtime dependency — no Node.js plugins or peer dependency chains.
- $0 budget — fully open source.

## Considered Options

- **ESLint + Prettier** — industry standard, massive plugin ecosystem, two separate tools.
- **Biome** — unified Rust-based formatter and linter, single config, 25x faster than Prettier.
- **dprint + ESLint** — fast Rust formatter with ESLint for linting, still two tools.

## Decision Outcome

**Biome.** It replaces both ESLint and Prettier with a single binary. Formatting achieves 97% Prettier compatibility. Linting ships 340+ rules covering correctness, security, complexity, a11y, and style — no plugins required. Written in Rust, it runs ~25x faster than Prettier and ~15x faster than ESLint.

ESLint + Prettier was rejected: two tools with overlapping concerns, slower execution, and complex plugin dependency chains. Not justified for our codebase size.

dprint + ESLint was rejected: still requires managing two tools. Biome's integrated approach is simpler.

### Positive Consequences

- Single `biome.json` at root configures both formatting and linting for all workspace packages.
- Rust-native performance — fast enough to run on every save without lag.
- No plugin dependency management — rules ship with the binary.
- Integrates with Turborepo's `lint` pipeline for cached execution.
- VCS-aware — respects `.gitignore` out of the box.

### Negative Consequences

- Smaller rule ecosystem compared to ESLint's plugin marketplace. If niche rules are needed later, we'd need to supplement.
- Not 100% Prettier-compatible (97%) — minor edge cases in formatting may differ.

## Current Configuration

Already active at root as `biome.json` (v2.0.0):

- **Indent**: 2 spaces
- **Line width**: 100
- **Quotes**: single
- **Trailing commas**: all
- **Semicolons**: always
- **Lint rules**: recommended set enabled

## Architectural Context

- Referenced Architecture Document(s):
  - [ADR 0006: Use Turborepo](./0006-use-turborepo.md) — `turbo run lint` and `turbo run format` delegate to Biome.
  - [ADR 0004: Use pnpm](./0004-use-pnpm.md) — Biome installed as root devDependency via pnpm.

- Impacted Components:
  - **Workspace Root** — `biome.json` is the single source of truth for code style.
  - **CI Pipeline** — `turbo run lint` replaces any `eslint` invocations.
  - **Developer Experience** — VS Code Biome extension replaces ESLint + Prettier extensions.
