---
created: 2026-02-10T01:45:00-06:00
modified: 2026-02-10T01:45:00-06:00
---

# 5. Use GitHub GraphQL API for Project Management

- Status: Accepted
- Deciders: Lead Developer
- Tags: architecture github graphql automation

## Context and Problem Statement

We need a way for AI agents to interact with GitHub Projects V2 to maintain a 'Source of Truth'. Our current local Mermaid Kanban is manual and prone to sync issues. How should the agent retrieve and update project data (Status, Priority, Assignments) efficiently and reliably?

## Decision Drivers

- **Determinism:** Agents need structured JSON data, not human-readable terminal tables.
- **Efficiency:** Minimize API calls (avoid N+1 problems when fetching custom fields).
- **Scalability:** Handle large project boards with pagination.
- **Zero-Install:** Avoid forcing users to install third-party `gh` extensions.

## Considered Options

1. **GitHub CLI (`gh project` commands):** Native but limited in JSON output for specific custom field values without complex piping and multiple calls.
2. **Third-party `gh` Extensions:** (e.g., `heaths/gh-projects`). Easier to use but introduces external dependencies and potential breaking changes in output formatting.
3. **GitHub GraphQL API (v4):** Direct access to the underlying data model.

## Decision Outcome

Chosen option: **GitHub GraphQL API (v4)** via the `gh api graphql` command.

This option is chosen because it allows for a single, batch query to retrieve all necessary fields (including custom fields like Priority and Size) in a structured JSON format that is natively digestible by AI agents. It eliminates the need for external extensions while providing the most robust and performant interface.

### Positive Consequences

- **Single Query Hydration:** The entire project state can be fetched in one request.
- **Strict Schema:** GraphQL's typed schema ensures predictable responses.
- **No Extra Dependencies:** Relies only on the standard GitHub CLI.

### Negative Consequences

- **Complexity:** Writing and maintaining GraphQL queries is more difficult than basic CLI commands.

## Architectural Context

- Referenced Architecture Document(s):
  - [System Metaphor: The Shepherd (Control Plane)](file:///c:/ag-workspace/lofipulse/.agent/docs/architecture/001-system-metaphor.md)

- Impacted Components:
  - `.agent/skills/gh-projects`
  - `.agent/workflows/pulse`
