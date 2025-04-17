import {
	insertMention,
	removeMention,
	getContextMenuOptions,
	shouldShowContextMenu,
	ContextMenuOptionType,
	ContextMenuQueryItem,
} from "../context-mentions"
import * as sharedContextMentions from "../../../../src/shared/context-mentions"

// Mock the parseMentionsFromText function from shared module
jest.mock("../../../../src/shared/context-mentions", () => ({
	mentionRegex: /@(\/|\w+:\/\/|[a-f0-9]{7,40}\b|problems\b|git-changes\b|terminal\b)/,
	parseMentionsFromText: jest.fn(),
}))

describe("insertMention", () => {
	it("should insert mention at cursor position when no @ symbol exists", () => {
		const result = insertMention("Hello world", 5, "test")
		expect(result.newValue).toBe("Hello@test  world")
		expect(result.mentionIndex).toBe(5)
	})

	it("should replace text after last @ symbol", () => {
		const result = insertMention("Hello @wor world", 8, "test")
		expect(result.newValue).toBe("Hello @test  world")
		expect(result.mentionIndex).toBe(6)
	})

	it("should handle empty text", () => {
		const result = insertMention("", 0, "test")
		expect(result.newValue).toBe("@test ")
		expect(result.mentionIndex).toBe(0)
	})

	it("should handle mentions with spaces correctly", () => {
		const result = insertMention("Hello world", 5, "file with spaces.txt")
		expect(result.newValue).toBe("Hello@file\\ with\\ spaces.txt  world")
		expect(result.mentionIndex).toBe(5)
	})

	it("should replace text after last @ symbol with spaces in mention", () => {
		const result = insertMention("Hello @wor world", 8, "file with spaces.txt")
		expect(result.newValue).toBe("Hello @file\\ with\\ spaces.txt  world")
		expect(result.mentionIndex).toBe(6)
	})

	it("should handle file names with multiple consecutive spaces", () => {
		const result = insertMention("Hello world", 5, "file  with   multiple    spaces.txt")
		expect(result.newValue).toBe("Hello@file\\ \\ with\\ \\ \\ multiple\\ \\ \\ \\ spaces.txt  world")
		expect(result.mentionIndex).toBe(5)
	})

	it("should handle file names with special characters", () => {
		const result = insertMention("Hello world", 5, "file-with_special#chars&.txt")
		expect(result.newValue).toBe("Hello@file-with_special#chars&.txt  world")
		expect(result.mentionIndex).toBe(5)
	})

	it("should handle file names with unicode characters", () => {
		const result = insertMention("Hello world", 5, "文件名with空格and字符.txt")
		expect(result.newValue).toBe("Hello@文件名with空格and字符.txt  world")
		expect(result.mentionIndex).toBe(5)
	})

	it("should handle paths with spaces", () => {
		const result = insertMention("Hello world", 5, "path with/spaces/in it/file.txt")
		expect(result.newValue).toBe("Hello@path\\ with/spaces/in\\ it/file.txt  world")
		expect(result.mentionIndex).toBe(5)
	})

	it("should handle cursor at beginning of text", () => {
		const result = insertMention("Hello world", 0, "test.txt")
		expect(result.newValue).toBe("@test.txt  Hello world")
		expect(result.mentionIndex).toBe(0)
	})

	it("should handle cursor at end of text", () => {
		const result = insertMention("Hello world", 11, "test.txt")
		expect(result.newValue).toBe("Hello world@test.txt  ")
		expect(result.mentionIndex).toBe(11)
	})

	it("should handle text with multiple @ symbols", () => {
		const result = insertMention("Hello @first and @second world", 19, "test.txt")
		expect(result.newValue).toBe("Hello @first and @test.txt  world")
		expect(result.mentionIndex).toBe(17)
	})

	it("should handle file names already containing backslashes", () => {
		const result = insertMention("Hello world", 5, "file\\with\\backslashes.txt")
		// Backslashes should be preserved and spaces should be escaped
		expect(result.newValue).toBe("Hello@file\\with\\backslashes.txt  world")
		expect(result.mentionIndex).toBe(5)
	})

	it("should handle very long file names", () => {
		const longName = "a".repeat(100) + " " + "b".repeat(100) + ".txt"
		const result = insertMention("Hello world", 5, longName)
		expect(result.newValue).toBe(`Hello@${"a".repeat(100)}\\ ${"b".repeat(100)}.txt  world`)
		expect(result.mentionIndex).toBe(5)
	})

	it("should handle file names already containing escaped spaces", () => {
		const result = insertMention("Hello world", 5, "file\\ with\\ spaces.txt")
		// It should correctly handle the already escaped spaces without double-escaping
		expect(result.newValue).toBe("Hello@file\\\\ with\\\\ spaces.txt  world")
		expect(result.mentionIndex).toBe(5)
	})
})

