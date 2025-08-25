import { describe, it, expect, beforeEach, vi, type Mock } from "vitest"
import { ModeManager } from "../../../services/ModeManager"

// Mock vscode module
const mockShowErrorMessage = vi.fn()
vi.mock("vscode", () => ({
	window: {
		showErrorMessage: mockShowErrorMessage,
	},
}))

// Mock extension context
const mockContext = {
	globalState: {
		get: vi.fn(),
		update: vi.fn(),
	},
	workspaceState: {
		get: vi.fn(),
		update: vi.fn(),
	},
} as any

// Mock custom modes manager
const mockCustomModesManager = {
	getCustomModes: vi.fn().mockReturnValue([]),
	updateCustomMode: vi.fn(),
} as any

describe("Mode Switch Validation", () => {
	let modeManager: ModeManager

	beforeEach(() => {
		vi.clearAllMocks()
		modeManager = new ModeManager(mockContext, mockCustomModesManager)
	})

	describe("validateModeSwitch", () => {
		it("should validate enabled built-in mode", async () => {
			// Mock that architect mode is enabled (default)
			mockCustomModesManager.getCustomModes.mockResolvedValue([])

			const result = await modeManager.validateModeSwitch("architect")

			expect(result.isValid).toBe(true)
			expect(result.errorMessage).toBeUndefined()
		})

		it("should reject disabled built-in mode", async () => {
			// Mock that code mode is disabled via custom override
			mockCustomModesManager.getCustomModes.mockResolvedValue([
				{
					slug: "code",
					name: "Code",
					roleDefinition: "You are a coding assistant",
					groups: ["read", "edit", "command"],
					source: "global",
					disabled: true,
				},
			])

			const result = await modeManager.validateModeSwitch("code")

			expect(result.isValid).toBe(false)
			expect(result.errorMessage).toBe("Mode 'code' is currently disabled.")
		})

		it("should reject non-existent mode", async () => {
			// Mock no disabled modes
			mockCustomModesManager.getCustomModes.mockResolvedValue([])

			const result = await modeManager.validateModeSwitch("invalid-mode")

			expect(result.isValid).toBe(false)
			expect(result.errorMessage).toBe("Mode 'invalid-mode' not found.")
		})

		it("should handle empty mode slug", async () => {
			const result = await modeManager.validateModeSwitch("")

			expect(result.isValid).toBe(false)
			expect(result.errorMessage).toBe("Mode '' not found.")
		})

		it("should validate custom enabled mode", async () => {
			// Mock custom mode
			const customMode = {
				slug: "custom-test",
				name: "Custom Test",
				roleDefinition: "A test custom mode",
				groups: [],
				source: "global",
				disabled: false,
			}
			mockCustomModesManager.getCustomModes.mockResolvedValue([customMode])

			const result = await modeManager.validateModeSwitch("custom-test")

			expect(result.isValid).toBe(true)
			expect(result.errorMessage).toBeUndefined()
		})

		it("should reject disabled custom mode", async () => {
			// Mock custom mode
			const customMode = {
				slug: "custom-disabled",
				name: "Custom Disabled",
				roleDefinition: "A disabled custom mode",
				groups: [],
				source: "global",
				disabled: true,
			}
			mockCustomModesManager.getCustomModes.mockResolvedValue([customMode])

			const result = await modeManager.validateModeSwitch("custom-disabled")

			expect(result.isValid).toBe(false)
			expect(result.errorMessage).toBe("Mode 'custom-disabled' is currently disabled.")
		})
	})

	describe("error message formatting", () => {
		it("should format disabled mode messages consistently", async () => {
			mockCustomModesManager.getCustomModes.mockResolvedValue([
				{
					slug: "debug",
					name: "Debug",
					roleDefinition: "You are a debugging assistant",
					groups: ["read", "edit", "command"],
					source: "global",
					disabled: true,
				},
			])

			const result = await modeManager.validateModeSwitch("debug")

			expect(result.isValid).toBe(false)
			expect(result.errorMessage).toBe("Mode 'debug' is currently disabled.")
		})

		it("should format non-existent mode messages consistently", async () => {
			mockCustomModesManager.getCustomModes.mockResolvedValue([])

			const result = await modeManager.validateModeSwitch("unknown")

			expect(result.isValid).toBe(false)
			expect(result.errorMessage).toBe("Mode 'unknown' not found.")
		})
	})

	describe("mode existence checks", () => {
		it("should recognize all built-in modes", async () => {
			const builtInModes = ["architect", "code", "ask", "debug", "orchestrator"]
			mockCustomModesManager.getCustomModes.mockResolvedValue([])

			for (const mode of builtInModes) {
				const result = await modeManager.validateModeSwitch(mode)
				expect(result.isValid).toBe(true)
			}
		})

		it("should handle case sensitivity", async () => {
			mockCustomModesManager.getCustomModes.mockResolvedValue([])

			const result = await modeManager.validateModeSwitch("ARCHITECT")

			expect(result.isValid).toBe(false)
			expect(result.errorMessage).toBe("Mode 'ARCHITECT' not found.")
		})
	})
})
