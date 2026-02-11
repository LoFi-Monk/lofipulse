# Lofi Pulse

> [!IMPORTANT]
> **PROTOCOL:** Before executing ANY task, you MUST consult [.agent/docs/specs/team-workflow.md](file:///c:/ag-workspace/lofipulse/.agent/docs/specs/team-workflow.md). Strict adherence to **State Gates** (Backlog/Ready) is required.

# Current Focus

**Issue #2: Monorepo Foundation**

- **Status:** `Ready`
- **Agent:** `Lead Developer`
- **Next Action:** **Activation** (Move to In Progress -> Create Branch -> Execute).

# Recent Decisions

- [x] **Team Protocol:** Adopted `team-workflow.md` with strict State Gates.
- [x] **Backlog Gate:** Agents CANNOT touch Backlog items.
- [x] **Ready Gate:** Agents ONLY pick up `Ready` items assigned to them.
- [x] **Blocked Protocol:** explicit "Stop the Line" procedure with `notify_user`.
- [x] **Trunk-Based Development:** Linear history, small PRs.
- [x] **Devin Review:** All merges require explicit user confirmation.
- [x] **Strict TDD:** Lofi Gate enabled (`strict_tdd = true`).
- [x] **Project Management:** GitHub Projects (Issue #12) + `task.md`.
- [x] **Package Manager:** `pnpm` standardized (ADR 0004).

# Backlog

- [ ] **Issue #2:** Monorepo Foundation (High)
- [ ] **Issue #3:** Config Package
- [ ] **Issue #4:** Harness Runtime
- [ ] **Issue #8:** Configure Secretlint (Blocked)

# Completed

- [x] **Issue #1:** Project Init & CI
- [x] **Issue #9:** Fix YouTube Transcript Bugs
- [x] **Issue #10:** Infra & Gate Cleanup (pnpm)
- [x] **Issue #11:** GH PR Conversation Resolver Skill
- [x] **Issue #12:** Advanced GitHub Projects Spike
- [x] **Issue #13:** EARS Method Skill
- [x] **Issue #15:** Mandatory Metadata
- [x] **Issue #16:** Enhance PR Resolver (Apply Suggestions)
- [x] **PR #18:** Rewrite PR Resolver to Node.js + REVIEW.md
- [x] **PR #19:** Rewrite gh-projects to Node.js

# Artifacts

- [Task Board](file:///C:/Users/lofim/.gemini/antigravity/brain/8cb4abb7-604e-41bd-840d-06de299af6a9/task.md)
- [Implementation Plan](file:///C:/Users/lofim/.gemini/antigravity/brain/8cb4abb7-604e-41bd-840d-06de299af6a9/implementation_plan.md)

# Notes to future self

- **Issue #8 (Secretlint):** HOLD until Husky setup is complete.
- **Skill Scripts:** All skills now use Node.js (`resolve.js`, `projects.js`). No more PowerShell deps.
- **Devin Review:** `REVIEW.md` in project root instructs Devin to reduce noise. Use `resolve.js --review-all` to batch-process threads.
