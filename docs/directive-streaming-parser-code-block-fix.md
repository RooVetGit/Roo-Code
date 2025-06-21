# DirectiveStreamingParser Code Block Fix - Implementation Plan

## Problem Statement

The test `"should not parse directives inside triple backticks as directives"` in [`src/core/message-parsing/__tests__/directive-streaming-parser.spec.ts`](../src/core/message-parsing/__tests__/directive-streaming-parser.spec.ts) is failing because the [`DirectiveStreamingParser`](../src/core/message-parsing/DirectiveStreamingParser.ts) currently parses XML directives inside code blocks (`...`) instead of treating them as plain text.

### Current Behavior

````
Input: "Some text\n```\n<log_message>content</log_message>\n```\nMore text"
Output: [TextDirective, LogDirective, TextDirective] ❌
````

### Expected Behavior

````
Input: "Some text\n```\n<log_message>content</log_message>\n```\nMore text"
Output: [TextDirective] ✅ (entire content as single text block)
````

## Streaming Complexity

The parser must handle **true streaming scenarios** where code block boundaries can be split across message chunks:

### Example Streaming Scenario

````
Chunk 1: "Some text with\n`"
Chunk 2: "``\n<log_message>\n<message>"
Chunk 3: "This is an example</message>\n<level>warn</level>"
Chunk 4: "\n</log_message>\n```\nMore text"
````

**Challenge**: The ``` boundary is split across chunks 1-2, requiring stateful parsing.

## Solution: Streaming-Aware State Machine

### Architecture Overview

````mermaid
flowchart TD
    A[Streaming Text Input] --> B[Code Block State Machine]
    B --> C{Current State}
    C -->|OUTSIDE| D[Check for ``` Start]
    C -->|INSIDE| E[Check for ``` End]
    C -->|PARTIAL_START| F[Complete ``` Detection]
    C -->|PARTIAL_END| G[Complete ``` End Detection]

    D -->|Found ```| H[Enter INSIDE State]
    D -->|Partial `| I[Enter PARTIAL_START State]
    D -->|Normal Text| J[Process as Text/XML]

    E -->|Found ```| K[Exit to OUTSIDE State]
    E -->|Partial `| L[Enter PARTIAL_END State]
    E -->|Normal Text| M[Accumulate as Plain Text]

    F -->|Complete ```| H
    F -->|More `| F
    F -->|Not ```| N[Revert to OUTSIDE + Process]

    G -->|Complete ```| K
    G -->|More `| G
    G -->|Not ```| M

    H --> O[Suppress XML Parsing]
    K --> P[Resume XML Parsing]
    M --> Q[Add to Code Block Content]
    J --> R[Allow Directive Processing]
````

### State Machine Definition

````typescript
enum CodeBlockState {
	OUTSIDE = "outside", // Normal parsing mode
	INSIDE = "inside", // Inside code block - suppress XML
	PARTIAL_START = "partial_start", // Detected partial ``` at start
	PARTIAL_END = "partial_end", // Detected partial ``` at end
}
````

## Implementation Plan

### Phase 1: Extend ParseContext

**File**: [`src/core/message-parsing/ParseContext.ts`](../src/core/message-parsing/ParseContext.ts)

````typescript
export interface ParseContext {
	currentText: string
	contentBlocks: Directive[]
	hasXmlTags: boolean
	hasIncompleteXml: boolean

	// New code block state tracking
	codeBlockState: CodeBlockState
	pendingBackticks: string // For partial ``` detection
	codeBlockContent: string // Accumulated content inside code blocks
	codeBlockStartIndex: number // Track where code block started
}
````

### Phase 2: Create Code Block State Machine

**New File**: `src/core/message-parsing/CodeBlockStateMachine.ts`

```typescript
export interface ProcessedTextResult {
	processedText: string
	suppressXmlParsing: boolean
	stateChanged: boolean
}

export class CodeBlockStateMachine {
	processText(text: string, context: ParseContext): ProcessedTextResult {
		// Core state machine logic
		// Handle all edge cases for partial boundaries
		// Return processed text and parsing instructions
	}

	private detectCodeBlockBoundary(
		text: string,
		startIndex: number,
	): {
		found: boolean
		endIndex: number
		isComplete: boolean
	}

	private handlePartialBoundary(text: string, context: ParseContext): void

	private transitionState(newState: CodeBlockState, context: ParseContext): void
}
```

