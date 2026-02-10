---
status: Approved
date: 2026-02-08
decision-makers: [LofiMonk, CTO Persona]
consulted: [DeepWiki Research]
---

# 2. Use Pi SDK for the Agent Kernel

## Context and Problem Statement

We need a library to power the "Brain" of our agents (`apps/engine`).
This library needs to handle:

1.  **Context Management:** Automatically shrinking chat history to fit token limits.
2.  **Tooling:** Providing safe access to the filesystem and terminal.
3.  **Harness Logic:** The "Loop" of thinking and acting.

We are building a **Node.js** system (LofiPulse) to run on Windows/WSL.

## Considered Options

- **LangChain.js**: The "Standard" general-purpose framework.
  - _Pros:_ Massive ecosystem, supports every LLM.
  - _Cons:_ "Assembly required." No pre-built "Coding Agent" suitable for our use case. We would have to write the FileSystem/Terminal tools and context compaction logic from scratch.
- **Vercel AI SDK**: The "Modern" web framework.
  - _Pros:_ Excellent streaming UI support.
  - _Cons:_ Designed for _Browsers_, not _Agents_. Has no concept of a persistent filesystem or terminal session.
- **Pi SDK (`@mariozechner/pi-coding-agent`)**: A specialized "Kernel" for coding agents.
  - _Pros:_ **Batteries Included.** Comes with `read`, `write`, `edit`, and `bash` tools. Has built-in context compaction optimized for coding. Native Node.js.
  - _Cons:_ Smaller community than LangChain.

## Decision Outcome

Chosen option: **Pi SDK**, because it is the only Node.js library that provides a "Turnkey" coding agent harness out of the box.

### Positive Consequences

- **Speed to MVP:** We don't have to write the "Plumbing" (Token counting, JSON parsing, Tool definitions).
- **Quality:** The "Edit" tool (diff-based) is already tuned for coding tasks.
- **Focus:** Allows us to focus on the "Body" (Incus) and "Shepherd" (Dashboard) rather than the "Brain" internals.

### Negative Consequences

- **Dependency:** We are relying on a smaller, specific library. If it is abandoned, we may need to fork it or migrate to LangChain later.

## Links

- [Pi SDK Research](../plans/incus-research.md) (Implicit in early research)
