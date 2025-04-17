import { ToolArgs } from "./types"

export function getNotebookReadToolDescription(args: ToolArgs): string {
	return `## notebook_read
Description: Retrieve information about the active notebook.
Parameters:
- action: (required) The action to perform. Valid values are:
  - "get_info": Get comprehensive information about the active notebook, including URI, kernel info, and cell statistics
  - "get_cells": Get the cells of the active notebook. Returns detailed information about each cell, including content and outputs

Usage:
<notebook_read>
<action>action name here</action>
</notebook_read>

Example 1: Get comprehensive notebook information
<notebook_read>
<action>get_info</action>
</notebook_read>

Example 2: Get the cells of the active notebook
<notebook_read>
<action>get_cells</action>
</notebook_read>

Notes:
- The user must have opened a notebook file in VSCode to have an active notebook in the workspace
- The "get_info" action provides a comprehensive overview including URI, kernel info, and statistics about cell types and languages
- If no active notebook is found, "get_info" will return a message stating "No active notebook found"
- The "get_cells" action provides a formatted analysis of all cells, including their content and outputs
- If no active notebook is found, "get_cells" will return an error message
- Cell content and outputs are truncated if they exceed the configured size limit
- For code cells, both the source code and execution outputs are included`
}
