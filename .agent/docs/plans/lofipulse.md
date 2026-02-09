# Lofipulse: MVP Definition
> **Goal:** A Simple, Safe Agent Runner (Headless).

## The Core
- **Engine:** `pi-coding-agent` SDK (Node.js).
- **Environment:** Docker Dev Container (Ubuntu + Node.js).
- **Interface:** Headless TUI (via `pi-tui`).

## Functionality (MVP)
1.  **Hatch Agent**: Run a command to spawn one agent.
2.  **Execute Task**: Agent receives a prompt, uses tools, and completes a task.
3.  **Persist State**: Agent memory survives a restart (SQLite).
4.  **Secure Keys**: API Keys are injected from `.env` (not stored in plain text).

## Road to MVP
1.  Create `lofipulse` directory.
2.  Add `.devcontainer` (Ubuntu + Node.js).
3.  Install `pi-coding-agent`.
4.  Run "Hello World" Agent.

## Definition of Done (DOD)
1.  **Container Builds**: `docker build` (or Dev Container startup) succeeds without error.
2.  **Agent Runs**: `npm run start` executes a basic prompt ("Hello World").
3.  **State Persists**: Restarting the container/process does NOT wipe the conversation history.
4.  **Secure**: No API keys are in source code; they are loaded from `.env`.
