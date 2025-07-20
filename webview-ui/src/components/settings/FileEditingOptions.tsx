import React, { useCallback } from "react"
import { Slider } from "@/components/ui"
import { useAppTranslation } from "@/i18n/TranslationContext"
import { VSCodeCheckbox } from "@vscode/webview-ui-toolkit/react"
import { SectionHeader } from "@/components/settings/SectionHeader"
import { Section } from "@/components/settings/Section"
import { FileDiff, Settings2 } from "lucide-react"

type FileEditingOptionsField = "diffEnabled" | "fuzzyMatchThreshold" | "fileBasedEditing"

interface FileEditingOptionsProps {
	diffEnabled?: boolean
	fuzzyMatchThreshold?: number
	fileBasedEditing?: boolean
	onChange: (field: FileEditingOptionsField, value: any) => void
}

interface DiffPrecisionMatchControlProps {
	fuzzyMatchThreshold: number
	disabled: boolean
	onValueChange: (newValue: number[]) => void
}

interface FileBasedEditingControlProps {
	fileBasedEditing: boolean
	onChange: (e: any) => void
}

/**
 * Control for diff precision match threshold
 */
const DiffPrecisionMatchControl: React.FC<DiffPrecisionMatchControlProps> = ({
	fuzzyMatchThreshold,
	disabled,
	onValueChange,
}) => {
	const { t } = useAppTranslation()
	return (
		<div className="flex flex-col gap-3 pl-3 border-l-2 border-vscode-button-background">
			<div>
				<label className="block font-medium mb-1">{t("settings:advanced.diff.matchPrecision.label")}</label>
				<div className="flex items-center gap-2">
					<Slider
						min={0.8}
						max={1}
						step={0.005}
						value={[fuzzyMatchThreshold]}
						onValueChange={onValueChange}
						disabled={disabled}
					/>
					<span className="w-10">{Math.round(fuzzyMatchThreshold * 100)}%</span>
				</div>
				<div className="text-vscode-descriptionForeground text-sm mt-1">
					{t("settings:advanced.diff.matchPrecision.description")}
				</div>
			</div>
		</div>
	)
}

/**
 * Control for enabling file-based editing mode
 */
const FileBasedEditingControl: React.FC<FileBasedEditingControlProps> = ({ fileBasedEditing, onChange }) => {
	const { t } = useAppTranslation()
	return (
		<div>
			<VSCodeCheckbox checked={fileBasedEditing} onChange={onChange}>
				<span className="font-medium">{t("settings:advanced.fileEditing.fileBasedEditing.label")}</span>
			</VSCodeCheckbox>
			<div className="text-vscode-descriptionForeground text-sm">
				{t("settings:advanced.fileEditing.fileBasedEditing.description")}
			</div>
		</div>
	)
}

/**
 * File editing options control component with mutual exclusivity logic
 */
export const FileEditingOptions: React.FC<FileEditingOptionsProps> = ({
	diffEnabled = true,
	fuzzyMatchThreshold = 1.0,
	fileBasedEditing = false,
	onChange,
}) => {
	const { t } = useAppTranslation()

	// When file-based editing is enabled, diff settings should be disabled
	const isDiffDisabled = fileBasedEditing

	const resetAllButFileBasedEditing = useCallback(() => {
		onChange("diffEnabled", false)
		onChange("fileBasedEditing", true)
	}, [onChange])

	const handleDiffEnabledChange = useCallback(
		(e: any) => {
			onChange("diffEnabled", e.target.checked)
			// if diffEnabled is checked, uncheck fileBasedEditing
			if (e.target.checked) {
				onChange("fileBasedEditing", false)
			}
		},
		[onChange],
	)

	const handleThresholdChange = useCallback(
		(newValue: number[]) => {
			onChange("fuzzyMatchThreshold", newValue[0])
		},
		[onChange],
	)

	const handleFileBasedEditingChange = useCallback(
		(e: any) => {
			if (e.target.checked) {
				// if we enable file-based editing, we reset all other settings
				resetAllButFileBasedEditing()
			} else {
				// if we disable file-based editing, we reset only the file-based editing setting and set diffEnabled to true
				onChange("fileBasedEditing", false)
			}
		},
		[onChange, resetAllButFileBasedEditing],
	)

	return (
		<div className="flex flex-col gap-3">
			{/* File editing options section */}
			<SectionHeader description={t("settings:editingType.description")}>
				<div className="flex items-center gap-2">
					<Settings2 className={"w-4"} />
					<div>{t("settings:sections.editingType")}</div>
				</div>
			</SectionHeader>

			<Section>
				<div>
					<VSCodeCheckbox checked={diffEnabled} onChange={handleDiffEnabledChange}>
						<span className="font-medium">{t("settings:advanced.diff.label")}</span>
					</VSCodeCheckbox>
					<div className="text-vscode-descriptionForeground text-sm">
						{t("settings:advanced.diff.description")}
					</div>
				</div>
				<div>
					<FileBasedEditingControl
						fileBasedEditing={fileBasedEditing}
						onChange={handleFileBasedEditingChange}
					/>
				</div>
			</Section>

			{/* Diff settings section */}
			<SectionHeader description={t("settings:diffSettings.description")}>
				<div className="flex items-center gap-2">
					<FileDiff className={"w-4"} />
					<div>{t("settings:sections.diffSettings")}</div>
				</div>
			</SectionHeader>

			<Section>
				{/* Diff settings section */}
				<div className="flex flex-col gap-1">
					{diffEnabled && !isDiffDisabled && (
						<>
							<DiffPrecisionMatchControl
								fuzzyMatchThreshold={fuzzyMatchThreshold}
								disabled={isDiffDisabled}
								onValueChange={handleThresholdChange}
							/>
						</>
					)}
					{isDiffDisabled && (
						<div className="text-vscode-descriptionForeground text-sm italic pl-3 border-l-2 border-vscode-button-background">
							{t("settings:advanced.fileEditing.exclusivityNotice")}
						</div>
					)}
					{!diffEnabled && (
						<div className="text-vscode-descriptionForeground text-sm italic pl-3 border-l-2 border-vscode-button-background">
							{t("settings:advanced.diff.disabledNotice")}
						</div>
					)}
				</div>
			</Section>
		</div>
	)
}
