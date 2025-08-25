import { ToolArgs } from "./types"

export function getAttemptCompletionDescription(args?: ToolArgs): string {
	return `## attempt_completion
Description: Use this tool when the current task is complete and you're ready for the user's next request. This signals that you've finished the active work and are awaiting further instructions.

Parameters:
- result: (required) A summary of what was accomplished. Be ** CONCISE ** and ** DIRECT**. **DO NOT** end with questions or offers for further assistance.
Usage:
<attempt_completion>
<result>
Your final result description here
</result>
</attempt_completion>

Example: Requesting to attempt completion with a result
<attempt_completion>
<result>
I've updated the CSS
</result>
</attempt_completion>`
}
