# Our Workflow: "The Lofi Loop"

1.  **Inception (Idea -> Backlog)**
    - User Request -> **Project Manager** creates GitHub Issue (Epic/Story).
    - Added to Kanban `Backlog`.
    - _Validation:_ Visual check of value.

2.  **Activation (Backlog -> In-Progress)**
    - **Project Manager** moves **1 Item** to `In-Progress`.
    - Assigns **Persona** (e.g., Lead Developer) and **Priority**.
    - _Validation:_ `mermaid-validator` ensures board is clean.

3.  **The TDD Cycle (Red-Green-Refactor)**
    - **Step 1: Red (Lead QA)**
      - Write a failing test for the feature/bug.
      - Run `lofi-gate` (it fails, or passes if empty).
      - **Commit 1:** "test: add failing test for X".
    - **Step 2: Green (Lead Developer)**
      - Write the _minimum_ code to pass the test.
      - Run `lofi-gate` (MUST PASS).
      - **Commit 2:** "feat: implement X".
    - **Step 3: Refactor (Lead Developer / Architect)**
      - Clean up code, optimize, document.
      - Run `lofi-gate` (MUST PASS).
      - **Commit 3:** "refactor: clean up X".

4.  **Verification (In-Progress -> Review)**
    - Move item to `Review`.
    - **Lead QA** runs final full suite (`npm test`).
    - **Creative Director** checks UI/UX (if applicable).
    - _Validation:_ `mermaid-validator`.

5.  **Completion (Review -> Done)**
    - If approved, move to `Done`.
    - **Project Manager** closes GitHub Issue.
    - _Validation:_ `mermaid-validator`.

6.  **Definition of Done (Done -> Archive)**
    - Item MUST be moved to `Archive`.
    - **Rule:** New work CANNOT start until the board is clear (except Blocked).

---

**Key Rules:**

- **Serial Work:** Finish -> Archive -> Start Next.
- **WIP Limit:** 1. Focus on one thing.
- **Visual Proof:** Lofi Gate must be green before Review.
- **No Cheat:** Tests MUST exist before implementation.
