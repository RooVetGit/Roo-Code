import { ToolArgs } from "./types"

export function getOpenCursorDescription(args: ToolArgs): string {
	return `## open_cursor

Description: Request to open a new instance of Cursor with a specified prompt and mode. This tool allows Roo Code to start and monitor a new, separate task within a new Cursor instance.

Parameters:
- prompt: (required) The initial prompt or instructions to send to the new Cursor instance.
- mode: (optional) The mode to start the new instance in (e.g., "code", "ask", "architect"). If not provided, will use the current mode.
- monitor: (optional) Whether to monitor the task's progress. Defaults to true.
- projectDir: (optional) The directory to open Cursor in. If not provided, will use the current project directory.

Usage:
<open_cursor>
<prompt>Your initial prompt here</prompt>
<mode>Mode to start in (optional)</mode>
<projectDir>Project directory to open Cursor in (optional)</projectDir>
</open_cursor>

Example:
<open_cursor>
<prompt>Create a new React component</prompt>
<mode>code</mode>
<projectDir>/Users/rooCode/Projects/Roo-Code</projectDir>
</open_cursor>
`
}
