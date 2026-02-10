---
name: gh-projects
description: Manage GitHub Projects V2 items and metadata using GraphQL.
---

# GitHub Projects Skill

Automates interaction with GitHub Projects V2 using the GitHub CLI and GraphQL.

## AUTO-DISCOVERY

This skill automatically resolves the **Owner**, **Repository**, and **Project Number** based on the current workspace context. It assumes:

1.  The project is owned by the current user/org.
2.  The target GitHub Project title matches the repository name (e.g., repository `lofipulse` -> Project title `lofipulse`).

## COMMANDS

### 1. `pulse`

Fetches the current status of the board.

```powershell
pwsh -File .agent/skills/gh-projects/scripts/pulse.ps1
```

### 2. `add`

Adds an issue or PR to the project.

```powershell
pwsh -File .agent/skills/gh-projects/scripts/add-item.ps1 -IssueNumber [ID]
```

### 3. `set`

Updates board fields (Status, Priority, Size).

```powershell
# Update Status
pwsh -File .agent/skills/gh-projects/scripts/set-field.ps1 -IssueNumber [ID] -FieldName "Status" -Value "In progress"

# Update Priority (P0, P1, P2)
pwsh -File .agent/skills/gh-projects/scripts/set-field.ps1 -IssueNumber [ID] -FieldName "Priority" -Value "P1"
```

### 4. `link-child`

Natively links a child issue to a parent issue.

```powershell
pwsh -File .agent/skills/gh-projects/scripts/add-sub-issue.ps1 -ParentIssueNumber [PID] -ChildIssueNumber [CID]
```

## MANDATORY METADATA

Every Issue (Epic or Story) MUST have the following 5 fields populated:

1.  **Assignee**: Always `@me` (via `gh issue create`).
2.  **Labels**: Required (e.g., `chore`, `feat`, `bug`).
3.  **Priority**: `P0` (Critical), `P1` (High), `P2` (Normal).
4.  **Size**: `XS`, `S`, `M`, `L`, `XL`.
5.  **Agent**: The Persona responsible for execution.
    - Options: `CTO`, `Creative Director`, `Lead Developer`, `QA Engineer`, `Librarian`

### Setting the Agent

```powershell
pwsh -File .agent/skills/gh-projects/scripts/set-field.ps1 -IssueNumber [ID] -FieldName "Agent" -Value "Lead Developer"
```

## THE WORKFLOW (HIERARCHY)

All work follows the **Epic/Story/Task Hierarchy**.

1.  **Epic (Parent Issue):** The professional technical objective.
    - **Board Entity:** The only ID present on the GitHub Project board.
    - **Content**: MUST contain the **EARS-compliant requirements** (What/Why).
    - **Exclusions**: Do NOT include personas, granular task lists, or implementation tests here.
    - **Sync:** Automatically tracks progress of child Stories.

2.  **Story (Child Issue):** The atomic prompt for an agent.
    - **Content**:
      - **Assigned Persona**: Explicit role (e.g., `[LEAD DEV]`).
      - **Expected Tests**: The "Definition of Done" for this specific prompt.
      - **Task List**: Granular checklist (`- [ ]`) for the agent to follow.
    - **Isolation:** Linked natively as a Sub-issue. It does NOT appear on the board.

---

## PROJECT MANAGER PROTOCOL

- **Decomposition:** Split all features into Parent (Job) and Child (Phase) structures.
- **Relational Integrity:** Every child MUST be linked to its parent via `add-sub-issue.ps1`.
- **Board Enrollment:** Only the Parent ID is added to the board via `add-item.ps1`.

---

## AGENT PROTOCOL

- **Execution:** Your task is defined by the Child Issue ID provided to you.
- **Inheritance:** Consult the Parent Issue for global constraints.
- **Closing:** Close the Child Issue immediately upon completion of the atomic phase.
