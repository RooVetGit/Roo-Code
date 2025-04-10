import * as fs from "fs/promises"
import * as path from "path"
import { ModeConfigService } from "../ModeConfigService"
import { fileExistsAtPath } from "../../utils/fs"
import { getWorkspacePath } from "../../utils/path"

// Mock dependencies
jest.mock("fs/promises", () => ({
	mkdir: jest.fn(),
	readdir: jest.fn(),
	readFile: jest.fn(),
	writeFile: jest.fn(),
	unlink: jest.fn(),
}))
jest.mock("../../utils/fs", () => ({
	fileExistsAtPath: jest.fn(),
}))
jest.mock("../../utils/path", () => ({
	getWorkspacePath: jest.fn(),
}))
jest.mock("../../utils/logging", () => ({
	logger: {
		info: jest.fn(),
		error: jest.fn(),
	},
}))

describe("Debug ModeConfigService", () => {
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

	it("should load modes with v1 syntax", async () => {
		// Mock workspace path
		;(getWorkspacePath as jest.Mock)
			.mockReturnValue(null)(
				// Mock file system
				fs.mkdir as jest.Mock,
			)
			.mockResolvedValue(undefined)(
				// Mock directory listing
				fs.readdir as jest.Mock,
			)
			.mockImplementation((dirPath: string) => {
				console.log(`Reading directory: ${dirPath}`)
				if (dirPath === path.join("/mock/global/storage", "modes")) {
					return Promise.resolve(["v1-syntax-mode.yaml"])
				}
				return Promise.resolve([])
			})(
				// Mock file content
				fs.readFile as jest.Mock,
			)
			.mockImplementation((filePath: string) => {
				console.log(`Reading file: ${filePath}`)
				if (filePath.includes("v1-syntax-mode.yaml")) {
					return Promise.resolve(
						"name: V1 Syntax Mode\nroleDefinition: Test role definition with v1 syntax\ngroups:\n  - read\n  - - edit\n    - fileRegex: \\.md$\n      description: Markdown files\n  - command",
					)
				}
				return Promise.resolve("")
			})

		const service = new ModeConfigService(mockContext, mockOnUpdate)
		const modes = await service.loadAllModes()

		console.log("Loaded modes:", JSON.stringify(modes, null, 2))

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
})
