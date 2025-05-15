export function getCodebaseSearchDescription(): string {
	return `## codebase_search
Description: Search the codebase for relevant files based on a query. Use this when the user asks a question about the codebase that requires finding specific files or code snippets. You can optionally specify a path to a directory to search in, the results will be filtered to only include files within that directory, this is useful for searching for files related to a specific project or module.
Parameters:
- query: (required) The natural language query to search for.
- limit: (optional) The maximum number of search results to return. Defaults to 10.
- path: (optional) The path to the directory to search in relative to the current working directory. Defaults to the current working directory.
Usage:
<codebase_search>
<query>Your natural language query here</query>
<limit>Number of results (optional)</limit>
<path>Path to the directory to search in (optional)</path>
</codebase_search>

Example: Searching for functions related to user authentication
<codebase_search>
<query>User login and password hashing</query>
<limit>5</limit>
<path>/path/to/directory</path>
</codebase_search>
`
}
