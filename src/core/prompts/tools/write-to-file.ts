import { ToolArgs } from "./types"

export function getWriteToFileDescription(args: ToolArgs): string {
	return `## write_to_file
Create/overwrite file with complete content. Creates directories if needed.

Parameters:
- path: File path (required, relative to ${args.cwd})
- content: Complete file content (required, no omissions)
- line_count: Total lines (required, count actual content)

Usage:
<write_to_file>
<path>file_path</path>
<content>
full_file_content
</content>
<line_count>N</line_count>
</write_to_file>

Example:
<write_to_file>
<path>config.json</path>
<content>
{
	 "apiEndpoint": "https://api.example.com",
	 "theme": {
	   "primaryColor": "#007bff",
	   "secondaryColor": "#6c757d",
	   "fontFamily": "Arial, sans-serif"
	 },
	 "features": {
	   "darkMode": true,
	   "notifications": true,
	   "analytics": false
	 },
	 "version": "1.0.0"
}
</content>
<line_count>14</line_count>
</write_to_file>`
}
