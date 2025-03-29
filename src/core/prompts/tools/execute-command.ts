import { ToolArgs } from "./types"

export function getExecuteCommandDescription(args: ToolArgs): string | undefined {
	return `## execute_command
Description: Request to execute a CLI command on the system. Use this when you need to perform system operations or run specific commands to accomplish any step in the user's task. You must tailor your command to the user's system and provide a clear explanation of what the command does. For command chaining, use the appropriate chaining syntax for the user's shell. Prefer to execute complex CLI commands over creating executable scripts, as they are more flexible and easier to run. Prefer relative commands and paths that avoid location sensitivity for terminal consistency, e.g: \`touch ./testdata/example.file\`, \`dir ./examples/model1/data/yaml\`, or \`go test ./cmd/front --config ./cmd/front/config.yml\`. If directed by the user, you may open a terminal in a different directory by using the \`cwd\` parameter.
Parameters:
- command: (required) The CLI command to execute. This should be valid for the current operating system. Ensure the command is properly formatted and does not contain any harmful instructions.
- cwd: (optional) The working directory to execute the command in (default: ${sanitizeHtmlEscapes(args.cwd)})
Usage:
<execute_command>
<command>${sanitizeHtmlEscapes("Your command here")}</command>
<cwd>${sanitizeHtmlEscapes("Working directory path (optional)")}</cwd>
</execute_command>

Example: Requesting to execute npm run dev
<execute_command>
<command>${sanitizeHtmlEscapes("npm run dev")}</command>
</execute_command>

Example: Requesting to execute ls in a specific directory if directed
<execute_command>
<command>${sanitizeHtmlEscapes("ls -la")}</command>
<cwd>${sanitizeHtmlEscapes("/home/user/projects")}</cwd>
</execute_command>`
}

function sanitizeHtmlEscapes(input: string): string {
	const htmlEscapes: Record<string, string> = {
		"&amp;": "&",
		"&lt;": "<",
		"&gt;": ">",
		"&quot;": '"',
		"&#39;": "'",
	}

	return input.replace(/&(?:amp|lt|gt|quot|#39);/g, (match) => htmlEscapes[match] || match)
}
