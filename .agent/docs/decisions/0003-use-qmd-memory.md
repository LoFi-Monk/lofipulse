---
status: Approved
date: 2026-02-08
decision-makers: [LofiMonk, CTO Persona]
consulted: [DeepWiki Research]
---

# 3. Use QMD for Agent Memory

## Context and Problem Statement

Agents need a "Long Term Memory" to recall facts, file contents, and past instructions across sessions.
Standard solutions (Pinecone, Weaviate) are "Heavy" and cloud-dependent.
Simple solutions (JSON files) scale poorly and lack semantic search.

We need a solution that is:

1.  **Local First:** Runs inside the Agent's container/process.
2.  **Hybrid Search:** Supports both Keywords (BM25) and Meaning (Vector).
3.  **Low Friction:** Minimal setup for new agents.

## Considered Options

- **SQLite + Vector Extension**:
  - _Pros:_ Single file.
  - _Cons:_ Managing embeddings manually in Node.js is tedious.
- **External Vector DB (Chroma/Weaviate)**:
  - _Pros:_ Powerful.
  - _Cons:_ Requires running a separate Docker service. Overkill for "Lofi" agents.
- **QMD (`tobi/qmd`)**:
  - _Pros:_ **Batteries Included.** Handles RAG pipeline (Ingest -> Chunk -> Embed -> Search) locally. Built on Bun/TypeScript.
  - _Cons:_ Newer tool.

## Decision Outcome

Chosen option: **QMD**, used **Directly** (via CLI or Library) by the Agent.

### Positive Consequences

- **Individual Memory:** Each Agent has its own QMD index (just a folder).
- **Performance:** High-quality retrieval without cloud latency or costs.
- **Simplicity:** No need to run a separate "Database Server" for the agent.

### Negative Consequences

- **Dependency:** Requires installing `qmd` in the environment.

## Links

- [QMD Repo](https://github.com/tobi/qmd)
