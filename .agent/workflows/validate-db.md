---
description: Validate database state using the Supabase MCP server
---

1. identify the relevant tables and schemas for the feature.

2. Use `list_tables` to confirm the schema structure.

3. Use `execute_sql` to query for the expected data:
   - Example: `SELECT * FROM players WHERE id = '...'`
   - Example: `SELECT count(*) FROM transaction_logs`

4. Verify that the results match the expected state.

5. If validation fails, correct the logic and repeat.
