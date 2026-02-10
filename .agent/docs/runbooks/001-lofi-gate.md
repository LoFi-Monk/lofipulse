---
title: Lofi Gate
service: Developer Experience
owners: @Lead QA Engineer
---

# Runbook: Lofi Gate

> **Trigger:** MUST be run before every `git commit`.

## 1. Overview

Lofi Gate is a **Signal-First Verification Proxy** designed for AI agents. It protects the codebase by enforcing strict quality gates while protecting the Agent's context window by truncating verbose logs.

### Core Philosophy

1.  **Teeth:** It is not a linter; it is a gatekeeper. It **blocks** commits that violate TDD (e.g., adding source code without tests) or introduce security vulnerabilities.
2.  **Visual Proof:** It optimizes for speed and "visual physics." No loading bars. Just instant, timestamped feedback.
3.  **Signal over Noise:** It strips garbage logs to save tokens.

## 2. Usage

### The Command

The Agent must run the standard test command:

```bash
npm run test
```

_(This maps to `lofi-gate verify --parallel` internally. The Agent thinks it is running tests, but it is running the Gate.)_

### The Ledger (`verification_history.md`)

Every run generates an entry in the ledger.

- **Time:** Execution duration (e.g., `0.10s`).
- **Cost:** Token usage and **Token Savings**.
- **Status:** ✅ PASS or ❌ FAIL.

## 3. Agent Rules (CRITICAL)

### Rule #1: Respect the Truncation

Lofi Gate automatically truncates massive error logs to save your context window.

- **IF** you see `[Truncated]` in the output...
- **THEN** you MUST **STOP** and ask the user:
  > "The test output was truncated. Please provide the full log for [specific test] so I can debug."
- **DO NOT** guess the error. **DO NOT** modify code based on incomplete logs.

### Rule #2: Strict TDD

- You cannot add a file to `src/` without adding/modifying a corresponding file in `tests/`.
- The Gate will reject "orphan" source files.

### Rule #3: Anti-Cheat

- **NEVER** use `.skip` to bypass a failing test.
- **NEVER** delete a test file to make the build pass.
- The Gate detects and blocks these "cheat" attempts.

## 4. Troubleshooting

### "Tests failed"

- Read the error. If truncated, ask the user (See Rule #1).
- Fix the code. Retest.

### "Security Check Failed"

- Analyze the vulnerability.
- If it is a false positive or minor issue, ask the User for permission to update `lofi.toml`.

## 5. Implementation Guide

To install Lofi Gate in a new project:

1.  **Install:** `pip install lofi-gate`
2.  **Initialize:** `lofi-gate init`
3.  **Configure `package.json`:**

    ```json
    "scripts": {
      "test": "lofi-gate verify --parallel",
      "test:agent": "vitest run --changed",
      "test:watch": "vitest"
    }
    ```

    _Note: `test:agent` is the "Speed Lane". It runs only tests related to changed files._

4.  **Install Husky (Optional but Recommended):**
    Prevent messy commits by running the gate on push.

    ```bash
    npm install husky --save-dev
    npx husky init
    echo "npm test" > .husky/pre-push
    ```

5.  **Configure `lofi.toml`:**

    ```toml
    [project]
    # Leave empty to auto-detect 'test:agent' (Speed Lane)
    test_command = ""

    [gate]
    # We use Biome, so ensure lint/format checks are aligned
    lint_check = true
    strict_tdd = true
    ```

    _Note: Lofi Gate automatically detects `biome.json` and uses it for linting._
