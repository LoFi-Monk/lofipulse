# Lofipulse Roadmap & Vision

## Phase 1: The MVP (Core Engine)
> **Goal:** A Simple, Safe Agent Runner (Headless).
> **Status:** 🚧 In Progress

### What it is
A Docker container running the Pi SDK (`pi-coding-agent`) with a minimal TUI. It proves we can run an agent, persist its memory, and secure its keys.

### Definition of Done (DOD)
1.  **Container Builds**: `docker build` succeeds (Ubuntu + Node.js).
2.  **Agent Runs**: `npm run start` executes a basic prompt ("Hello World").
3.  **State Persists**: Restarting the container does NOT wipe conversation history (SQLite).
4.  **Secure**: API Keys injected via `.env`, never stored in code.

---

## Phase 2: The Face (Web Dashboard)
> **Goal:** Visibility without Friction.
> **Status:** 📅 Planned

### What it is
A Next.js web app (`localhost:3000`) that connects to the Core Engine.
-   **Read-Only**: View active agents, their logs, and their memory.
-   **Real-Time**: Updates via WebSocket (Hot Reloading supported).
-   **Why**: Replacing the "Black Box" terminal with a proper Status Board.

---

## Phase 3: The Builder (Drag-and-Drop)
> **Goal:** Design Agents Visually.
> **Status:** 📅 Planned

### What it is
Adding `React Flow` to the Phase 2 Dashboard.
-   **Drag**: Drop "Agent" nodes onto a canvas.
-   **Connect**: Link agents together (e.g., "Product Manager" -> "Developer").
-   **Configure**: Set prompts/models in a UI form, validated *before* saving.

---

## Phase 4: The Product (Windows Installer)
> **Goal:** "One Click" Install for Users.
> **Status:** 📅 Planned

### What it is
Wrapping the Docker Environment into a Windows Desktop App (Electron/Tauri).
-   **Control Panel**: Managing the underlying WSL/Docker instance.
-   **Multi-Instance Manager**: Connect to *many* headless Lofipulse instances (Docker containers running on Raspberry Pi, Remote Linux, or Cloud VPS).
-   **Sandbox**: Automatically creating the safe "Lofipulse" user in WSL.
-   **Zero Dependencies**: Installing everything (even WSL) for the user.

---

## Future Vision: The "Lofipulse OS"
> **The Dream:** An Operating System for Agents.

-   **Marketplace**: One-click install of new Skills/Agents.
-   **Voice Mode**: Talk to your swarm via microphone.
-   **mCP Registry**: Auto-discovery of local MCP servers (Docker, Filesystem).
