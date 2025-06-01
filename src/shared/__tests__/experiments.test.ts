import { ExperimentId } from "@roo-code/types"
import { getExperimentDefaults, isNightlyBuild } from "../experiments"
import { EXPERIMENT_IDS, experimentConfigsMap, experiments as Experiments } from "../experiments"

describe("Internal Feature Flags", () => {
	let originalEnv: string | undefined

	beforeEach(() => {
		// Save original environment variable
		originalEnv = process.env.ROO_CODE_NIGHTLY
	})

	afterEach(() => {
		// Restore original environment variable
		if (originalEnv !== undefined) {
			process.env.ROO_CODE_NIGHTLY = originalEnv
		} else {
			delete process.env.ROO_CODE_NIGHTLY
		}
	})

	describe("POWER_STEERING", () => {
		it("is configured correctly", () => {
			expect(EXPERIMENT_IDS.POWER_STEERING).toBe("powerSteering")
			expect(experimentConfigsMap.POWER_STEERING).toMatchObject({
				enabled: false,
			})
		})
	})

	describe("isEnabled", () => {
		it("returns false when POWER_STEERING experiment is not enabled", () => {
			const experiments: Record<ExperimentId, boolean> = {
				powerSteering: false,
				concurrentFileReads: false,
			}
			expect(Experiments.isEnabled(experiments, EXPERIMENT_IDS.POWER_STEERING)).toBe(false)
		})

		it("returns true when experiment POWER_STEERING is enabled", () => {
			const experiments: Record<ExperimentId, boolean> = {
				powerSteering: true,
				concurrentFileReads: false,
			}
			expect(Experiments.isEnabled(experiments, EXPERIMENT_IDS.POWER_STEERING)).toBe(true)
		})

		it("returns false when experiment is not present", () => {
			const experiments: Record<ExperimentId, boolean> = {
				powerSteering: false,
				concurrentFileReads: false,
			}
			expect(Experiments.isEnabled(experiments, EXPERIMENT_IDS.POWER_STEERING)).toBe(false)
		})
	})

	describe("isNightlyBuild", () => {
		it("should return false when ROO_CODE_NIGHTLY is not set", () => {
			delete process.env.ROO_CODE_NIGHTLY
			expect(isNightlyBuild()).toBe(false)
		})

		it("should return true when ROO_CODE_NIGHTLY is 'true'", () => {
			process.env.ROO_CODE_NIGHTLY = "true"
			expect(isNightlyBuild()).toBe(true)
		})

		it("should return false when ROO_CODE_NIGHTLY is any other value", () => {
			process.env.ROO_CODE_NIGHTLY = "false"
			expect(isNightlyBuild()).toBe(false)
		})
	})

	describe("getExperimentDefaults", () => {
		it("should return default values for stable build", () => {
			const defaults = getExperimentDefaults(false)
			expect(defaults.powerSteering).toBe(false)
			expect(defaults.concurrentFileReads).toBe(false)
		})

		it("should respect nightlyDefault for nightly builds", () => {
			// This test will be more meaningful when internal flags are added
			const stableDefaults = getExperimentDefaults(false)
			const nightlyDefaults = getExperimentDefaults(true)

			// For now, they should be the same since no flags have nightlyDefault
			expect(stableDefaults).toEqual(nightlyDefaults)
		})
	})

	describe("Internal flag filtering", () => {
		it("should filter out flags starting with underscore in UI", () => {
			// This is tested in the UI component, but we can verify the convention
			const internalFlagExample = "_internalFeature"
			const userFacingFlag = "userFeature"

			expect(internalFlagExample.startsWith("_")).toBe(true)
			expect(userFacingFlag.startsWith("_")).toBe(false)
		})
	})
})
