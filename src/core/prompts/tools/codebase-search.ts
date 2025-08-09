export function getCodebaseSearchDescription(): string {
	return `## codebase_search
Description: Find files most relevant to the search query using semantic search.\nThis tool searches based on meaning rather than exact text matches.\nBy default, it searches the entire workspace - only specify a path if you need to limit the search to a specific subdirectory.\nUnless there is a clear reason to use your own search query, please just reuse the user's exact query with their wording.\nTheir exact wording/phrasing can often be helpful for the semantic search query. Keeping the same exact question format can also be helpful.\nIMPORTANT: Queries MUST be in English. Translate non-English queries before searching.
Parameters:
- query: (required) The search query to find relevant code. You should reuse the user's exact query/most recent message with their wording unless there is a clear reason not to.
- path: (optional) Only specify this to limit search to a specific subdirectory. Leave empty to search the entire workspace. Must be a directory path relative to the workspace root.
Usage:
<codebase_search>
<query>Your natural language query here</query>
<path>Subdirectory path (optional - only if limiting search scope)</path>
</codebase_search>

Example 1: Search entire workspace for browser implementation
<codebase_search>
<query>browser use implementation</query>
</codebase_search>

Example 2: Search only in src/auth directory for authentication
<codebase_search>
<query>User login and password hashing</query>
<path>src/auth</path>
</codebase_search>
`
}
