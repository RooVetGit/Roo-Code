import type { AssertEqual, Equals, Keys, Values, ExperimentId } from "@roo-code/types"

export const EXPERIMENT_IDS = {
	POWER_STEERING: "powerSteering",
	CONCURRENT_FILE_READS: "concurrentFileReads",
	_NIGHTLY_TEST_BANNER: "_nightlyTestBanner",
} as const satisfies Record<string, ExperimentId>

type _AssertExperimentIds = AssertEqual<Equals<ExperimentId, Values<typeof EXPERIMENT_IDS>>>

type ExperimentKey = Keys<typeof EXPERIMENT_IDS>

interface ExperimentConfig {
	enabled: boolean
	internal?: boolean // Mark as internal
	nightlyDefault?: boolean // Enable by default in nightly
	description?: string
}

export const experimentConfigsMap: Record<ExperimentKey, ExperimentConfig> = {
	POWER_STEERING: { enabled: false },
	CONCURRENT_FILE_READS: { enabled: false },
	_NIGHTLY_TEST_BANNER: {
		enabled: false,
		internal: false,
		nightlyDefault: true,
		description: "Internal: Shows a test banner in nightly builds",
	},
}

/**
 * Gets the default values for all experiments based on build type
 *
 * For nightly builds:
 * - Experiments with nightlyDefault=true will be enabled by default
 * - Other experiments use their configured enabled value
 *
 * For stable builds:
 * - All experiments use their configured enabled value
 *
 * This allows features to be automatically enabled in nightly builds
 * for testing before being enabled in stable builds.
 */
export function getExperimentDefaults(isNightly: boolean = false): Record<ExperimentId, boolean> {
	const defaults: Record<ExperimentId, boolean> = {} as Record<ExperimentId, boolean>

	Object.entries(experimentConfigsMap).forEach(([key, config]) => {
		const experimentId = EXPERIMENT_IDS[key as keyof typeof EXPERIMENT_IDS]

		if (isNightly && config.nightlyDefault) {
			defaults[experimentId] = true
		} else {
			defaults[experimentId] = config.enabled
		}
	})

	return defaults
}

// Check if running nightly build
export function isNightlyBuild(): boolean {
	// The nightly build process defines PKG_NAME as "roo-code-nightly" at compile time
	// This is the most reliable single indicator for nightly builds
	return process.env.PKG_NAME === "roo-code-nightly"
}

export const experimentDefault = getExperimentDefaults(isNightlyBuild())

export const experiments = {
	get: (id: ExperimentKey): ExperimentConfig | undefined => experimentConfigsMap[id],
	isEnabled: (experimentsConfig: Record<ExperimentId, boolean>, id: ExperimentId) =>
		experimentsConfig[id] ?? experimentDefault[id],
} as const
