# Tool Implementations

This directory contains all the tool implementations used by the Roo Code extension. Each tool is implemented as a class that extends the `BaseTool` abstract class.

## Tool Implementation Pattern

All tools follow a consistent implementation pattern:

1. Each tool is implemented as a class that extends `BaseTool`
2. Each tool must implement the `getName()` and `execute()` methods
3. Tools can use helper methods from `BaseTool` like `validateRequiredParams()` and `handlePartial()`

Example:

```typescript
import { BaseTool } from "../BaseTool"
import { Cline } from "../../Cline"
import { ToolUse } from "../../assistant-message"
import { AskApproval, HandleError, PushToolResult, RemoveClosingTag } from "../types"

export class MyTool extends BaseTool {
	public getName(): string {
		return "my_tool"
	}

	public async execute(
		cline: Cline,
		block: ToolUse,
		askApproval: AskApproval,
		handleError: HandleError,
		pushToolResult: PushToolResult,
		removeClosingTag: RemoveClosingTag,
	): Promise<void> {
		const param1: string | undefined = block.params.param1

		try {
			// Handle partial blocks
			if (block.partial) {
				await cline.ask("tool", "Partial message", block.partial).catch(() => {})
				return
			}

			// Validate required parameters
			if (!param1) {
				cline.consecutiveMistakeCount++
				pushToolResult(await cline.sayAndCreateMissingParamError("my_tool", "param1"))
				return
			}

			// Reset consecutive mistake count
			cline.consecutiveMistakeCount = 0

			// Implement tool logic here

			// Push result
			pushToolResult("Tool executed successfully")
		} catch (error) {
			await handleError("executing my tool", error)
		}
	}
}
```

## Adding a New Tool

To add a new tool:

1. Create a new class in this directory that extends `BaseTool`
2. Implement the `getName()` and `execute()` methods
3. Register the tool in `src/core/tools/ToolFactory.ts`
4. Add the tool description in `src/core/prompts/tools/`
5. Add tests for the tool in `__tests__/` directory

## Tool Registration

All tools must be registered in the `ToolFactory` class to be available for use:

```typescript
// In ToolFactory.ts
private registerTools(): void {
    // Register existing tools
    this.registerTool(new ReadFileTool())
    this.registerTool(new WriteToFileTool())
    // ...

    // Register the new tool
    this.registerTool(new MyTool())
}
```

## Tool Testing

Each tool should have corresponding tests in the `__tests__` directory. Tests should cover:

1. Basic functionality
2. Parameter validation
3. Error handling
4. Partial block handling

See existing tests for examples of how to structure tool tests.
