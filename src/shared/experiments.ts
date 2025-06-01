import type { AssertEqual, Equals, Keys, Values, ExperimentId } from "@roo-code/types"

export const EXPERIMENT_IDS = {
	POWER_STEERING: "powerSteering",
	CONCURRENT_FILE_READS: "concurrentFileReads",
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
}

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
	// This will be determined by the build process
	// For now, we can check environment variables or package name
	return process.env.ROO_CODE_NIGHTLY === "true"
}

// Update experimentDefault to use nightly defaults when appropriate
export const experimentDefault = getExperimentDefaults(isNightlyBuild())

export const experiments = {
	get: (id: ExperimentKey): ExperimentConfig | undefined => experimentConfigsMap[id],
	isEnabled: (experimentsConfig: Record<ExperimentId, boolean>, id: ExperimentId) =>
		experimentsConfig[id] ?? experimentDefault[id],
} as const
