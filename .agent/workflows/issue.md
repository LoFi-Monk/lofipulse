---
description: Activate an agent for a specific GitHub Issue.
---

// turbo-all

1. Read the GitHub Issue using `gh issue view [ISSUE_ID]`.
2. Extract the `Assigned Persona` from the body.
3. Map the persona name to a file in `.agent/personas/`.
4. Run `code2prompt` with the issue content as the primary instruction to generate `.agent/current-issue.md`.
5. Update the Kanban board to move the item to `in-progress`.
6. Output the handoff link:
   ```
   ***
   [[Start Session Handoff]](file:///c:/ag-workspace/lofipulse/.agent/current-issue.md)
   ```
