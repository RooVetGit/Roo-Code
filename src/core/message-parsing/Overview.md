# Message Parsing System

This directory contains the core message parsing system that processes AI assistant responses and converts them into structured directives that the extension can execute.

## Overview

The message parsing system is responsible for:

- Parsing streaming AI responses containing XML-formatted directives
- Handling mixed content (text + XML tools + code blocks)
- Converting parsed content into actionable directives
- Managing parsing state and error recovery

## Core Components

### Main Parser

- **`DirectiveStreamingParser.ts`** - Primary streaming XML parser using SAX
- **`ParseContext.ts`** - Parsing state management and context tracking
- **`presentAssistantMessage.ts`** - Main entry point for processing assistant messages

### Directive System

- **`directives/`** - Defines the core directive types:
    - `TextDirective` - Plain text content
    - `ToolDirective` - Tool execution commands
    - `LogDirective` - Logging and debugging output
    - `Directive.ts` - Union type for all directive types

### Tool Directives

- **`directives/tool-directives/`** - Specific tool implementations:
    - File operations: `ReadFileToolDirective`, `WriteToFileToolDirective`
    - Code manipulation: `SearchAndReplaceToolDirective`, `InsertCodeBlockToolDirective`
    - System interaction: `ExecuteCommandToolDirective`, `BrowserActionToolDirective`
    - Navigation: `ListFilesToolDirective`, `SearchFilesToolDirective`
    - MCP integration: `UseMcpToolToolDirective`, `AccessMcpResourceToolDirective`
    - Task management: `NewTaskToolDirective`, `AttemptCompletionToolDirective`

### Handler System

- **`handlers/`** - Directive-specific parsing handlers:
    - `BaseDirectiveHandler.ts` - Base class for all handlers
    - `TextDirectiveHandler.ts` - Handles plain text content
    - `ToolDirectiveHandler.ts` - Handles tool execution directives
    - `LogDirectiveHandler.ts` - Handles logging directives

### Registry & Factory

- **`DirectiveHandlerRegistry.ts`** - Registry for mapping XML tags to handlers
- **`DirectiveRegistryFactory.ts`** - Factory for creating handler registries
- **`DirectiveHandler.ts`** - Base directive handler interface

### Parsing Utilities

- **`CodeBlockStateMachine.ts`** - State machine for handling code block parsing
- **`FallbackParser.ts`** - Fallback parser for malformed XML
- **`ParameterCodeBlockHandler.ts`** - Specialized handler for parameter code blocks
- **`XmlUtils.ts`** - XML parsing utilities and helpers

## Key Features

### Streaming Parser

The system uses a SAX-based streaming parser that can handle:

- Incomplete XML messages (streaming in progress)
- Mixed content (text, XML, and code blocks)
- Malformed XML with graceful fallback
- Code block detection and preservation

### State Management

The `ParseContext` tracks:

- Current parsing state
- Code block boundaries
- XML tag completion status
- Content accumulation

### Error Recovery

- Graceful handling of incomplete XML during streaming
- Fallback parsing for malformed content
- Preservation of partial tool directives

### Tool Integration

Each tool directive corresponds to a specific AI capability:

- File system operations
- Terminal command execution
- Web browser automation
- Code search and manipulation
- MCP (Model Context Protocol) tool usage

## Usage

```typescript
import { DirectiveStreamingParser } from "./DirectiveStreamingParser"

// Parse assistant message into directives
const directives = DirectiveStreamingParser.parse(assistantMessage)

// Process each directive
for (const directive of directives) {
	switch (directive.type) {
		case "text":
			// Handle text content
			break
		case "tool_use":
			// Execute tool with directive.name and directive.params
			break
		case "log":
			// Handle logging directive
			break
	}
}
```

## Testing

The `__tests__/` directory contains comprehensive tests for:

- Core parser functionality
- State machine behavior
- Fallback parsing scenarios
- Individual directive parsing

Run tests with:

```bash
pnpm test
```
