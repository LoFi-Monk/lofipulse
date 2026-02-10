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
python .agent/skills/gh-pr-conversation-resolver/scripts/resolve.py --list
# To specify a PR number
python .agent/skills/gh-pr-conversation-resolver/scripts/resolve.py --list --pr 7
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
python .agent/skills/gh-pr-conversation-resolver/scripts/resolve.py --resolve PRRT_...
```

### 3. Reply and Resolve

Reply to the reviewer and resolve the thread in one go.

```bash
python .agent/skills/gh-pr-conversation-resolver/scripts/resolve.py --reply "Fixed in 5b9be6d." --resolve PRRT_...
```

### 4. Resolve All (Use with Caution and only when explicitly asked by the user)

**CRITICAL:** ONLY USE THIS IF THE USER SPECIFICALLY ASKS TO RESOLVE ALL THREADS.
DO NOT USE THIS UNLESS SPECIFICALLY ASKED BY THE USER.

Bulk resolve all open threads (e.g., after a major refactor or when all feedback is addressed).

```bash
python .agent/skills/gh-pr-conversation-resolver/scripts/resolve.py --resolve-all
```

## Dependencies

- `gh` CLI (authenticated)
- Python 3
