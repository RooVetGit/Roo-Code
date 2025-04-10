import * as fs from "fs/promises"
import * as path from "path"
import * as yaml from "js-yaml"
import { ModeConfigService } from "../ModeConfigService"
import { ModeConfig } from "../../modeSchemas"
import { fileExistsAtPath } from "../../utils/fs"
import { getWorkspacePath } from "../../utils/path"

// Mock dependencies
jest.mock("fs/promises", () => ({
	mkdir: jest.fn().mockResolvedValue(undefined),
	readdir: jest.fn(),
	readFile: jest.fn(),
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

describe("ModeConfigService Syntax Compatibility", () => {
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

	// Reset mocks before each test
	beforeEach(() => {
		jest.clearAllMocks()
	})

	it("should load modes with v1 tuple-based syntax", async () => {
		// Mock directory listing
		;(fs.readdir as jest.Mock)
			.mockImplementation((dirPath) => {
				if (typeof dirPath === "string" && dirPath.includes("global/storage/modes")) {
					return Promise.resolve(["v1-syntax-mode.yaml"])
				}
				return Promise.resolve([])
			})(
				// Mock file content
				fs.readFile as jest.Mock,
			)
			.mockImplementation((filePath) => {
				if (typeof filePath === "string" && filePath.includes("v1-syntax-mode.yaml")) {
					return Promise.resolve(`
name: V1 Syntax Mode
roleDefinition: Test role definition with v1 syntax
groups:
  - read
  - - edit
    - fileRegex: \\.md$
      description: Markdown files
  - command
`)
				}
				return Promise.resolve("")
			})

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
		// Mock directory listing
		;(fs.readdir as jest.Mock)
			.mockImplementation((dirPath) => {
				if (typeof dirPath === "string" && dirPath.includes("global/storage/modes")) {
					return Promise.resolve(["v2-syntax-mode.yaml"])
				}
				return Promise.resolve([])
			})(
				// Mock file content
				fs.readFile as jest.Mock,
			)
			.mockImplementation((filePath) => {
				if (typeof filePath === "string" && filePath.includes("v2-syntax-mode.yaml")) {
					return Promise.resolve(`
name: V2 Syntax Mode
roleDefinition: Test role definition with v2 syntax
groups:
  - read
  - group: edit
    options:
      fileRegex: \\.md$
      description: Markdown files
  - command
`)
				}
				return Promise.resolve("")
			})

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

	it("should treat v1 and v2 syntax as equivalent", async () => {
		// First load a mode with v1 syntax
		;(fs.readdir as jest.Mock)
			.mockImplementation((dirPath) => {
				if (typeof dirPath === "string" && dirPath.includes("global/storage/modes")) {
					return Promise.resolve(["test-mode.yaml"])
				}
				return Promise.resolve([])
			})(fs.readFile as jest.Mock)
			.mockImplementation((filePath) => {
				if (typeof filePath === "string" && filePath.includes("test-mode.yaml")) {
					return Promise.resolve(`
name: Test Mode
roleDefinition: Test role definition
groups:
  - read
  - - edit
    - fileRegex: \\.md$
      description: Markdown files
  - command
`)
				}
				return Promise.resolve("")
			})

		const serviceV1 = new ModeConfigService(mockContext, mockOnUpdate)
		const modesV1 = await serviceV1.loadAllModes()

		// Reset mocks
		jest.clearAllMocks()(
			// Now load a mode with v2 syntax
			fs.readdir as jest.Mock,
		)
			.mockImplementation((dirPath) => {
				if (typeof dirPath === "string" && dirPath.includes("global/storage/modes")) {
					return Promise.resolve(["test-mode.yaml"])
				}
				return Promise.resolve([])
			})(fs.readFile as jest.Mock)
			.mockImplementation((filePath) => {
				if (typeof filePath === "string" && filePath.includes("test-mode.yaml")) {
					return Promise.resolve(`
name: Test Mode
roleDefinition: Test role definition
groups:
  - read
  - group: edit
    options:
      fileRegex: \\.md$
      description: Markdown files
  - command
`)
				}
				return Promise.resolve("")
			})

		const serviceV2 = new ModeConfigService(mockContext, mockOnUpdate)
		const modesV2 = await serviceV2.loadAllModes()

		// Verify both syntaxes produce equivalent results
		expect(modesV1).toHaveLength(1)
		expect(modesV2).toHaveLength(1)

		expect(modesV1[0].name).toEqual(modesV2[0].name)
		expect(modesV1[0].roleDefinition).toEqual(modesV2[0].roleDefinition)

		// Extract the edit group from both syntaxes for comparison
		const v1EditGroup = modesV1[0].groups[1]
		const v2EditGroup = modesV2[0].groups[1]

		// Check that the edit group has the same structure regardless of syntax
		expect(Array.isArray(v1EditGroup) ? v1EditGroup[0] : (v1EditGroup as any).group).toEqual(
			Array.isArray(v2EditGroup) ? v2EditGroup[0] : (v2EditGroup as any).group,
		)

		// Check that the options are equivalent
		const v1Options = Array.isArray(v1EditGroup) ? v1EditGroup[1] : (v1EditGroup as any).options
		const v2Options = Array.isArray(v2EditGroup) ? v2EditGroup[1] : (v2EditGroup as any).options

		expect(v1Options.fileRegex).toEqual(v2Options.fileRegex)
		expect(v1Options.description).toEqual(v2Options.description)
	})
})
