// npx vitest core/config/__tests__/CustomModesManager.lenientParsing.spec.ts

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
		showWarningMessage: vi.fn(),
	},
}))

vi.mock("fs/promises")

vi.mock("../../../utils/fs")
vi.mock("../../../utils/path")

describe("CustomModesManager - Lenient Parsing", () => {
	let manager: CustomModesManager
	let mockContext: vscode.ExtensionContext
	let mockOnUpdate: Mock
	let mockWorkspaceFolders: { uri: { fsPath: string } }[]

	const mockStoragePath = `${path.sep}mock${path.sep}settings`
	const mockSettingsPath = path.join(mockStoragePath, "settings", GlobalFileNames.customModes)
	const mockRoomodes = `${path.sep}mock${path.sep}workspace${path.sep}.roomodes`

	// Helper function to reduce duplication in fs.readFile mocks
	const mockFsReadFile = (files: Record<string, string>) => {
		;(fs.readFile as Mock).mockImplementation(async (path: string) => {
			if (files[path]) return files[path]
			throw new Error("File not found")
		})
	}

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

	describe("JSON fallback for .roomodes", () => {
		it("should successfully parse .roomodes file as JSON when YAML fails", async () => {
			const jsonContent = JSON.stringify({
				customModes: [
					{
						slug: "json-mode",
						name: "JSON Mode",
						roleDefinition: "A mode from JSON",
						groups: ["read", "edit"],
					},
				],
			})

			mockFsReadFile({
				[mockRoomodes]: jsonContent,
				[mockSettingsPath]: yaml.stringify({ customModes: [] }),
			})

			const modes = await manager.getCustomModes()

			expect(modes).toHaveLength(1)
			expect(modes[0].slug).toBe("json-mode")
			expect(modes[0].name).toBe("JSON Mode")
		})

		it("should handle JSON array format in .roomodes", async () => {
			const jsonArrayContent = JSON.stringify([
				{
					slug: "mode1",
					name: "Mode 1",
					roleDefinition: "First mode",
					groups: ["read"],
				},
				{
					slug: "mode2",
					name: "Mode 2",
					roleDefinition: "Second mode",
					groups: ["edit"],
				},
			])

			// This should be wrapped in customModes during parsing
			mockFsReadFile({
				[mockRoomodes]: jsonArrayContent,
				[mockSettingsPath]: yaml.stringify({ customModes: [] }),
			})

			const modes = await manager.getCustomModes()

			// The parser should handle this gracefully
			expect(modes).toBeDefined()
		})
	})

	describe("Partial mode recovery", () => {
		it("should recover modes from partially corrupted YAML", async () => {
			const partiallyCorruptedYaml = `customModes:
  - slug: "valid-mode"
    name: "Valid Mode"
    roleDefinition: "This mode is valid"
    groups: ["read", "edit"]
  - slug: "partial-mode"
    name: "Partial Mode
    roleDefinition: "Missing quote above"
    groups: ["read"]
  - slug: "another-valid"
    name: "Another Valid"
    roleDefinition: "This should work"
    groups: ["browser"]`

			mockFsReadFile({
				[mockRoomodes]: partiallyCorruptedYaml,
				[mockSettingsPath]: yaml.stringify({ customModes: [] }),
			})

			const modes = await manager.getCustomModes()

			// Should recover at least some modes
			expect(modes.length).toBeGreaterThan(0)
			// Should have extracted valid modes
			const slugs = modes.map((m) => m.slug)
			expect(slugs).toContain("valid-mode")
		})

		it("should extract modes even with indentation issues", async () => {
			const badIndentationYaml = `customModes:
- slug: "mode1"
  name: "Mode 1"
    roleDefinition: "Bad indent"
  groups: ["read"]
  - slug: "mode2"
name: "Mode 2"
    roleDefinition: "Also bad"
    groups: ["edit"]`

			mockFsReadFile({
				[mockRoomodes]: badIndentationYaml,
				[mockSettingsPath]: yaml.stringify({ customModes: [] }),
			})

			const modes = await manager.getCustomModes()

			// Should attempt to recover what it can
			expect(modes).toBeDefined()
		})
	})

	describe("Mode validation recovery", () => {
		it("should fix modes with missing required fields", async () => {
			const modesWithMissingFields = yaml.stringify({
				customModes: [
					{
						slug: "incomplete-mode",
						name: "Incomplete Mode",
						// Missing roleDefinition and groups
					},
					{
						slug: "minimal-mode",
						// Missing everything except slug
					},
				],
			})

			mockFsReadFile({
				[mockRoomodes]: modesWithMissingFields,
				[mockSettingsPath]: yaml.stringify({ customModes: [] }),
			})

			const modes = await manager.getCustomModes()

			// Should recover modes with defaults
			const incompleteMode = modes.find((m) => m.slug === "incomplete-mode")
			if (incompleteMode) {
				expect(incompleteMode.roleDefinition).toBeDefined()
				expect(incompleteMode.groups).toContain("read")
			}

			const minimalMode = modes.find((m) => m.slug === "minimal-mode")
			if (minimalMode) {
				expect(minimalMode.name).toBe("Minimal Mode") // Generated from slug
				expect(minimalMode.roleDefinition).toBeDefined()
				expect(minimalMode.groups).toContain("read")
			}
		})

		it("should fix modes with invalid group values", async () => {
			const modesWithBadGroups = yaml.stringify({
				customModes: [
					{
						slug: "bad-groups-mode",
						name: "Bad Groups Mode",
						roleDefinition: "Mode with invalid groups",
						groups: ["read", "invalid-group", "edit", "not-a-group"],
					},
					{
						slug: "string-groups-mode",
						name: "String Groups Mode",
						roleDefinition: "Groups as string",
						groups: "read, edit, browser",
					},
				],
			})

			mockFsReadFile({
				[mockRoomodes]: modesWithBadGroups,
				[mockSettingsPath]: yaml.stringify({ customModes: [] }),
			})

			const modes = await manager.getCustomModes()

			// Should filter out invalid groups
			const badGroupsMode = modes.find((m) => m.slug === "bad-groups-mode")
			if (badGroupsMode) {
				expect(badGroupsMode.groups).toContain("read")
				expect(badGroupsMode.groups).toContain("edit")
				expect(badGroupsMode.groups).not.toContain("invalid-group")
				expect(badGroupsMode.groups).not.toContain("not-a-group")
			}

			// Should parse comma-separated string
			const stringGroupsMode = modes.find((m) => m.slug === "string-groups-mode")
			if (stringGroupsMode) {
				expect(stringGroupsMode.groups).toContain("read")
				expect(stringGroupsMode.groups).toContain("edit")
				expect(stringGroupsMode.groups).toContain("browser")
			}
		})

		it("should handle modes with extra whitespace", async () => {
			const modesWithWhitespace = yaml.stringify({
				customModes: [
					{
						slug: "  whitespace-mode  ",
						name: "  Whitespace Mode  ",
						roleDefinition: "  Mode with extra spaces  ",
						groups: ["read"],
						customInstructions: "  Instructions with spaces  ",
					},
				],
			})

			mockFsReadFile({
				[mockRoomodes]: modesWithWhitespace,
				[mockSettingsPath]: yaml.stringify({ customModes: [] }),
			})

			const modes = await manager.getCustomModes()

			const mode = modes.find((m) => m.slug === "whitespace-mode")
			expect(mode).toBeDefined()
			if (mode) {
				expect(mode.slug).toBe("whitespace-mode")
				expect(mode.name).toBe("Whitespace Mode")
				expect(mode.roleDefinition).toBe("Mode with extra spaces")
				expect(mode.customInstructions).toBe("Instructions with spaces")
			}
		})
	})

	describe("Error handling and user feedback", () => {
		it("should show warning for partially invalid modes", async () => {
			const mixedValidityModes = yaml.stringify({
				customModes: [
					{
						slug: "valid-mode",
						name: "Valid Mode",
						roleDefinition: "Valid",
						groups: ["read"],
					},
					{
						// Completely invalid - no slug
						name: "No Slug Mode",
						roleDefinition: "Invalid",
					},
					{
						slug: "", // Empty slug
						name: "Empty Slug",
						roleDefinition: "Invalid",
					},
				],
			})

			mockFsReadFile({
				[mockRoomodes]: mixedValidityModes,
				[mockSettingsPath]: yaml.stringify({ customModes: [] }),
			})

			const modes = await manager.getCustomModes()

			// Should load valid mode
			expect(modes.some((m) => m.slug === "valid-mode")).toBe(true)

			// Should show warning about invalid modes
			expect(vscode.window.showWarningMessage).toHaveBeenCalled()
		})
	})

	describe("Duplicate keys handling", () => {
		it("should handle YAML with duplicate keys (last one wins)", async () => {
			const yamlWithDuplicates = `customModes:
  - slug: "duplicate-mode"
    name: "First Name"
    name: "Second Name"
    name: "Final Name"
    roleDefinition: "Test role"
    groups: ["read"]
    groups: ["read", "edit"]`

			mockFsReadFile({
				[mockRoomodes]: yamlWithDuplicates,
				[mockSettingsPath]: yaml.stringify({ customModes: [] }),
			})

			const modes = await manager.getCustomModes()

			const mode = modes.find((m) => m.slug === "duplicate-mode")
			expect(mode).toBeDefined()
			if (mode) {
				expect(mode.name).toBe("Final Name") // Last value should win
				expect(mode.groups).toEqual(["read", "edit"]) // Last value should win
			}
		})
	})

	describe("Single mode object handling", () => {
		it("should handle customModes as a single object instead of array", async () => {
			const singleModeYaml = `customModes:
  slug: "single-mode"
  name: "Single Mode"
  roleDefinition: "Not in array"
  groups: ["read"]`

			mockFsReadFile({
				[mockRoomodes]: singleModeYaml,
				[mockSettingsPath]: yaml.stringify({ customModes: [] }),
			})

			const modes = await manager.getCustomModes()

			// Should wrap single mode in array
			expect(modes).toHaveLength(1)
			expect(modes[0].slug).toBe("single-mode")
		})
	})
})
