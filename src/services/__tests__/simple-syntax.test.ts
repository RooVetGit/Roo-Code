import * as fs from "fs/promises"
import * as path from "path"
import { ModeConfigService } from "../ModeConfigService"
import { fileExistsAtPath } from "../../utils/fs"
import { getWorkspacePath } from "../../utils/path"

// Mock dependencies
jest.mock("fs/promises", () => ({
	mkdir: jest.fn().mockResolvedValue(undefined),
	readdir: jest.fn().mockResolvedValue([]),
	readFile: jest.fn().mockResolvedValue(""),
	writeFile: jest.fn().mockResolvedValue(undefined),
	unlink: jest.fn().mockResolvedValue(undefined),
}))
jest.mock("../../utils/fs", () => ({
	fileExistsAtPath: jest.fn().mockResolvedValue(true),
}))
jest.mock("../../utils/path", () => ({
	getWorkspacePath: jest.fn().mockReturnValue(null),
}))
jest.mock("../../utils/logging", () => ({
	logger: {
		info: jest.fn(),
		error: jest.fn(),
	},
}))

describe("Simple Syntax Test", () => {
	// Mock context
	const mockContext = {
		globalStorageUri: {
			fsPath: "/mock/global/storage",
		},
		globalState: {
			update: jest.fn().mockResolvedValue(undefined),
		},
	}

	// Mock onUpdate callback
	const mockOnUpdate = jest.fn().mockResolvedValue(undefined)

	beforeEach(() => {
		jest.clearAllMocks()
	})

	it("should load modes with v1 tuple-based syntax", async () => {
		// Mock directory listing to return a YAML file
		;(fs.readdir as jest.Mock).mockReturnValueOnce(["v1-syntax-mode.yaml"])

		// Mock file content with v1 syntax
		const v1Content = `
name: V1 Syntax Mode
roleDefinition: Test role definition with v1 syntax
groups:
  - read
  - - edit
    - fileRegex: \\.md$
      description: Markdown files
  - command
`
		;(fs.readFile as jest.Mock).mockReturnValueOnce(v1Content)

		const service = new ModeConfigService(mockContext, mockOnUpdate)
		const modes = await service.loadAllModes()

		// Verify modes were loaded
		expect(modes).toHaveLength(1)
		expect(modes[0]).toEqual({
			slug: "v1-syntax-mode",
			name: "V1 Syntax Mode",
			roleDefinition: "Test role definition with v1 syntax",
			groups: ["read", ["edit", { fileRegex: "\\.md$", description: "Markdown files" }], "command"],
			source: "global",
		})
	})

	it("should load modes with v2 object-based syntax", async () => {
		// Mock directory listing to return a YAML file
		;(fs.readdir as jest.Mock).mockReturnValueOnce(["v2-syntax-mode.yaml"])

		// Mock file content with v2 syntax
		const v2Content = `
name: V2 Syntax Mode
roleDefinition: Test role definition with v2 syntax
groups:
  - read
  - group: edit
    options:
      fileRegex: \\.md$
      description: Markdown files
  - command
`
		;(fs.readFile as jest.Mock).mockReturnValueOnce(v2Content)

		const service = new ModeConfigService(mockContext, mockOnUpdate)
		const modes = await service.loadAllModes()

		// Verify modes were loaded
		expect(modes).toHaveLength(1)
		expect(modes[0]).toEqual({
			slug: "v2-syntax-mode",
			name: "V2 Syntax Mode",
			roleDefinition: "Test role definition with v2 syntax",
			groups: [
				"read",
				{ group: "edit", options: { fileRegex: "\\.md$", description: "Markdown files" } },
				"command",
			],
			source: "global",
		})
	})

	it("should load modes with mixed syntax (v1 and v2)", async () => {
		// Mock directory listing to return a YAML file
		;(fs.readdir as jest.Mock).mockReturnValueOnce(["mixed-syntax-mode.yaml"])

		// Mock file content with mixed syntax
		const mixedContent = `
name: Mixed Syntax Mode
roleDefinition: Test role definition with mixed syntax
groups:
  - read
  - - edit
    - fileRegex: \\.md$
      description: Markdown files (v1 syntax)
  - group: browser
    options:
      description: Browser tools (v2 syntax)
  - command
`
		;(fs.readFile as jest.Mock).mockReturnValueOnce(mixedContent)

		const service = new ModeConfigService(mockContext, mockOnUpdate)
		const modes = await service.loadAllModes()

		// Verify modes were loaded
		expect(modes).toHaveLength(1)
		expect(modes[0]).toEqual({
			slug: "mixed-syntax-mode",
			name: "Mixed Syntax Mode",
			roleDefinition: "Test role definition with mixed syntax",
			groups: [
				"read",
				["edit", { fileRegex: "\\.md$", description: "Markdown files (v1 syntax)" }],
				{ group: "browser", options: { description: "Browser tools (v2 syntax)" } },
				"command",
			],
			source: "global",
		})
	})

	it("should verify v1 and v2 syntax equivalence", async () => {
		// Test v1 syntax
		const v1Content = `
name: Test Mode
roleDefinition: Test role definition
groups:
  - read
  - - edit
    - fileRegex: \\.md$
      description: Markdown files
  - command
`
		// Test v2 syntax
		const v2Content = `
name: Test Mode
roleDefinition: Test role definition
groups:
  - read
  - group: edit
    options:
      fileRegex: \\.md$
      description: Markdown files
  - command
`(
			// First test with v1 syntax
			fs.readdir as jest.Mock,
		).mockReturnValueOnce(["test-mode.yaml"])
		;(fs.readFile as jest.Mock).mockReturnValueOnce(v1Content)

		const serviceV1 = new ModeConfigService(mockContext, mockOnUpdate)
		const modesV1 = await serviceV1
			.loadAllModes()(
				// Then test with v2 syntax
				fs.readdir as jest.Mock,
			)
			.mockReturnValueOnce(["test-mode.yaml"])
		;(fs.readFile as jest.Mock).mockReturnValueOnce(v2Content)

		const serviceV2 = new ModeConfigService(mockContext, mockOnUpdate)
		const modesV2 = await serviceV2.loadAllModes()

		// Verify both syntaxes produce equivalent results
		expect(modesV1).toHaveLength(1)
		expect(modesV2).toHaveLength(1)

		// Compare basic properties
		expect(modesV1[0].name).toEqual(modesV2[0].name)
		expect(modesV1[0].roleDefinition).toEqual(modesV2[0].roleDefinition)

		// Extract the edit group from both syntaxes for comparison
		const v1EditGroup = modesV1[0].groups[1]
		const v2EditGroup = modesV2[0].groups[1]

		// Check that the edit group has the same structure regardless of syntax
		const v1GroupName = Array.isArray(v1EditGroup) ? v1EditGroup[0] : (v1EditGroup as any).group
		const v2GroupName = Array.isArray(v2EditGroup) ? v2EditGroup[0] : (v2EditGroup as any).group
		expect(v1GroupName).toEqual(v2GroupName)

		// Check that the options are equivalent
		const v1Options = Array.isArray(v1EditGroup) ? v1EditGroup[1] : (v1EditGroup as any).options
		const v2Options = Array.isArray(v2EditGroup) ? v2EditGroup[1] : (v2EditGroup as any).options

		expect(v1Options.fileRegex).toEqual(v2Options.fileRegex)
		expect(v1Options.description).toEqual(v2Options.description)
	})
})
