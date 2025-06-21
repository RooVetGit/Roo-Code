import { suite, test, expect } from "vitest"
import { DirectiveStreamingParser } from "../DirectiveStreamingParser"
import { ToolDirective, TextDirective, LogDirective } from "../directives"

suite("DirectiveStreamingParser", () => {
	test("should parse plain text content", () => {
		const input = "This is a simple text message."
		const result = DirectiveStreamingParser.parse(input)
		expect(result).toEqual([
			{
				type: "text",
				content: "This is a simple text message.",
				partial: true,
			} as TextDirective,
		])
	})

	test("should parse a tool use directive", () => {
		const input = "<read_file><path>src/app.ts</path></read_file>"
		const result = DirectiveStreamingParser.parse(input)
		expect(result).toEqual([
			{
				type: "tool_use",
				name: "read_file",
				params: { path: "src/app.ts" },
				partial: false,
			} as ToolDirective,
		])
	})

	test("should parse mixed content with text and tool use", () => {
		const input =
			"Some text here<apply_diff><path>src/file.ts</path><diff>diff content</diff></apply_diff>More text"
		const result = DirectiveStreamingParser.parse(input)
		expect(result).toEqual([
			{
				type: "text",
				content: "Some text here",
				partial: false,
			} as TextDirective,
			{
				type: "tool_use",
				name: "apply_diff",
				params: { path: "src/file.ts", diff: "diff content" },
				partial: false,
			} as ToolDirective,
			{
				type: "text",
				content: "More text",
				partial: true,
			} as TextDirective,
		])
	})

	test("should handle partial tool use directive", () => {
		const input = "<write_to_file><path>src/newfile.ts</path><content>Some content"
		const result = DirectiveStreamingParser.parse(input)
		expect(result).toEqual([
			{
				type: "tool_use",
				name: "write_to_file",
				params: { path: "src/newfile.ts", content: "Some content" },
				partial: true,
			} as ToolDirective,
		])
	})

	test("should not parse directives inside triple backticks as directives", () => {
		const input =
			"Some text with\n```\n<log_message>\n<message>This is a warning message</message>\n<level>warn</level>\n</log_message>\n```\nMore text"
		const result = DirectiveStreamingParser.parse(input)
		expect(result).toEqual([
			{
				type: "text",
				content:
					"Some text with\n```\n<log_message>\n<message>This is a warning message</message>\n<level>warn</level>\n</log_message>\n```\nMore text",
				partial: true,
			} as TextDirective,
		])
	})

	test("should handle mixed content with code blocks and directives", () => {
		const input =
			"Some text ```\n<log_message>\n<message>This is code</message>\n</log_message>\n```\nMore text\n<log_message>\n<message>This is a real directive</message>\n<level>info</level>\n</log_message>"
		const result = DirectiveStreamingParser.parse(input)
		expect(result).toHaveLength(2)
		expect(result[0].type).toBe("text")
		expect((result[0] as TextDirective).content).toContain("<log_message>")
		expect(result[1].type).toBe("log_message")
	})

	test("should handle multiple code blocks in single message", () => {
		const input =
			"Text ```\n<directive1>content1</directive1>\n``` middle ```\n<directive2>content2</directive2>\n``` end"
		const result = DirectiveStreamingParser.parse(input)
		expect(result).toEqual([
			{
				type: "text",
				content:
					"Text ```\n<directive1>content1</directive1>\n``` middle ```\n<directive2>content2</directive2>\n``` end",
				partial: true,
			} as TextDirective,
		])
	})

	test("should handle nested backticks inside code blocks", () => {
		const input = "Text ```\nSome `nested` backticks here\n``` end"
		const result = DirectiveStreamingParser.parse(input)
		expect(result).toEqual([
			{
				type: "text",
				content: "Text ```\nSome `nested` backticks here\n``` end",
				partial: true,
			} as TextDirective,
		])
	})

	test("should not treat incomplete backticks as code blocks", () => {
		const input =
			"Text with `single` and ``double`` backticks <log_message><message>Should be parsed</message><level>info</level></log_message>"
		const result = DirectiveStreamingParser.parse(input)
		expect(result).toHaveLength(2)
		expect(result[0].type).toBe("text")
		expect(result[1].type).toBe("log_message")
	})

	test("should not parse directives inside ```xml code blocks", () => {
		const input =
			"Here's the basic format:\n\n```xml\n<log_message>\n<message>This is a debug message for detailed troubleshooting information</message>\n<level>debug</level>\n</log_message>\n```\n\nThat should be treated as code."
		const result = DirectiveStreamingParser.parse(input)
		expect(result).toEqual([
			{
				type: "text",
				content:
					"Here's the basic format:\n\n```xml\n<log_message>\n<message>This is a debug message for detailed troubleshooting information</message>\n<level>debug</level>\n</log_message>\n```\n\nThat should be treated as code.",
				partial: true,
			} as TextDirective,
		])
	})

	test("should not parse directives inside code blocks within tool directive parameters", () => {
		const input =
			"<attempt_completion><result>Here's the format:\n\n```xml\n<log_message>\n<message>This should be plain text</message>\n<level>debug</level>\n</log_message>\n```\n\nThat's the format.</result></attempt_completion>"
		const result = DirectiveStreamingParser.parse(input)
		expect(result).toHaveLength(1)
		expect(result[0].type).toBe("tool_use")
		expect((result[0] as any).name).toBe("attempt_completion")
		expect((result[0] as any).params.result).toContain("```xml")
		expect((result[0] as any).params.result).toContain("<log_message>")
		expect((result[0] as any).params.result).toContain("This should be plain text")
		// The key test: ensure it's treated as one text block, not parsed as separate directives
		expect((result[0] as any).params.result).toBe(
			"Here's the format:\n\n```xml\n<log_message>\n<message>This should be plain text</message>\n<level>debug</level>\n</log_message>\n```\n\nThat's the format.",
		)
	})

	test("should not parse directives inside code blocks within tool directive parameters during streaming", () => {
		// Simulate streaming chunks
		const chunks = [
			"<attempt_completion>",
			"<result>Here's the format:\n\n```xml\n",
			"<log_message>\n<message>This should be plain text</message>\n<level>debug</level>\n</log_message>\n",
			"```\n\nThat's the format.</result>",
			"</attempt_completion>",
		]

		let accumulatedMessage = ""
		let finalResult: any[] = []

		// Test each streaming chunk
		for (const chunk of chunks) {
			accumulatedMessage += chunk
			const result = DirectiveStreamingParser.parse(accumulatedMessage)
			finalResult = result
		}

		// Final result should have only one directive (attempt_completion)
		expect(finalResult).toHaveLength(1)
		expect(finalResult[0].type).toBe("tool_use")
		expect(finalResult[0].name).toBe("attempt_completion")

		// The result parameter should contain the log_message as plain text
		expect(finalResult[0].params.result).toContain("<log_message>")
		expect(finalResult[0].params.result).toContain("This should be plain text")

		// Most importantly: there should be NO separate log_message directive
		const logMessages = finalResult.filter((r: any) => r.type === "log_message")
		expect(logMessages).toHaveLength(0)
	})

	test("should handle malformed XML that might trigger FallbackParser", () => {
		// Test a scenario that might cause parse errors and trigger FallbackParser
		const input =
			"<attempt_completion><result>Here's the format:\n\n```xml\n<log_message>\n<message>This should be plain text</message>\n<level>debug</level>\n</log_message>\n```\n\nThat's the format.</result></attempt_completion>"

		// Add some malformed XML to potentially trigger fallback
		const malformedInput = input + "<unclosed_tag>"

		const result = DirectiveStreamingParser.parse(malformedInput)

		// Should still not parse log_message as separate directive
		const logMessages = result.filter((r: any) => r.type === "log_message")
		expect(logMessages).toHaveLength(0)

		// Should have attempt_completion with log_message preserved as text
		const attemptCompletion = result.find((r: any) => r.type === "tool_use" && r.name === "attempt_completion")
		expect(attemptCompletion).toBeDefined()
		if (attemptCompletion && attemptCompletion.type === "tool_use") {
			expect((attemptCompletion as any).params.result).toContain("<log_message>")
		}
	})

	test("should handle real-world scenario with log message example", () => {
		// Test a scenario similar to what's shown in the user's image
		const input = `I'm happy to provide an example of the XML format for the log_message directive.

<log_message>
<message>This is an example log message for demonstration purposes</message>
<level>info</level>
</log_message>

<attempt_completion>
<result>I've provided an example of the XML format for the log_message directive.</result>
</attempt_completion>`

		const result = DirectiveStreamingParser.parse(input)

		// Should have text, log_message, and attempt_completion
		expect(result).toHaveLength(3)
		expect(result[0].type).toBe("text")
		expect(result[1].type).toBe("log_message")
		expect(result[2].type).toBe("tool_use")

		// The log message should be processed as a real directive (this is correct behavior)
		expect((result[1] as any).message).toBe("This is an example log message for demonstration purposes")
		expect((result[1] as any).level).toBe("info")
	})

	test("should NOT process log messages inside code blocks in attempt_completion", () => {
		// Test the problematic scenario
		const input = `<attempt_completion>
<result>Here's an example:

\`\`\`xml
<log_message>
<message>This should NOT be processed as a log directive</message>
<level>debug</level>
</log_message>
\`\`\`

That's the format.</result>
</attempt_completion>`

		const result = DirectiveStreamingParser.parse(input)

		// Should only have the attempt_completion directive
		expect(result).toHaveLength(1)
		expect(result[0].type).toBe("tool_use")
		expect((result[0] as any).name).toBe("attempt_completion")

		// The result should contain the log_message as plain text
		expect((result[0] as any).params.result).toContain("<log_message>")
		expect((result[0] as any).params.result).toContain("This should NOT be processed as a log directive")

		// Most importantly: NO separate log_message directive should exist
		const logMessages = result.filter((r) => r.type === "log_message")
		expect(logMessages).toHaveLength(0)
	})

	test("should handle log message directly inside attempt_completion result", () => {
		// Test the actual scenario from the user's image - log message directly inside attempt_completion result
		const input = `<attempt_completion>
<result>I'm happy to provide an example of the XML format for the log_message directive.

<log_message>
<message>This is an example log message for demonstration purposes</message>
<level>info</level>
</log_message>

I've provided an example of the XML format for the log_message directive.</result>
</attempt_completion>`

		const result = DirectiveStreamingParser.parse(input)

		console.log("Result:", JSON.stringify(result, null, 2))

		// Should only have the attempt_completion directive
		expect(result).toHaveLength(1)
		expect(result[0].type).toBe("tool_use")
		expect((result[0] as any).name).toBe("attempt_completion")

		// The result should contain the log_message as plain text (NOT as a separate directive)
		expect((result[0] as any).params.result).toContain("<log_message>")
		expect((result[0] as any).params.result).toContain("This is an example log message for demonstration purposes")

		// Most importantly: NO separate log_message directive should exist
		const logMessages = result.filter((r) => r.type === "log_message")
		expect(logMessages).toHaveLength(0)
	})

	test("should correctly identify code block contexts in various scenarios", () => {
		// Test that the extracted isInsideCodeBlock logic works correctly
		// by testing scenarios that depend on this logic

		// Test 1: Code block should prevent directive parsing
		const codeBlockInput = "Text ```\n<log_message><message>Should not parse</message></log_message>\n``` end"
		const codeBlockResult = DirectiveStreamingParser.parse(codeBlockInput)
		expect(codeBlockResult).toHaveLength(1)
		expect(codeBlockResult[0].type).toBe("text")
		expect((codeBlockResult[0] as any).content).toContain("<log_message>")

		// Test 2: Tool parameter code block should prevent directive parsing
		const toolParamCodeBlockInput =
			"<attempt_completion><result>```\n<log_message><message>Should not parse</message></log_message>\n```</result></attempt_completion>"
		const toolParamResult = DirectiveStreamingParser.parse(toolParamCodeBlockInput)
		expect(toolParamResult).toHaveLength(1)
		expect(toolParamResult[0].type).toBe("tool_use")
		expect((toolParamResult[0] as any).name).toBe("attempt_completion")
		expect((toolParamResult[0] as any).params.result).toContain("<log_message>")

		// Ensure no separate log_message directive was created
		const logMessages = toolParamResult.filter((r) => r.type === "log_message")
		expect(logMessages).toHaveLength(0)

		// Test 3: Normal directive parsing outside code blocks should still work
		const normalInput = "<log_message><message>Should parse normally</message><level>info</level></log_message>"
		const normalResult = DirectiveStreamingParser.parse(normalInput)
		expect(normalResult).toHaveLength(1)
		expect(normalResult[0].type).toBe("log_message")
		expect((normalResult[0] as any).message).toBe("Should parse normally")
	})
})
