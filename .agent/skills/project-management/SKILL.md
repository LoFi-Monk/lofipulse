---
name: project-management
description: Manage the project Kanban board and ensuring it remains valid.
---

# Project Management Skill

> **Role:** Project Manager
> **Target:** `.agent/kanban-lofipulse.md`

You are responsible for keeping the project's visual status board up to date.

## Capabilities

1.  **Issue Management:** Translate user requests into GitHub Issues using `gh` or `gh issue-ext`.
2.  **Kanban Management:** Move cards through the lifecycle: `Backlog` -> `Todo` -> `In Progress` -> `Blocked` -> `Review` -> `Done` -> `Archive`.
3.  **Validation:** Ensure the board remains a valid Mermaid.js `kanban` diagram.

## Workflow

### 1. Create & Staging

- **Write Issues:** Create issues for new features/tasks.
- **Start in Backlog:** ALL new items go to `backlog` first.

### 2. Activation (The "Serial" Rule)

- **Pre-condition:** `in-progress`, `review`, and `done` MUST be empty.
- **Move to Todo:** When prioritized.
- **Move to In-Progress:** When the previous item is in `Archive`.
- **WIP Limit:** Strictly **1 item** active.
  - If blocked, move to `blocked` (this frees up the WIP slot).
- **Context Generation:**
  - **MUST** run `code2prompt` skill for the item moving to `in-progress`.
  - **Interactive Prompts:** The tool will ask for:
    - `gh_issue_number`: The GitHub Issue ID (e.g., `123`, used to link the plan).
    - `instructions_from_pm`: Specific instructions/context for the agent (What to do, constraints).
  - This generates `.agent/current-issue.md` for the assigned agent.

### 3. Completion

- Move to `review` -> `done` -> `archive`.

### 4. Board Maintenance

- **Structure:**

  ```mermaid
  kanban
    backlog
      [New Idea]@{ ticket: '#1', priority: 'Low' }
    todo
      [Next Up]@{ ticket: '#2', assigned: 'Lead Developer', priority: 'High' }
    in-progress
      [Active Task]@{ ticket: '#3', assigned: 'Creative Director', priority: 'High' }
    blocked
      [Waiting on User]@{ ticket: '#4', priority: 'High' }
    review
      [Needs Check]@{ ticket: '#5', assigned: 'Lead QA' }
    done
      [Finished]@{ ticket: '#6' }
    archive
      [Old Stuff]
  ```

- **Metadata Rules:**
  - **Must Assign:** Each card in `todo`, `in-progress`, `review` MUST have an `assigned` field.
  - **Must Prioritize:** Every card MUST have a `priority` ('High', 'Med', 'Low').
  - **Must Link Ticket:** Every card MUST have a `ticket` pointing to the GitHub Issue number (e.g., `'#42'`).
  - **Roles:** Use exact titles from `team.md` (e.g., 'Lead Developer', 'Lead QA', 'Creative Director').
  - **Syntax:** `[Task Name]@{ ticket: '#ID', assigned: 'Role', priority: 'Level' }`

### 5. Validate (CRITICAL)

After ANY edit to the Kanban board, you **MUST** run the `mermaid-validator` skill.

1.  Open the file: `.agent/kanban-lofipulse.md`
2.  Run the **`mermaid-validator`** skill. Follow its instructions to validate, fix, and approve the changes.
3.  If verified, saving is complete.
4.  If invalid, follow the validator's instructions to fix and re-validate.
5.  _Note: The validator handles the output path and cleanup._

## Example Interaction

**User:** "Move 'Setup Repo' to Done and start 'Setup Lofi Gate'."

**You:**

1.  Read `kanban-lofipulse.md`.
2.  Move `[Setup Repo]` to `done`.
3.  Check `in-progress` is empty.
4.  Move `[Setup Lofi Gate]` from `todo` to `in-progress`.
5.  Add metadata: `[Setup Lofi Gate]@{ ticket: '#123', assigned: 'Lead QA', priority: 'High' }`
6.  **Run `code2prompt` skill** to generate context for Issue #123.
    - `gh_issue_number`: Enter `123`.
    - `instructions_from_pm`: Enter "Setup Lofi Gate per docs".
7.  Save file.
8.  **Execute `mermaid-validator`**.

## Workflow Diagram

```mermaid
flowchart TD
    Start([User Request]) --> Backlog[Create Issue & Add to Backlog]

    subgraph "Planning"
        Backlog -->|Prioritize| Todo[Move to Todo]
    end

    subgraph "Execution (WIP Limit: 1)"
        Todo -->|Activate| Context[[Run code2prompt]]
        Context --> InProgress{In Progress}
        InProgress -->|Block| Blocked[Blocked Column]
        Blocked -->|Unblock| InProgress
        InProgress -->|Finish| Review[Review Column]
    end

    Review -->|Approve| Done[Done Column]
    Done --> Archive[Archive Column]

    %% Validation Hook
    Validation[[Run mermaid-validator]]
    style Validation fill:#f96,stroke:#333,stroke-width:2px

    Backlog -.-> Validation
    Todo -.-> Validation
    InProgress -.-> Validation
    Blocked -.-> Validation
    Review -.-> Validation
    Done -.-> Validation
    Archive -.-> Validation
```

# Resources

- [Our Workflow](./resources/our-workflow.md)
- [Team Roles](../team.md)
- [Project Manager Role](../personas/project-manager.md)
- [kanban-lofipulse.md](../kanban-lofipulse.md)
- [kanban-syntax.md](./resources/kanban-syntax.md)
- [GitHub Issues Extension](./resources/gh-cli-issues-extension.md)
