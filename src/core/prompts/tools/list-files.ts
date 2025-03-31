import { ToolArgs } from "./types"

export function getListFilesDescription(args: ToolArgs): string {
	return `## list_files
List directory contents. Use recursive=true for full tree.

Parameters:
- path: Directory path (required, relative to ${args.cwd})
- recursive: Include subdirectories (optional, default false)

Usage:
<list_files>
<path>directory_path</path>
<recursive>true</recursive>  <!-- optional -->
</list_files>

Example: Top-level listing:
<list_files>
<path>.</path>
<recursive>false</recursive>
</list_files>

Note: Don't use to verify file creation - user will confirm.`
}
