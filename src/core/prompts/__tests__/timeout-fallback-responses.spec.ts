import { describe, it, expect } from "vitest"
import { formatResponse } from "../responses"

describe("timeout fallback responses", () => {
	describe("toolTimeout", () => {
		it("should include background operation warning for execute_command", () => {
			const message = formatResponse.toolTimeout("execute_command", 30000, 35000)

			expect(message).toContain("timed out after 30 seconds")
			expect(message).toContain(
				"**Important**: The execute_command operation may still be running in the background",
			)
			expect(message).toContain("You might see output or effects from this operation later")
		})

		it("should include background operation warning for browser_action", () => {
			const message = formatResponse.toolTimeout("browser_action", 15000, 20000)

			expect(message).toContain("timed out after 15 seconds")
			expect(message).toContain(
				"**Important**: The browser_action operation may still be running in the background",
			)
			expect(message).toContain("You might see output or effects from this operation later")
		})

		it("should not include background operation warning for other tools", () => {
			const message = formatResponse.toolTimeout("read_file", 10000, 12000)

			expect(message).toContain("timed out after 10 seconds")
			expect(message).not.toContain("may still be running in the background")
			expect(message).not.toContain("**Important**")
		})

		it("should format timeout details correctly", () => {
			const message = formatResponse.toolTimeout("write_to_file", 5000, 6000)

			expect(message).toContain("<timeout_details>")
			expect(message).toContain("Tool: write_to_file")
			expect(message).toContain("Configured Timeout: 5s")
			expect(message).toContain("Execution Time: 6s")
			expect(message).toContain("Status: Canceled")
			expect(message).toContain("</timeout_details>")
		})
	})

	describe("generateContextualSuggestions", () => {
		it("should generate execute_command suggestions", () => {
			const suggestions = formatResponse.timeoutFallbackSuggestions.generateContextualSuggestions(
				"execute_command",
				{ command: "npm install" },
			)

			expect(suggestions).toHaveLength(4)
			expect(suggestions[0].text).toContain("npm install")
			expect(suggestions[0].text).toContain("still running in the background")
			expect(suggestions[1].text).toContain("smaller, sequential steps")
		})

		it("should generate read_file suggestions", () => {
			const suggestions = formatResponse.timeoutFallbackSuggestions.generateContextualSuggestions("read_file", {
				path: "/large/file.txt",
			})

			expect(suggestions).toHaveLength(4)
			expect(suggestions[0].text).toContain("/large/file.txt")
			expect(suggestions[0].text).toContain("smaller chunks")
		})

		it("should generate write_to_file suggestions", () => {
			const suggestions = formatResponse.timeoutFallbackSuggestions.generateContextualSuggestions(
				"write_to_file",
				{ path: "/output/file.js" },
			)

			expect(suggestions).toHaveLength(4)
			expect(suggestions[0].text).toContain("/output/file.js")
			expect(suggestions[0].text).toContain("insert_content")
		})

		it("should generate browser_action suggestions", () => {
			const suggestions = formatResponse.timeoutFallbackSuggestions.generateContextualSuggestions(
				"browser_action",
				{ action: "click" },
			)

			expect(suggestions).toHaveLength(4)
			expect(suggestions[0].text).toContain("browser action")
			expect(suggestions[0].text).toContain("still processing in the background")
			expect(suggestions[1].text).toContain("smaller, more targeted steps")
		})

		it("should generate search_files suggestions", () => {
			const suggestions = formatResponse.timeoutFallbackSuggestions.generateContextualSuggestions(
				"search_files",
				{ regex: "complex.*pattern" },
			)

			expect(suggestions).toHaveLength(4)
			expect(suggestions[0].text).toContain("Narrow the search scope")
		})

		it("should generate generic suggestions for unknown tools", () => {
			const suggestions = formatResponse.timeoutFallbackSuggestions.generateContextualSuggestions(
				"unknown_tool" as any,
			)

			expect(suggestions).toHaveLength(4)
			expect(suggestions[0].text).toContain("unknown_tool operation")
			expect(suggestions[0].text).toContain("smaller steps")
		})
	})

	describe("individual suggestion generators", () => {
		it("should generate command suggestions with default command name", () => {
			const suggestions = formatResponse.timeoutFallbackSuggestions.generateCommandSuggestions()

			expect(suggestions).toHaveLength(4)
			expect(suggestions[0].text).toContain("the command")
			expect(suggestions[0].text).toContain("still running in the background")
		})

		it("should generate read file suggestions with default file name", () => {
			const suggestions = formatResponse.timeoutFallbackSuggestions.generateReadFileSuggestions()

			expect(suggestions).toHaveLength(4)
			expect(suggestions[0].text).toContain("the file")
		})

		it("should generate write file suggestions with default file name", () => {
			const suggestions = formatResponse.timeoutFallbackSuggestions.generateWriteFileSuggestions()

			expect(suggestions).toHaveLength(4)
			expect(suggestions[0].text).toContain("the file")
		})

		it("should generate browser suggestions with default action name", () => {
			const suggestions = formatResponse.timeoutFallbackSuggestions.generateBrowserSuggestions()

			expect(suggestions).toHaveLength(4)
			expect(suggestions[0].text).toContain("browser action")
			expect(suggestions[0].text).toContain("still processing in the background")
		})

		it("should generate search suggestions", () => {
			const suggestions = formatResponse.timeoutFallbackSuggestions.generateSearchSuggestions()

			expect(suggestions).toHaveLength(4)
			expect(suggestions[0].text).toContain("Narrow the search scope")
		})

		it("should generate generic suggestions", () => {
			const suggestions = formatResponse.timeoutFallbackSuggestions.generateGenericSuggestions("new_task")

			expect(suggestions).toHaveLength(4)
			expect(suggestions[0].text).toContain("new_task operation")
		})
	})

	describe("suggestion structure", () => {
		it("should return suggestions with text property", () => {
			const suggestions = formatResponse.timeoutFallbackSuggestions.generateGenericSuggestions("new_task")

			suggestions.forEach((suggestion) => {
				expect(suggestion).toHaveProperty("text")
				expect(typeof suggestion.text).toBe("string")
				expect(suggestion.text.length).toBeGreaterThan(0)
			})
		})

		it("should optionally include mode property", () => {
			const suggestions = formatResponse.timeoutFallbackSuggestions.generateGenericSuggestions("new_task")

			suggestions.forEach((suggestion) => {
				if (suggestion.mode) {
					expect(typeof suggestion.mode).toBe("string")
				}
			})
		})
	})
})
