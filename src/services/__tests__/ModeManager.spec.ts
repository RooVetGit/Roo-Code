import { describe, it, expect, beforeEach, vi, type Mock } from "vitest"
import type { ExtensionContext } from "vscode"
import type { ModeConfig } from "@roo-code/types"
import { ModeManager } from "../ModeManager"
import type { CustomModesManager } from "../../core/config/CustomModesManager"

// Mock VSCode ExtensionContext
const mockContext = {
	globalState: {
		get: vi.fn(),
		update: vi.fn(),
	},
	workspaceState: {
		get: vi.fn(),
		update: vi.fn(),
	},
} as unknown as ExtensionContext

// Mock CustomModesManager
const mockCustomModesManager = {
	getCustomModes: vi.fn(),
	setModeDisabled: vi.fn(),
	getModeDisabledState: vi.fn(),
	updateCustomMode: vi.fn(),
} as unknown as CustomModesManager

const sampleCustomModes: ModeConfig[] = [
	{
		slug: "custom-mode",
		name: "Custom Mode",
		roleDefinition: "You are a custom assistant",
		groups: ["read"],
		source: "global",
		disabled: false,
	},
	{
		slug: "project-mode",
		name: "Project Mode",
		roleDefinition: "You are a project-specific assistant",
		groups: ["edit"],
		source: "project",
		disabled: false,
	},
]

describe("ModeManager", () => {
	let modeManager: ModeManager

	beforeEach(() => {
		vi.clearAllMocks()
		modeManager = new ModeManager(mockContext, mockCustomModesManager)

		// Setup default mock returns
		;(mockCustomModesManager.getCustomModes as Mock).mockResolvedValue(sampleCustomModes)
	})

	describe("getAllModesWithSource", () => {
		it("should return all modes with source information", async () => {
			const modes = await modeManager.getAllModesWithSource()

			expect(modes).toHaveLength(7) // 5 built-in + 2 custom
			expect(modes.map((m) => m.slug)).toEqual(
				expect.arrayContaining([
					"architect",
					"code",
					"ask",
					"debug",
					"orchestrator",
					"custom-mode",
					"project-mode",
				]),
			)
			const architectMode = modes.find((m) => m.slug === "architect")
			expect(architectMode).toMatchObject({
				slug: "architect",
				source: "builtin",
			})
		})

		it("should include custom modes from CustomModesManager", async () => {
			const modes = await modeManager.getAllModesWithSource()

			const customMode = modes.find((m) => m.slug === "custom-mode")
			const projectMode = modes.find((m) => m.slug === "project-mode")

			expect(customMode).toMatchObject({
				slug: "custom-mode",
				source: "global",
			})
			expect(projectMode).toMatchObject({
				slug: "project-mode",
				source: "project",
			})
		})
	})

	describe("getEnabledModes", () => {
		it("should return only enabled modes", async () => {
			const enabledModes = await modeManager.getEnabledModes()

			expect(enabledModes).toHaveLength(7) // All modes enabled by default
			expect(enabledModes.map((m) => m.slug)).toEqual(
				expect.arrayContaining([
					"architect",
					"code",
					"ask",
					"debug",
					"orchestrator",
					"custom-mode",
					"project-mode",
				]),
			)
		})

		it("should exclude disabled modes", async () => {
			// Mock one mode as disabled
			;(mockCustomModesManager.getCustomModes as Mock).mockResolvedValue([
				{
					slug: "code",
					name: "Code",
					roleDefinition: "You are a coding assistant",
					groups: ["read", "edit", "command"],
					source: "global",
					disabled: true,
				},
				...sampleCustomModes,
			])

			const enabledModes = await modeManager.getEnabledModes()

			expect(enabledModes).toHaveLength(6) // 6 enabled modes
			expect(enabledModes.map((m) => m.slug)).not.toContain("code")
		})
	})

	describe("getModesBySource", () => {
		it("should group modes by source correctly", async () => {
			const modesBySource = await modeManager.getModesBySource()

			expect(modesBySource).toHaveProperty("builtin")
			expect(modesBySource).toHaveProperty("global")
			expect(modesBySource).toHaveProperty("project")

			expect(modesBySource.builtin).toHaveLength(5) // 5 built-in modes
			expect(modesBySource.global).toHaveLength(1) // custom-mode
			expect(modesBySource.project).toHaveLength(1) // project-mode
		})
	})

	describe("setModeDisabled", () => {
		it("should call CustomModesManager.updateCustomMode for built-in modes", async () => {
			await modeManager.setModeDisabled("architect", true)

			expect(mockCustomModesManager.updateCustomMode).toHaveBeenCalledWith(
				"architect",
				expect.objectContaining({
					slug: "architect",
					disabled: true,
					source: "global",
				}),
			)
		})
	})

	describe("validateModeSwitch", () => {
		it("should return valid for enabled modes", async () => {
			const result = await modeManager.validateModeSwitch("architect")

			expect(result).toEqual({
				isValid: true,
			})
		})

		it("should return invalid for disabled modes", async () => {
			// Setup: code mode is disabled via custom override
			;(mockCustomModesManager.getCustomModes as Mock).mockResolvedValue([
				{
					slug: "code",
					name: "Code",
					roleDefinition: "You are a coding assistant",
					groups: ["read", "edit", "command"],
					source: "global",
					disabled: true,
				},
				...sampleCustomModes,
			])

			const result = await modeManager.validateModeSwitch("code")

			expect(result).toEqual({
				isValid: false,
				errorMessage: "Mode 'code' is currently disabled.",
				availableModes: expect.any(Array),
			})
		})

		it("should return invalid for non-existent modes", async () => {
			const result = await modeManager.validateModeSwitch("non-existent")

			expect(result).toEqual({
				isValid: false,
				errorMessage: "Mode 'non-existent' not found.",
				availableModes: expect.any(Array),
			})
		})
	})
})
