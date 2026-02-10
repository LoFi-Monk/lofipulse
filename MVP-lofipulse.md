# LofiPulse MVP: "The Digital Soul"

> **Philosophy:** "Start with the Brain, then build the Body."

## The Vision

LofiPulse is a **Distributed Agent Operating System**.

- **The Soul:** A portable, stateful "Agent Engine" (Node.js + Pi SDK).
- **The Body:** A persistent system container (Incus) that gives the Soul a home.
- **The Bridge:** A Control Plane (Desktop App) that connects the User to their Flock of Souls.

## Phase 1: The Core Harness (MVP)

**Goal:** A standalone Node.js application (`apps/engine`) that wraps the Pi SDK and runs locally. It does _not_ require Incus or Docker yet.

### Must Haves

1.  **Monorepo Foundation:** TurboRepo + Biome + TypeScript.
2.  **Config Schema (Zod):** A strict `packages/config` that validates API Keys and Agent settings.
3.  **The Harness Runtime:**
    - Boots up the Pi SDK (`createAgentSession`).
    - Accepts input via CLI (REPL).
    - Executes basic tools (File Read/Write).
    - Maintains conversation history (SQLite or JSONL).

### Definition of Done

- [ ] `pnpm install` works from root.
- [ ] `pnpm start --filter engine` launches a terminal chat.
- [ ] Agent can answer "Who are you?" and write a file to disk (`hello.txt`).

---

## Phase 2: The Vessel (Incus Integration)

**Goal:** Deploy the Phase 1 Harness into an **Incus Container**.

- **Why:** Isolation, Persistence, and "Root" safety.
- **Deliverable:** A deployment script (`scripts/deploy-to-incus.ts`) that:
  1.  Spins up an Incus container (Ubuntu).
  2.  Pushes the `apps/engine` code.
  3.  Starts it as a `systemd` service.

## Phase 3: The Shepherd (Desktop Control)

**Goal:** A Tauri/Electron app to manage the Flock.

- **Deliverable:** A GUI that lists running Incus containers and opens a terminal/chat window to them.
