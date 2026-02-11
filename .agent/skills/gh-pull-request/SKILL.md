---
name: gh-pull-request
description: Standardize PR creation with auto-link, auto-label, and auto-project.
---

# GH Pull Request Skill

Automates the creation of GitHub Pull Requests, ensuring consistent metadata and quality gates.

## Usage

```bash
# Create a PR with a pre-filled body file (RECOMMENDED)
node scripts/gh-pr.js --create --body-file path/to/pr-body.md

# Create a PR (auto-detects issue # from branch name)
node scripts/gh-pr.js --create

# Dry run to see what it detects
node scripts/gh-pr.js --create --dry-run
```

> [!IMPORTANT]
> **Agent Rule:** You MUST always use `--body-file` with a filled-in markdown file.
> Never rely on the raw template fallback — it produces generic placeholder text.
> Write the PR body to a temp file first, then pass it via `--body-file`.

## Features

- **Auto-Linking**: Detects issue ID from branch name (e.g., `issue-21`, `feat/21`).
- **Metadata Inheritance**:
  - Copies **Labels** from the linked issue.
  - Adds PR to the same **Project Board** as the linked issue.
  - Sets Project Status to **In review**.
- **Template Support**: Uses `.github/pull_request_template.md` if available.
- **Auto-Closing**: Appends `Closes #N` to the PR body.

## CLI Options

| Option            | Description                                                    |
| ----------------- | -------------------------------------------------------------- |
| `--create`        | Primary command to start the flow.                             |
| `--issue <N>`     | Override issue detection.                                      |
| `--title "..."`   | Custom title (defaults to issue title).                        |
| `--label "..."`   | Additional label to add.                                       |
| `--body "..."`    | Inline PR description (short text only).                       |
| `--body-file <p>` | Read PR body from a markdown file (overrides --body/template). |
| `--dry-run`       | Preview actions without execution.                             |
