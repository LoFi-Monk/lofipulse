---
name: code2prompt
description: Generate a comprehensive context file of the codebase for LLM consumption using a specific template.
---

# Code2Prompt Skill

> **Target:** `.agent/current-issue.md`
> **Purpose:** Create a single, up-to-date snapshot of the project structure and content to "hydrate" issue descriptions or agent context, using the `default-task.hbs` template.

## Prerequisites

- **Tool:** `code2prompt` must be installed and available in the PATH.
- **Template:** `.agent/skills/code2prompt/resources/templates/default-task.hbs`

## Workflow

1.  **Check Installation:** Verify `code2prompt --version` works. If it doesn't, install it.(`cargo install code2prompt `)
2.  **Generate Context:** Run the command to overwrite the issue context file.
3.  **Use Context:** Read the generated Markdown to paste into Issues or analysis.

## Commands

### Windows (PowerShell)

```powershell
code2prompt . --template .agent/skills/code2prompt/resources/templates/default-task.hbs --output-file .agent/current-issue.md
```

### Interactive Inputs

The default template (`default-task.hbs`) will prompt you for:

- **`gh_issue_number`**: The GitHub Issue Number (e.g., `123`).
- **`persona_path`**: Relative path to the persona file (e.g., `.agent/personas/lead-developer.md`).
- **`instructions_from_pm`**: Specific instructions for the agent.

## create custom templates

1.  **Templates Location:** `.agent/skills/code2prompt/resources/templates/`
2.  **How to make a template:** `.agent\skills\code2prompt\resources\Learn-templates-code2prompt.md`
3.  **When to use:** Special cases that the default just doesn't cover when assigning an issue to a team member.

## Rules

1.  **Overwrite Always:** We want the _current_ state. Always overwrite.
2.  **sanitize:** Ensure secrets (env files) are excluded (handled by `.gitignore` usually).
3.  **Output Location:** Always output to `.agent/current-issue.md`.
