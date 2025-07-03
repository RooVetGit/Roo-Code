// npx vitest services/marketplace/__tests__/SimpleInstaller.spec.ts

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest"
import { SimpleInstaller } from "../SimpleInstaller"
import * as fs from "fs/promises"
import * as yaml from "yaml"
import * as vscode from "vscode"
import type { MarketplaceItem } from "@roo-code/types"
import * as path from "path"

vi.mock("fs/promises")
vi.mock("vscode", () => ({
	workspace: {
		workspaceFolders: [
			{
				uri: { fsPath: "/test/workspace" },
				name: "test",
				index: 0,
			},
		],
	},
}))
vi.mock("../../../utils/globalContext")
vi.mock("../../../utils/safeReadJson")
vi.mock("../../../utils/safeWriteJson")

// Import the mocked functions
import { safeReadJson } from "../../../utils/safeReadJson"
import { safeWriteJson } from "../../../utils/safeWriteJson"

const mockFs = fs as any
const mockSafeReadJson = vi.mocked(safeReadJson)
const mockSafeWriteJson = vi.mocked(safeWriteJson)

describe("SimpleInstaller", () => {
	let installer: SimpleInstaller
	let mockContext: vscode.ExtensionContext

	beforeEach(() => {
		mockContext = {} as vscode.ExtensionContext
		installer = new SimpleInstaller(mockContext)
		vi.clearAllMocks()

		// Mock mkdir to always succeed
		mockFs.mkdir.mockResolvedValue(undefined as any)
	})

	describe("installMode", () => {
		const mockModeItem: MarketplaceItem = {
			id: "test-mode",
			name: "Test Mode",
			description: "A test mode for testing",
			type: "mode",
			content: yaml.stringify({
				slug: "test",
				name: "Test Mode",
				roleDefinition: "Test role",
				groups: ["read"],
			}),
		}

		it("should install mode when .roomodes file does not exist", async () => {
			// Mock file not found error
			const notFoundError = new Error("File not found") as any
			notFoundError.code = "ENOENT"
			mockFs.readFile.mockRejectedValueOnce(notFoundError)
			mockFs.writeFile.mockResolvedValueOnce(undefined as any)

			const result = await installer.installItem(mockModeItem, { target: "project" })

			expect(result.filePath).toBe(path.join("/test/workspace", ".roomodes"))
			expect(mockFs.writeFile).toHaveBeenCalled()

			// Verify the written content contains the new mode
			const writtenContent = mockFs.writeFile.mock.calls[0][1] as string
			const writtenData = yaml.parse(writtenContent)
			expect(writtenData.customModes).toHaveLength(1)
			expect(writtenData.customModes[0].slug).toBe("test")
		})

		it("should install mode when .roomodes contains valid YAML", async () => {
			const existingContent = yaml.stringify({
				customModes: [{ slug: "existing", name: "Existing Mode", roleDefinition: "Existing", groups: [] }],
			})

			mockFs.readFile.mockResolvedValueOnce(existingContent)
			mockFs.writeFile.mockResolvedValueOnce(undefined as any)

			await installer.installItem(mockModeItem, { target: "project" })

			expect(mockFs.writeFile).toHaveBeenCalled()
			const writtenContent = mockFs.writeFile.mock.calls[0][1] as string
			const writtenData = yaml.parse(writtenContent)

			// Should contain both existing and new mode
			expect(writtenData.customModes).toHaveLength(2)
			expect(writtenData.customModes.find((m: any) => m.slug === "existing")).toBeDefined()
			expect(writtenData.customModes.find((m: any) => m.slug === "test")).toBeDefined()
		})

		it("should handle empty .roomodes file", async () => {
			// Empty file content
			mockFs.readFile.mockResolvedValueOnce("")
			mockFs.writeFile.mockResolvedValueOnce(undefined as any)

			const result = await installer.installItem(mockModeItem, { target: "project" })

			expect(result.filePath).toBe(path.join("/test/workspace", ".roomodes"))
			expect(mockFs.writeFile).toHaveBeenCalled()

			// Verify the written content contains the new mode
			const writtenContent = mockFs.writeFile.mock.calls[0][1] as string
			const writtenData = yaml.parse(writtenContent)
			expect(writtenData.customModes).toHaveLength(1)
			expect(writtenData.customModes[0].slug).toBe("test")
		})

		it("should handle .roomodes file with null content", async () => {
			// File exists but yaml.parse returns null
			mockFs.readFile.mockResolvedValueOnce("---\n")
			mockFs.writeFile.mockResolvedValueOnce(undefined as any)

			const result = await installer.installItem(mockModeItem, { target: "project" })

			expect(result.filePath).toBe(path.join("/test/workspace", ".roomodes"))
			expect(mockFs.writeFile).toHaveBeenCalled()

			// Verify the written content contains the new mode
			const writtenContent = mockFs.writeFile.mock.calls[0][1] as string
			const writtenData = yaml.parse(writtenContent)
			expect(writtenData.customModes).toHaveLength(1)
			expect(writtenData.customModes[0].slug).toBe("test")
		})

		it("should handle .roomodes file without customModes property", async () => {
			// File has valid YAML but no customModes property
			const contentWithoutCustomModes = yaml.stringify({ someOtherProperty: "value" })
			mockFs.readFile.mockResolvedValueOnce(contentWithoutCustomModes)
			mockFs.writeFile.mockResolvedValueOnce(undefined as any)

			const result = await installer.installItem(mockModeItem, { target: "project" })

			expect(result.filePath).toBe(path.join("/test/workspace", ".roomodes"))
			expect(mockFs.writeFile).toHaveBeenCalled()

			// Verify the written content contains the new mode and preserves other properties
			const writtenContent = mockFs.writeFile.mock.calls[0][1] as string
			const writtenData = yaml.parse(writtenContent)
			expect(writtenData.customModes).toHaveLength(1)
			expect(writtenData.customModes[0].slug).toBe("test")
			expect(writtenData.someOtherProperty).toBe("value")
		})

		it("should throw error when .roomodes contains invalid YAML", async () => {
			const invalidYaml = "invalid: yaml: content: {"

			mockFs.readFile.mockResolvedValueOnce(invalidYaml)

			await expect(installer.installItem(mockModeItem, { target: "project" })).rejects.toThrow(
				"Cannot install mode: The .roomodes file contains invalid YAML",
			)

			// Should NOT write to file
			expect(mockFs.writeFile).not.toHaveBeenCalled()
		})

		it("should replace existing mode with same slug", async () => {
			const existingContent = yaml.stringify({
				customModes: [{ slug: "test", name: "Old Test Mode", roleDefinition: "Old role", groups: [] }],
			})

			mockFs.readFile.mockResolvedValueOnce(existingContent)
			mockFs.writeFile.mockResolvedValueOnce(undefined as any)

			await installer.installItem(mockModeItem, { target: "project" })

			const writtenContent = mockFs.writeFile.mock.calls[0][1] as string
			const writtenData = yaml.parse(writtenContent)

			// Should contain only one mode with updated content
			expect(writtenData.customModes).toHaveLength(1)
			expect(writtenData.customModes[0].slug).toBe("test")
			expect(writtenData.customModes[0].name).toBe("Test Mode") // New name
		})
	})

	describe("installMcp", () => {
		const mockMcpItem: MarketplaceItem = {
			id: "test-mcp",
			name: "Test MCP",
			description: "A test MCP server for testing",
			type: "mcp",
			url: "https://example.com/mcp",
			content: JSON.stringify({
				command: "test-server",
				args: ["--test"],
			}),
		}

		it("should install MCP when mcp.json file does not exist", async () => {
			// Mock safeReadJson to return null for a non-existent file
			mockSafeReadJson.mockResolvedValueOnce(null)

			// Capture the data passed to fs.writeFile
			let capturedData: any = null
			mockFs.writeFile.mockImplementationOnce((path: string, content: string) => {
				capturedData = JSON.parse(content)
				return Promise.resolve(undefined)
			})

			const result = await installer.installItem(mockMcpItem, { target: "project" })

			expect(result.filePath).toBe(path.join("/test/workspace", ".roo", "mcp.json"))
			expect(mockFs.writeFile).toHaveBeenCalled()

			// Verify the written content contains the new server
			expect(capturedData.mcpServers["test-mcp"]).toBeDefined()
		})

		it("should throw error when mcp.json contains invalid JSON", async () => {
			const invalidJson = '{ "mcpServers": { invalid json'

			// Mock safeReadJson to return a SyntaxError
			const syntaxError = new SyntaxError("Unexpected token i in JSON at position 17")
			mockSafeReadJson.mockRejectedValueOnce(syntaxError)

			await expect(installer.installItem(mockMcpItem, { target: "project" })).rejects.toThrow(
				"Cannot install MCP server: The .roo/mcp.json file contains invalid JSON",
			)

			// Should NOT write to file
			expect(mockFs.writeFile).not.toHaveBeenCalled()
		})

		it("should install MCP when mcp.json contains valid JSON", async () => {
			const existingData = {
				mcpServers: {
					"existing-server": { command: "existing", args: [] },
				},
			}

			// Mock safeReadJson to return the existing data
			mockSafeReadJson.mockResolvedValueOnce(existingData)

			// Capture the data passed to fs.writeFile
			let capturedData: any = null
			mockFs.writeFile.mockImplementationOnce((path: string, content: string) => {
				capturedData = JSON.parse(content)
				return Promise.resolve(undefined)
			})

			await installer.installItem(mockMcpItem, { target: "project" })

			// Should contain both existing and new server
			expect(Object.keys(capturedData.mcpServers)).toHaveLength(2)
			expect(capturedData.mcpServers["existing-server"]).toBeDefined()
			expect(capturedData.mcpServers["test-mcp"]).toBeDefined()
		})
	})

	describe("removeMode", () => {
		const mockModeItem: MarketplaceItem = {
			id: "test-mode",
			name: "Test Mode",
			description: "A test mode for testing",
			type: "mode",
			content: yaml.stringify({
				slug: "test",
				name: "Test Mode",
				roleDefinition: "Test role",
				groups: ["read"],
			}),
		}

		it("should throw error when .roomodes contains invalid YAML during removal", async () => {
			const invalidYaml = "invalid: yaml: content: {"

			// Mock readFile to return invalid YAML
			// The removeMode method still uses fs.readFile directly for YAML files
			mockFs.readFile.mockResolvedValueOnce(invalidYaml)

			// The implementation will try to parse the YAML and throw an error
			await expect(installer.removeItem(mockModeItem, { target: "project" })).rejects.toThrow(
				"Cannot remove mode: The .roomodes file contains invalid YAML",
			)

			// Should NOT write to file
			expect(mockFs.writeFile).not.toHaveBeenCalled()
		})

		it("should do nothing when file does not exist", async () => {
			const notFoundError = new Error("File not found") as any
			notFoundError.code = "ENOENT"

			// Mock readFile to simulate file not found
			// The removeMode method still uses fs.readFile directly for YAML files
			mockFs.readFile.mockRejectedValueOnce(notFoundError)

			// Should not throw
			await installer.removeItem(mockModeItem, { target: "project" })

			// Should NOT write to file
			expect(mockFs.writeFile).not.toHaveBeenCalled()
		})

		it("should handle empty .roomodes file during removal", async () => {
			// Empty file content
			mockFs.readFile.mockResolvedValueOnce("")
			mockFs.writeFile.mockResolvedValueOnce(undefined as any)

			// Should not throw
			await installer.removeItem(mockModeItem, { target: "project" })

			// Should write back a valid structure with empty customModes
			expect(mockFs.writeFile).toHaveBeenCalled()
			const writtenContent = mockFs.writeFile.mock.calls[0][1] as string
			const writtenData = yaml.parse(writtenContent)
			expect(writtenData.customModes).toEqual([])
		})

		it("should handle .roomodes file with null content during removal", async () => {
			// File exists but yaml.parse returns null
			mockFs.readFile.mockResolvedValueOnce("---\n")
			mockFs.writeFile.mockResolvedValueOnce(undefined as any)

			// Should not throw
			await installer.removeItem(mockModeItem, { target: "project" })

			// Should write back a valid structure with empty customModes
			expect(mockFs.writeFile).toHaveBeenCalled()
			const writtenContent = mockFs.writeFile.mock.calls[0][1] as string
			const writtenData = yaml.parse(writtenContent)
			expect(writtenData.customModes).toEqual([])
		})

		it("should handle .roomodes file without customModes property during removal", async () => {
			// File has valid YAML but no customModes property
			const contentWithoutCustomModes = yaml.stringify({ someOtherProperty: "value" })
			mockFs.readFile.mockResolvedValueOnce(contentWithoutCustomModes)
			mockFs.writeFile.mockResolvedValueOnce(undefined as any)

			// Should not throw
			await installer.removeItem(mockModeItem, { target: "project" })

			// Should write back the file with the same content (no modes to remove)
			expect(mockFs.writeFile).toHaveBeenCalled()
			const writtenContent = mockFs.writeFile.mock.calls[0][1] as string
			const writtenData = yaml.parse(writtenContent)
			expect(writtenData.customModes).toEqual([])
			expect(writtenData.someOtherProperty).toBe("value")
		})
	})
})
