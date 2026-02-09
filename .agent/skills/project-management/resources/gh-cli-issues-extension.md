## Usage

### Sub-Issue Management

```bash
# Add issue #42 as a sub-issue of epic #10
gh issue-ext sub add 10 42

# Remove the sub-issue relationship
gh issue-ext sub remove 10 42

# List all sub-issues of an issue
gh issue-ext sub list 10

# Reorder sub-issues (move #42 after #41 in parent #10)
gh issue-ext sub reorder 10 42 --after 41
gh issue-ext sub reorder 10 42 --before 43
```

### Blocking Relationships

```bash
# Mark issue #15 as blocked by issue #14
gh issue-ext blocking add 15 14

# Remove the blocking relationship
gh issue-ext blocking remove 15 14

# Show what blocks an issue and what it blocks
gh issue-ext blocking list 15
```

### Linked Branches

```bash
# Create a development branch for issue #42
gh issue-ext branch create 42

# Create with a specific name
gh issue-ext branch create 42 --name feature/user-authentication

# List linked branches
gh issue-ext branch list 42

# Unlink a branch (does not delete the branch itself)
gh issue-ext branch delete 42 feature/user-authentication
```

### Show All Relationships

```bash
# Display all relationships for an issue
gh issue-ext show 42

# Output as JSON
gh issue-ext show 42 --json
```

## JSON Output

Most list and show commands support `--json` flag for machine-readable output:

```bash
gh issue-ext sub list 10 --json
gh issue-ext blocking list 15 --json
gh issue-ext show 42 --json
```

## How It Works

This extension uses the GitHub GraphQL API to manage relationships that aren't exposed through the standard `gh issue` commands:

- **Sub-issues**: Uses `addSubIssue`, `removeSubIssue`, `reprioritizeSubIssue` mutations with the `GraphQL-Features: sub_issues` header
- **Blocking**: Uses `addBlockedBy`, `removeBlockedBy` mutations
- **Linked branches**: Uses `createLinkedBranch`, `deleteLinkedBranch` mutations
