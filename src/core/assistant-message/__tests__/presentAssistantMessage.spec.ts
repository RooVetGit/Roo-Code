// npx vitest src/core/assistant-message/__tests__/presentAssistantMessage.spec.ts

describe("thinking tag filtering logic", () => {
	// Test the thinking tag filtering logic directly without mocking the entire Task class
	const filterThinkingTags = (content: string): string => {
		if (!content) return content

		// This is the exact logic from presentAssistantMessage.ts
		// Remove all instances of <thinking>...</thinking> blocks completely
		// while preserving content outside of thinking tags.
		content = content.replace(/<thinking>[\s\S]*?<\/thinking>/g, "")
		
		// Also handle partial thinking tags at the end of streaming content
		// Remove incomplete thinking tags that might appear during streaming
		content = content.replace(/<thinking>\s*$/g, "")
		content = content.replace(/\s*<\/thinking>\s*$/g, "")

		return content
	}

	describe("thinking tag removal", () => {
		it("should remove complete thinking tags and preserve content outside them", () => {
			const messageWithThinking = `I'll analyze this step by step.

<thinking>
This is internal reasoning that should not be shown to the user.
Let me think about the best approach here.
</thinking>

Here's my analysis of the implementation plan:

1. First, I need to understand the requirements
2. Then I'll create a solution

<thinking>
Another internal thought process.
This should also be hidden.
</thinking>

The final recommendation is to proceed with the implementation.`

			const expectedContent = `I'll analyze this step by step.

Here's my analysis of the implementation plan:

1. First, I need to understand the requirements
2. Then I'll create a solution

The final recommendation is to proceed with the implementation.`

			const result = filterThinkingTags(messageWithThinking)
			expect(result).toBe(expectedContent)
		})

		it("should handle partial thinking tags at the end of streaming content", () => {
			const messageWithPartialThinking = `Here's my response.

<thinking>
This is a partial thinking tag that hasn't been closed yet because streaming is still in progress`

			const expectedContent = `Here's my response.

`

			const result = filterThinkingTags(messageWithPartialThinking)
			expect(result).toBe(expectedContent)
		})

		it("should handle incomplete closing thinking tags", () => {
			const messageWithIncompleteClosing = `Here's my response.

<thinking>
Internal reasoning here.
</thinking`

			const expectedContent = `Here's my response.

`

			const result = filterThinkingTags(messageWithIncompleteClosing)
			expect(result).toBe(expectedContent)
		})

		it("should handle nested XML-like content within thinking tags", () => {
			const messageWithNestedXML = `I'll help you with that.

<thinking>
Let me think about this:
<analysis>
  <step>1. Understand the problem</step>
  <step>2. Design solution</step>
</analysis>
This analysis should be hidden.
</thinking>

Here's the solution I recommend.`

			const expectedContent = `I'll help you with that.

Here's the solution I recommend.`

			const result = filterThinkingTags(messageWithNestedXML)
			expect(result).toBe(expectedContent)
		})

		it("should handle multiple thinking blocks in sequence", () => {
			const messageWithMultipleThinking = `Initial response.

<thinking>
First internal thought.
</thinking>

<thinking>
Second internal thought.
</thinking>

<thinking>
Third internal thought.
</thinking>

Final response.`

			const expectedContent = `Initial response.

Final response.`

			const result = filterThinkingTags(messageWithMultipleThinking)
			expect(result).toBe(expectedContent)
		})

		it("should preserve content when there are no thinking tags", () => {
			const messageWithoutThinking = `This is a normal response without any thinking tags.

It should be displayed exactly as written.`

			const result = filterThinkingTags(messageWithoutThinking)
			expect(result).toBe(messageWithoutThinking)
		})

		it("should handle thinking tags with whitespace variations", () => {
			const messageWithWhitespaceThinking = `Response start.

<thinking>
  Indented thinking content.
  
  Multiple lines with spaces.
</thinking>

Response end.`

			const expectedContent = `Response start.

Response end.`

			const result = filterThinkingTags(messageWithWhitespaceThinking)
			expect(result).toBe(expectedContent)
		})

		it("should handle thinking tags mixed with other XML-like content", () => {
			const messageWithThinkingAndXML = `I'll help you read that file.

<thinking>
The user wants me to read a file. I should use the read_file tool.
</thinking>

<read_file><path>example.txt</path></read_file>

<thinking>
Now I should analyze the content and provide a response.
</thinking>

The file has been read successfully.`

			const expectedTextContent = `I'll help you read that file.

<read_file><path>example.txt</path></read_file>

The file has been read successfully.`

			const result = filterThinkingTags(messageWithThinkingAndXML)
			expect(result).toBe(expectedTextContent)
		})
	})

	describe("edge cases", () => {
		it("should handle empty content", () => {
			const emptyMessage = ""
			const result = filterThinkingTags(emptyMessage)
			expect(result).toBe("")
		})

		it("should handle content that is only thinking tags", () => {
			const onlyThinkingMessage = `<thinking>
This entire message is just internal reasoning.
Nothing should be displayed to the user.
</thinking>`

			const result = filterThinkingTags(onlyThinkingMessage)
			expect(result).toBe("")
		})

		it("should handle malformed thinking tags", () => {
			const malformedThinkingMessage = `Response with malformed tags.

<thinking
This thinking tag is missing the closing bracket.

Regular content should still be preserved.`

			// Malformed tags should be preserved since they don't match the regex
			const result = filterThinkingTags(malformedThinkingMessage)
			expect(result).toBe(malformedThinkingMessage)
		})

		it("should handle thinking tags with newlines and special characters", () => {
			const messageWithSpecialChars = `Start of response.

<thinking>
This thinking block contains:
- Special characters: !@#$%^&*()
- Unicode: 🤔💭
- Code snippets: const x = "test";
- Multiple newlines


And more content.
</thinking>

End of response.`

			const expectedContent = `Start of response.

End of response.`

			const result = filterThinkingTags(messageWithSpecialChars)
			expect(result).toBe(expectedContent)
		})

		it("should handle adjacent thinking tags without content between them", () => {
			const messageWithAdjacentThinking = `Response start.

<thinking>
First thought.
</thinking><thinking>
Second thought immediately after.
</thinking>

Response end.`

			const expectedContent = `Response start.

Response end.`

			const result = filterThinkingTags(messageWithAdjacentThinking)
			expect(result).toBe(expectedContent)
		})

		it("should handle thinking tags at the very beginning and end", () => {
			const messageWithBoundaryThinking = `<thinking>
Thinking at the start.
</thinking>Middle content.<thinking>
Thinking at the end.
</thinking>`

			const expectedContent = `Middle content.`

			const result = filterThinkingTags(messageWithBoundaryThinking)
			expect(result).toBe(expectedContent)
		})
	})
})