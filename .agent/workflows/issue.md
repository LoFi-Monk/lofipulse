---
description: Activate an agent for a specific GitHub Issue (Hydrate Context).
---

# Workflow: Activate Issue

Follow this workflow to pick up a task.

## 1. Protocol Check (The Gate)

1.  **Fetch Metadata:**
    ```bash
    gh issue view [ISSUE_ID] --json number,title,state,projectItems
    ```
2.  **Verify State:**
    - Check the `Status` field in `projectItems`.
    - **CRITICAL:** If `Backlog` -> 🛑 **STOP**. Notify the user.
    - If `Ready` -> ✅ **PROCEED**.
3.  **Verify Persona:**
    - Check the `Agent` field.
    - Ensure you are ready to adopt this Persona.

## 2. Activation (The Move)

1.  **Set Status:**
    ```bash
    node .agent/skills/gh-projects/scripts/projects.js --set --issue [ISSUE_ID] --field "Status" --value "In Progress"
    ```
2.  **Assign Self:**
    ```bash
    gh issue edit [ISSUE_ID] --add-assignee "@me"
    ```

## 3. Contextualization (The Build)

1.  **Generate Context:**
    Run `code2prompt` to create `.agent/current-issue.md`.
    (Use the `code2prompt` skill instructions).

2.  **Read Context:**
    View the generated file to load it into your context window.

## 4. Execution Handoff

1.  **Switch Persona:**
    Adhere to the `Agent` persona defined in the issue.
2.  **Start Work:**
    Begin the "In Progress" phase (Create Branch -> Code).
