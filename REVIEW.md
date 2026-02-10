# Devin Review Instructions

> These instructions guide the Devin code review bot on how to review PRs in this repository.

## Comment Rules

- **Only open threads for actionable items**: bugs, regressions, missing validation, security issues.
- **Do NOT open threads for confirmations** like "this looks correct" or "this is safe." These create noise.
- **Use `suggestion` blocks** for concrete code fixes whenever possible. This enables auto-application.
- **Prefix comment IDs** with severity: `BUG_`, `SUGGESTION_`, or `QUESTION_`.

## Re-Review Scope

- On subsequent pushes, **only review changed files** in the new commits.
- **Do NOT re-analyze files** that were unchanged since the last review.
- If a previous comment was resolved, do not re-open the same concern unless the fix introduced a new issue.

## Severity Guidelines

| Prefix        | When to Use                                       | Example                               |
| ------------- | ------------------------------------------------- | ------------------------------------- |
| `BUG_`        | Must fix before merge — causes incorrect behavior | Off-by-one error, missing null check  |
| `SUGGESTION_` | Nice-to-have improvement, not blocking            | Better variable name, slight refactor |
| `QUESTION_`   | Needs clarification from author                   | "Is this intentional?"                |

## Skip These

- **`chore:` prefixed PRs** — cleanup, formatting, file deletions. Minimal review needed.
- **Documentation-only changes** — `.md` files, comments, READMEs.
- **Confirming correct behavior** — If the code is correct, don't open a thread saying so.
