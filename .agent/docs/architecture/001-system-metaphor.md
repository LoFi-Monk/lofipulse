---
title: System Metaphor - The Soul, The Body, and The Shepherd
type: concept
---

# System Metaphor: The Soul, The Body, and The Shepherd

To clearly define boundaries, LofiPulse uses the following metaphor.

## 1. The Soul (The Harness)

**Responsibility:** Intelligence, Logic, Memory.

- This is the **Core Agent Process**.
- It is "Headless" and portable.
- It has no body; it can only think and speak (IO).
- _Implementation:_ `apps/engine` (Node.js + Pi SDK).

## 2. The Body (The Vessel)

**Responsibility:** Consistency, Identity, Tools.

- This is the **Persistent Environment** where the Soul lives.
- It provides the file system, the IP address, and the tools (git, python).
- It protects the outside world from the Soul (Sandbox).
- _Implementation:_ **Incus Container**.

## 3. The Shepherd (The Control Plane)

**Responsibility:** Management, Observability, Orchestration.

- This is the **User Interface**.
- It does not "think"; it watches the Flock (the Souls).
- It allows the user to spawn new Souls or kill rogue ones.
- _Implementation:_ **Web Dashboard** (Phase 1) / **Desktop App** (Phase 3).

## Topology Diagram

```mermaid
graph TD
    User((Shepherd))

    subgraph "The Flock (Incus)"
        subgraph "Body 1 (Container)"
            Soul1[Soul (Agent Process)]
        end
        subgraph "Body 2 (Container)"
            Soul2[Soul (Agent Process)]
        end
    end

    User -->|Observe/Control| Soul1
    User -->|Observe/Control| Soul2
```
