import { HTMLAttributes } from "react"
import { useAppTranslation } from "@/i18n/TranslationContext"
import { FlaskConical } from "lucide-react"

import { EXPERIMENT_IDS, experimentConfigsMap, ExperimentId } from "@roo/shared/experiments"

import { cn } from "@/lib/utils"
import { vscode } from "@/utils/vscode"

import { SetCachedStateField, SetExperimentEnabled } from "./types"
import { SectionHeader } from "./SectionHeader"
import { Section } from "./Section"
import { ExperimentalFeature } from "./ExperimentalFeature"
import { Button, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Slider } from "@/components/ui/"
import { VSCodeTextArea } from "@vscode/webview-ui-toolkit/react"

type ExperimentalSettingsProps = HTMLAttributes<HTMLDivElement> & {
	experiments: Record<ExperimentId, boolean>
	setExperimentEnabled: SetExperimentEnabled
	autoCondenseContextPercent: number
	setCachedStateField: SetCachedStateField<"autoCondenseContextPercent">
	condensingApiConfigId?: string
	setCondensingApiConfigId: (value: string) => void
	customCondensingPrompt?: string
	setCustomCondensingPrompt: (value: string) => void
	listApiConfigMeta: any[]
}

export const ExperimentalSettings = ({
	experiments,
	setExperimentEnabled,
	autoCondenseContextPercent,
	setCachedStateField,
	condensingApiConfigId,
	setCondensingApiConfigId,
	customCondensingPrompt,
	setCustomCondensingPrompt,
	listApiConfigMeta,
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
					.filter((config) => config[0] !== "DIFF_STRATEGY" && config[0] !== "MULTI_SEARCH_AND_REPLACE")
					.map((config) => (
						<ExperimentalFeature
							key={config[0]}
							experimentKey={config[0]}
							enabled={experiments[EXPERIMENT_IDS[config[0] as keyof typeof EXPERIMENT_IDS]] ?? false}
							onChange={(enabled) =>
								setExperimentEnabled(EXPERIMENT_IDS[config[0] as keyof typeof EXPERIMENT_IDS], enabled)
							}
						/>
					))}
				{experiments[EXPERIMENT_IDS.AUTO_CONDENSE_CONTEXT] && (
					<div className="flex flex-col gap-3 pl-3 border-l-2 border-vscode-button-background">
						<div className="flex items-center gap-4 font-bold">
							<span className="codicon codicon-fold" />
							<div>{t("settings:experimental.autoCondenseContextPercent.label")}</div>
						</div>
						<div>
							<div className="flex items-center gap-2">
								<Slider
									min={10}
									max={100}
									step={1}
									value={[autoCondenseContextPercent]}
									onValueChange={([value]) =>
										setCachedStateField("autoCondenseContextPercent", value)
									}
								/>
								<span className="w-20">{autoCondenseContextPercent}%</span>
							</div>
							<div className="text-vscode-descriptionForeground text-sm mt-1">
								{t("settings:experimental.autoCondenseContextPercent.description")}
							</div>
						</div>

						{/* New API Configuration Selection */}
						<div className="flex flex-col gap-3">
							<div className="flex items-center gap-4 font-bold">
								<span className="codicon codicon-settings-gear" />
								<div>{t("settings:experimental.condensingApiConfiguration.label")}</div>
							</div>
							<div>
								<div className="text-[13px] text-vscode-descriptionForeground mb-2">
									{t("settings:experimental.condensingApiConfiguration.description")}
								</div>
								<Select
									value={condensingApiConfigId || "-"}
									onValueChange={(value) => {
										const newConfigId = value === "-" ? "" : value
										setCondensingApiConfigId(newConfigId)
										vscode.postMessage({
											type: "condensingApiConfigId",
											text: newConfigId,
										})
									}}>
									<SelectTrigger className="w-full">
										<SelectValue
											placeholder={t(
												"settings:experimental.condensingApiConfiguration.useCurrentConfig",
											)}
										/>
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="-">
											{t("settings:experimental.condensingApiConfiguration.useCurrentConfig")}
										</SelectItem>
										{(listApiConfigMeta || []).map((config) => (
											<SelectItem key={config.id} value={config.id}>
												{config.name}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
						</div>

						{/* Custom Prompt Section */}
						<div className="flex flex-col gap-3">
							<div className="flex items-center gap-4 font-bold">
								<span className="codicon codicon-edit" />
								<div>{t("settings:experimental.customCondensingPrompt.label")}</div>
							</div>
							<div>
								<div className="text-[13px] text-vscode-descriptionForeground mb-2">
									{t("settings:experimental.customCondensingPrompt.description")}
								</div>
								<VSCodeTextArea
									resize="vertical"
									value={customCondensingPrompt || ""}
									onChange={(e) => {
										const value = (e.target as HTMLTextAreaElement).value
										setCustomCondensingPrompt(value)
										vscode.postMessage({
											type: "updateCondensingPrompt",
											text: value,
										})
									}}
									placeholder={t("settings:experimental.customCondensingPrompt.placeholder")}
									rows={8}
									className="w-full font-mono text-sm"
								/>
								<div className="mt-2 flex justify-between items-center">
									<Button
										variant="secondary"
										size="sm"
										onClick={() => {
											setCustomCondensingPrompt("")
											vscode.postMessage({
												type: "updateCondensingPrompt",
												text: "",
											})
										}}>
										{t("settings:experimental.customCondensingPrompt.reset")}
									</Button>
									<div className="text-xs text-vscode-descriptionForeground">
										{t("settings:experimental.customCondensingPrompt.hint")}
									</div>
								</div>
							</div>
						</div>
					</div>
				)}
			</Section>
		</div>
	)
}
