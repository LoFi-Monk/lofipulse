---
trigger: model_decision
description: when i ask for information or documentation for a library/API, remote codebase, github repo, npm package or anything like these examples.
---

# Deeper Understanding

Always use MCP tools when I need library/API documentation, code generation, setup or configuration steps without me having to explicitly ask.

## deepwiki

Try deepwiki first. it has a deeper analysis use it for asking questions:

1. Synthesized Answers: Text summaries based on the documentation.
2. Citations: Links to specific Wiki pages (e.g., [Agent System](/wiki/...)).
3. Source Links: Sometimes links to the source files if the wiki explicitly references them.

- You can ask Multiple questions.
- You can follow citation links to find out more information when necessary.
- You can follow source links when necessary.

## Context7

Use context7 as a fall back if deepwiki is not enough or fails. for uptodate access to documentation for library/API

# Troubleshooting

**PROTOCOL**

1. **Consult runbooks:** `.agent/docs/runbooks`. Proceed if further assistance is required.
2. **look up documentation:** using deepwiki or Context7. Proceed if further assistance is required.
3. If **ALL** previous steps fail: use websearch tool to look for answers.
