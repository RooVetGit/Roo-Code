## Extension Tool API

Roo now provides an API for VSCode extensions to register custom tools that can be used by Roo. This allows other extensions to extend Roo's capabilities without modifying the Roo codebase.

### Using the Extension Tool API

To use the Extension Tool API, your extension needs to:

1. Add `RooVeterinaryInc.roo-cline` as an extension dependency in your `package.json`.
2. Get the Roo extension API and access the `extensionTools` property.
3. Register your tools using the `registerTool` method.

Here's a simple example:

```typescript
// Access the Roo extension
const rooExtension = vscode.extensions.getExtension<RooAPI>("RooVeterinaryInc.roo-cline")

if (rooExtension && rooExtension.exports.extensionTools) {
	// Register a tool
	rooExtension.exports.extensionTools.registerTool(context.extension.id, {
		name: "my_tool",
		description: "Description of what the tool does",
		inputSchema: {
			// Optional JSON schema for tool arguments
			type: "object",
			properties: {
				myArg: {
					type: "string",
					description: "Description of the argument",
				},
			},
		},
		execute: async (args) => {
			// Implement your tool functionality
			return {
				content: [
					{
						type: "text",
						text: "Result of the tool execution",
					},
				],
			}
		},
	})
}
```

### Tool Response Format

Tools return responses in the same format as MCP tools:

```typescript
{
  content: [
    {
      type: 'text',
      text: 'Text content'
    }
    // Can also include resources
  ],
  isError?: boolean // Optional flag to indicate if the tool execution failed
}
```

### Example Extension

See the [Roo-NB](https://github.com/RooVeterinaryInc/Roo-NB) extension for a complete example of a tool provider extension.
