import { HTMLAttributes } from "react"
import { useAppTranslation } from "@/i18n/TranslationContext"
import { VSCodeCheckbox } from "@vscode/webview-ui-toolkit/react"
import { Database } from "lucide-react"

import { cn } from "@/lib/utils"
import { Slider } from "@/components/ui"

import { SetCachedStateField } from "./types"
import { SectionHeader } from "./SectionHeader"
import { Section } from "./Section"

type ContextManagementSettingsProps = HTMLAttributes<HTMLDivElement> & {
	maxOpenTabsContext: number
	maxWorkspaceFiles: number
	showRooIgnoredFiles?: boolean
	maxReadFileLine?: number
	// Context Synthesization Props (Added)
	enableContextSummarization?: boolean
	contextSummarizationTriggerThreshold?: number
	contextSummarizationInitialStaticTurns?: number
	contextSummarizationRecentTurns?: number
	setCachedStateField: SetCachedStateField<
		// Update type to include new keys
		| "maxOpenTabsContext"
		| "maxWorkspaceFiles"
		| "showRooIgnoredFiles"
		| "maxReadFileLine"
		// Context Synthesization Keys (Added)
		| "enableContextSummarization"
		| "contextSummarizationTriggerThreshold"
		| "contextSummarizationInitialStaticTurns"
		| "contextSummarizationRecentTurns"
	>
}

