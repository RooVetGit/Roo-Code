export function getCodebaseSearchDescription(): string {
	return `## codebase_search
Description: Search the codebase for relevant files based on a query. Use this when the user asks a question about the codebase that requires finding specific files or code snippets.
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