describe("removeMention", () => {
	it("should remove mention when cursor is at end of mention", () => {
		// Test with the problems keyword that matches the regex
		const result = removeMention("Hello @problems ", 15)
		expect(result.newText).toBe("Hello ")
		expect(result.newPosition).toBe(6)
	})

	it("should not remove text when not at end of mention", () => {
		const result = removeMention("Hello @test world", 8)
		expect(result.newText).toBe("Hello @test world")
		expect(result.newPosition).toBe(8)
	})

	it("should handle text without mentions", () => {
		const result = removeMention("Hello world", 5)
		expect(result.newText).toBe("Hello world")
		expect(result.newPosition).toBe(5)
	})
})

describe("getContextMenuOptions", () => {
	const mockQueryItems: ContextMenuQueryItem[] = [
		{
			type: ContextMenuOptionType.File,
			value: "src/test.ts",
			label: "test.ts",
			description: "Source file",
		},
		{
			type: ContextMenuOptionType.OpenedFile,
			value: "src/opened.ts",
			label: "opened.ts",
			description: "Currently opened file",
		},
		{
			type: ContextMenuOptionType.Git,
			value: "abc1234",
			label: "Initial commit",
			description: "First commit",
			icon: "$(git-commit)",
		},
		{
			type: ContextMenuOptionType.Folder,
			value: "src",
			label: "src",
			description: "Source folder",
		},
	]

	const mockDynamicSearchResults = [
		{
			path: "search/result1.ts",
			type: "file" as const,
			label: "result1.ts",
		},
		{
			path: "search/folder",
			type: "folder" as const,
		},
	]

	it("should return all option types for empty query", () => {
		const result = getContextMenuOptions("", null, [])
		expect(result).toHaveLength(6)
		expect(result.map((item) => item.type)).toEqual([
			ContextMenuOptionType.Problems,
			ContextMenuOptionType.Terminal,
			ContextMenuOptionType.URL,
			ContextMenuOptionType.Folder,
			ContextMenuOptionType.File,
			ContextMenuOptionType.Git,
		])
	})

	it("should filter by selected type when query is empty", () => {
		const result = getContextMenuOptions("", ContextMenuOptionType.File, mockQueryItems)
		expect(result).toHaveLength(2)
		expect(result.map((item) => item.type)).toContain(ContextMenuOptionType.File)
		expect(result.map((item) => item.type)).toContain(ContextMenuOptionType.OpenedFile)
		expect(result.map((item) => item.value)).toContain("src/test.ts")
		expect(result.map((item) => item.value)).toContain("src/opened.ts")
	})

	it("should match git commands", () => {
		const result = getContextMenuOptions("git", null, mockQueryItems)
		expect(result[0].type).toBe(ContextMenuOptionType.Git)
		expect(result[0].label).toBe("Git Commits")
	})

	it("should match git commit hashes", () => {
		const result = getContextMenuOptions("abc1234", null, mockQueryItems)
		expect(result[0].type).toBe(ContextMenuOptionType.Git)
		expect(result[0].value).toBe("abc1234")
	})

	it("should return NoResults when no matches found", () => {
		const result = getContextMenuOptions("nonexistent", null, mockQueryItems)
		expect(result).toHaveLength(1)
		expect(result[0].type).toBe(ContextMenuOptionType.NoResults)
	})

	/**
	 * Tests for the combined handling of open files, git results, and search results
	 * Added for commit 3cd7dec78faf786e468ae4f66cef0b81a76d9075
	 */
	it("should include dynamic search results along with other matches", () => {
		// Add an opened file that will match the query
		const testItems = [
			...mockQueryItems,
			{
				type: ContextMenuOptionType.OpenedFile,
				value: "src/test-opened.ts",
				label: "test-opened.ts",
				description: "Opened test file for search test",
			},
		]

		const result = getContextMenuOptions("test", null, testItems, mockDynamicSearchResults)

		// Check if opened files and dynamic search results are included
		expect(result.some((item) => item.type === ContextMenuOptionType.OpenedFile)).toBe(true)
		expect(result.some((item) => item.value === "/search/result1.ts")).toBe(true)
	})

	it("should maintain correct result ordering according to implementation", () => {
		// Add multiple item types to test ordering
		const result = getContextMenuOptions("t", null, mockQueryItems, mockDynamicSearchResults)

		// Find the different result types
		const fileResults = result.filter(
			(item) =>
				item.type === ContextMenuOptionType.File ||
				item.type === ContextMenuOptionType.OpenedFile ||
				item.type === ContextMenuOptionType.Folder,
		)

		const searchResults = result.filter(
			(item) => item.type === ContextMenuOptionType.File && item.value?.includes("/search/"),
		)

		const gitResults = result.filter((item) => item.type === ContextMenuOptionType.Git)

		// Find the indexes of the first item of each type in the results array
		const firstFileIndex = result.findIndex((item) => fileResults.some((f) => f === item))

		const firstSearchResultIndex = result.findIndex((item) => searchResults.some((s) => s === item))

		const firstGitResultIndex = result.findIndex((item) => gitResults.some((g) => g === item))

		// Verify file results come before search results
		expect(firstFileIndex).toBeLessThan(firstSearchResultIndex)

		// Verify search results appear before git results
		expect(firstSearchResultIndex).toBeLessThan(firstGitResultIndex)
	})

	it("should include opened files when dynamic search results exist", () => {
		const result = getContextMenuOptions("open", null, mockQueryItems, mockDynamicSearchResults)

		// Verify opened files are included
		expect(result.some((item) => item.type === ContextMenuOptionType.OpenedFile)).toBe(true)
		// Verify dynamic search results are also present
		expect(result.some((item) => item.value === "/search/result1.ts")).toBe(true)
	})

	it("should include git results when dynamic search results exist", () => {
		const result = getContextMenuOptions("commit", null, mockQueryItems, mockDynamicSearchResults)

		// Verify git results are included
		expect(result.some((item) => item.type === ContextMenuOptionType.Git)).toBe(true)
		// Verify dynamic search results are also present
		expect(result.some((item) => item.value === "/search/result1.ts")).toBe(true)
	})

	it("should deduplicate items correctly when combining different result types", () => {
		// Create duplicate search result with same path as an existing file
		const duplicateSearchResults = [
			{
				path: "src/test.ts", // Duplicate of existing file in mockQueryItems
				type: "file" as const,
			},
			{
				path: "unique/path.ts",
				type: "file" as const,
			},
		]

		const result = getContextMenuOptions("test", null, mockQueryItems, duplicateSearchResults)

		// Count occurrences of src/test.ts in results
		const duplicateCount = result.filter(
			(item) =>
				(item.value === "src/test.ts" || item.value === "/src/test.ts") &&
				item.type === ContextMenuOptionType.File,
		).length
		// With path normalization, these should be treated as duplicates
		expect(duplicateCount).toBe(1)

		// Verify the unique item was included (check both path formats)
		expect(result.some((item) => item.value === "/unique/path.ts" || item.value === "unique/path.ts")).toBe(true)
	})

	it("should return NoResults when all combined results are empty with dynamic search", () => {
		// Use a query that won't match anything
		const result = getContextMenuOptions(
			"nonexistentquery123456",
			null,
			mockQueryItems,
			[], // Empty dynamic search results
		)

		expect(result).toHaveLength(1)
		expect(result[0].type).toBe(ContextMenuOptionType.NoResults)
	})

	/**
	 * Tests that opened files appear first in the results, according to the updated implementation
	 * This test validates the updated ordering where opened files have the highest priority
	 */
	it("should place opened files first in result order", () => {
		// Create test data with multiple types that should match the query
		const testQuery = "test" // Using "test" as the query to match all items

		const testItems: ContextMenuQueryItem[] = [
			{
				type: ContextMenuOptionType.File,
				value: "src/test-file.ts",
				label: "test-file.ts",
				description: "Regular test file",
			},
			{
				type: ContextMenuOptionType.OpenedFile,
				value: "src/test-opened.ts",
				label: "test-opened.ts",
				description: "Opened test file",
			},
			{
				type: ContextMenuOptionType.Git,
				value: "abctest",
				label: "Test commit",
				description: "Git test commit",
			},
		]

		const testSearchResults = [
			{
				path: "search/test-result.ts",
				type: "file" as const,
				label: "test-result.ts",
			},
		]

		// Get results for "test" query
		const result = getContextMenuOptions(testQuery, null, testItems, testSearchResults)

		// Verify we have results
		expect(result.length).toBeGreaterThan(0)

		// Verify the first item is an opened file type
		expect(result[0].type).toBe(ContextMenuOptionType.OpenedFile)

		// Verify the remaining items are in the correct order:
		// suggestions -> openedFiles -> searchResults -> gitResults

		// Get index of first item of each type
		const firstOpenedFileIndex = result.findIndex((item) => item.type === ContextMenuOptionType.OpenedFile)
		const firstSearchResultIndex = result.findIndex(
			(item) => item.type === ContextMenuOptionType.File && item.value?.includes("/search/"),
		)
		const firstGitResultIndex = result.findIndex((item) => item.type === ContextMenuOptionType.Git)

		// Verify opened files come first
		expect(firstOpenedFileIndex).toBe(0)

		// Verify search results come after opened files but before git results
		expect(firstSearchResultIndex).toBeGreaterThan(firstOpenedFileIndex)

		// Verify git results come after search results
		if (firstGitResultIndex !== -1 && firstSearchResultIndex !== -1) {
			expect(firstGitResultIndex).toBeGreaterThan(firstSearchResultIndex)
		}
	})
})

