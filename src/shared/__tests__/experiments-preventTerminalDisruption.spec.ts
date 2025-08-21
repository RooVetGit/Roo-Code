import { EXPERIMENT_IDS, experimentConfigsMap, experimentDefault, experiments } from "../experiments"

describe("PREVENT_TERMINAL_DISRUPTION experiment", () => {
	it("should include PREVENT_TERMINAL_DISRUPTION in EXPERIMENT_IDS", () => {
		expect(EXPERIMENT_IDS.PREVENT_TERMINAL_DISRUPTION).toBe("preventTerminalDisruption")
	})

	it("should have PREVENT_TERMINAL_DISRUPTION in experimentConfigsMap", () => {
		expect(experimentConfigsMap.PREVENT_TERMINAL_DISRUPTION).toBeDefined()
		expect(experimentConfigsMap.PREVENT_TERMINAL_DISRUPTION.enabled).toBe(false)
	})

	it("should have PREVENT_TERMINAL_DISRUPTION in experimentDefault", () => {
		expect(experimentDefault.preventTerminalDisruption).toBe(false)
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
})
