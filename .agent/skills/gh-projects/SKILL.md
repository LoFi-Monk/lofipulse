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

```bash
node .agent/skills/gh-projects/scripts/projects.js --pulse
# Output:
# ID  Title                           Status       Priority  Labels
# --  ------------------------------  -----------  --------  -----------
# 12  Spike: Advanced GitHub Proj...  In progress            enhancement
#  2  chore: Monorepo Foundation      Backlog
```

### 2. `add`

Adds an issue or PR to the project.

```bash
node .agent/skills/gh-projects/scripts/projects.js --add 5
```

### 4. `groom`

Sets all mandatory metadata for an issue in one command. Auto-creates labels if they don't exist.

```bash
node .agent/skills/gh-projects/scripts/projects.js --groom --issue 3 \
  --priority P2 --size M --agent "Lead Developer" --label feat --status "In progress"

# Output:
# --- Groom Report: Issue #3 ---
# Set:
#   + Assignee: @me
#   + Label: feat
#   + Priority: P2
#   + Size: M
#   + Agent: Lead Developer
# All metadata set successfully.
```

All flags are optional — only pass what you want to set. Assignee is always set to `@me`.

### 5. `set`

Updates board fields (Status, Priority, Size, Agent).

```bash
# Update Status
node .agent/skills/gh-projects/scripts/projects.js --set --issue 5 --field "Status" --value "In progress"

# Update Priority (P0, P1, P2)
node .agent/skills/gh-projects/scripts/projects.js --set --issue 5 --field "Priority" --value "P1"

# Set Agent
node .agent/skills/gh-projects/scripts/projects.js --set --issue 5 --field "Agent" --value "Lead Developer"
```

### 6. `link-child`

Natively links a child issue to a parent issue.

```bash
node .agent/skills/gh-projects/scripts/projects.js --link-child --parent 2 --child 13
```

### 7. `list`

Lists all projects for the current owner.

```bash
node .agent/skills/gh-projects/scripts/projects.js --list
```

## MANDATORY METADATA

Every Issue (Epic or Story) MUST have the following 5 fields populated:

1.  **Assignee**: Always `@me` (via `gh issue create`).
2.  **Labels**: Required (e.g., `chore`, `feat`, `bug`).
3.  **Priority**: `P0` (Critical), `P1` (High), `P2` (Normal).
4.  **Size**: `XS`, `S`, `M`, `L`, `XL`.
5.  **Agent**: The Persona responsible for execution.
    - Options: `CTO`, `Creative Director`, `Lead Developer`, `QA Engineer`, `Librarian`

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
- **Relational Integrity:** Every child MUST be linked to its parent via `--link-child`.
- **Board Enrollment:** Only the Parent ID is added to the board via `--add`.

---

## AGENT PROTOCOL

- **Execution:** Your task is defined by the Child Issue ID provided to you.
- **Inheritance:** Consult the Parent Issue for global constraints.
- **Closing:** Close the Child Issue immediately upon completion of the atomic phase.

## DEPENDENCIES

- `gh` CLI (authenticated)
- Node.js