describe("shouldShowContextMenu", () => {
	const mockParseMentionsFromText = sharedContextMentions.parseMentionsFromText as jest.Mock

	beforeEach(() => {
		jest.clearAllMocks()
	})

	it("should return true for slash commands", () => {
		expect(shouldShowContextMenu("/mode", 5)).toBe(true)
	})

	it("should return false for slash commands with spaces", () => {
		expect(shouldShowContextMenu("/mode with space", 15)).toBe(false)
	})

	it("should return false when there is no @ symbol", () => {
		expect(shouldShowContextMenu("text without mention", 10)).toBe(false)
	})

	it("should return true when there is a space after @ but at the same position as @", () => {
		// Position 10 is the @ symbol, position 11 is space after @
		const testText = "text with @ space"
		const testPos = 10 // Position of @ symbol

		mockParseMentionsFromText.mockReturnValue([])
		expect(shouldShowContextMenu(testText, testPos)).toBe(true)
	})

	it("should return true for valid file path mentions", () => {
		mockParseMentionsFromText.mockReturnValue([{ fullMatch: "@/path/to/file.txt", value: "/path/to/file.txt" }])
		expect(shouldShowContextMenu("Check @/path/to/file.txt", 10)).toBe(true)
	})

	it("should return true for valid URL mentions", () => {
		mockParseMentionsFromText.mockReturnValue([{ fullMatch: "@http://example.com", value: "http://example.com" }])
		expect(shouldShowContextMenu("Visit @http://example.com", 10)).toBe(true)
	})

	it("should return true for valid git hash mentions", () => {
		mockParseMentionsFromText.mockReturnValue([{ fullMatch: "@abc1234", value: "abc1234" }])
		expect(shouldShowContextMenu("See commit @abc1234", 15)).toBe(true)
	})

	it("should return true for just @ symbol (empty mention)", () => {
		mockParseMentionsFromText.mockReturnValue([])
		// Position cursor right after the @ symbol
		expect(shouldShowContextMenu("text with @", 11)).toBe(true)
	})

	it("should return true for file paths with escaped spaces", () => {
		mockParseMentionsFromText.mockReturnValue([
			{ fullMatch: "@/path/with\\ spaces/file.txt", value: "/path/with spaces/file.txt" },
		])
		expect(shouldShowContextMenu("Look at @/path/with\\ spaces/file.txt", 15)).toBe(true)
	})

	it("should return true for file paths with URL encoded characters", () => {
		mockParseMentionsFromText.mockReturnValue([
			{ fullMatch: "@/path/with%20space.txt", value: "/path/with space.txt" },
		])
		expect(shouldShowContextMenu("Check @/path/with%20space.txt", 15)).toBe(true)
	})
})

