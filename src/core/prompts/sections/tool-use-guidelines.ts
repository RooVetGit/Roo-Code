export function getToolUseGuidelinesSection(): string {
	return `### Tool Use Guidelines

1. Assess task requirements in <thinking> tags
2. Select optimal tool for each step
3. Use one tool per message, iteratively
4. Format tools using specified XML
5. Process user responses containing:
	 - Success/failure status
	 - Linter errors
	 - Terminal output
	 - Other relevant feedback
6. Always wait for user confirmation

Key benefits:
1. Verify step success
2. Fix issues immediately
3. Adapt to new information
4. Maintain correct sequencing`
}
