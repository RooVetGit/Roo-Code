import { describe, it, expect } from "vitest"
import {
	createTimeoutFallbackPrompt,
	parseTimeoutFallbackResponse,
	type TimeoutFallbackContext,
} from "../timeout-fallback"

describe("timeout-fallback", () => {
	describe("createTimeoutFallbackPrompt", () => {
		it("should create a basic prompt with required context", () => {
			const context: TimeoutFallbackContext = {
				toolName: "execute_command",
				timeoutMs: 30000,
				executionTimeMs: 32000,
			}

			const prompt = createTimeoutFallbackPrompt(context)

			expect(prompt).toContain("execute_command operation has timed out after 30 seconds")
			expect(prompt).toContain("actual execution time: 32 seconds")
			expect(prompt).toContain("Tool: execute_command")
			expect(prompt).toContain("Generate exactly 3-4 specific, actionable suggestions")
		})

		it("should include tool parameters when provided", () => {
			const context: TimeoutFallbackContext = {
				toolName: "read_file",
				timeoutMs: 15000,
				executionTimeMs: 16000,
				toolParams: {
					path: "/large/file.txt",
					line_range: "1-10000",
				},
			}

			const prompt = createTimeoutFallbackPrompt(context)

			expect(prompt).toContain("Parameters:")
			expect(prompt).toContain("/large/file.txt")
			expect(prompt).toContain("1-10000")
		})

		it("should include task context when provided", () => {
			const context: TimeoutFallbackContext = {
				toolName: "write_to_file",
				timeoutMs: 20000,
				executionTimeMs: 22000,
				taskContext: {
					currentStep: "Creating configuration file",
					workingDirectory: "/project/config",
				},
			}

			const prompt = createTimeoutFallbackPrompt(context)

			expect(prompt).toContain("Current step: Creating configuration file")
			expect(prompt).toContain("Working directory: /project/config")
		})
	})

	describe("parseTimeoutFallbackResponse", () => {
		it("should parse numbered list responses", () => {
			const response = `Here are the suggestions:
1. Break the command into smaller parts
2. Use background execution with nohup
3. Try an alternative approach
4. Increase the timeout setting`

			const suggestions = parseTimeoutFallbackResponse(response)

			expect(suggestions).toHaveLength(4)
			expect(suggestions[0].text).toBe("Break the command into smaller parts")
			expect(suggestions[1].text).toBe("Use background execution with nohup")
			expect(suggestions[2].text).toBe("Try an alternative approach")
			expect(suggestions[3].text).toBe("Increase the timeout setting")
		})

		it("should parse numbered list with parentheses", () => {
			const response = `Suggestions:
1) Check file permissions
2) Use smaller chunks
3) Try a different tool`

			const suggestions = parseTimeoutFallbackResponse(response)

			expect(suggestions).toHaveLength(3)
			expect(suggestions[0].text).toBe("Check file permissions")
			expect(suggestions[1].text).toBe("Use smaller chunks")
			expect(suggestions[2].text).toBe("Try a different tool")
		})

		it("should fallback to sentence parsing when no numbered list found", () => {
			const response = `You should try breaking the operation into smaller parts. Consider using an alternative approach. Check system resources and try again.`

			const suggestions = parseTimeoutFallbackResponse(response)

			expect(suggestions.length).toBeGreaterThan(0)
			expect(suggestions[0].text).toBe("You should try breaking the operation into smaller parts")
		})

		it("should limit suggestions to 4 items", () => {
			const response = `1. First suggestion
2. Second suggestion
3. Third suggestion
4. Fourth suggestion
5. Fifth suggestion
6. Sixth suggestion`

			const suggestions = parseTimeoutFallbackResponse(response)

			expect(suggestions).toHaveLength(4)
		})

		it("should filter out suggestions that are too long", () => {
			const response = `1. Good suggestion
2. This is a very long suggestion that exceeds the maximum character limit and should be filtered out because it's too verbose
3. Another good suggestion`

			const suggestions = parseTimeoutFallbackResponse(response)

			expect(suggestions).toHaveLength(2)
			expect(suggestions[0].text).toBe("Good suggestion")
			expect(suggestions[1].text).toBe("Another good suggestion")
		})

		it("should return empty array for invalid responses", () => {
			const response = ""

			const suggestions = parseTimeoutFallbackResponse(response)

			expect(suggestions).toHaveLength(0)
		})
	})
})
