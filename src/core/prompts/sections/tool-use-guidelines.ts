import { TOOL_USE_GUIDELINES } from "../constants"

export function getToolUseGuidelinesSection(): string {
	return `# Tool Use Guidelines

1. ${TOOL_USE_GUIDELINES[0]}.
2. ${TOOL_USE_GUIDELINES[1]}. For example, using list_files is more effective than running \`ls\` in the terminal.
3. ${TOOL_USE_GUIDELINES[2]}. Do not assume the outcome of any tool use.
4. ${TOOL_USE_GUIDELINES[3]}.
5. After each tool use, the user will respond with results that may include:
   - Success or failure information with reasons
   - Linter errors to address
   - Terminal output to consider
   - Other relevant feedback
6. ${TOOL_USE_GUIDELINES[4]}. Never assume success without explicit confirmation.

This step-by-step approach allows you to:
1. Confirm the success of each step before proceeding
2. Address issues immediately
3. Adapt to new information
4. Build each action correctly on previous ones

This iterative process ensures overall success and accuracy.`
}
