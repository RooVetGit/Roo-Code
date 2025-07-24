import { DirectiveHandlerRegistry } from "./DirectiveHandlerRegistry"
import { toolNames } from "@roo-code/types"

export class DirectiveRegistryFactory {
	static create(): DirectiveHandlerRegistry {
		const registry = new DirectiveHandlerRegistry()

		// Register all tool directives
		toolNames.forEach((toolName) => {
			registry.registerTool(toolName)
		})

		return registry
	}
}
