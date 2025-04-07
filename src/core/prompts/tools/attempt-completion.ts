export function getAttemptCompletionDescription(): string {
	return `## attempt_completion
Present final task results to user. Requires confirmation of all prior tool successes.

WARNING: Never use without confirming previous tool successes in <thinking> tags.

Parameters:
- result: Final result (required, no questions/offers for help)
- command: Demo command (optional, e.g. \`open index.html\`)

Usage:
<attempt_completion>
<result>Final result text</result>
<command>demo_command</command>  <!-- optional -->
</attempt_completion>

Example:
<attempt_completion>
<result>Updated CSS styles</result>
<command>open index.html</command>
</attempt_completion>`
}