### Phase 3: Enhanced TextDirectiveHandler

**File**: [`src/core/message-parsing/handlers/TextDirectiveHandler.ts`](../src/core/message-parsing/handlers/TextDirectiveHandler.ts)

```typescript
export class TextDirectiveHandler extends BaseDirectiveHandler {
	private stateMachine = new CodeBlockStateMachine()

	override onText(text: string, context: ParseContext): void {
		const result = this.stateMachine.processText(text, context)

		if (result.suppressXmlParsing) {
			// Inside code block - accumulate as plain text
			context.codeBlockContent += result.processedText
		} else {
			// Normal text processing
			if (this.currentState === "text") {
				context.currentText += result.processedText
			}
		}
	}

	override onEnd(context: ParseContext): void {
		// Handle any remaining code block content
		if (context.codeBlockContent) {
			context.currentText += context.codeBlockContent
		}

		if (context.currentText.trim()) {
			context.contentBlocks.push({
				type: "text",
				content: context.currentText.trim(),
				partial: true,
			} as TextDirective)
		}
	}
}
```

### Phase 4: Parser-Level Integration

**File**: [`src/core/message-parsing/DirectiveStreamingParser.ts`](../src/core/message-parsing/DirectiveStreamingParser.ts)

```typescript
export class DirectiveStreamingParser {
	static parse(assistantMessage: string): Directive[] {
		const context: ParseContext = {
			// ... existing fields
			codeBlockState: CodeBlockState.OUTSIDE,
			pendingBackticks: "",
			codeBlockContent: "",
			codeBlockStartIndex: -1,
		}

		// ... existing parser setup

		parser.onopentag = (node: sax.Tag) => {
			// Only process XML tags if NOT inside code block
			if (context.codeBlockState !== CodeBlockState.INSIDE) {
				// Existing XML processing logic
				context.hasXmlTags = true
				tagStack.push(node.name)
				const handler = this.registry.getHandler(node.name)
				// ... rest of existing logic
			} else {
				// Inside code block - treat as plain text
				const tagText = `<${node.name}${this.attributesToString(node.attributes)}>`
				this.registry.getTextHandler().onText(tagText, context)
			}
		}

		parser.onclosetag = (tagName: string) => {
			if (context.codeBlockState !== CodeBlockState.INSIDE) {
				// Existing close tag logic
			} else {
				// Inside code block - treat as plain text
				this.registry.getTextHandler().onText(`</${tagName}>`, context)
			}
		}

		// ... rest of existing logic
	}

	private attributesToString(attributes: { [key: string]: string }): string {
		return Object.entries(attributes)
			.map(([key, value]) => ` ${key}="${value}"`)
			.join("")
	}
}
```

## Edge Cases to Handle

### 1. Partial Boundaries Across Chunks

````typescript
// Chunk 1: "text `"
// Chunk 2: "``\ncontent"
// Expected: Detect complete ``` boundary
````

### 2. Multiple Code Blocks

````typescript
// "text ```code1``` more ```code2``` end"
// Expected: Two separate code blocks, both suppressed
````

### 3. Nested Backticks

````typescript
// "```\nSome `code` here\n```"
// Expected: Inner backticks treated as literal text
````

### 4. Malformed Boundaries

```typescript
// "text `` incomplete"
// Expected: Treat as normal text, not code block
```

### 5. Mixed Content

````typescript
// "text ```code``` <directive>content</directive>"
// Expected: Code block as text, directive processed normally
````

## Test Strategy

### New Test Cases Required

**File**: [`src/core/message-parsing/__tests__/directive-streaming-parser.spec.ts`](../src/core/message-parsing/__tests__/directive-streaming-parser.spec.ts)

