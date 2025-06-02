import React from "react"
import { AlertCircle } from "lucide-react"
import type { ExperimentId } from "@roo-code/types"
import { EXPERIMENT_IDS } from "@roo/experiments"

interface NightlyTestBannerProps {
	experiments: Record<ExperimentId, boolean>
}

export const NightlyTestBanner: React.FC<NightlyTestBannerProps> = ({ experiments }) => {
	// Check if the internal nightly test banner experiment is enabled
	const showBanner = experiments[EXPERIMENT_IDS._NIGHTLY_TEST_BANNER] ?? false

	if (!showBanner) {
		return null
	}

	return (
		<div className="bg-yellow-500/10 border border-yellow-500/30 rounded-md p-3 mb-4 flex items-center gap-2">
			<AlertCircle className="w-5 h-5 text-yellow-600" />
			<div className="flex-1">
				<p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
					🧪 Nightly Build Test Feature
				</p>
				<p className="text-xs text-yellow-700 dark:text-yellow-300 mt-1">
					This banner is an internal test feature that only appears in nightly builds. It demonstrates that
					internal experiments with nightlyDefault=true are working correctly.
				</p>
			</div>
		</div>
	)
}
