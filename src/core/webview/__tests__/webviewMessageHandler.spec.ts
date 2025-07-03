import { describe, it, expect, vi, beforeEach } from "vitest"
import { webviewMessageHandler } from "../webviewMessageHandler"
import { ClineProvider } from "../ClineProvider"
import * as vscode from "vscode"
import { Package } from "../../../shared/package"

// Mock vscode module
vi.mock("vscode", () => ({
	workspace: {
		getConfiguration: vi.fn().mockReturnValue({
			update: vi.fn().mockResolvedValue(undefined),
		}),
	},
	ConfigurationTarget: {
		Global: 1,
	},
}))

// Mock Package
vi.mock("../../../shared/package", () => ({
	Package: {
		name: "roo-cline",
	},
}))

describe("webviewMessageHandler", () => {
	let mockProvider: any
	let mockContextProxy: any

	beforeEach(() => {
		// Reset all mocks
		vi.clearAllMocks()

		// Create mock context proxy
		mockContextProxy = {
			getValue: vi.fn(),
			setValue: vi.fn().mockResolvedValue(undefined),
		}

		// Create mock provider
		mockProvider = {
			contextProxy: mockContextProxy,
			postStateToWebview: vi.fn().mockResolvedValue(undefined),
			log: vi.fn(),
		}
	})

	describe("allowedCommands", () => {
		it("should update global state, workspace settings, and call postStateToWebview", async () => {
			const testCommands = ["npm test", "npm run build", "git status"]

			await webviewMessageHandler(mockProvider, {
				type: "allowedCommands",
				commands: testCommands,
			})

			// Verify global state was updated
			expect(mockContextProxy.setValue).toHaveBeenCalledWith("allowedCommands", testCommands)

			// Verify workspace settings were updated
			const mockConfig = vscode.workspace.getConfiguration()
			expect(vscode.workspace.getConfiguration).toHaveBeenCalledWith(Package.name)
			expect(mockConfig.update).toHaveBeenCalledWith(
				"allowedCommands",
				testCommands,
				vscode.ConfigurationTarget.Global,
			)

			// Verify postStateToWebview was called
			expect(mockProvider.postStateToWebview).toHaveBeenCalledTimes(1)
		})

		it("should filter out invalid commands", async () => {
			const testCommands = ["npm test", "", "   ", null, undefined, "git status", 123]

			await webviewMessageHandler(mockProvider, {
				type: "allowedCommands",
				commands: testCommands as any,
			})

			// Should only include valid string commands
			const expectedCommands = ["npm test", "git status"]
			expect(mockContextProxy.setValue).toHaveBeenCalledWith("allowedCommands", expectedCommands)
		})

		it("should handle empty commands array", async () => {
			await webviewMessageHandler(mockProvider, {
				type: "allowedCommands",
				commands: [],
			})

			expect(mockContextProxy.setValue).toHaveBeenCalledWith("allowedCommands", [])
			expect(mockProvider.postStateToWebview).toHaveBeenCalledTimes(1)
		})

		it("should handle undefined commands", async () => {
			await webviewMessageHandler(mockProvider, {
				type: "allowedCommands",
				commands: undefined,
			})

			expect(mockContextProxy.setValue).toHaveBeenCalledWith("allowedCommands", [])
			expect(mockProvider.postStateToWebview).toHaveBeenCalledTimes(1)
		})

		it("should handle non-array commands", async () => {
			await webviewMessageHandler(mockProvider, {
				type: "allowedCommands",
				commands: "not an array" as any,
			})

			expect(mockContextProxy.setValue).toHaveBeenCalledWith("allowedCommands", [])
			expect(mockProvider.postStateToWebview).toHaveBeenCalledTimes(1)
		})
	})
})
