---
name: github-projects
description: Manage GitHub Projects V2 items and metadata using GraphQL.
---

# GitHub Projects Skill

Automates interaction with GitHub Projects V2 to ensure the agent is working from the current source of truth.

## PREREQUISITES

- GitHub CLI (`gh`) installed and authenticated.
- Access to the target repository and project board.

## COMMANDS

### 1. `pulse`

Fetches the current status of the project board.

```powershell
pwsh -File .agent/skills/github-projects/pulse.ps1
```

### 2. `move`

Updates the 'Status' of an issue or pull request.
_(Planned implementation: uses `updateProjectV2ItemFieldValue` mutation)_

### 3. `hydrate`

Bulk updates metadata (Priority, Size, Estimates).
_(Planned implementation)_

## USAGE RULES

1. **Always `pulse` first:** Before starting work, run `pulse` to see your assigned tasks and their current status.
2. **Atomic Updates:** Only one status change per command.
3. **No Local Sync:** Do NOT attempt to manually update local Mermaid diagrams. Use this skill as the primary dashboard.
