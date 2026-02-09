# LofiPulse Identity & Architecture

## The Core Mission

To build a **Distributed, Headless Agent Engine** that runs anywhere (WSL, Raspberry Pi, VPS) and a **Unified Control Plane** (Web Dashboard / Future Desktop App) to manage them all.

## Problem & Solution

Addressing the specific pain points of previous tools (OpenClaw) and enabling a distributed future:

| Problem            | The OpenClaw "Jank"                                                                                 | The LofiPulse Solution                                                                                                                           |
| :----------------- | :-------------------------------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------- |
| **Architecture**   | **Linear Chat Interface:** Managing 5+ active agents in a single chat stream is chaotic and opaque. | **Agent-Centric Dashboard:** A Next.js Web App dedicated to observability. separate Panels for logs, memory, and active tasks.                   |
| **Fragile Config** | **JSON Files:** Typos in `sessions.json` or `config.json` break the system silently.                | **Typical Config (`zod`):** Shared TypeScript configuration packages. Validated at build/runtime. "It doesn't compile, it doesn't run."          |
| **Security**       | **Plain Text Keys:** API keys stored in accessible JSON files are vulnerable to the agent itself.   | **Env Injection:** Secrets injected directly into the Docker Container environment at runtime. The agent code never sees the raw file.           |
| **WSL Friction**   | **Brittle Bridges:** Connecting WSL agents to Windows tools requires manual hacks.                  | **Docker Native:** The Engine runs in a standard container. Interop is handled via standard TCP/WebSocket APIs, not fragile file-system bridges. |

## Proposed Project Structure (TurboRepo Monorepo)

We will use a **Monorepo** to tightly couple the contracts between the _Engine_ and the _Consumers_ (Web/Desktop) while ensuring the Engine remains a standalone, portable unit.

```text
lofipulse/
├── .devcontainer/          # Standardized Dev Environment (VS Code)
├── apps/
│   ├── web/                # Next.js Dashboard (The "Face" for Phase 1)
│   ├── engine/             # Node.js + Pi SDK (The Headless Runner - Deployable anywhere)
│   └── desktop/            # (Future) Electron/Tauri Control Panel
├── packages/
│   ├── config/             # Shared TypeScript Configuration (Zod schemas)
│   ├── api-types/          # Shared RPC/WebSocket types (tRPC or similar)
│   └── ui/                 # Shared UI components (Web & Desktop)
├── docker/                 # Production/Local Docker Composition
│   └── docker-compose.yml
├── turbo.json              # Build pipeline configuration
└── package.json            # Root configuration
```

## Tech Stack Decisions

- **Monorepo Tool:** `turbo` (Fast, efficient caching)
- **Package Manager:** `pnpm` (Fast, disk efficient)
- **Linting/Formatting:** `biome` (Fast, replaces ESLint/Prettier)
- **Engine:** `Node.js` + `@mariozechner/pi-coding-agent`
- **Dashboard:** `Next.js` + `Shadcn UI` + `Tailwind CSS`
- **Communication:** `Socket.io` or `tRPC` (Engine <-> Dashboard)
