import { suite, test, expect } from "vitest"
import { DirectiveStreamingParser } from ".."

suite("Log Entry Parsing", () => {
	test("should parse complete log entries correctly", () => {
		const message = `<log_message>
<message>This is a test log message</message>
<level>debug</level>
</log_message>`

		const result = DirectiveStreamingParser.parse(message)

		// Filter out empty text blocks
		const filteredResult = result.filter((block) => !(block.type === "text" && block.content === ""))

		expect(filteredResult).toHaveLength(1)
		expect(filteredResult[0]).toEqual({
			type: "log_message",
			message: "This is a test log message",
			level: "debug",
			partial: false,
		})
	})

	test("should mark partial log entries as partial", () => {
		const message = `<log_message>
<message>This is a test log message</message>`

		const result = DirectiveStreamingParser.parse(message)

		// Filter out empty text blocks
		const filteredResult = result.filter((block) => !(block.type === "text" && block.content === ""))

		expect(filteredResult).toHaveLength(1)
		expect(filteredResult[0]).toEqual({
			type: "log_message",
			message: "This is a test log message",
			level: "info", // Default level
			partial: true,
		})
	})

	test("should handle log entries with only message tag", () => {
		const message = `<log_message>
<message>This is a test log message</message>
</log_message>`

		const result = DirectiveStreamingParser.parse(message)

		// Filter out empty text blocks
		const filteredResult = result.filter((block) => !(block.type === "text" && block.content === ""))

		expect(filteredResult).toHaveLength(1)
		expect(filteredResult[0]).toEqual({
			type: "log_message",
			message: "This is a test log message",
			level: "info", // Default level
			partial: false,
		})
	})

	test("should simulate streaming behavior with partial log entries", () => {
		// Simulate streaming chunks
		const chunks = [
			"<log_message>\n",
			"<message>This is a debug level log message</message>\n",
			"<level>debug</level>\n",
			"</log_message>",
		]

		let accumulatedMessage = ""
		const results = []

		// Process each chunk as it would happen during streaming
		for (const chunk of chunks) {
			accumulatedMessage += chunk
			const result = DirectiveStreamingParser.parse(accumulatedMessage)
			results.push(result)
		}

		// First chunk: Just the opening tag - filter out empty text blocks
		const filteredResults0 = results[0].filter((block) => !(block.type === "text" && block.content === ""))
		expect(filteredResults0[0]).toEqual({
			type: "log_message",
			message: "",
			level: "info", // Default level
			partial: true,
		})

		// Second chunk: Has message but not level - filter out empty text blocks
		const filteredResults1 = results[1].filter((block) => !(block.type === "text" && block.content === ""))
		expect(filteredResults1[0]).toEqual({
			type: "log_message",
			message: "This is a debug level log message",
			level: "info", // Still default level
			partial: true,
		})

		// Third chunk: Has message and level but not closing tag - filter out empty text blocks
		const filteredResults2 = results[2].filter((block) => !(block.type === "text" && block.content === ""))
		expect(filteredResults2[0]).toEqual({
			type: "log_message",
			message: "This is a debug level log message",
			level: "debug", // Level is now properly parsed
			partial: true,
		})

		// Fourth chunk: Complete log entry - filter out empty text blocks
		const filteredResults3 = results[3].filter((block) => !(block.type === "text" && block.content === ""))
		expect(filteredResults3[0]).toEqual({
			type: "log_message",
			message: "This is a debug level log message",
			level: "debug",
			partial: false,
		})
	})

	test("should handle multiple log entries with different levels", () => {
		const message = `<log_message>
<message>This is a debug message</message>
<level>debug</level>
</log_message>

<log_message>
<message>This is an info message</message>
</log_message>

<log_message>
<message>This is a warning message</message>
<level>warn</level>
</log_message>

<log_message>
<message>This is an error message</message>
<level>error</level>
</log_message>`

		const result = DirectiveStreamingParser.parse(message)

		// Filter out empty text blocks
		const filteredResult = result.filter((block) => !(block.type === "text" && block.content === ""))

		expect(filteredResult).toHaveLength(4)
		expect(filteredResult[0]).toEqual({
			type: "log_message",
			message: "This is a debug message",
			level: "debug",
			partial: false,
		})
		expect(filteredResult[1]).toEqual({
			type: "log_message",
			message: "This is an info message",
			level: "info", // Default level
			partial: false,
		})
		expect(filteredResult[2]).toEqual({
			type: "log_message",
			message: "This is a warning message",
			level: "warn",
			partial: false,
		})
		expect(filteredResult[3]).toEqual({
			type: "log_message",
			message: "This is an error message",
			level: "error",
			partial: false,
		})
	})
})
