---
created: { { date } }
status: draft | accepted
scope: conceptual
---

# <System Name>: Conceptual Architecture

> **Core Metaphor:** "<Short, memorable metaphor>"

---

## 1. Purpose of This Document

Explain:

- What this document defines
- What it explicitly does NOT define

Example:

> This document defines the conceptual architecture and shared mental model of the system.  
> It does not define implementation details, APIs, or operational procedures.

---

## 2. The Core Model

Describe the system using the metaphor.

- What are the primary entities?
- What responsibilities do they hold?
- How do they relate?

Avoid:

- Code terms
- File names
- Frameworks

---

## 3. High-Level Topology

```mermaid
graph TD
    %% Keep this abstract and stable
```

Rules:

- Boxes represent responsibilities, not services
- Arrows represent intent or data flow, not protocols

---

## 4. Key Components (Conceptual)

### <Component Name>

- Responsibility:
- Inputs:
- Outputs:
- Non-responsibilities:

Repeat only for major components.

---

## 5. System Boundaries

Define:

- What is inside the system
- What is outside the system
- External actors or dependencies (conceptual only)

---

## 6. Core Constraints

List constraints that must remain true.

Examples:

- Local-first
- File-based state
- Deterministic orchestration
- Human-in-the-loop

These are guardrails, not decisions.

---

## 7. Non-Goals

Explicitly state what this system is **not** trying to be.

This prevents scope creep and agent hallucinations.

---

## 8. Relationship to Other Documents

- Architectural decisions → `decisions/`
- Implementation details → `specs/`
- Operational procedures → `runbooks/`

---

## 9. Stability Expectations

Describe:

- What should change rarely
- What is expected to evolve

Example:

> The metaphor and component responsibilities should remain stable.  
> Topology may evolve as capabilities expand.
