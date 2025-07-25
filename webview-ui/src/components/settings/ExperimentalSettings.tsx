import { HTMLAttributes } from "react"
import { FlaskConical } from "lucide-react"

import type { Experiments } from "@roo-code/types"

import { EXPERIMENT_IDS, experimentConfigsMap } from "@roo/experiments"

import { useAppTranslation } from "@src/i18n/TranslationContext"
import { cn } from "@src/lib/utils"

import { SetExperimentEnabled } from "./types"
import { SectionHeader } from "./SectionHeader"
import { Section } from "./Section"
import { ExperimentalFeature } from "./ExperimentalFeature"

type ExperimentalSettingsProps = HTMLAttributes<HTMLDivElement> & {
	experiments: Experiments
	setExperimentEnabled: SetExperimentEnabled
}

export const ExperimentalSettings = ({
	experiments,
	setExperimentEnabled,
	className,
	...props
}: ExperimentalSettingsProps) => {
	const { t } = useAppTranslation()

	return (
		<div className={cn("flex flex-col gap-2", className)} {...props}>
			<SectionHeader>
				<div className="flex items-center gap-2">
					<FlaskConical className="w-4" />
					<div>{t("settings:sections.experimental")}</div>
				</div>
			</SectionHeader>

			<Section>
				{Object.entries(experimentConfigsMap)
					.filter(([key]) => key in EXPERIMENT_IDS)
					.map((config) => {
						const experimentKey = config[0] as keyof typeof EXPERIMENT_IDS
						const experimentId = EXPERIMENT_IDS[experimentKey]
						const defaultEnabled = experimentConfigsMap[experimentKey].enabled

						return (
							<ExperimentalFeature
								key={experimentKey}
								experimentKey={experimentKey}
								enabled={experiments[experimentId] ?? defaultEnabled}
								onChange={(enabled) => setExperimentEnabled(experimentId, enabled)}
							/>
						)
					})}
			</Section>
		</div>
	)
}
