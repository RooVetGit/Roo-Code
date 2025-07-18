import type { ToolName } from "@roo-code/types"

export interface TimeoutFallbackContext {
	toolName: ToolName
	timeoutMs: number
	executionTimeMs: number
	toolParams?: Record<string, any>
	errorMessage?: string
	taskContext?: {
		currentStep?: string
		previousActions?: string[]
		workingDirectory?: string
	}
}

/**
 * Create a prompt for the AI to generate contextual timeout fallback suggestions
 */
export function createTimeoutFallbackPrompt(context: TimeoutFallbackContext): string {
	const { toolName, timeoutMs, executionTimeMs, toolParams, taskContext } = context

	const timeoutSeconds = Math.round(timeoutMs / 1000)
	const executionSeconds = Math.round(executionTimeMs / 1000)

	let prompt = `A ${toolName} operation has timed out after ${timeoutSeconds} seconds (actual execution time: ${executionSeconds} seconds).

Context:
- Tool: ${toolName}
- Timeout limit: ${timeoutSeconds}s
- Actual execution time: ${executionSeconds}s`

	// Add tool-specific context
	if (toolParams) {
		prompt += `\n- Parameters: ${JSON.stringify(toolParams, null, 2)}`
	}

	// Add task context if available
	if (taskContext) {
		if (taskContext.currentStep) {
			prompt += `\n- Current step: ${taskContext.currentStep}`
		}
		if (taskContext.workingDirectory) {
			prompt += `\n- Working directory: ${taskContext.workingDirectory}`
		}
	}

	prompt += `

Generate exactly 3-4 specific, actionable suggestions for how to proceed after this timeout. Each suggestion should be:
1. Contextually relevant to the specific ${toolName} operation that timed out
2. Actionable and specific (not generic advice)
3. Focused on solving the immediate problem
4. Ordered by likelihood of success

Format your response as a simple numbered list:
1. [First suggestion]
2. [Second suggestion]
3. [Third suggestion]
4. [Fourth suggestion (optional)]

Focus on practical solutions like:
- Breaking the operation into smaller parts
- Using alternative tools or methods
- Adjusting parameters or settings
- Checking for underlying issues
- Optimizing the approach

Keep each suggestion concise (under 80 characters) and actionable.`

	return prompt
}

/**
 * Parse AI response to extract suggestions
 */
export function parseTimeoutFallbackResponse(response: string): Array<{ text: string; mode?: string }> {
	const suggestions: Array<{ text: string; mode?: string }> = []

	// Look for numbered list items
	const lines = response.split("\n")
	for (const line of lines) {
		const trimmed = line.trim()

		// Match patterns like "1. suggestion", "2) suggestion", etc.
		const match = trimmed.match(/^(\d+)[.)]\s*(.+)$/)
		if (match && match[2]) {
			const suggestionText = match[2].trim()
			if (suggestionText.length > 0 && suggestionText.length <= 120) {
				suggestions.push({ text: suggestionText })
			}
		}
	}

	// If no numbered list found, try to extract sentences
	if (suggestions.length === 0) {
		const sentences = response
			.split(/[.!?]+/)
			.map((s) => s.trim())
			.filter((s) => s.length > 10 && s.length <= 120)
		for (let i = 0; i < Math.min(4, sentences.length); i++) {
			suggestions.push({ text: sentences[i] })
		}
	}

	return suggestions.slice(0, 4) // Limit to 4 suggestions
}
