import { FallbackParser } from "../FallbackParser"
import { LogDirective, TextDirective } from "../directives"

describe("FallbackParser", () => {
	test("should not parse log messages inside code blocks", () => {
		const input = `Here's the format:

\`\`\`xml
<log_message>
<message>This should be plain text</message>
<level>debug</level>
</log_message>
\`\`\`

That should be treated as code.`

		const result = FallbackParser.parse(input)

		// Should only have text directive, no log message directive
		expect(result).toHaveLength(1)
		expect(result[0].type).toBe("text")
		expect((result[0] as TextDirective).content).toContain("<log_message>")
		expect((result[0] as TextDirective).content).toContain("This should be plain text")
	})

	test("should parse log messages outside code blocks", () => {
		const input = `Some text

<log_message>
<message>This is a real log message</message>
<level>info</level>
</log_message>

More text with code:

\`\`\`xml
<log_message>
<message>This should be ignored</message>
<level>debug</level>
</log_message>
\`\`\`

End text.`

		const result = FallbackParser.parse(input)

		// Should have text + log message + text
		expect(result).toHaveLength(3)
		expect(result[0].type).toBe("text")
		expect(result[1].type).toBe("log_message")
		expect((result[1] as LogDirective).message).toBe("This is a real log message")
		expect(result[2].type).toBe("text")
		expect((result[2] as TextDirective).content).toContain("This should be ignored")
	})

	test("should handle attempt_completion with log messages in code blocks", () => {
		const input = `<attempt_completion><result>Here's the format:

\`\`\`xml
<log_message>
<message>This should be plain text</message>
<level>debug</level>
</log_message>
\`\`\`

That's the format.</result></attempt_completion>`

		const result = FallbackParser.parse(input)

		// Should have tool directive, no separate log message
		expect(result).toHaveLength(1)
		expect(result[0].type).toBe("tool_use")
		expect((result[0] as any).name).toBe("attempt_completion")
		expect((result[0] as any).params.result).toContain("<log_message>")
		expect((result[0] as any).params.result).toContain("This should be plain text")

		// No separate log message directive
		const logMessages = result.filter((r) => r.type === "log_message")
		expect(logMessages).toHaveLength(0)
	})
})