export const ContextManagementSettings = ({
	maxOpenTabsContext,
	maxWorkspaceFiles,
	showRooIgnoredFiles,
	setCachedStateField,
	maxReadFileLine,
	// Context Synthesization Props (Added)
	enableContextSummarization,
	contextSummarizationTriggerThreshold,
	contextSummarizationInitialStaticTurns,
	contextSummarizationRecentTurns,
	className,
	...props
}: ContextManagementSettingsProps) => {
	const { t } = useAppTranslation()
	return (
		<div className={cn("flex flex-col gap-2", className)} {...props}>
			<SectionHeader description={t("settings:contextManagement.description")}>
				<div className="flex items-center gap-2">
					<Database className="w-4" />
					<div>{t("settings:sections.contextManagement")}</div>
				</div>
			</SectionHeader>

			<Section>
				<div>
					<span className="block font-medium mb-1">{t("settings:contextManagement.openTabs.label")}</span>
					<div className="flex items-center gap-2">
						<Slider
							min={0}
							max={500}
							step={1}
							value={[maxOpenTabsContext ?? 20]}
							onValueChange={([value]) => setCachedStateField("maxOpenTabsContext", value)}
							data-testid="open-tabs-limit-slider"
						/>
						<span className="w-10">{maxOpenTabsContext ?? 20}</span>
					</div>
					<div className="text-vscode-descriptionForeground text-sm mt-1">
						{t("settings:contextManagement.openTabs.description")}
					</div>
				</div>

				<div>
					<span className="block font-medium mb-1">
						{t("settings:contextManagement.workspaceFiles.label")}
					</span>
					<div className="flex items-center gap-2">
						<Slider
							min={0}
							max={500}
							step={1}
							value={[maxWorkspaceFiles ?? 200]}
							onValueChange={([value]) => setCachedStateField("maxWorkspaceFiles", value)}
							data-testid="workspace-files-limit-slider"
						/>
						<span className="w-10">{maxWorkspaceFiles ?? 200}</span>
					</div>
					<div className="text-vscode-descriptionForeground text-sm mt-1">
						{t("settings:contextManagement.workspaceFiles.description")}
					</div>
				</div>

				<div>
					<VSCodeCheckbox
						checked={showRooIgnoredFiles}
						onChange={(e: any) => setCachedStateField("showRooIgnoredFiles", e.target.checked)}
						data-testid="show-rooignored-files-checkbox">
						<label className="block font-medium mb-1">
							{t("settings:contextManagement.rooignore.label")}
						</label>
					</VSCodeCheckbox>
					<div className="text-vscode-descriptionForeground text-sm mt-1">
						{t("settings:contextManagement.rooignore.description")}
					</div>
				</div>

				<div>
					<div className="flex flex-col gap-2">
						<span className="font-medium">{t("settings:contextManagement.maxReadFile.label")}</span>
						<div className="flex items-center gap-4">
							<input
								type="number"
								pattern="-?[0-9]*"
								className="w-24 bg-vscode-input-background text-vscode-input-foreground border border-vscode-input-border px-2 py-1 rounded text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none disabled:opacity-50"
								value={maxReadFileLine ?? 500}
								min={-1}
								onChange={(e) => {
									const newValue = parseInt(e.target.value, 10)
									if (!isNaN(newValue) && newValue >= -1) {
										setCachedStateField("maxReadFileLine", newValue)
									}
								}}
								onClick={(e) => e.currentTarget.select()}
								data-testid="max-read-file-line-input"
								disabled={maxReadFileLine === -1}
							/>
							<span>{t("settings:contextManagement.maxReadFile.lines")}</span>
							<VSCodeCheckbox
								checked={maxReadFileLine === -1}
								onChange={(e: any) =>
									setCachedStateField("maxReadFileLine", e.target.checked ? -1 : 500)
								}
								data-testid="max-read-file-always-full-checkbox">
								{t("settings:contextManagement.maxReadFile.always_full_read")}
							</VSCodeCheckbox>
						</div>
					</div>
					<div className="text-vscode-descriptionForeground text-sm mt-2">
						{t("settings:contextManagement.maxReadFile.description")}
					</div>
				</div>

				{/* --- Context Synthesization Settings --- */}
				<div className="border-t border-vscode-settings-rowHoverBackground my-4"></div>

				<div>
					<VSCodeCheckbox
						checked={!!enableContextSummarization}
						onChange={(e: any) => setCachedStateField("enableContextSummarization", e.target.checked)} // Use generic setter
						data-testid="enable-context-synthesization-checkbox">
						<label className="block font-medium mb-1">
							{t("settings:contextManagement.synthesization.enable.label")}
						</label>
					</VSCodeCheckbox>
					<div className="text-vscode-descriptionForeground text-sm mt-1">
						{t("settings:contextManagement.synthesization.enable.description")}
					</div>
				</div>

				<div className={!enableContextSummarization ? "opacity-50" : ""}>
					<div className="flex flex-col gap-2">
						<span className="font-medium">
							{t("settings:contextManagement.synthesization.triggerThreshold.label")}
						</span>
						<div className="flex items-center gap-4">
							<input
								type="number"
								pattern="[0-9]*"
								className="w-24 bg-vscode-input-background text-vscode-input-foreground border border-vscode-input-border px-2 py-1 rounded text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none disabled:opacity-50"
								value={contextSummarizationTriggerThreshold ?? 80}
								min={1}
								max={100}
								onChange={(e) => {
									const newValue = parseInt(e.target.value, 10)
									if (!isNaN(newValue) && newValue >= 1 && newValue <= 100) {
										setCachedStateField("contextSummarizationTriggerThreshold", newValue) // Use generic setter
									}
								}}
								onClick={(e) => e.currentTarget.select()}
								data-testid="context-synthesization-trigger-threshold-input"
								disabled={!enableContextSummarization}
							/>
							<span>%</span>
						</div>
					</div>
					<div className="text-vscode-descriptionForeground text-sm mt-2">
						{t("settings:contextManagement.synthesization.triggerThreshold.description")}
					</div>
				</div>

				<div className={!enableContextSummarization ? "opacity-50" : ""}>
					<div className="flex flex-col gap-2">
						<span className="font-medium">
							{t("settings:contextManagement.synthesization.initialTurns.label")}
						</span>
						<div className="flex items-center gap-4">
							<input
								type="number"
								pattern="[0-9]*"
								className="w-24 bg-vscode-input-background text-vscode-input-foreground border border-vscode-input-border px-2 py-1 rounded text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none disabled:opacity-50"
								value={contextSummarizationInitialStaticTurns ?? 3} // Changed default display from 5 to 3
								min={0}
								onChange={(e) => {
									const newValue = parseInt(e.target.value, 10)
									if (!isNaN(newValue) && newValue >= 0) {
										setCachedStateField("contextSummarizationInitialStaticTurns", newValue) // Use generic setter
									}
								}}
								onClick={(e) => e.currentTarget.select()}
								data-testid="context-synthesization-initial-turns-input"
								disabled={!enableContextSummarization}
							/>
							<span>{t("settings:contextManagement.synthesization.turns")}</span>
						</div>
					</div>
					<div className="text-vscode-descriptionForeground text-sm mt-2">
						{t("settings:contextManagement.synthesization.initialTurns.description")}
					</div>
				</div>

				<div className={!enableContextSummarization ? "opacity-50" : ""}>
					<div className="flex flex-col gap-2">
						<span className="font-medium">
							{t("settings:contextManagement.synthesization.recentTurns.label")}
						</span>
						<div className="flex items-center gap-4">
							<input
								type="number"
								pattern="[0-9]*"
								className="w-24 bg-vscode-input-background text-vscode-input-foreground border border-vscode-input-border px-2 py-1 rounded text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none disabled:opacity-50"
								value={contextSummarizationRecentTurns ?? 3} // Changed default display from 10 to 3
								min={0}
								onChange={(e) => {
									const newValue = parseInt(e.target.value, 10)
									if (!isNaN(newValue) && newValue >= 0) {
										setCachedStateField("contextSummarizationRecentTurns", newValue) // Use generic setter
									}
								}}
								onClick={(e) => e.currentTarget.select()}
								data-testid="context-synthesization-recent-turns-input"
								disabled={!enableContextSummarization}
							/>
							<span>{t("settings:contextManagement.synthesization.turns")}</span>
						</div>
					</div>
					<div className="text-vscode-descriptionForeground text-sm mt-2">
						{t("settings:contextManagement.synthesization.recentTurns.description")}
					</div>
				</div>
				{/* --- End Context Synthesization Settings --- */}
			</Section>
		</div>
	)
}
