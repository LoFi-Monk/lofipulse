---
trigger: always_on
description: map of the local documents folder and what each directory and file means.
---

# Documentation File Tree

This document outlines the purpose and structure of the `.agent/docs` directory. It is organized by subdirectory, explaining the intended use of each area and the templates provided.

## 🧭 The WHY / WHAT / HOW / WHERE Map

| Folder            | Primary Role      | Question it Answers             |
| :---------------- | :---------------- | :------------------------------ |
| **decisions/**    | **WHY**           | Why is it like this?            |
| **specs/**        | **WHAT**          | What is defined / guaranteed?   |
| **runbooks/**     | **HOW**           | How do I operate or fix it?     |
| **architecture/** | **WHERE**         | Where does responsibility live? |
| **plans/**        | **WHAT (future)** | What are we intending to do?    |

## `.agent/docs`

The central repository for all project documentation, including architectural decisions, plans, runbooks, and specifications.

### `architecture/`

**Purpose**: The shape of the system. Answers: **Where does responsibility live?** What exists? How do parts relate?
Think diagrams, boundaries, and mental models. Little to no step-by-step instructions. Almost no history.

> _"Here is the city. Here are the districts."_

- **[000-system-concept-template.md](.agent/docs/architecture/000-system-concept-template.md)**: A template for defining the conceptual architecture. It prompts for a core metaphor, high-level topology, key component responsibilities, and system boundaries.
- **[README.md](.agent/docs/architecture/README.md)**: Guidelines for naming conventions.

### `decisions/`

**Purpose**: The reasons things are the way they are. Answers: **Why is it like this?** Why did we choose this? What alternatives existed?
These are frozen moments in time. They explain intent, not implementation.

> _"We chose bridges instead of tunnels because flooding."_

- **[0000-adr-template.md](.agent/docs/decisions/0000-adr-template.md)**: A standard ADR template including sections for context, decision drivers, considered options, the chosen outcome (with justification), and positive/negative consequences.

### `plans/`

**Purpose**: Intent and direction. Answers: **What are we intending to do?** In what order? With what risks?
Plans are allowed to rot. That’s okay. They represent beliefs at the time.

> _"We plan to expand the city east next year."_

- **[README.md](.agent/docs/plans/README.md)**: Clarifies that documents here are _plans_ and _drafts_, not necessarily reflecting the active codebase.

### `specs/`

**Purpose**: The rules of reality. Answers: **What is defined / guaranteed?** What must be true? What is the contract?
Specs are precise, boring, and powerful. If code disagrees with specs, something is wrong.

> _"All bridges must support 40 tons."_

- **[000-spec-template.md](.agent/docs/specs/000-spec-template.md)**: A comprehensive template for feature specs. It supports different levels of detail.

### `runbooks/`

**Purpose**: Action under pressure. Answers: **How do I operate or fix it?** How do I do the thing?
These are step-by-step and opinionated. Written for tired humans.

> _"If the bridge is on fire, do these steps."_

- **[000-runbook-template.md](.agent/docs/runbooks/000-runbook-template.md)**: A template for creating runbooks. Includes sections for triage, investigation steps, and remediation.
