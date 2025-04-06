import { ToolArgs } from "./types"

export function getCodebaseSearchDescription(args: ToolArgs): string {
	return `## codebase_search
Description: Request to perform a semantic search across the indexed codebase to find relevant code snippets based on a natural language query. Requires code indexing to be enabled and configured.
Parameters:
- query: (required) The natural language query to search for.
- limit: (optional) The maximum number of search results to return. Defaults to 10.
Usage:
<codebase_search>
<query>Your natural language query here</query>
<limit>Number of results (optional)</limit>
</codebase_search>

Example: Searching for functions related to user authentication
<codebase_search>
<query>User login and password hashing</query>
<limit>5</limit>
</codebase_search>
`
}
