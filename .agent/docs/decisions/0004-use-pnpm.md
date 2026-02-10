# 4. Use pnpm

Date: 2026-02-09

## Status

Accepted

## Context

The project requires a package manager for Node.js dependencies. We currently have an inconsistency where `npm` is used in CI but `pnpm` is referenced in architecture documentation.
As we move towards a monorepo structure (Issue #2), we need a tool that handles workspaces efficiently and deterministically.
`npm` can be slower and uses more disk space due to flattened dependencies.

## Decision

We will standardize on **pnpm** (Performant npm) for all dependency management.

## Consequences

### Positive

- **Performance:** `pnpm` is significantly faster than `npm` or `yarn`.
- **Disk Space:** Uses a content-addressable store, saving disk space.
- **Monorepo Support:** Excellent built-in support for workspaces (essential for Issue #2).
- **Strictness:** Prevents phantom dependencies (unlike `npm`), forcing cleaner dependency declarations.

### Negative

- **Tooling:** Developers must install `pnpm` (`npm install -g pnpm` or `corepack enable`).
- **CI Updates:** GitHub Actions must be updated to use `pnpm/action-setup` and `pnpm install`.

## Compliance

- All `package.json` scripts should assume `pnpm`.
- CI workflows must use `pnpm`.
- Documentation should reference `pnpm` commands.
