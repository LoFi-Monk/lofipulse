---
name: gh-projects
description: Manage GitHub Projects V2 items and metadata using GraphQL.
---

# GitHub Projects Skill

Automates interaction with GitHub Projects V2 using the GitHub CLI and GraphQL.

## HIGH-EFFICIENCY COMMANDS (Agent-First)

These commands are optimized for agents. Use the `--json` flag to suppress all ASCII tables and narration, returning only a minimal JSON object for parsing.

### 1. `create-epic` (Composite Command)

Atomically creates an issue, adds it to the board, and sets all mandatory metadata.

```bash
node .agent/skills/gh-projects/scripts/projects.js --create-epic "Title" \
  --priority P0 --size L --agent "Lead Developer" --json

# Output:
# {"success":true,"number":123,"url":"...","results":["..."],"errors":[]}
```

### 2. `blueprint` (Recursive Builder)

Generates an entire feature hierarchy (Epics -> Stories -> Tasks) in a single atomic call. Supports Markdown bodies and infinite nesting.

```bash
node .agent/skills/gh-projects/scripts/projects.js --blueprint '{
  "title": "Epic Title",
  "body": "Global objectives...",
  "priority": "P1",
  "size": "L",
  "agent": "CTO",
  "children": [
    {
      "title": "[LEAD DEV] Story 1",
      "body": "- [ ] Task 1.1\n- [ ] Task 1.2",
      "children": [
        { "title": "Sub-task 1.1.1", "body": "Details..." }
      ]
    }
  ]
}' --json

# Output:
# {"success":true,"rootId":124,"status":"Blueprint Executed"}
```

### 3. `read-tree`

Fetches the full hierarchy (Epic -> Stories -> Tasks) of an issue.

```bash
node .agent/skills/gh-projects/scripts/projects.js --read-tree 123 --json

# Output:
# {
#   "success": true,
#   "tree": {
#     "number": 123,
#     "title": "Epic",
#     "state": "open",
#     "body": "...",
#     "children": [
#       { "number": 124, "title": "Story", "state": "open", "body": "..." }
#     ]
#   }
# }
```

### 4. `--json` Flag

Available for all commands. Suppresses formatting and returns raw data.

```bash
node .agent/skills/gh-projects/scripts/projects.js --pulse --json
```

## AUTO-DISCOVERY

This skill automatically resolves the **Owner**, **Repository**, and **Project Number** based on the current workspace context. It assumes:

1.  The project is owned by the current user/org.
2.  The target GitHub Project title matches the repository name (e.g., repository `lofipulse` -> Project title `lofipulse`).

## COMMANDS

### 1. `pulse` (Human Only)

Fetches the current status of the board. Agents should prefer `--json` mode or atomic commands to save tokens.

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

### 7. `ship`

Creates a pull request for an issue.

```bash
node .agent/skills/gh-projects/scripts/projects.js --ship --issue 12 --title "Feat: Auth Logic" --json
```

**Optional Flags for `ship`:**

- `--reviewer <user>`: Request a review (Critical for visibility).
- `--label <label>`: Add classification (e.g., `automated-pr`).
- `--assignee <user>`: Assign ownership.

### 8. `list`

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