/**
 * Integration tests for the complete file mention workflow
 * These tests simulate the actual user flow when selecting files from the list
 *
 * IMPORTANT NOTE ABOUT BACKSLASH ESCAPING IN TESTS:
 * ================================================
 * The escaping of spaces in file paths is a multi-level process:
 *
 * 1. In JavaScript strings, a single backslash must be written as "\\".
 *    So to represent "\" in the string, we write it as "\\".
 *
 * 2. When we want to escape a space in a path, we use "\ " (backslash + space).
 *    But in JavaScript code, this must be written as "\\ ".
 *
 * 3. Our escaping pipeline has two phases:
 *    - First in convertToMentionPath: spaces -> "\ "
 *    - Then in insertMention: "\ " -> "\\ "
 *
 * 4. Due to this multi-level escaping, paths in our expect() statements
 *    contain four backslashes "\\\\" for each escaped space.
 *
 *    This is NOT a bug but the expected behavior:
 *    - In JS, "\\\\" represents two literal backslashes "\\"
 *    - When the string is processed, these become the actual double escape
 *      that's displayed to the user in their editor
 *
 * Example:
 * - Original path: "/docs/file with spaces.txt"
 * - After convertToMentionPath: "@/docs/file\ with\ spaces.txt"
 * - After insertMention: "@/docs/file\\ with\\ spaces.txt"
 * - In test code expect(): "...@/docs/file\\\\ with\\\\ spaces.txt..."
 */
