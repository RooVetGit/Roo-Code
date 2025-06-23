import { DirectiveHandlerRegistry } from "./DirectiveHandlerRegistry"
import { LogDirectiveHandler } from "./handlers"
import { toolNames } from "@roo-code/types"

export class DirectiveRegistryFactory {
	static create(): DirectiveHandlerRegistry {
		const registry = new DirectiveHandlerRegistry()

		// Register built-in directives
		registry.register(new LogDirectiveHandler())

		// Register all tool directives
		toolNames.forEach((toolName) => {
			registry.registerTool(toolName)
		})

		return registry
	}
}
