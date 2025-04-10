# Tool Abstraction

This directory contains the implementation of the tool abstraction layer for Roo-Code. The abstraction layer provides a unified way to implement and use tools in the codebase.

## Overview

The tool abstraction layer consists of the following components:

1. **BaseTool**: An abstract class that defines the interface for all tools.
2. **ToolFactory**: A factory class that creates tool instances based on the tool name.
3. **ToolExecutor**: A class that executes tools using the factory.
4. **Tool Implementations**: Concrete implementations of the BaseTool abstract class.

## Usage

### Using the Tool Abstraction in Cline.ts

The `Cline.ts` file uses the `ToolExecutor` to execute tools:

```typescript
const toolExecutor = new ToolExecutor()
await toolExecutor.executeToolUse(
	this,
	block,
	askApproval,
	handleError,
	pushToolResult,
	removeClosingTag,
	toolDescription,
	askFinishSubTaskApproval,
)
```

### Implementing a New Tool

To implement a new tool:

1. Create a new class that extends `BaseTool` in the `implementations` directory.
2. Implement the `getName()` and `execute()` methods.
3. Register the tool in the `ToolFactory` class.

Example:

```typescript
import { BaseTool } from "../BaseTool"
import { Cline } from "../../Cline"
import { ToolUse } from "../../assistant-message"
import { AskApproval, HandleError, PushToolResult, RemoveClosingTag } from "../types"

export class MyNewTool extends BaseTool {
	public getName(): string {
		return "my_new_tool"
	}

	public async execute(
		cline: Cline,
		block: ToolUse,
		askApproval: AskApproval,
		handleError: HandleError,
		pushToolResult: PushToolResult,
		removeClosingTag: RemoveClosingTag,
	): Promise<void> {
		// Implement the tool logic here
	}
}
```

Then register the tool in the `ToolFactory` class:

```typescript
// In ToolFactory.ts
private registerTools(): void {
    // Register existing tools
    this.registerTool(new ReadFileTool());
    this.registerTool(new WriteToFileTool());
    // ...

    // Register the new tool
    this.registerTool(new MyNewTool());
}
```

## Benefits

The tool abstraction layer provides several benefits:

1. **Consistency**: All tools follow the same interface and pattern.
2. **Extensibility**: New tools can be added easily without modifying the core code.
3. **Testability**: Tools can be tested in isolation.
4. **Maintainability**: The code is more organized and easier to maintain.
5. **Reusability**: Common functionality can be shared between tools.

## Future Improvements

Potential future improvements to the tool abstraction layer:

1. **Tool Configuration**: Add support for tool-specific configuration.
2. **Tool Dependencies**: Allow tools to depend on other tools.
3. **Tool Versioning**: Add support for versioning tools.
4. **Tool Documentation**: Generate documentation for tools automatically.
5. **Tool Validation**: Add more robust validation for tool parameters.
