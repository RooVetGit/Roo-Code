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

describe("Mode Syntax Tests", () => {
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
})
