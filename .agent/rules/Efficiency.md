# AI Efficiency & Autonomy Rules

To maximize efficiency and reduce the need for manual validation, the AI agent should adhere to the following rules:

### 1. Autonomous Validation (Self-Check)
- **UI Changes**: Do not ask the user "is this fixed?". Instead, run the local dev server (`npm run dev` in `frontend`) and use the `browser_subagent` to verify the fix yourself. Capture a screenshot for the walkthrough.
- **Database Changes**: Use the `supabase-mcp-server` to verify that tables are created, records are inserted, or data is updated correctly.
- **API Changes**: Use `run_command` with `curl` or a test script to verify API responses match the expected schema defined in the developer guide.

### 2. "Build Before You Buy" (Health Check)
- Always run `npm run lint` or `npm run build` after making changes to ensure no regressions were introduced.
- If a command fails, fix the issue before notifying the user.

### 3. Proactive Research
- When encountering an error, search the `integration-rules.md` (Developer Guide) and the codebase for similar patterns before asking for clarification.
- Use `grep_search` to find usage patterns of specific APIs or components.

### 4. Background Server Management
- If a task requires a running server (e.g., frontend dev server, backend API), start it in the background using `run_command` with a high `WaitMsBeforeAsync` and then proceed with validation tools.

### 5. Verified Walkthroughs
- Every task completion MUST include a verification step in the `walkthrough.md` with proof (logs, screenshots, command outputs).
