---
trigger: always_on
---

# Code Comments

Agents may only write TSDoc comments that explain the intent and guarantees of the code; comments must never restate implementation details, control flow, or names already expressed by the code. A comment is valid only if it explicitly answers at least one of: why this exists, what it guarantees to callers, or what callers must never assume. Vague, speculative, or hedging language is forbidden, and comments that would become false if the implementation changes but behavior does not are considered incorrect. Ambiguous or misleading comments are worse than no comment and must be removed.

## Required TSDoc Shape

When a TSDoc comment exists, it must follow this order:
/\*\*

- Intent (why this exists).
-
- Guarantees and contracts.
-
- Non-obvious constraints or misuse warnings.
  \*/
