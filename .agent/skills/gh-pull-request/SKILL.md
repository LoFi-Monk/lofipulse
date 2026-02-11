---
name: gh-pull-request
description: Standardize PR creation with auto-link, auto-label, and auto-project.
---

# GH Pull Request Skill

Automates the creation of GitHub Pull Requests, ensuring consistent metadata and quality gates.

## Usage

```bash
# Create a PR for the current branch
# (Auto-detects issue # from branch name like feat/issue-21-...)
node scripts/gh-pr.js --create

# Dry run to see what it detects
node scripts/gh-pr.js --create --dry-run
```

## Features

- **Auto-Linking**: Detects issue ID from branch name (e.g., `issue-21`, `feat/21`).
- **Metadata Inheritance**:
  - Copies **Labels** from the linked issue.
  - Adds PR to the same **Project Board** as the linked issue.
- **Auto-Closing**: Appends `Closes #N` to the PR body.

## CLI Options

| Option          | Description                             |
| --------------- | --------------------------------------- |
| `--create`      | Primary command to start the flow.      |
| `--issue <N>`   | Override issue detection.               |
| `--title "..."` | Custom title (defaults to issue title). |
| `--label "..."` | Additional label to add.                |
| `--dry-run`     | Preview actions without execution.      |
