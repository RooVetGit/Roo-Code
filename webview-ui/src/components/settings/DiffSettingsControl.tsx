import React, { useCallback } from "react"
import { Slider } from "@/components/ui"
import { useAppTranslation } from "@/i18n/TranslationContext"
import { VSCodeCheckbox } from "@vscode/webview-ui-toolkit/react"

type DiffSettingsControlField =
	| "diffEnabled"
	| "fuzzyMatchThreshold"
	| "diffViewAutoFocus"
	| "autoCloseRooTabs"
	| "autoCloseAllRooTabs"

interface DiffSettingsControlProps {
	diffEnabled?: boolean
	diffViewAutoFocus?: boolean
	autoCloseRooTabs?: boolean
	autoCloseAllRooTabs?: boolean // Added new setting
	fuzzyMatchThreshold?: number
	onChange: (field: DiffSettingsControlField, value: any) => void
}

interface DiffCheckAutoFocusControlProps {
	diffViewAutoFocus: boolean
	onChange: (e: any) => void
}

interface DiffCheckAutoCloseControlProps {
	autoCloseRooTabs: boolean
	onChange: (e: any) => void
}

interface DiffCheckAutoCloseAllControlProps {
	autoCloseAllRooTabs: boolean
	disabled: boolean
	onChange: (e: any) => void
}

interface DiffPrecisionMatchControlProps {
	fuzzyMatchThreshold: number
	onValueChange: (newValue: number[]) => void
}

const DiffViewAutoFocusControl: React.FC<DiffCheckAutoFocusControlProps> = ({ diffViewAutoFocus, onChange }) => {
	const { t } = useAppTranslation()
	return (
		<div>
			<VSCodeCheckbox checked={diffViewAutoFocus} onChange={onChange}>
				<span className="font-medium">{t("settings:advanced.diff.autoFocus.label")}</span>
			</VSCodeCheckbox>
			<div className="text-vscode-descriptionForeground text-sm">
				{t("settings:advanced.diff.autoFocus.description")}
			</div>
		</div>
	)
}

const DiffViewAutoCloseControl: React.FC<DiffCheckAutoCloseControlProps> = ({ autoCloseRooTabs, onChange }) => {
	const { t } = useAppTranslation()
	return (
		<div>
			<VSCodeCheckbox checked={autoCloseRooTabs} onChange={onChange}>
				<span className="font-medium">{t("settings:advanced.diff.autoClose.label")}</span>
			</VSCodeCheckbox>
			<div className="text-vscode-descriptionForeground text-sm">
				{t("settings:advanced.diff.autoClose.description")}
			</div>
		</div>
	)
}

const DiffViewAutoCloseAllControl: React.FC<DiffCheckAutoCloseAllControlProps> = ({
	autoCloseAllRooTabs,
	disabled,
	onChange,
}) => {
	const { t } = useAppTranslation()
	return (
		<div>
			<VSCodeCheckbox checked={autoCloseAllRooTabs} disabled={disabled} onChange={onChange}>
				<span className="font-medium">{t("settings:advanced.diff.autoCloseAll.label")}</span>
			</VSCodeCheckbox>
			<div className="text-vscode-descriptionForeground text-sm">
				{t("settings:advanced.diff.autoCloseAll.description")}
			</div>
		</div>
	)
}

const DiffPrecisionMatchControl: React.FC<DiffPrecisionMatchControlProps> = ({
	fuzzyMatchThreshold,
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

export const DiffSettingsControl: React.FC<DiffSettingsControlProps> = ({
	diffEnabled = true,
	diffViewAutoFocus = true,
	autoCloseRooTabs = false,
	autoCloseAllRooTabs = false,
	fuzzyMatchThreshold = 1.0,
	onChange,
}) => {
	const { t } = useAppTranslation()

	const handleDiffEnabledChange = useCallback(
		(e: any) => {
			onChange("diffEnabled", e.target.checked)
		},
		[onChange],
	)

	const handleThresholdChange = useCallback(
		(newValue: number[]) => {
			onChange("fuzzyMatchThreshold", newValue[0])
		},
		[onChange],
	)

	const handleDiffViewAutoFocusChange = useCallback(
		(e: any) => {
			onChange("diffViewAutoFocus", e.target.checked)
		},
		[onChange],
	)

	const handleAutoCloseRooTabsChange = useCallback(
		(e: any) => {
			onChange("autoCloseRooTabs", e.target.checked)
			// If autoCloseRooTabs is unchecked, also uncheck autoCloseAllRooTabs
			if (!e.target.checked) {
				onChange("autoCloseAllRooTabs", false)
			}
		},
		[onChange],
	)

	const handleAutoCloseAllRooTabsChange = useCallback(
		(e: any) => {
			onChange("autoCloseAllRooTabs", e.target.checked)
		},
		[onChange],
	)

	return (
		<div className="flex flex-col gap-1">
			<div>
				<VSCodeCheckbox checked={diffEnabled} onChange={handleDiffEnabledChange}>
					<span className="font-medium">{t("settings:advanced.diff.label")}</span>
				</VSCodeCheckbox>
				<div className="text-vscode-descriptionForeground text-sm">
					{t("settings:advanced.diff.description")}
				</div>
			</div>

			{diffEnabled && (
				<>
					<DiffPrecisionMatchControl
						fuzzyMatchThreshold={fuzzyMatchThreshold}
						onValueChange={handleThresholdChange}
					/>
					<DiffViewAutoFocusControl
						diffViewAutoFocus={diffViewAutoFocus}
						onChange={handleDiffViewAutoFocusChange}
					/>
					<DiffViewAutoCloseControl
						autoCloseRooTabs={autoCloseRooTabs}
						onChange={handleAutoCloseRooTabsChange}
					/>
					<DiffViewAutoCloseAllControl
						autoCloseAllRooTabs={autoCloseAllRooTabs}
						disabled={!autoCloseRooTabs} // Disabled if autoCloseRooTabs is false
						onChange={handleAutoCloseAllRooTabsChange}
					/>
				</>
			)}
		</div>
	)
}
