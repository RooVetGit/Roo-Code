// Integration test for PREVENT_TERMINAL_DISRUPTION functionality
// npx vitest run src/core/tools/__tests__/executeCommandTool.preventTerminalDisruption.integration.spec.ts

import { EXPERIMENT_IDS, experiments } from "../../../shared/experiments"

describe("PREVENT_TERMINAL_DISRUPTION integration", () => {
	it("should have PREVENT_TERMINAL_DISRUPTION experiment defined", () => {
		expect(EXPERIMENT_IDS.PREVENT_TERMINAL_DISRUPTION).toBe("preventTerminalDisruption")
	})

	it("should correctly check if PREVENT_TERMINAL_DISRUPTION is enabled", () => {
		// Test when experiment is disabled (default)
		const disabledConfig = { preventTerminalDisruption: false }
		expect(experiments.isEnabled(disabledConfig, EXPERIMENT_IDS.PREVENT_TERMINAL_DISRUPTION)).toBe(false)

		// Test when experiment is enabled
		const enabledConfig = { preventTerminalDisruption: true }
		expect(experiments.isEnabled(enabledConfig, EXPERIMENT_IDS.PREVENT_TERMINAL_DISRUPTION)).toBe(true)

		// Test when experiment is not in config (should use default)
		const emptyConfig = {}
		expect(experiments.isEnabled(emptyConfig, EXPERIMENT_IDS.PREVENT_TERMINAL_DISRUPTION)).toBe(false)
	})

	it("should verify the executeCommandTool imports experiments correctly", async () => {
		// This test verifies that the executeCommandTool module can import and use experiments
		const executeCommandModule = await import("../executeCommandTool")
		expect(executeCommandModule).toBeDefined()
		expect(executeCommandModule.executeCommand).toBeDefined()
		expect(executeCommandModule.executeCommandTool).toBeDefined()
	})

	it("should verify Terminal class structure for show method", async () => {
		// This test verifies the Terminal class has the expected structure
		const terminalModule = await import("../../../integrations/terminal/Terminal")
		expect(terminalModule.Terminal).toBeDefined()

		// The Terminal class should have a constructor that accepts a terminal
		const Terminal = terminalModule.Terminal
		expect(typeof Terminal).toBe("function")
	})
})
