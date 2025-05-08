import { DiffStrategy } from "../../../shared/tools"
import { McpHub } from "../../../services/mcp/McpHub"
import { ExtensionToolManager } from "../../../services/extensions/ExtensionToolManager"

export type ToolArgs = {
	cwd: string
	supportsComputerUse: boolean
	diffStrategy?: DiffStrategy
	browserViewportSize?: string
	mcpHub?: McpHub
	extensionToolManager?: ExtensionToolManager
	toolOptions?: any
}
