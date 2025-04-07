import { ToolArgs } from "./types"

export function getExecuteCommandDescription(args: ToolArgs): string | undefined {
	return `## execute_command
Run CLI commands on the system. Prefer direct commands over scripts.

Parameters:
- command: CLI command (required, must be safe)
- cwd: Working directory (optional, default: ${args.cwd})

Usage:
<execute_command>
<command>your_command</command>
<cwd>optional_path</cwd>
</execute_command>

Examples:
1. Run dev server: <execute_command><command>npm run dev</command></execute_command>
2. List files: <execute_command><command>ls -la</command><cwd>/path</cwd></execute_command>

Use relative paths when possible for better portability.`
}
