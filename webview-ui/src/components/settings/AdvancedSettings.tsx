import { HTMLAttributes } from "react"
import { VSCodeCheckbox } from "@vscode/webview-ui-toolkit/react"
import { Cog } from "lucide-react"

import { EXPERIMENT_IDS, ExperimentId } from "../../../../src/shared/experiments"

import { cn } from "@/lib/utils"

import { SetCachedStateField, SetExperimentEnabled } from "./types"
import { sliderLabelStyle } from "./styles"
import { SectionHeader } from "./SectionHeader"
import { Section } from "./Section"

type AdvancedSettingsProps = HTMLAttributes<HTMLDivElement> & {
	rateLimitSeconds: number
	diffEnabled?: boolean
	fuzzyMatchThreshold?: number
	setCachedStateField: SetCachedStateField<"rateLimitSeconds" | "diffEnabled" | "fuzzyMatchThreshold">
	experiments: Record<ExperimentId, boolean>
	setExperimentEnabled: SetExperimentEnabled

	// New props for profile-specific settings
	currentApiConfigId: string
	profileSpecificSettings?: {
		[profileId: string]: {
			rateLimitSeconds?: number
			diffEnabled?: boolean
			fuzzyMatchThreshold?: number
		}
	}
	setProfileSpecificSetting: (profileId: string, setting: string, value: any) => void
	isProfileSpecific: (profileId: string, setting: string) => boolean
	toggleProfileSpecific: (profileId: string, setting: string) => void
}
export const AdvancedSettings = ({
	rateLimitSeconds,
	diffEnabled,
	fuzzyMatchThreshold,
	setCachedStateField,
	experiments,
	setExperimentEnabled,
	currentApiConfigId,
	profileSpecificSettings,
	setProfileSpecificSetting,
	isProfileSpecific,
	toggleProfileSpecific,
	className,
	...props
}: AdvancedSettingsProps) => {
	return (
		<div className={cn("flex flex-col gap-2", className)} {...props}>
			<SectionHeader>
				<div className="flex items-center gap-2">
					<Cog className="w-4" />
					<div>Advanced</div>
				</div>
			</SectionHeader>

			<Section>
				<div>
					<div className="flex flex-col gap-2">
						<div className="flex items-center justify-between">
							<span className="font-medium">Rate limit</span>
							<VSCodeCheckbox
								checked={isProfileSpecific(currentApiConfigId, "rateLimitSeconds")}
								onChange={() => toggleProfileSpecific(currentApiConfigId, "rateLimitSeconds")}>
								<span className="text-sm">Profile-Specific</span>
							</VSCodeCheckbox>
						</div>
						<div className="flex items-center gap-2">
							<input
								type="range"
								min="0"
								max="60"
								step="1"
								value={
									isProfileSpecific(currentApiConfigId, "rateLimitSeconds")
										? (profileSpecificSettings?.[currentApiConfigId]?.rateLimitSeconds ??
											rateLimitSeconds)
										: rateLimitSeconds
								}
								onChange={(e) => {
									const value = parseInt(e.target.value)
									if (isProfileSpecific(currentApiConfigId, "rateLimitSeconds")) {
										setProfileSpecificSetting(currentApiConfigId, "rateLimitSeconds", value)
									} else {
										setCachedStateField("rateLimitSeconds", value)
									}
								}}
								className="h-2 focus:outline-0 w-4/5 accent-vscode-button-background"
							/>
							<span style={{ ...sliderLabelStyle }}>
								{isProfileSpecific(currentApiConfigId, "rateLimitSeconds")
									? (profileSpecificSettings?.[currentApiConfigId]?.rateLimitSeconds ??
										rateLimitSeconds)
									: rateLimitSeconds}
								s
							</span>
						</div>
					</div>
					<p className="text-vscode-descriptionForeground text-sm mt-0">Minimum time between API requests.</p>
				</div>

				<div>
					<div className="flex items-center justify-between">
						<VSCodeCheckbox
							checked={
								isProfileSpecific(currentApiConfigId, "diffEnabled")
									? (profileSpecificSettings?.[currentApiConfigId]?.diffEnabled ?? diffEnabled)
									: diffEnabled
							}
							onChange={(e: any) => {
								const value = e.target.checked
								if (isProfileSpecific(currentApiConfigId, "diffEnabled")) {
									setProfileSpecificSetting(currentApiConfigId, "diffEnabled", value)
								} else {
									setCachedStateField("diffEnabled", value)
								}

								if (!value) {
									// Reset both experimental strategies when diffs are disabled.
									setExperimentEnabled(EXPERIMENT_IDS.DIFF_STRATEGY, false)
									setExperimentEnabled(EXPERIMENT_IDS.MULTI_SEARCH_AND_REPLACE, false)
								}
							}}>
							<span className="font-medium">Enable editing through diffs</span>
						</VSCodeCheckbox>
						<VSCodeCheckbox
							checked={isProfileSpecific(currentApiConfigId, "diffEnabled")}
							onChange={() => toggleProfileSpecific(currentApiConfigId, "diffEnabled")}>
							<span className="text-sm">Profile-Specific</span>
						</VSCodeCheckbox>
					</div>
					<p className="text-vscode-descriptionForeground text-sm mt-0">
						When enabled, Roo will be able to edit files more quickly and will automatically reject
						truncated full-file writes. Works best with the latest Claude 3.7 Sonnet model.
					</p>
					{diffEnabled && (
						<div className="flex flex-col gap-2 mt-3 mb-2 pl-3 border-l-2 border-vscode-button-background">
							<div className="flex flex-col gap-2">
								<span className="font-medium">Diff strategy</span>
								<select
									value={
										experiments[EXPERIMENT_IDS.DIFF_STRATEGY]
											? "unified"
											: experiments[EXPERIMENT_IDS.MULTI_SEARCH_AND_REPLACE]
												? "multiBlock"
												: "standard"
									}
									onChange={(e) => {
										const value = e.target.value
										if (value === "standard") {
											setExperimentEnabled(EXPERIMENT_IDS.DIFF_STRATEGY, false)
											setExperimentEnabled(EXPERIMENT_IDS.MULTI_SEARCH_AND_REPLACE, false)
										} else if (value === "unified") {
											setExperimentEnabled(EXPERIMENT_IDS.DIFF_STRATEGY, true)
											setExperimentEnabled(EXPERIMENT_IDS.MULTI_SEARCH_AND_REPLACE, false)
										} else if (value === "multiBlock") {
											setExperimentEnabled(EXPERIMENT_IDS.DIFF_STRATEGY, false)
											setExperimentEnabled(EXPERIMENT_IDS.MULTI_SEARCH_AND_REPLACE, true)
										}
									}}
									className="p-2 rounded w-full bg-vscode-input-background text-vscode-input-foreground border border-vscode-input-border outline-none focus:border-vscode-focusBorder">
									<option value="standard">Standard (Single block)</option>
									<option value="multiBlock">Experimental: Multi-block diff</option>
									<option value="unified">Experimental: Unified diff</option>
								</select>
							</div>

							{/* Description for selected strategy */}
							<p className="text-vscode-descriptionForeground text-sm mt-1">
								{!experiments[EXPERIMENT_IDS.DIFF_STRATEGY] &&
									!experiments[EXPERIMENT_IDS.MULTI_SEARCH_AND_REPLACE] &&
									"Standard diff strategy applies changes to a single code block at a time."}
								{experiments[EXPERIMENT_IDS.DIFF_STRATEGY] &&
									"Unified diff strategy takes multiple approaches to applying diffs and chooses the best approach."}
								{experiments[EXPERIMENT_IDS.MULTI_SEARCH_AND_REPLACE] &&
									"Multi-block diff strategy allows updating multiple code blocks in a file in one request."}
							</p>

							{/* Match precision slider */}
							<div className="flex items-center justify-between mt-3">
								<span className="font-medium">Match precision</span>
								<VSCodeCheckbox
									checked={isProfileSpecific(currentApiConfigId, "fuzzyMatchThreshold")}
									onChange={() => toggleProfileSpecific(currentApiConfigId, "fuzzyMatchThreshold")}>
									<span className="text-sm">Profile-Specific</span>
								</VSCodeCheckbox>
							</div>
							<div className="flex items-center gap-2">
								<input
									type="range"
									min="0.8"
									max="1"
									step="0.005"
									value={
										isProfileSpecific(currentApiConfigId, "fuzzyMatchThreshold")
											? (profileSpecificSettings?.[currentApiConfigId]?.fuzzyMatchThreshold ??
												fuzzyMatchThreshold ??
												1.0)
											: (fuzzyMatchThreshold ?? 1.0)
									}
									onChange={(e) => {
										const value = parseFloat(e.target.value)
										if (isProfileSpecific(currentApiConfigId, "fuzzyMatchThreshold")) {
											setProfileSpecificSetting(currentApiConfigId, "fuzzyMatchThreshold", value)
										} else {
											setCachedStateField("fuzzyMatchThreshold", value)
										}
									}}
									className="h-2 focus:outline-0 w-4/5 accent-vscode-button-background"
								/>
								<span style={{ ...sliderLabelStyle }}>
									{Math.round(
										(isProfileSpecific(currentApiConfigId, "fuzzyMatchThreshold")
											? (profileSpecificSettings?.[currentApiConfigId]?.fuzzyMatchThreshold ??
												fuzzyMatchThreshold ??
												1.0)
											: (fuzzyMatchThreshold ?? 1.0)) * 100,
									)}
									%
								</span>
							</div>
							<p className="text-vscode-descriptionForeground text-sm mt-0">
								This slider controls how precisely code sections must match when applying diffs. Lower
								values allow more flexible matching but increase the risk of incorrect replacements. Use
								values below 100% with extreme caution.
							</p>
						</div>
					)}
				</div>
			</Section>
		</div>
	)
}
