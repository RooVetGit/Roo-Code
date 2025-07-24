import { DirectiveHandler } from "./DirectiveHandler"
import { TextDirectiveHandler, ToolDirectiveHandler } from "./handlers"

export class DirectiveHandlerRegistry {
	private handlers: Map<string, DirectiveHandler> = new Map()
	private textHandler = new TextDirectiveHandler()

	register(handler: DirectiveHandler): void {
		this.handlers.set(handler.tagName, handler)
	}

	registerTool(toolName: string): void {
		this.register(new ToolDirectiveHandler(toolName))
	}

	getHandler(tagName: string): DirectiveHandler | undefined {
		return this.handlers.get(tagName)
	}

	getTextHandler(): TextDirectiveHandler {
		return this.textHandler
	}

	getAllHandlers(): DirectiveHandler[] {
		return [this.textHandler, ...Array.from(this.handlers.values())]
	}
}
