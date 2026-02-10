---
description: starting a session
---

// turbo-all

# Session Start

**CRITICAL: Project Context**

1. Understand the project
   - Read the latest documents in `.agent/docs` to get up to speed.
   - Focus on architecture, ADRs, runbooks, specs, and any recent updates.

2. Read `./GEMINI.md`
   - Review all artifact files left by the previous agent.
   - Take note of any incomplete tasks, decisions, or context markers.

3. Check the current state of the code
   - **Closed PRs:**
     - Run `gh pr list --state closed` to list recently closed PRs.
     - Read the last 2 closed PRs to understand recent changes, decisions, and dev log notes.
   - **Open PRs:**
     - Run `gh pr list` to see open PRs.
     - Ask the user: “Do you want me to review any of these open PRs?”
   - **Local changes:**
     - Run `git status --porcelain` to see uncommitted local changes.
     - Note any changes that may conflict with the branch or open PRs.

4. Report back to the user
   - Summarize your findings, including:
     - Project status
     - Recent changes from closed PRs
     - Open PRs requiring attention
     - Local uncommitted changes
   - Ask the user for instructions on next steps.
