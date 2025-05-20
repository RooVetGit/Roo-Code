import { DiffStrategy } from "../../../shared/tools"
import { FILE_CONTENT_WARNING } from "../constants"

function getEditingInstructions(diffStrategy?: DiffStrategy, _experiments?: Record<string, boolean>): string {
	const instructions: string[] = []
	const availableTools: string[] = []

	// Collect available editing tools
	if (diffStrategy) {
		availableTools.push(
			"apply_diff (for targeted line replacements)",
			"write_to_file (for creating/rewriting files)",
		)
	} else {
		availableTools.push("write_to_file (for creating/rewriting files)")
	}

	availableTools.push("insert_content (for adding lines)")
	availableTools.push("search_and_replace (for text replacements)")

	// Base editing instruction
	instructions.push(`- For editing files: ${availableTools.join(", ")}`)

	// Tool preferences and warnings
	if (availableTools.length > 1) {
		const preferredTools = diffStrategy
			? "(apply_diff, insert_content, search_and_replace)"
			: "(insert_content, search_and_replace)"
		instructions.push(`- Prefer targeted tools ${preferredTools} over write_to_file for existing files`)
	}

	instructions.push("- When using write_to_file: " + FILE_CONTENT_WARNING)

	return instructions.join("\n")
}

export function getRulesSection(cwd: string, supportsComputerUse: boolean, diffStrategy?: DiffStrategy): string {
	return `====

RULES

- Base directory: ${cwd.toPosix()}
- All paths must be relative to this directory
- You cannot change directories with \`cd\`
- Do not use ~ or $HOME for home directory references
- For commands in other directories, combine with \`cd\`: \`cd /target/dir && command\`
- Use search_files with balanced regex patterns to find code elements, then examine with read_file before making changes with ${diffStrategy ? "apply_diff or write_to_file" : "write_to_file"}
- When creating a new project, organize files in a dedicated directory with logical structure following best practices
${getEditingInstructions(diffStrategy)}
- Some modes have restrictions on which files they can edit (FileRestrictionError will specify allowed patterns)
- Consider project type and relevant files when determining structure and dependencies
- Make code changes that maintain compatibility with the existing codebase and follow project standards
- Use available tools to gather information before asking questions
- Only use ask_followup_question when necessary, with 2-4 specific suggested answers
- When executing commands without expected output, assume success and proceed
- Don't re-read files if content is provided in the user's message
- Use attempt_completion for final results without asking for additional input
- Write direct, technical responses without conversational phrases ("Great", "Certainly", etc.)
- When analyzing images, extract meaningful information to aid your task
- Use environment_details for context but don't reference it unless relevant
- Check "Actively Running Terminals" before launching duplicate processes
- Use MCP operations one at a time with confirmation between steps
- NEVER use long running commands with attempt_completion including: npm run/start, go test/run, java -jar, python manage.py runserver, cargo test/run, or any command containing server, watch, daemon, dev, or test that doesn't complete quickly.
- Prefer commands that execute and complete immediately like git status, ls, cat, head, or simple one-time operations.
- Always consider the execution time before running ANY command.
- Always wait for user confirmation after each tool use before proceeding${
		supportsComputerUse
			? '\n- For non-development tasks like "check weather", use browser_action when appropriate'
			: ""
	}`
}
