import { HTMLAttributes } from "react"
import { FlaskConical } from "lucide-react"
import { VSCodeCheckbox, VSCodeLink, VSCodeButton } from "@vscode/webview-ui-toolkit/react"
import { Trans } from "react-i18next"

import type { Experiments, CodebaseIndexConfig, CodebaseIndexModels } from "@roo-code/types"

import { EXPERIMENT_IDS, experimentConfigsMap } from "@roo/experiments"

import { useAppTranslation } from "@src/i18n/TranslationContext"
import { cn } from "@src/lib/utils"
import { buildDocLink } from "@src/utils/docLinks"
import { Slider } from "@src/components/ui"

import { SetExperimentEnabled } from "./types"
import { SectionHeader } from "./SectionHeader"
import { Section } from "./Section"
import { ExperimentalFeature } from "./ExperimentalFeature"
import { SetCachedStateField } from "./types"

// Import the constant from the backend
const DEFAULT_MAX_SEARCH_RESULTS = 50

type ExperimentalSettingsProps = HTMLAttributes<HTMLDivElement> & {
	experiments: Experiments
	setExperimentEnabled: SetExperimentEnabled
	// CodeIndexSettings props
	codebaseIndexModels: CodebaseIndexModels | undefined
	codebaseIndexConfig: CodebaseIndexConfig | undefined
	// For codebase index enabled toggle
	codebaseIndexEnabled?: boolean
	setCachedStateField?: SetCachedStateField<any>
}

export const ExperimentalSettings = ({
	experiments,
	setExperimentEnabled,
	codebaseIndexModels,
	codebaseIndexConfig,
	codebaseIndexEnabled,
	setCachedStateField,
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

				{/* Codebase Indexing Enable/Disable Toggle */}
				<div className="mt-4">
					<div className="flex items-center gap-2">
						<VSCodeCheckbox
							checked={codebaseIndexEnabled || false}
							onChange={(e: any) => {
								const newEnabledState = e.target.checked
								if (setCachedStateField && codebaseIndexConfig) {
									setCachedStateField("codebaseIndexConfig", {
										...codebaseIndexConfig,
										codebaseIndexEnabled: newEnabledState,
									})
								}
							}}>
							<span className="font-medium">{t("settings:codeIndex.enableLabel")}</span>
						</VSCodeCheckbox>
					</div>
					<p className="text-vscode-descriptionForeground text-sm mt-1 ml-6">
						<Trans i18nKey="settings:codeIndex.enableDescription">
							<VSCodeLink
								href={buildDocLink("features/experimental/codebase-indexing", "settings")}
								style={{ display: "inline" }}></VSCodeLink>
						</Trans>
					</p>
				</div>

				{/* Max Search Results Slider */}
				{codebaseIndexEnabled && (
					<div className="mt-4 ml-6">
						<div className="flex flex-col gap-2">
							<span className="block font-medium mb-1">
								{t("settings:codeIndex.searchMaxResultsLabel")}
							</span>
							<div className="flex items-center gap-4">
								<Slider
									min={10}
									max={200}
									step={10}
									value={[
										codebaseIndexConfig?.codebaseIndexSearchMaxResults ??
											DEFAULT_MAX_SEARCH_RESULTS,
									]}
									onValueChange={([value]) =>
										setCachedStateField &&
										codebaseIndexConfig &&
										setCachedStateField("codebaseIndexConfig", {
											...codebaseIndexConfig,
											codebaseIndexSearchMaxResults: value,
										})
									}
									data-testid="search-max-results-slider"
									aria-label={t("settings:codeIndex.searchMaxResultsLabel")}
								/>
								<span className="w-10">
									{codebaseIndexConfig?.codebaseIndexSearchMaxResults ?? DEFAULT_MAX_SEARCH_RESULTS}
								</span>
								<VSCodeButton
									appearance="icon"
									onClick={() =>
										setCachedStateField &&
										codebaseIndexConfig &&
										setCachedStateField("codebaseIndexConfig", {
											...codebaseIndexConfig,
											codebaseIndexSearchMaxResults: DEFAULT_MAX_SEARCH_RESULTS,
										})
									}
									title={t("settings:codeIndex.resetToDefault")}>
									<span className="codicon codicon-discard"></span>
								</VSCodeButton>
							</div>
							<div className="text-vscode-descriptionForeground text-sm mt-1">
								{t("settings:codeIndex.searchMaxResultsDescription")}
							</div>
						</div>
					</div>
				)}
			</Section>
		</div>
	)
}
