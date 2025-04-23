import { EXPERIMENT_IDS, experimentConfigsMap, experiments as Experiments, ExperimentId } from "../experiments"

describe("experiments", () => {
	describe("POWER_STEERING", () => {
		it("is configured correctly", () => {
			expect(EXPERIMENT_IDS.POWER_STEERING).toBe("powerSteering")
			expect(experimentConfigsMap.POWER_STEERING).toMatchObject({
				enabled: false,
			})
		})
	})

	describe("isEnabled", () => {
		it("returns false when experiment is not enabled", () => {
			const experiments: Record<ExperimentId, boolean> = {
				powerSteering: false,
				readMultipleFiles: false, // Add new experiment
			}
			expect(Experiments.isEnabled(experiments, EXPERIMENT_IDS.POWER_STEERING)).toBe(false)
			expect(Experiments.isEnabled(experiments, EXPERIMENT_IDS.READ_MULTIPLE_FILES)).toBe(false) // Add assertion
		})

		it("returns true when experiment is enabled", () => {
			const experiments: Record<ExperimentId, boolean> = {
				powerSteering: true,
				readMultipleFiles: true, // Add new experiment
			}
			expect(Experiments.isEnabled(experiments, EXPERIMENT_IDS.POWER_STEERING)).toBe(true)
			expect(Experiments.isEnabled(experiments, EXPERIMENT_IDS.READ_MULTIPLE_FILES)).toBe(true) // Add assertion
		})

		it("returns default value when experiment is not present in config", () => {
			// Simulate a scenario where the config might be missing an experiment
			const experiments: Partial<Record<ExperimentId, boolean>> = {
				powerSteering: true,
				// readMultipleFiles is missing
			}
			// It should fall back to the default value (false for readMultipleFiles)
			expect(
				Experiments.isEnabled(experiments as Record<ExperimentId, boolean>, EXPERIMENT_IDS.READ_MULTIPLE_FILES),
			).toBe(false)
			// Ensure existing experiment check still works
			expect(
				Experiments.isEnabled(experiments as Record<ExperimentId, boolean>, EXPERIMENT_IDS.POWER_STEERING),
			).toBe(true)
		})
	})
})
