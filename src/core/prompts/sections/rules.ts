import { DiffStrategy } from "../../diff/DiffStrategy"

function getEditingInstructions(diffStrategy?: DiffStrategy, experiments?: Record<string, boolean>): string {
	const instructions: string[] = []
	const availableTools: string[] = []

	// Collect available editing tools
	if (diffStrategy) {
		availableTools.push(
			"apply_diff (for replacing lines in existing files)",
			"write_to_file (for creating new files or complete file rewrites)",
		)
	} else {
		availableTools.push("write_to_file (for creating new files or complete file rewrites)")
	}
	if (experiments?.["insert_content"]) {
		availableTools.push("insert_content (for adding lines to existing files)")
	}
	if (experiments?.["search_and_replace"]) {
		availableTools.push("search_and_replace (for finding and replacing individual pieces of text)")
	}

	// Base editing instruction mentioning all available tools
	if (availableTools.length > 1) {
		instructions.push(`- For editing files, you have access to these tools: ${availableTools.join(", ")}.`)
	}

	// Additional details for experimental features
	if (experiments?.["insert_content"]) {
		instructions.push(
			"- The insert_content tool adds lines of text to files, such as adding a new function to a JavaScript file or inserting a new route in a Python file. This tool will insert it at the specified line location. It can support multiple operations at once.",
		)
	}

	if (experiments?.["search_and_replace"]) {
		instructions.push(
			"- The search_and_replace tool finds and replaces text or regex in files. This tool allows you to search for a specific regex pattern or text and replace it with another value. Be cautious when using this tool to ensure you are replacing the correct text. It can support multiple operations at once.",
		)
	}

	if (availableTools.length > 1) {
		instructions.push(
			"- You should always prefer using other editing tools over write_to_file when making changes to existing files since write_to_file is much slower and cannot handle large files.",
		)
	}

	instructions.push(
		"- When using the write_to_file tool to modify a file, use the tool directly with the desired content. You do not need to display the content before using the tool. ALWAYS provide the COMPLETE file content in your response. This is NON-NEGOTIABLE. Partial updates or placeholders like '// rest of code unchanged' are STRICTLY FORBIDDEN. You MUST include ALL parts of the file, even if they haven't been modified. Failure to do so will result in incomplete or broken code, severely impacting the user's project.",
	)

	return instructions.join("\n")
}

export function getRulesSection(
	cwd: string,
	supportsComputerUse: boolean,
	diffStrategy?: DiffStrategy,
	experiments?: Record<string, boolean> | undefined,
): string {
	return `## RULES
- Base dir: ${cwd.toPosix()} (use relative paths)
- Cannot cd - specify paths relative to base
- No ~/$HOME paths
- For external commands: cd path && command
- Craft regex carefully with search_files
- New projects: use dedicated dir with logical structure
${getEditingInstructions(diffStrategy, experiments)}
- Mode restrictions: FileRestrictionError shows allowed patterns
- Consider project type when adding files
- Code changes must follow project standards
- Minimize questions - use tools when possible
- For questions: provide 2-4 suggested answers
- Assume command success if no output seen
- Don't re-read files provided by user
- Focus on task completion, not conversation${
		supportsComputerUse ? "\n- For non-dev tasks: prefer MCP over browser_action" : ""
	}
- Never end with questions in attempt_completion
- Be direct, not conversational
- Analyze images thoroughly
- Use environment_details context appropriately
- Check active terminals before new commands
- One MCP operation at a time
- Always wait for user confirmation after each step${
		supportsComputerUse ? "\n- For browser tests: wait for confirmation at each step" : ""
	}`
}