````typescript
describe("Code Block Handling", () => {
	test("should handle partial code block boundaries across chunks", () => {
		// Test streaming scenario with split boundaries
	})

	test("should handle multiple code blocks in single message", () => {
		// Test multiple ```...``` blocks
	})

	test("should handle mixed content with code blocks and directives", () => {
		// Test your example scenario
	})

	test("should handle nested backticks inside code blocks", () => {
		// Test backticks within code blocks
	})

	test("should handle malformed code block boundaries", () => {
		// Test incomplete or invalid ``` patterns
	})

	test("should maintain performance with large messages", () => {
		// Performance regression test
	})
})
````

### Existing Test Verification

- ✅ All existing tests must continue to pass
- ✅ Specifically: `"should not parse directives inside triple backticks as directives"`
- ✅ No regression in normal directive parsing

## Performance Considerations

### Optimization Strategies

1. **Lazy Activation**: Only activate state machine when backticks detected
2. **Efficient String Processing**: Minimize string concatenation overhead
3. **State Caching**: Cache frequently accessed state information
4. **Early Exit**: Skip processing when clearly outside code blocks

### Performance Benchmarks

- Measure parsing time for messages with/without code blocks
- Test memory usage with large messages containing multiple code blocks
- Verify no significant regression in normal parsing scenarios

## Implementation Checklist

### Phase 1: Core Infrastructure

- [ ] Extend [`ParseContext`](../src/core/message-parsing/ParseContext.ts) with code block state
- [ ] Create `CodeBlockStateMachine` class
- [ ] Implement state transition logic
- [ ] Add comprehensive unit tests for state machine

### Phase 2: Parser Integration

- [ ] Modify [`DirectiveStreamingParser`](../src/core/message-parsing/DirectiveStreamingParser.ts) to check code block state
- [ ] Update XML tag processing to respect code block state
- [ ] Handle attribute serialization for suppressed tags
- [ ] Test parser-level integration

### Phase 3: Handler Updates

- [ ] Enhance [`TextDirectiveHandler`](../src/core/message-parsing/handlers/TextDirectiveHandler.ts) with state machine
- [ ] Update text processing logic
- [ ] Handle code block content accumulation
- [ ] Test handler-level functionality

### Phase 4: Comprehensive Testing

- [ ] Add all edge case tests
- [ ] Verify existing test compatibility
- [ ] Performance benchmarking
- [ ] Integration testing with real streaming scenarios

### Phase 5: Documentation & Cleanup

- [ ] Update code documentation
- [ ] Add inline comments for complex logic
- [ ] Performance optimization if needed
- [ ] Final integration testing

## Risk Mitigation

### Potential Issues

1. **Complex State Management**: Multiple edge cases to handle
2. **Performance Impact**: Additional processing overhead
3. **Backward Compatibility**: Existing functionality must remain intact
4. **Memory Usage**: State persistence across chunks

### Mitigation Strategies

1. **Comprehensive Testing**: Cover all identified edge cases
2. **Performance Benchmarking**: Measure and optimize impact
3. **Gradual Rollout**: Feature flag for new behavior if needed
4. **Fallback Mechanism**: Graceful degradation on state machine errors

## Success Criteria

- ✅ Failing test `"should not parse directives inside triple backticks as directives"` passes
- ✅ All existing tests continue to pass
- ✅ Handles streaming scenarios with partial code block boundaries
- ✅ Performance impact < 10% for normal parsing scenarios
- ✅ Memory usage remains stable for large messages
- ✅ Comprehensive test coverage for all edge cases

## Files to Modify/Create

### Modified Files

1. [`src/core/message-parsing/ParseContext.ts`](../src/core/message-parsing/ParseContext.ts)
2. [`src/core/message-parsing/DirectiveStreamingParser.ts`](../src/core/message-parsing/DirectiveStreamingParser.ts)
3. [`src/core/message-parsing/handlers/TextDirectiveHandler.ts`](../src/core/message-parsing/handlers/TextDirectiveHandler.ts)
4. [`src/core/message-parsing/__tests__/directive-streaming-parser.spec.ts`](../src/core/message-parsing/__tests__/directive-streaming-parser.spec.ts)

### New Files

1. `src/core/message-parsing/CodeBlockStateMachine.ts`
2. `src/core/message-parsing/__tests__/code-block-state-machine.spec.ts`

This comprehensive plan addresses the streaming nature of the parser while ensuring robust handling of all edge cases related to code block detection and XML directive suppression.
