import { ToolArgs } from "./types"

export function getNotebookExecuteToolDescription(args: ToolArgs): string {
	return `## notebook_execute
Description: Execute cells in the active notebook.
Parameters:
- action: (required) The action to perform. Currently only "execute_cells" is supported.
- start_index: (required) The starting index of the range to execute (0-based, inclusive). Must be a valid cell index in the notebook.
- end_index: (required) The ending index of the range to execute (0-based, exclusive). Must be a valid cell index in the notebook and >= start_index.

Usage:
<notebook_execute>
<action>execute_cells</action>
<start_index>start index value here</start_index>
<end_index>end index value here</end_index>
</notebook_execute>

Example: Execute cells from index 3 through 5 (inclusive)
<notebook_execute>
<action>execute_cells</action>
<start_index>3</start_index>
<end_index>6</end_index>
</notebook_execute>

Notes:
- The user must have opened a notebook file in VSCode to have an active notebook in the workspace
- The execution is initiated immediately, but completion time depends on the cells' content
- The tool will wait for execution to complete and return the results
- Results include both the cell content and any outputs produced by execution
- Execution will timeout if it takes too long, and a timeout message will be included in the response
- Cell outputs are truncated if they exceed the configured size limit
- To execute a single cell, set end_index to start_index + 1`
}
