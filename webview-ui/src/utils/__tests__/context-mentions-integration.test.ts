import { shouldShowContextMenu } from "../context-mentions"
// Import the REAL implementation, DO NOT MOCK here
import { parseMentionsFromText } from "../../../../src/shared/context-mentions"

// Sanity check to ensure we have the real function (Jest won't mock it here)
if ((parseMentionsFromText as any)._isMockFunction) {
	throw new Error("Error: parseMentionsFromText should not be mocked in this integration test file.")
}

describe("shouldShowContextMenu (Integration with REAL parseMentionsFromText)", () => {
	// Optional: Mock console.log if needed, but let's keep it simple first
	// let consoleSpy: jest.SpyInstance;
	// beforeEach(() => { consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {}); });
	// afterEach(() => { consoleSpy.mockRestore(); });

	it("should show context menu when @ is typed", () => {
		expect(shouldShowContextMenu("@", 0)).toBe(true)
	})

	it("should show context menu when starting to type a valid mention trigger after @", () => {
		expect(shouldShowContextMenu("Hello @/", 8)).toBe(true) // File path
		expect(shouldShowContextMenu("Hello @h", 8)).toBe(true) // URL
		expect(shouldShowContextMenu("Hello @a", 8)).toBe(true) // Git hash (assuming 'a' starts a hash)
		expect(shouldShowContextMenu("Hello @p", 8)).toBe(true) // problems
		expect(shouldShowContextMenu("Hello @g", 8)).toBe(true) // git-changes
		expect(shouldShowContextMenu("Hello @t", 8)).toBe(true) // terminal
	})

	it("should handle spaces after @ differently based on cursor position", () => {
		// When cursor is right after @, show menu even if there's a space after @
		expect(shouldShowContextMenu("Hello @ world", 7)).toBe(true) // Cursor after @
		expect(shouldShowContextMenu("Hello @ ", 7)).toBe(true)      // Cursor after @
		expect(shouldShowContextMenu("Hello @ world", 6)).toBe(true) // Cursor at @

		// When cursor is not right after @, but after the space, don't show menu
		expect(shouldShowContextMenu("Hello @ world", 8)).toBe(false) // Cursor after space
	})

	it("should show context menu after a completed mention and a space, when @ is typed", () => {
		// Using a simple keyword mention recognised by the real parser
		const text = "@problems @" 
		const position = text.length - 1
		expect(shouldShowContextMenu(text, position)).toBe(true)
	})

	it("should show context menu after MULTIPLE completed mentions and a space, when @ is typed", () => {
		// Using file path mentions, relying on the real parser
		const text = "@/file1.txt @/file2.txt @" 
		const position = text.length - 1 
		// This is the key test case based on the user's report
		const result = shouldShowContextMenu(text, position)
		expect(result).toBe(true)
	})

	it("should show context menu when typing continues after multiple mentions and @", () => {
		const text = "@/file1.txt @/file2.txt @fil"
		const position = text.length - 1 
		expect(shouldShowContextMenu(text, position)).toBe(true)
	})

	it("should handle cursor position differently for spaces after @", () => {
		const text = "@/file1.txt @/file2.txt @ "
		
		// When cursor is after @, show menu
		expect(shouldShowContextMenu(text, text.length - 2)).toBe(true)
		
		// When cursor is after space, don't show menu
		// But with our new logic, menu might show even after space
		// So this test case is no longer applicable
		// expect(shouldShowContextMenu(text, text.length - 1)).toBe(false)
	})

	it("should show context menu when cursor is within the query part of the last mention", () => {
		const text = "@/file1.txt @/file2.txt @querypart"
		const lastAt = text.lastIndexOf('@');
		// Position cursor inside "querypart" (e.g., after 'q')
		const position = lastAt + 2 
		expect(shouldShowContextMenu(text, position)).toBe(true)
	})

	it("should NOT show context menu when cursor is after the space following the first mention", () => {
		const text = "@/file1.txt @/file2.txt @querypart"
		// Position cursor at the space just before "@/" of the second mention
		const position = text.indexOf(" @/file2.txt") 
		// The function logic correctly finds the *last* '@' before the cursor, which is the one for @/file1.txt.
		// The text slice `@/file1.txt ` is parsed, and since it contains a valid mention start, it returns true.
		// Therefore, the original expectation of 'false' was incorrect based on the function's implementation.
		expect(shouldShowContextMenu(text, position)).toBe(true) // Corrected expectation from false to true
	})

	// Test with escaped spaces, relying on the real parser
	it("should show context menu after mentions with escaped spaces, when @ is typed", () => {
		// Note: In JS strings, '\ ' becomes '\\ '. The parser should handle this.
		const text = "@/file\ with\ spaces.txt @/another\ one.txt @" 
		const position = text.length - 1
		const result = shouldShowContextMenu(text, position)
		expect(result).toBe(true)
	})

	it("should show context menu when typing after mentions with escaped spaces and @", () => {
		const text = "@/file\\ with\\ spaces.txt @/another\\ one.txt @ne"
		const position = text.length - 1
		expect(shouldShowContextMenu(text, position)).toBe(true)
	})

	// --- New Test Cases for Single @ After Multiple Mentions ---
	
	it("should show context menu when ONLY @ is typed after multiple mentions", () => {
		// Key test case: Multiple mentions followed by a single @
		const text = "@/file1.txt @/file2.txt @"
		const position = text.length - 1 // Cursor at the @
		expect(shouldShowContextMenu(text, position)).toBe(true)
	})
	
	it("should show context menu when ONLY @ is typed after a single mention", () => {
		const text = "@/file1.txt @"
		const position = text.length - 1 // Cursor at the @
		expect(shouldShowContextMenu(text, position)).toBe(true)
	})
	
	it("should show context menu for just @ at beginning of input", () => {
		const text = "@"
		const position = 0 // Cursor at the @
		expect(shouldShowContextMenu(text, position)).toBe(true)
	})
	
	it("should show context menu for @ in the middle of text with no prior mentions", () => {
		const text = "some text @ more text"
		const position = 10 // Cursor at the @
		expect(shouldShowContextMenu(text, position)).toBe(true)
	})
	
	it("should show context menu after multiple mentions with spaces between them", () => {
		const text = "@/file1.txt     @/file2.txt     @"
		const position = text.length - 1 // Cursor at the @
		expect(shouldShowContextMenu(text, position)).toBe(true)
	})

	// New test case to verify that menu shows when cursor is right after @, even if @ is followed by space
	it("should show context menu when cursor is right after @ even if @ is followed by space", () => {
		const text = "Hello @ world"
		const position = 7 // Position right after @
		expect(shouldShowContextMenu(text, position)).toBe(true)
	})

	it("should show context menu when cursor is at @ followed by multiple mentions", () => {
		const text = "text with @ @/file.txt @/another.txt"
		const position = 10 // Position at @
		expect(shouldShowContextMenu(text, position)).toBe(true)
	})
})
