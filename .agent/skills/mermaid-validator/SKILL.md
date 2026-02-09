---
name: mermaid-validator
description: Automatically validate mermaid diagrams after creating or editing them in markdown files
---

# When to Use This Skill

**Proactively use this skill after:**

- Creating new mermaid diagrams in markdown files
- Editing existing mermaid diagrams
- User asks to validate/check mermaid diagrams

**Always validate before completing the task.**

# Instructions

1. Read the markdown file (use the file from context or ask user which file to validate)
2. **Run validation** using: `npx -y @mermaid-js/mermaid-cli -i <file-path> -o .agent/temp-validation.svg`
3. **Check for IDE/Lint Errors**:
   - Check if the editor reports any syntax errors or warnings (red squiggles).
   - Trust the IDE's strict syntax checking over the CLI if they disagree.
4. **Evaluate Results**:
   - If **Valid** (CLI passes AND no IDE errors): Go to Step 5 (Proofread).
   - If **Invalid**: Go to Step 6 (Fix).
5. **AI Proofread**:
   - Instruction: "Proofread the markdown file for structural errors. Verify that code fences are properly opened and closed, there are no nested or stray backticks, and no unrelated text appears around the diagram. Correct any issues found."
   - If **Issues Found**: Go to Step 6 (Fix).
   - If **Clean**: Go to Step 10 (Final Success).
6. **Fix the issues** automatically (Syntax or Structural).
7. **Re-validate** to confirm the fix works.
8. **Log Execution Result**:
   - Follow the logging policy at `.agent/rules/skill-logging-policy.md`.
   - Use status "Success" if valid, "Failed" if unable to fix.
9. **Loop**: Repeat steps 4-8 until the diagram is valid and clean.
10. **Final Success**:

- Confirm the diagram is valid.
- Show the final result to the user.
- Exit.
