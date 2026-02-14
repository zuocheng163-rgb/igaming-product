---
description: Validate UI changes using the local dev server and browser subagent
---

1. Start the frontend dev server in the background:
   - Use `run_command` in `frontend` directory with `npm run dev`.
   - Set `WaitMsBeforeAsync` to `5000` to allow the server to start.

2. Check the output for the local URL (usually `http://localhost:5173`).

3. Use `browser_subagent` to visit the URL:
   - Task: "Navigate to [URL], verify the component [Name] is visible and [Issue] is resolved. Take a screenshot."
   - Target: The specific page or component that was modified.

4. If validation fails, stop the server, apply fixes, and repeat.

5. document the success in `walkthrough.md` with the screenshot.
