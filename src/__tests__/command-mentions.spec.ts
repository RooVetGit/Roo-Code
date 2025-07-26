import { describe, it, expect, beforeEach, vi } from "vitest"
import { parseMentions } from "../core/mentions"
import { UrlContentFetcher } from "../services/browser/UrlContentFetcher"
import { getCommand } from "../services/command/commands"

// Mock the dependencies
vi.mock("../services/command/commands")
vi.mock("../services/browser/UrlContentFetcher")

const MockedUrlContentFetcher = vi.mocked(UrlContentFetcher)
const mockGetCommand = vi.mocked(getCommand)

describe("Command Mentions", () => {
	let mockUrlContentFetcher: any

	beforeEach(() => {
		vi.clearAllMocks()

		// Create a mock UrlContentFetcher instance
		mockUrlContentFetcher = {
			launchBrowser: vi.fn(),
			urlToMarkdown: vi.fn(),
			closeBrowser: vi.fn(),
		}

		MockedUrlContentFetcher.mockImplementation(() => mockUrlContentFetcher)
	})

	// Helper function to call parseMentions with required parameters
	const callParseMentions = async (text: string) => {
		return await parseMentions(
			text,
			"/test/cwd", // cwd
			mockUrlContentFetcher, // urlContentFetcher
			undefined, // fileContextTracker
			undefined, // rooIgnoreController
			true, // showRooIgnoredFiles
			true, // includeDiagnosticMessages
			50, // maxDiagnosticMessages
			undefined, // maxReadFileLine
		)
	}

	describe("parseMentions with command support", () => {
		it("should parse command mentions and include content", async () => {
			const commandContent = "# Setup Environment\n\nRun the following commands:\n```bash\nnpm install\n```"
			mockGetCommand.mockResolvedValue({
				name: "setup",
				content: commandContent,
				source: "project",
				filePath: "/project/.roo/commands/setup.md",
			})

			const input = "/setup Please help me set up the project"
			const result = await callParseMentions(input)

			expect(mockGetCommand).toHaveBeenCalledWith("/test/cwd", "setup")
			expect(result).toContain('<command name="setup">')
			expect(result).toContain(commandContent)
			expect(result).toContain("</command>")
			expect(result).toContain("Please help me set up the project")
		})

		it("should only handle command at start of message", async () => {
			mockGetCommand.mockResolvedValue({
				name: "setup",
				content: "# Setup instructions",
				source: "project",
				filePath: "/project/.roo/commands/setup.md",
			})

			// Only the first command should be recognized
			const input = "/setup the project\nThen /deploy later"
			const result = await callParseMentions(input)

			expect(mockGetCommand).toHaveBeenCalledWith("/test/cwd", "setup")
			expect(mockGetCommand).toHaveBeenCalledTimes(1) // Only called once
			expect(result).toContain('<command name="setup">')
			expect(result).toContain("# Setup instructions")
			expect(result).not.toContain('<command name="deploy">') // Second command not processed
		})

		it("should handle non-existent command gracefully", async () => {
			mockGetCommand.mockResolvedValue(undefined)

			const input = "/nonexistent command"
			const result = await callParseMentions(input)

			expect(mockGetCommand).toHaveBeenCalledWith("/test/cwd", "nonexistent")
			expect(result).toContain('<command name="nonexistent">')
			expect(result).toContain("not found")
			expect(result).toContain("</command>")
		})

		it("should handle command loading errors", async () => {
			mockGetCommand.mockRejectedValue(new Error("Failed to load command"))

			const input = "/error-command test"
			const result = await callParseMentions(input)

			expect(result).toContain('<command name="error-command">')
			expect(result).toContain("Error loading command")
			expect(result).toContain("</command>")
		})

		it("should handle command names with hyphens and underscores at start", async () => {
			mockGetCommand.mockResolvedValue({
				name: "setup-dev",
				content: "# Dev setup",
				source: "project",
				filePath: "/project/.roo/commands/setup-dev.md",
			})

			const input = "/setup-dev for the project"
			const result = await callParseMentions(input)

			expect(mockGetCommand).toHaveBeenCalledWith("/test/cwd", "setup-dev")
			expect(result).toContain('<command name="setup-dev">')
			expect(result).toContain("# Dev setup")
		})

		it("should preserve command content formatting", async () => {
			const commandContent = `# Complex Command

## Step 1
Run this command:
\`\`\`bash
npm install
\`\`\`

## Step 2
- Check file1.js
- Update file2.ts
- Test everything

> **Note**: This is important!`

			mockGetCommand.mockResolvedValue({
				name: "complex",
				content: commandContent,
				source: "project",
				filePath: "/project/.roo/commands/complex.md",
			})

			const input = "/complex command"
			const result = await callParseMentions(input)

			expect(result).toContain('<command name="complex">')
			expect(result).toContain("# Complex Command")
			expect(result).toContain("```bash")
			expect(result).toContain("npm install")
			expect(result).toContain("- Check file1.js")
			expect(result).toContain("> **Note**: This is important!")
			expect(result).toContain("</command>")
		})

		it("should handle empty command content", async () => {
			mockGetCommand.mockResolvedValue({
				name: "empty",
				content: "",
				source: "project",
				filePath: "/project/.roo/commands/empty.md",
			})

			const input = "/empty command"
			const result = await callParseMentions(input)

			expect(result).toContain('<command name="empty">')
			expect(result).toContain("</command>")
			// Should still include the command tags even with empty content
		})
	})

	describe("command mention regex patterns", () => {
		it("should match valid command mention patterns at start of message", () => {
			const commandRegex = /^\/([a-zA-Z0-9_\.-]+)(?=\s|$)/g

			const validPatterns = ["/setup", "/build-prod", "/test_suite", "/my-command", "/command123"]

			validPatterns.forEach((pattern) => {
				const match = pattern.match(commandRegex)
				expect(match).toBeTruthy()
				expect(match![0]).toBe(pattern)
			})
		})

		it("should not match command patterns in middle of text", () => {
			const commandRegex = /^\/([a-zA-Z0-9_\.-]+)(?=\s|$)/g

			const invalidPatterns = ["Please /setup", "Run /build now", "Use /deploy here"]

			invalidPatterns.forEach((pattern) => {
				const match = pattern.match(commandRegex)
				expect(match).toBeFalsy()
			})
		})

		it("should NOT match commands at start of new lines", () => {
			const commandRegex = /^\/([a-zA-Z0-9_\.-]+)(?=\s|$)/g

			const multilineText = "First line\n/setup the project\nAnother line\n/deploy when ready"
			const matches = multilineText.match(commandRegex)

			// Should not match any commands since they're not at the very start
			expect(matches).toBeFalsy()
		})

		it("should only match command at very start of message", () => {
			const commandRegex = /^\/([a-zA-Z0-9_\.-]+)(?=\s|$)/g

			const validText = "/setup the project\nThen do other things"
			const matches = validText.match(commandRegex)

			expect(matches).toBeTruthy()
			expect(matches).toHaveLength(1)
			expect(matches![0]).toBe("/setup")
		})

		it("should not match invalid command patterns", () => {
			const commandRegex = /^\/([a-zA-Z0-9_\.-]+)(?=\s|$)/g

			const invalidPatterns = ["/ space", "/with space", "/with/slash", "//double", "/with@symbol"]

			invalidPatterns.forEach((pattern) => {
				const match = pattern.match(commandRegex)
				if (match) {
					// If it matches, it should not be the full invalid pattern
					expect(match[0]).not.toBe(pattern)
				}
			})
		})
	})

	describe("command mention text transformation", () => {
		it("should transform command mentions at start of message", async () => {
			const input = "/setup the project"
			const result = await callParseMentions(input)

			expect(result).toContain("Command 'setup' (see below for command content)")
		})

		it("should only process first command in message", async () => {
			const input = "/setup the project\nThen /deploy later"
			const result = await callParseMentions(input)

			expect(result).toContain("Command 'setup' (see below for command content)")
			expect(result).not.toContain("Command 'deploy'") // Second command not processed
		})

		it("should only match commands at very start of message", async () => {
			// At the beginning - should match
			let input = "/build the project"
			let result = await callParseMentions(input)
			expect(result).toContain("Command 'build'")

			// In the middle - should NOT match
			input = "Please /build and test"
			result = await callParseMentions(input)
			expect(result).not.toContain("Command 'build'")
			expect(result).toContain("Please /build and test") // Original text preserved

			// At the end - should NOT match
			input = "Run the /build"
			result = await callParseMentions(input)
			expect(result).not.toContain("Command 'build'")
			expect(result).toContain("Run the /build") // Original text preserved

			// At start of new line - should NOT match
			input = "Some text\n/build the project"
			result = await callParseMentions(input)
			expect(result).not.toContain("Command 'build'")
			expect(result).toContain("Some text\n/build the project") // Original text preserved
		})
	})
})
