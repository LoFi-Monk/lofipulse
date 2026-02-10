---
description: ending a session
---

# End Session

1. Update project documents
   - Ensure all relevant files in `.agent/docs` are up to date.
   - Include architecture changes, ADRs, runbooks, specs, and any new notes.

2. Update `./GEMINI.md`
   - Use the template located at:
     `.agent/templates/template-GEMINI.md`
   - Edit `GEMINI.md` using the template.
   - Make sure all new session information is included.

3. Clean up `./GEMINI.md`
   - Organize information in **logical or chronological order** within each section.
   - Remove any outdated or irrelevant information.
   - Ensure clarity and consistency for the next session.

4. Stop all background processes
   - Terminate any running scripts, agents, or temporary tasks initiated during the session.

5. Report back to the user
   - Summarize updates to documentation.
   - Highlight any unresolved issues or next steps.
   - Confirm that all processes have been stopped and context is saved.
