import { getToolDescriptionsForMode } from "../tools/index"
import { defaultModeSlug } from "../../../shared/modes"
import * as fs from "fs/promises"
import { toPosix } from "./utils"

// Mock the fs/promises module
jest.mock("fs/promises", () => ({
	readFile: jest.fn(),
	mkdir: jest.fn().mockResolvedValue(undefined),
	access: jest.fn().mockResolvedValue(undefined),
}))

// Get the mocked fs module
const mockedFs = fs as jest.Mocked<typeof fs>

describe("Tool Override System", () => {
	beforeEach(() => {
		// Reset mocks before each test
		jest.clearAllMocks()

		// Default behavior: file doesn't exist
		mockedFs.readFile.mockRejectedValue({ code: "ENOENT" })
	})

	it("should return default read_file tool description when no override file exists", async () => {
		const toolDescriptions = await getToolDescriptionsForMode(
			defaultModeSlug,
			"test/workspace",
			false, // supportsComputerUse
			undefined, // codeIndexManager
			undefined, // diffStrategy
			undefined, // browserViewportSize
			undefined, // mcpHub
			undefined, // customModes
			undefined, // experiments
		)

		// Should contain the default read_file description
		expect(toolDescriptions).toContain("## read_file")
		expect(toolDescriptions).toContain("Request to read the contents of one or more files")
		expect(toolDescriptions).toContain("relative to the current workspace directory test/workspace")
		expect(toolDescriptions).toContain("<read_file>")
		expect(toolDescriptions).toContain("Examples:")
	})

	it("should use custom read_file tool description when override file exists", async () => {
		// Mock the readFile to return content from an override file
		const customReadFileDescription = `## read_file
Description: Custom read file description for testing
Parameters:
- path: (required) Custom path description for \${args.cwd}
- start_line: (optional) Custom start line description
- end_line: (optional) Custom end line description
Usage:
<read_file>
<path>Custom file path</path>
</read_file>
Custom example:
<read_file>
<path>custom-example.txt</path>
</read_file>`

		mockedFs.readFile.mockImplementation((filePath, options) => {
			if (toPosix(filePath).includes(".roo/tools/read_file.md") && options === "utf-8") {
				return Promise.resolve(customReadFileDescription)
			}
			return Promise.reject({ code: "ENOENT" })
		})

		const toolDescriptions = await getToolDescriptionsForMode(
			defaultModeSlug,
			"test/workspace",
			false, // supportsComputerUse
			undefined, // codeIndexManager
			undefined, // diffStrategy
			undefined, // browserViewportSize
			undefined, // mcpHub
			undefined, // customModes
			undefined, // experiments
		)

		// Should contain the custom read_file description
		expect(toolDescriptions).toContain("Custom read file description for testing")
		expect(toolDescriptions).toContain("Custom path description for test/workspace")
		expect(toolDescriptions).toContain("Custom example:")
		expect(toolDescriptions).toContain("custom-example.txt")

		// Should not contain the default description text
		expect(toolDescriptions).not.toContain("Request to read the contents of one or more files")
		expect(toolDescriptions).not.toContain("3. Reading lines 500-1000 of a CSV file:")
	})

	it("should interpolate args properties in override content", async () => {
		// Mock the readFile to return content with args interpolation
		const customReadFileDescription = `## read_file
Description: Custom read file description with interpolated args
Parameters:
- path: (required) File path relative to workspace \${args.cwd}
- workspace: Current workspace is \${args.cwd}
Usage:
<read_file>
<path>File relative to \${args.cwd}</path>
</read_file>`

		mockedFs.readFile.mockImplementation((filePath, options) => {
			if (toPosix(filePath).includes(".roo/tools/read_file.md") && options === "utf-8") {
				return Promise.resolve(customReadFileDescription)
			}
			return Promise.reject({ code: "ENOENT" })
		})

		const toolDescriptions = await getToolDescriptionsForMode(
			defaultModeSlug,
			"test/workspace",
			false, // supportsComputerUse
			undefined, // codeIndexManager
			undefined, // diffStrategy
			undefined, // browserViewportSize
			undefined, // mcpHub
			undefined, // customModes
			undefined, // experiments
		)

		// Should contain interpolated values
		expect(toolDescriptions).toContain("File path relative to workspace test/workspace")
		expect(toolDescriptions).toContain("Current workspace is test/workspace")
		expect(toolDescriptions).toContain("File relative to test/workspace")

		// Should not contain the placeholder text
		expect(toolDescriptions).not.toContain("\${args.cwd}")
	})

	it("should return multiple tool descriptions including read_file", async () => {
		const toolDescriptions = await getToolDescriptionsForMode(
			defaultModeSlug,
			"test/workspace",
			false, // supportsComputerUse
			undefined, // codeIndexManager
			undefined, // diffStrategy
			undefined, // browserViewportSize
			undefined, // mcpHub
			undefined, // customModes
			undefined, // experiments
		)

		// Should contain multiple tools from the default mode
		expect(toolDescriptions).toContain("# Tools")
		expect(toolDescriptions).toContain("## read_file")
		expect(toolDescriptions).toContain("## write_to_file")
		expect(toolDescriptions).toContain("## list_files")
		expect(toolDescriptions).toContain("## search_files")

		// Tools should be separated by double newlines
		const toolSections = toolDescriptions.split("\n\n")
		expect(toolSections.length).toBeGreaterThan(1)
	})

	it("should handle empty override file gracefully", async () => {
		// Mock the readFile to return empty content
		mockedFs.readFile.mockImplementation((filePath, options) => {
			if (toPosix(filePath).includes(".roo/tools/read_file.md") && options === "utf-8") {
				return Promise.resolve("")
			}
			return Promise.reject({ code: "ENOENT" })
		})

		const toolDescriptions = await getToolDescriptionsForMode(
			defaultModeSlug,
			"test/workspace",
			false, // supportsComputerUse
			undefined, // codeIndexManager
			undefined, // diffStrategy
			undefined, // browserViewportSize
			undefined, // mcpHub
			undefined, // customModes
			undefined, // experiments
		)

		// Should fall back to default description when override file is empty
		expect(toolDescriptions).toContain("## read_file")
		expect(toolDescriptions).toContain("Request to read the contents of one or more files")
	})

	it("should handle whitespace-only override file gracefully", async () => {
		// Mock the readFile to return whitespace-only content
		mockedFs.readFile.mockImplementation((filePath, options) => {
			if (toPosix(filePath).includes(".roo/tools/read_file.md") && options === "utf-8") {
				return Promise.resolve("   \n  \t  \n   ")
			}
			return Promise.reject({ code: "ENOENT" })
		})

		const toolDescriptions = await getToolDescriptionsForMode(
			defaultModeSlug,
			"test/workspace",
			false, // supportsComputerUse
			undefined, // codeIndexManager
			undefined, // diffStrategy
			undefined, // browserViewportSize
			undefined, // mcpHub
			undefined, // customModes
			undefined, // experiments
		)

		// Should fall back to default description when override file contains only whitespace
		expect(toolDescriptions).toContain("## read_file")
		expect(toolDescriptions).toContain("Request to read the contents of one or more files")
	})
})
