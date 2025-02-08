export function getSemanticSearchDescription() {
	return `## semantic_search
Description: Find code snippets semantically matching a natural language query. Use this when you need to understand how certain features or components are implemented, without knowing their exact location or naming. The tool leverages the configured model to find and rank relevant code snippets based on their semantic meaning rather than exact text matches.

Parameters:
- query: (required) The natural language query to search for (e.g. "how is the Person class implemented?" or "where is the authentication logic?")

Usage:
<semantic_search>
<query>Your natural language query here</query>
</semantic_search>

Example: Finding implementation of user authentication
<semantic_search>
<query>how is user authentication implemented?</query>
</semantic_search>`
}
