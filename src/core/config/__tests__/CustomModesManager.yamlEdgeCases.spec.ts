// npx vitest core/config/__tests__/CustomModesManager.yamlEdgeCases.spec.ts

import type { Mock } from "vitest"

import * as path from "path"
import * as fs from "fs/promises"

import * as yaml from "yaml"
import * as vscode from "vscode"

import type { ModeConfig } from "@roo-code/types"

import { fileExistsAtPath } from "../../../utils/fs"
import { getWorkspacePath } from "../../../utils/path"
import { GlobalFileNames } from "../../../shared/globalFileNames"

import { CustomModesManager } from "../CustomModesManager"

vi.mock("vscode", () => ({
	workspace: {
		workspaceFolders: [],
		onDidSaveTextDocument: vi.fn(),
		createFileSystemWatcher: vi.fn(),
	},
	window: {
		showErrorMessage: vi.fn(),
	},
}))

vi.mock("fs/promises")

vi.mock("../../../utils/fs")
vi.mock("../../../utils/path")

describe("CustomModesManager - YAML Edge Cases", () => {
	let manager: CustomModesManager
	let mockContext: vscode.ExtensionContext
	let mockOnUpdate: Mock
	let mockWorkspaceFolders: { uri: { fsPath: string } }[]

	const mockStoragePath = `${path.sep}mock${path.sep}settings`
	const mockSettingsPath = path.join(mockStoragePath, "settings", GlobalFileNames.customModes)
	const mockRoomodes = `${path.sep}mock${path.sep}workspace${path.sep}.roomodes`

	beforeEach(() => {
		mockOnUpdate = vi.fn()
		mockContext = {
			globalState: {
				get: vi.fn(),
				update: vi.fn(),
				keys: vi.fn(() => []),
				setKeysForSync: vi.fn(),
			},
			globalStorageUri: {
				fsPath: mockStoragePath,
			},
		} as unknown as vscode.ExtensionContext

		mockWorkspaceFolders = [{ uri: { fsPath: "/mock/workspace" } }]
		;(vscode.workspace as any).workspaceFolders = mockWorkspaceFolders
		;(vscode.workspace.onDidSaveTextDocument as Mock).mockReturnValue({ dispose: vi.fn() })
		;(getWorkspacePath as Mock).mockReturnValue("/mock/workspace")
		;(fileExistsAtPath as Mock).mockImplementation(async (path: string) => {
			return path === mockSettingsPath || path === mockRoomodes
		})
		;(fs.mkdir as Mock).mockResolvedValue(undefined)
		;(fs.readFile as Mock).mockImplementation(async (path: string) => {
			if (path === mockSettingsPath) {
				return yaml.stringify({ customModes: [] })
			}
			throw new Error("File not found")
		})

		// Mock createFileSystemWatcher to prevent file watching in tests
		const mockWatcher = {
			onDidChange: vi.fn().mockReturnValue({ dispose: vi.fn() }),
			onDidCreate: vi.fn().mockReturnValue({ dispose: vi.fn() }),
			onDidDelete: vi.fn().mockReturnValue({ dispose: vi.fn() }),
			dispose: vi.fn(),
		}
		;(vscode.workspace.createFileSystemWatcher as Mock).mockReturnValue(mockWatcher)

		manager = new CustomModesManager(mockContext, mockOnUpdate)
	})

	afterEach(() => {
		vi.clearAllMocks()
	})

	describe("BOM (Byte Order Mark) handling", () => {
		it("should handle UTF-8 BOM in YAML files", async () => {
			const yamlWithBOM =
				"\uFEFF" +
				yaml.stringify({
					customModes: [
						{
							slug: "test-mode",
							name: "Test Mode",
							roleDefinition: "Test role",
							groups: ["read"],
						},
					],
				})

			;(fs.readFile as Mock).mockImplementation(async (path: string) => {
				if (path === mockRoomodes) {
					return yamlWithBOM
				}
				if (path === mockSettingsPath) {
					return yaml.stringify({ customModes: [] })
				}
				throw new Error("File not found")
			})

			const modes = await manager.getCustomModes()

			expect(modes).toHaveLength(1)
			expect(modes[0].slug).toBe("test-mode")
			expect(modes[0].name).toBe("Test Mode")
		})

		it("should handle UTF-16 LE BOM in YAML files", async () => {
			const yamlWithBOM =
				"\uFFFE" +
				yaml.stringify({
					customModes: [
						{
							slug: "utf16-mode",
							name: "UTF-16 Mode",
							roleDefinition: "Test role",
							groups: ["read"],
						},
					],
				})

			;(fs.readFile as Mock).mockImplementation(async (path: string) => {
				if (path === mockRoomodes) {
					return yamlWithBOM
				}
				if (path === mockSettingsPath) {
					return yaml.stringify({ customModes: [] })
				}
				throw new Error("File not found")
			})

			const modes = await manager.getCustomModes()

			expect(modes).toHaveLength(1)
			expect(modes[0].slug).toBe("utf16-mode")
		})
	})

	describe("Invisible character handling", () => {
		it("should handle non-breaking spaces in YAML", async () => {
			// YAML with non-breaking spaces (U+00A0) instead of regular spaces
			const yamlWithNonBreakingSpaces = `customModes:
  - slug: "test-mode"
    name: "Test\u00A0Mode"
    roleDefinition: "Test\u00A0role\u00A0with\u00A0non-breaking\u00A0spaces"
    groups: ["read"]`

			;(fs.readFile as Mock).mockImplementation(async (path: string) => {
				if (path === mockRoomodes) {
					return yamlWithNonBreakingSpaces
				}
				if (path === mockSettingsPath) {
					return yaml.stringify({ customModes: [] })
				}
				throw new Error("File not found")
			})

			const modes = await manager.getCustomModes()

			expect(modes).toHaveLength(1)
			expect(modes[0].name).toBe("Test Mode") // Non-breaking spaces replaced with regular spaces
			expect(modes[0].roleDefinition).toBe("Test role with non-breaking spaces")
		})

		it("should handle zero-width characters", async () => {
			// YAML with zero-width characters
			const yamlWithZeroWidth = `customModes:
  - slug: "test-mode"
    name: "Test\u200BMode\u200C"
    roleDefinition: "Test\u200Drole"
    groups: ["read"]`

			;(fs.readFile as Mock).mockImplementation(async (path: string) => {
				if (path === mockRoomodes) {
					return yamlWithZeroWidth
				}
				if (path === mockSettingsPath) {
					return yaml.stringify({ customModes: [] })
				}
				throw new Error("File not found")
			})

			const modes = await manager.getCustomModes()

			expect(modes).toHaveLength(1)
			expect(modes[0].name).toBe("TestMode") // Zero-width characters removed
			expect(modes[0].roleDefinition).toBe("Testrole")
		})

		it("should normalize various quote characters", async () => {
			// Use fancy quotes that will be normalized before YAML parsing
			// The fancy quotes will be normalized to standard quotes
			const yamlWithFancyQuotes = yaml.stringify({
				customModes: [
					{
						slug: "test-mode",
						name: "Test Mode",
						roleDefinition: "Test role with \u2018fancy\u2019 quotes and \u201Ccurly\u201D quotes",
						groups: ["read"],
					},
				],
			})

			;(fs.readFile as Mock).mockImplementation(async (path: string) => {
				if (path === mockRoomodes) {
					return yamlWithFancyQuotes
				}
				if (path === mockSettingsPath) {
					return yaml.stringify({ customModes: [] })
				}
				throw new Error("File not found")
			})

			const modes = await manager.getCustomModes()

			expect(modes).toHaveLength(1)
			expect(modes[0].roleDefinition).toBe("Test role with 'fancy' quotes and \"curly\" quotes")
		})
	})

	// Note: YAML anchor/alias support has been removed to reduce complexity
	// If needed in the future, users should pre-process their YAML files

	describe("Complex fileRegex handling", () => {
		it("should handle complex fileRegex syntax gracefully", async () => {
			const yamlWithComplexFileRegex = yaml.stringify({
				customModes: [
					{
						slug: "test-mode",
						name: "Test Mode",
						roleDefinition: "Test role",
						groups: [
							"read",
							["edit", { fileRegex: "\\.md$", description: "Markdown files only" }],
							"browser",
						],
					},
				],
			})

			;(fs.readFile as Mock).mockImplementation(async (path: string) => {
				if (path === mockRoomodes) {
					return yamlWithComplexFileRegex
				}
				if (path === mockSettingsPath) {
					return yaml.stringify({ customModes: [] })
				}
				throw new Error("File not found")
			})

			const modes = await manager.getCustomModes()

			// Should successfully parse the complex fileRegex syntax
			expect(modes).toHaveLength(1)
			expect(modes[0].groups).toHaveLength(3)
			expect(modes[0].groups[1]).toEqual(["edit", { fileRegex: "\\.md$", description: "Markdown files only" }])
		})

		it("should handle invalid fileRegex syntax with clear error", async () => {
			// This YAML has invalid structure that might cause parsing issues
			const invalidYaml = `customModes:
  - slug: "test-mode"
    name: "Test Mode"
    roleDefinition: "Test role"
    groups:
      - read
      - ["edit", { fileRegex: "\\.md$" }]  # This line has invalid YAML syntax
      - browser`

			;(fs.readFile as Mock).mockImplementation(async (path: string) => {
				if (path === mockRoomodes) {
					return invalidYaml
				}
				if (path === mockSettingsPath) {
					return yaml.stringify({ customModes: [] })
				}
				throw new Error("File not found")
			})

			const modes = await manager.getCustomModes()

			// Should handle the error gracefully
			expect(modes).toHaveLength(0)
			expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
				expect.stringContaining("Invalid YAML in .roomodes file"),
			)
		})
	})

	describe("Error messages", () => {
		it("should provide detailed syntax error messages with context", async () => {
			const invalidYaml = `customModes:
  - slug: "test-mode"
    name: "Test Mode"
    roleDefinition: "Test role
    groups: ["read"]` // Missing closing quote

			;(fs.readFile as Mock).mockImplementation(async (path: string) => {
				if (path === mockRoomodes) {
					return invalidYaml
				}
				if (path === mockSettingsPath) {
					return yaml.stringify({ customModes: [] })
				}
				throw new Error("File not found")
			})

			const modes = await manager.getCustomModes()

			// Should fallback to empty array and show detailed error
			expect(modes).toHaveLength(0)
			expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
				expect.stringContaining("Invalid YAML in .roomodes file"),
			)
		})

		it("should provide schema validation error messages", async () => {
			const invalidSchema = yaml.stringify({
				customModes: [
					{
						slug: "test-mode",
						name: "Test Mode",
						// Missing required 'roleDefinition' field
						groups: ["read"],
					},
				],
			})

			;(fs.readFile as Mock).mockImplementation(async (path: string) => {
				if (path === mockRoomodes) {
					return invalidSchema
				}
				if (path === mockSettingsPath) {
					return yaml.stringify({ customModes: [] })
				}
				throw new Error("File not found")
			})

			const modes = await manager.getCustomModes()

			// Should show schema validation error
			expect(modes).toHaveLength(0)
			expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
				expect.stringContaining("Invalid custom modes format"),
			)
		})
	})

	describe("UTF-8 encoding", () => {
		it("should handle special characters and emojis", async () => {
			const yamlWithEmojis = yaml.stringify({
				customModes: [
					{
						slug: "emoji-mode",
						name: "📝 Writing Mode",
						roleDefinition: "A mode for writing with emojis 🚀",
						groups: ["read", "edit"],
					},
				],
			})

			;(fs.readFile as Mock).mockImplementation(async (path: string) => {
				if (path === mockRoomodes) {
					return yamlWithEmojis
				}
				if (path === mockSettingsPath) {
					return yaml.stringify({ customModes: [] })
				}
				throw new Error("File not found")
			})

			const modes = await manager.getCustomModes()

			expect(modes).toHaveLength(1)
			expect(modes[0].name).toBe("📝 Writing Mode")
			expect(modes[0].roleDefinition).toBe("A mode for writing with emojis 🚀")
		})

		it("should handle various international characters", async () => {
			const yamlWithInternational = yaml.stringify({
				customModes: [
					{
						slug: "intl-mode",
						name: "Mode Français",
						roleDefinition: "Mode für Deutsch, 日本語モード, Режим русский",
						groups: ["read"],
					},
				],
			})

			;(fs.readFile as Mock).mockImplementation(async (path: string) => {
				if (path === mockRoomodes) {
					return yamlWithInternational
				}
				if (path === mockSettingsPath) {
					return yaml.stringify({ customModes: [] })
				}
				throw new Error("File not found")
			})

			const modes = await manager.getCustomModes()

			expect(modes).toHaveLength(1)
			expect(modes[0].roleDefinition).toContain("für Deutsch")
			expect(modes[0].roleDefinition).toContain("日本語モード")
			expect(modes[0].roleDefinition).toContain("Режим русский")
		})
	})
})
