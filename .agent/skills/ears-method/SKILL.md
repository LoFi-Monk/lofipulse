---
name: ears-method
description: Synthesize and review requirements using the Easy Approach to Requirements Syntax (EARS) to eliminate ambiguity.
---

# EARS Method (Technical Specification)

The Easy Approach to Requirements Syntax (EARS) gently constrains natural language to provide high-quality, unambiguous textual requirements following a strict temporal logic.

## THE PATTERNS

| Type             | Keyword       | Syntax                                                               |
| :--------------- | :------------ | :------------------------------------------------------------------- |
| **Ubiquitous**   | None          | The `<system>` shall `<response>`                                    |
| **State-driven** | **While**     | While `<state>`, the `<system>` shall `<response>`                   |
| **Event-driven** | **When**      | When `<trigger>`, the `<system>` shall `<response>`                  |
| **Optional**     | **Where**     | Where `<feature>`, the `<system>` shall `<response>`                 |
| **Unwanted**     | **If / Then** | If `<trigger>`, then the `<system>` shall `<response>`               |
| **Complex**      | Mix           | While `<state>`, When `<trigger>`, the `<system>` shall `<response>` |

## THE RULES (IRON FIST)

1.  **Fixed Order**: Clauses MUST appear in this sequence: `Pre-condition` (While/Where) → `Trigger` (When/If) → `System` (The) → `Response` (shall [Then]).
2.  **Constraint Level**:
    - **"shall"** denotes a mandatory requirement.
    - **"will"** denotes a statement of fact or intent (not a requirement).
    - **"should"** is forbidden in requirements.
3.  **Composition**:
    - Zero or many **Pre-conditions**.
    - Zero or one **Trigger**.
    - Exactly one **System Name**.
    - One or many **System Responses**.

## INSTRUCTIONS FOR AGENTS

- **Authoring**: Use EARS for all `## Expected Tests` and `## Task List` items in GitHub Issues.
- **Review**: If a requirement is ambiguous or speculative, refactor it into one of the EARS patterns.
- **Ambiguity Check**: If you cannot fit a requirement into a pattern, the requirement is likely poorly understood; ask for clarification.

## EXAMPLE

- **Draft**: "Make sure the login fails if the password is wrong."
- **EARS**: "If an invalid password is provided, then the Authentication System shall deny access."

# Resources

- [Ears Method](./resources/ears-method.md)
