import { parseAssistantMessage } from "../parseAssistantMessage"

describe("parseAssistantMessage – inline / codeblock tool mentions", () => {
	it("treats inline <read_file> mention as plain text", () => {
		const message = "Use the `<read_file>` tool when you need to read a file."
		const result = parseAssistantMessage(message)
		expect(result).toHaveLength(1)
		expect(result[0].type).toBe("text")
	})

	it("treats fenced code block mention as plain text", () => {
		const message = [
			"Here is an example:",
			"```",
			"<read_file>",
			"<path>demo.txt</path>",
			"</read_file>",
			"```",
		].join("\n")
		const result = parseAssistantMessage(message)
		expect(result).toHaveLength(1)
		expect(result[0].type).toBe("text")
	})

	it("parses real tool invocation with newline correctly", () => {
		const invocation = [
			"<read_file>",
			"<path>demo.txt</path>",
			"</read_file>",
		].join("\n")
		const result = parseAssistantMessage(invocation)
		expect(result).toHaveLength(1)
		const tool = result[0]
		if (tool.type !== "tool_use") throw new Error("Expected tool_use block")
		expect(tool.name).toBe("read_file")
		expect(tool.params.path).toBe("demo.txt")
	})
}) 