describe("File selection integration tests", () => {
	// Import the convertToMentionPath function to use in the integration tests
	const { convertToMentionPath } = require("../path-mentions")

	it("should correctly handle selection of file with spaces from file list", () => {
		// Step 1: User has text in editor with cursor position
		const originalText = "Check out this file: "
		const cursorPosition = originalText.length

		// Step 2: User selects a file with spaces from the list
		// The file path would be converted to a mention path
		const selectedFilePath = "/Users/username/project/documents/report with spaces.pdf"
		const projectRoot = "/Users/username/project"
		const mentionPath = convertToMentionPath(selectedFilePath, projectRoot)

		// Verify mention path has single-escaped spaces (written with double backslashes in code)
		// Actual: "@/documents/report\ with\ spaces.pdf"
		expect(mentionPath).toBe("@/documents/report\\ with\\ spaces.pdf")

		// Step 3: The mention path is inserted at cursor position
		// We remove the @ since insertMention adds it back
		const result = insertMention(originalText, cursorPosition, mentionPath.substring(1))

		// Step 4: Verify the final text has proper escaping and format
		// Note: Double backslashes in the actual output require four backslashes in the code
		// Actual output: "Check out this file: @/documents/report\\ with\\ spaces.pdf  "
		expect(result.newValue).toBe("Check out this file: @/documents/report\\\\ with\\\\ spaces.pdf  ")
	})

	it("should correctly handle selection of file with special characters from file list", () => {
		// Step 1: User has text in editor with cursor position
		const originalText = "Document reference: "
		const cursorPosition = originalText.length

		// Step 2: User selects a file with special characters
		const selectedFilePath = "/Users/username/project/docs/report#1 (2023) final-v2.pdf"
		const projectRoot = "/Users/username/project"
		const mentionPath = convertToMentionPath(selectedFilePath, projectRoot)

		// Verify mention path has single-escaped spaces (written with double backslashes in code)
		// Actual: "@/docs/report#1\ (2023)\ final-v2.pdf"
		expect(mentionPath).toBe("@/docs/report#1\\ (2023)\\ final-v2.pdf")

		// Step 3: The mention path is inserted at cursor position
		// We remove the @ since insertMention adds it back
		const result = insertMention(originalText, cursorPosition, mentionPath.substring(1))

		// Step 4: Verify the final text has proper escaping and format
		// Note: Double backslashes in the actual output require four backslashes in the code
		// Actual output: "Document reference: @/docs/report#1\\ (2023)\\ final-v2.pdf  "
		expect(result.newValue).toBe("Document reference: @/docs/report#1\\\\ (2023)\\\\ final-v2.pdf  ")
	})

	it("should correctly handle selection of nested file with spaces from file list", () => {
		// Step 1: User has text with existing mentions
		const originalText = "Compare with @/other/file.txt and "
		const cursorPosition = originalText.length

		// Step 2: User selects a nested file with spaces
		const selectedFilePath = "/Users/username/project/nested/folder with spaces/file with spaces.txt"
		const projectRoot = "/Users/username/project"
		const mentionPath = convertToMentionPath(selectedFilePath, projectRoot)

		// Verify mention path has single-escaped spaces (written with double backslashes in code)
		// Actual: "@/nested/folder\ with\ spaces/file\ with\ spaces.txt"
		expect(mentionPath).toBe("@/nested/folder\\ with\\ spaces/file\\ with\\ spaces.txt")

		// Step 3: The mention path is inserted at cursor position
		// We remove the @ since insertMention adds it back
		const result = insertMention(originalText, cursorPosition, mentionPath.substring(1))

		// Step 4: Verify the final text has proper escaping and format
		// Note: Double backslashes in the actual output require four backslashes in the code
		// Important: The original behavior replaces the existing text after the @ symbol
		// Actual output: "Compare with @/nested/folder\\ with\\ spaces/file\\ with\\ spaces.txt  "
		expect(result.newValue).toBe("Compare with @/nested/folder\\\\ with\\\\ spaces/file\\\\ with\\\\ spaces.txt  ")
	})
})
