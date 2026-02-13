---
name: gh-pr-conversation-resolver
description: Automates reading, replying to, and resolving GitHub Pull Request review threads.
---

# GH PR Conversation Resolver

This skill helps you manage Pull Request reviews efficiently by identifying unresolved conversations, replying to them, and marking them as resolved.

## Usage

### 1. List Unresolved Conversations

View all open threads for the current PR (or a specific PR).

```bash
node .agent/skills/gh-pr-conversation-resolver/scripts/resolve.js --list
# To specify a PR number
node .agent/skills/gh-pr-conversation-resolver/scripts/resolve.js --list --pr 7
```

### 2. Resolve a specific thread

Once you have addressed the feedback, mark the thread as resolved.

```bash
node .agent/skills/gh-pr-conversation-resolver/scripts/resolve.js --resolve PRRT_...
```

### 3. Reply and Resolve

Reply to the reviewer and resolve the thread in one go.

```bash
node .agent/skills/gh-pr-conversation-resolver/scripts/resolve.js --reply "Fixed in 5b9be6d." --resolve PRRT_...
```

### 4. Review All (Batch Scan)

> [!TIP]
> **Use this command to process all threads in a single execution.**
> It categorizes threads as BUG, SUGGESTION, or ANALYSIS, auto-resolves confirmations, and reports only actionable items.

```bash
node .agent/skills/gh-pr-conversation-resolver/scripts/resolve.js --review-all
```

### 5. Apply a Suggestion

Applies the `suggestion` block from the thread's first comment to the local file.

````bash
```bash
node .agent/skills/gh-pr-conversation-resolver/scripts/resolve.js --apply "THREAD_ID"
````

## Agent Strategy for Devin Reviews

This skill is optimized for "Agent-First" high-efficiency review cycles.

1.  **Read All Threads**: Use `--list --json` to get a machine-readable list of all unresolved threads, including 10 lines of code context for each.
    ```bash
    node resolve.js --list --json
    ```
2.  **Analyze Context**: Compare the `code_snippet` in the JSON with the comment body to understand the required fix.
3.  **Construct Batch Plan**: Group multiple fixes into a single JSON array for the `--batch` command.
    ```json
    [
      {
        "id": "PRRT_1",
        "applySuggestion": true,
        "reply": "Applied.",
        "resolve": true
      },
      { "id": "PRRT_2", "reply": "I'll fix this manually.", "resolve": false }
    ]
    ```
4.  **Execute**: Run the batch action atomically.
    ```bash
    node resolve.js --batch '[...]' --json
    ```

### 6. Resolution Plan (High-Efficiency Workflow)

Generate a JSON artifact to view and manage all threads in a single pass.

```bash
# 1. Export the plan
node .agent/skills/gh-pr-conversation-resolver/scripts/resolve.js --plan

# 2. View and edit review_temp/resolution_plan.json
# Set "proposed_action": "resolve" or "reply-and-resolve" (and optional "reply_body")

# 3. Apply the plan (always use --dry-run first!)
node .agent/skills/gh-pr-conversation-resolver/scripts/resolve.js --apply-plan review_temp/resolution_plan.json --dry-run

# 4. If all looks correct, execute:
node .agent/skills/gh-pr-conversation-resolver/scripts/resolve.js --apply-plan review_temp/resolution_plan.json
```

### 7. Visibility & Filtering

Filter threads to focus on specific reviewers or categories.

```bash
node .agent/skills/gh-pr-conversation-resolver/scripts/resolve.js --list --author Name --category BUG
```

### 8. Cleanup & Archiving

Move the `review_temp` directory to a timestamped archive. Run this only after the PR is successfully merged.

```bash
node .agent/skills/gh-pr-conversation-resolver/scripts/resolve.js --cleanup
```

## Reference: CLI Flags

| Flag            | Argument | Description                                                          |
| :-------------- | :------- | :------------------------------------------------------------------- |
| `--pr`          | `NUMBER` | Pull Request number (auto-detected if omitted).                      |
| `--list`        | -        | List threads (unresolved by default).                                |
| `--plan`        | -        | Export all threads to `review_temp/resolution_plan.json`.            |
| `--apply-plan`  | `PATH`   | Execute actions defined in the JSON plan.                            |
| `--dry-run`     | -        | Print actions without executing mutations (use with `--apply-plan`). |
| `--all`         | -        | Include resolved threads in list/plan (Deep Scan).                   |
| `--author`      | `NAME`   | Filter by author login (e.g., `devin-ai-integration`).               |
| `--category`    | `CAT`    | Filter by `BUG`, `SUGGESTION`, or `ANALYSIS`.                        |
| `--cleanup`     | -        | Archive the `review_temp` directory.                                 |
| `--review-all`  | -        | Batch review: categorize and auto-resolve analysis.                  |
| `--apply`       | `ID`     | Apply a suggestion block from a thread.                              |
| `--resolve`     | `ID`     | Resolve a specific thread.                                           |
| `--reply`       | `TEXT`   | Reply text (use with `--resolve` or `--thread`).                     |
| `--thread`      | `ID`     | Focus standard operations on a specific thread.                      |
| `--resolve-all` | -        | Resolve ALL unresolved threads.                                      |

> [!IMPORTANT]
>
> - `--plan` and `--apply-plan` use file paths relative to the current working directory.
> - `--apply-plan` is a destructive batch operation. **Always** run with `--dry-run` first to verify the intended actions.
> - `--cleanup` **archives** your review data rather than deleting it. Do not run it until your PR is closed or merged.

## Dependencies

- `gh` CLI (authenticated)
- Node.js
