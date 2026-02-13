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

Output format:

```text
[ID: PRRT_...] (Unresolved)
Author: devin-ai-integration
Body: "Comments here..."
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

### 4. Review All (Recommended for batch processing)

> [!TIP]
> **Use this command to process all threads in a single execution.**
> It categorizes threads as BUG, SUGGESTION, or ANALYSIS, auto-resolves confirmations, and reports only actionable items.

```bash
node .agent/skills/gh-pr-conversation-resolver/scripts/resolve.js --review-all --pr 16
```

### 5. Resolve All (Use with Caution and only when explicitly asked by the user)

> [!CAUTION]
> **DANGEROUS OPERATION.**
> This command will resolve ALL threads in the PR, including those you may not have read.
> **ONLY** use this if explicitly requested by the user.

Bulk resolve all open threads (e.g., after a major refactor or when all feedback is addressed).

```bash
node .agent/skills/gh-pr-conversation-resolver/scripts/resolve.js --resolve-all
```

### 6. Apply a Suggestion

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

## Dependencies

- `gh` CLI (authenticated)
- Node.js
