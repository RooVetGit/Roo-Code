import { ToolArgs } from "./types"

export function getExecuteCommandDescription(args: ToolArgs): string | undefined {
	return `## execute_command
Description: Execute CLI commands on the user's system. Tailor commands to the user's operating system and explain their purpose.

Best practices:
- Use relative paths when possible (\`./testdata/example.file\`)
- Prefer complex CLI commands over scripts
- Use appropriate shell syntax for command chaining

Parameters:
- command: (required) Valid CLI command for the current OS
- cwd: (optional) Working directory for execution (default: ${args.cwd})

Usage:
<execute_command>
<command>command_to_run</command>
<cwd>working_directory (optional)</cwd>
</execute_command>

Examples:
<execute_command>
<command>npm run dev</command>
</execute_command>

<execute_command>
<command>find . -name "*.js" | xargs grep "TODO"</command>
</execute_command>`
}
