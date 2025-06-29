import { HTMLAttributes } from "react"
import { FlaskConical } from "lucide-react"

import type { Experiments, CodebaseIndexConfig, CodebaseIndexModels, ProviderSettings, Language } from "@roo-code/types"

import { EXPERIMENT_IDS, experimentConfigsMap } from "@roo/experiments"

import { ExtensionStateContextType } from "@src/context/ExtensionStateContext"
import { useAppTranslation } from "@src/i18n/TranslationContext"
import { cn } from "@src/lib/utils"

import { SetCachedStateField, SetExperimentEnabled } from "./types"
import { SectionHeader } from "./SectionHeader"
import { Section } from "./Section"
import { ExperimentalFeature } from "./ExperimentalFeature"
import { CodeIndexSettings } from "./CodeIndexSettings"
import { CommitLanguageSettings } from "./CommitLanguageSettings"

type ExperimentalSettingsProps = HTMLAttributes<HTMLDivElement> & {
	experiments: Experiments
	setExperimentEnabled: SetExperimentEnabled
	setCachedStateField: SetCachedStateField<"codebaseIndexConfig" | "commitLanguage"> // Combined the types
	// CodeIndexSettings props
	codebaseIndexModels: CodebaseIndexModels | undefined
	codebaseIndexConfig: CodebaseIndexConfig | undefined
	apiConfiguration: ProviderSettings
	setApiConfigurationField: <K extends keyof ProviderSettings>(field: K, value: ProviderSettings[K]) => void
	areSettingsCommitted: boolean
	commitLanguage: Language
}

export const ExperimentalSettings = ({
	experiments,
	setExperimentEnabled,
	setCachedStateField,
	codebaseIndexModels,
	codebaseIndexConfig,
	apiConfiguration,
	setApiConfigurationField,
	areSettingsCommitted,
	commitLanguage,
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
						if (config[0] === "MULTI_FILE_APPLY_DIFF") {
							return (
								<ExperimentalFeature
									key={config[0]}
									experimentKey={config[0]}
									enabled={experiments[EXPERIMENT_IDS.MULTI_FILE_APPLY_DIFF] ?? false}
									onChange={(enabled) =>
										setExperimentEnabled(EXPERIMENT_IDS.MULTI_FILE_APPLY_DIFF, enabled)
									}
								/>
							)
						} else if (config[0] === "AI_COMMIT_MESSAGES") {
							// Dodano warunek dla AI_COMMIT_MESSAGES
							return (
								<>
									<ExperimentalFeature
										key={config[0]}
										experimentKey={config[0]}
										enabled={experiments[EXPERIMENT_IDS.AI_COMMIT_MESSAGES] ?? false}
										onChange={(enabled) =>
											setExperimentEnabled(EXPERIMENT_IDS.AI_COMMIT_MESSAGES, enabled)
										}
									/>
									<CommitLanguageSettings
										commitLanguage={commitLanguage}
										setCachedStateField={
											setCachedStateField as SetCachedStateField<"commitLanguage">
										}
										aiCommitMessagesEnabled={experiments?.aiCommitMessages} // Przekazujemy prop
									/>
								</>
							)
						}
						return (
							<ExperimentalFeature
								key={config[0]}
								experimentKey={config[0]}
								enabled={experiments[EXPERIMENT_IDS[config[0] as keyof typeof EXPERIMENT_IDS]] ?? false}
								onChange={(enabled) =>
									setExperimentEnabled(
										EXPERIMENT_IDS[config[0] as keyof typeof EXPERIMENT_IDS],
										enabled,
									)
								}
							/>
						)
					})}

				<CodeIndexSettings
					codebaseIndexModels={codebaseIndexModels}
					codebaseIndexConfig={codebaseIndexConfig}
					apiConfiguration={apiConfiguration}
					setCachedStateField={setCachedStateField as SetCachedStateField<keyof ExtensionStateContextType>}
					setApiConfigurationField={setApiConfigurationField}
					areSettingsCommitted={areSettingsCommitted}
				/>
			</Section>
		</div>
	)
}
