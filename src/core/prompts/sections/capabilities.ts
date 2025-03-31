import { DiffStrategy } from "../../diff/DiffStrategy"
import { McpHub } from "../../../services/mcp/McpHub"

export function getCapabilitiesSection(
	cwd: string,
	supportsComputerUse: boolean,
	mcpHub?: McpHub,
	diffStrategy?: DiffStrategy,
): string {
	return `## CAPABILITIES
- Tools available:
  - CLI command execution
  - File listing/searching
  - Code definition viewing
  - File reading/writing
  - Follow-up questions${supportsComputerUse ? "\n  - Browser interaction" : ""}
- Initial file structure provided in environment_details
---
- Use list_files to explore (recursive=true for full listing)
- search_files: Regex searches with context
- list_code_definition_names: Code structure overview
- Example workflow:
  1. Analyze file structure
  2. Examine code definitions
  3. Read relevant files
  4. Make/edit code
  5. Apply changes with ${diffStrategy ? "apply_diff/write_to_file" : "write_to_file"}
  6. Update related files if needed
- execute_command: Run CLI commands
  - Prefer direct commands over scripts
  - Supports interactive/long-running commands
  - Runs in new terminal instance${
		supportsComputerUse
			? "\n- browser_action: Web interaction tool\n  - Launch/navigate pages\n  - Interact with elements\n  - Capture screenshots/logs\n  - Example: Test React components locally"
			: ""
  }${mcpHub ? "\n- MCP servers: Additional tools/resources available" : ""}`
}
