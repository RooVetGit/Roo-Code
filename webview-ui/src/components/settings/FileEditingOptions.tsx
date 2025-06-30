import React, { useCallback } from "react"
import { Slider } from "@/components/ui"
import { useAppTranslation } from "@/i18n/TranslationContext"
import { VSCodeCheckbox } from "@vscode/webview-ui-toolkit/react"
import { SectionHeader } from "@/components/settings/SectionHeader"
import { Section } from "@/components/settings/Section"

type FileEditingOptionsField =
	| "diffEnabled"
	| "fuzzyMatchThreshold"
	| "diffViewAutoFocus"
	| "autoCloseRooTabs"
	| "autoCloseAllRooTabs"
	| "fileBasedEditing"
	| "openTabsInCorrectGroup"
	| "openTabsAtEndOfList"

interface FileEditingOptionsProps {
	diffEnabled?: boolean
	diffViewAutoFocus?: boolean
	autoCloseRooTabs?: boolean
	autoCloseAllRooTabs?: boolean
	fuzzyMatchThreshold?: number
	fileBasedEditing?: boolean
	openTabsInCorrectGroup?: boolean
	openTabsAtEndOfList?: boolean
	onChange: (field: FileEditingOptionsField, value: any) => void
}

interface DiffCheckAutoFocusControlProps {
	diffViewAutoFocus: boolean
	disabled: boolean
	onChange: (e: any) => void
}

interface DiffCheckAutoCloseControlProps {
	autoCloseRooTabs: boolean
	disabled: boolean
	onChange: (e: any) => void
}

interface DiffCheckAutoCloseAllControlProps {
	autoCloseAllRooTabs: boolean
	disabled: boolean
	onChange: (e: any) => void
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

interface OpenTabsInCorrectGroupControlProps {
	openTabsInCorrectGroup: boolean
	disabled: boolean
	onChange: (e: any) => void
}

interface OpenTabsAtEndOfListControlProps {
	openTabsAtEndOfList: boolean
	disabled: boolean
	onChange: (e: any) => void
}

/**
 * Control for diff view auto-focus setting
 */
const DiffViewAutoFocusControl: React.FC<DiffCheckAutoFocusControlProps> = ({
	diffViewAutoFocus,
	disabled,
	onChange,
}) => {
	const { t } = useAppTranslation()
	return (
		<div>
			<VSCodeCheckbox checked={diffViewAutoFocus} disabled={disabled} onChange={onChange}>
				<span className="font-medium">{t("settings:advanced.diff.autoFocus.label")}</span>
			</VSCodeCheckbox>
			<div className="text-vscode-descriptionForeground text-sm">
				{t("settings:advanced.diff.autoFocus.description")}
			</div>
		</div>
	)
}

/**
 * Control for auto-closing Roo tabs setting
 */
const DiffViewAutoCloseControl: React.FC<DiffCheckAutoCloseControlProps> = ({
	autoCloseRooTabs,
	disabled,
	onChange,
}) => {
	const { t } = useAppTranslation()
	return (
		<div>
			<VSCodeCheckbox checked={autoCloseRooTabs} disabled={disabled} onChange={onChange}>
				<span className="font-medium">{t("settings:advanced.diff.autoClose.label")}</span>
			</VSCodeCheckbox>
			<div className="text-vscode-descriptionForeground text-sm">
				{t("settings:advanced.diff.autoClose.description")}
			</div>
		</div>
	)
}

/**
 * Control for auto-closing all Roo tabs setting
 */
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
 * Control for opening tabs in correct tab group
 */
const OpenTabsInCorrectGroupControl: React.FC<OpenTabsInCorrectGroupControlProps> = ({
	openTabsInCorrectGroup,
	disabled,
	onChange,
}) => {
	const { t } = useAppTranslation()
	return (
		<div>
			<VSCodeCheckbox checked={openTabsInCorrectGroup} disabled={disabled} onChange={onChange}>
				<span className="font-medium">{t("settings:advanced.fileEditing.correctTabGroup.label")}</span>
			</VSCodeCheckbox>
			<div className="text-vscode-descriptionForeground text-sm">
				{t("settings:advanced.fileEditing.correctTabGroup.description")}
			</div>
		</div>
	)
}

/**
 * Control for opening tabs at end of tab list
 */
const OpenTabsAtEndOfListControl: React.FC<OpenTabsAtEndOfListControlProps> = ({
	openTabsAtEndOfList,
	disabled,
	onChange,
}) => {
	const { t } = useAppTranslation()
	return (
		<div>
			<VSCodeCheckbox checked={openTabsAtEndOfList} disabled={disabled} onChange={onChange}>
				<span className="font-medium">{t("settings:advanced.fileEditing.endOfTabList.label")}</span>
			</VSCodeCheckbox>
			<div className="text-vscode-descriptionForeground text-sm">
				{t("settings:advanced.fileEditing.endOfTabList.description")}
			</div>
		</div>
	)
}

/**
 * File editing options control component with mutual exclusivity logic
 */
export const FileEditingOptions: React.FC<FileEditingOptionsProps> = ({
	diffEnabled = true,
	diffViewAutoFocus = true,
	autoCloseRooTabs = false,
	autoCloseAllRooTabs = false,
	fuzzyMatchThreshold = 1.0,
	fileBasedEditing = false,
	openTabsInCorrectGroup = false,
	openTabsAtEndOfList = false,
	onChange,
}) => {
	const { t } = useAppTranslation()

	// When file-based editing is enabled, diff settings should be disabled
	const isDiffDisabled = fileBasedEditing
	// When file-based editing is enabled, other tab behavior toggles should be disabled
	const otherTogglesDisabled = fileBasedEditing

	const resetAllButFileBasedEditing = useCallback(() => {
		onChange("diffEnabled", false)
		onChange("diffViewAutoFocus", false)
		onChange("autoCloseRooTabs", false)
		onChange("autoCloseAllRooTabs", false)
		onChange("openTabsInCorrectGroup", false)
		onChange("openTabsAtEndOfList", false)
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

	const handleOpenTabsInCorrectGroupChange = useCallback(
		(e: any) => {
			onChange("openTabsInCorrectGroup", e.target.checked)
		},
		[onChange],
	)

	const handleOpenTabsAtEndOfListChange = useCallback(
		(e: any) => {
			onChange("openTabsAtEndOfList", e.target.checked)
		},
		[onChange],
	)

	return (
		<div className="flex flex-col gap-3">
			{/* File editing options section */}
			<SectionHeader description={t("settings:editingType.description")}>
				<div className="flex items-center gap-2">
					<span className="codicon codicon-check w-4" />
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
					<span className="codicon codicon-check w-4" />
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
							<DiffViewAutoCloseControl
								autoCloseRooTabs={autoCloseRooTabs}
								disabled={isDiffDisabled}
								onChange={handleAutoCloseRooTabsChange}
							/>
							<DiffViewAutoCloseAllControl
								autoCloseAllRooTabs={autoCloseAllRooTabs}
								disabled={isDiffDisabled || !autoCloseRooTabs} // Disabled if diff is disabled or autoCloseRooTabs is false
								onChange={handleAutoCloseAllRooTabsChange}
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

			{/* DiffView Behavior Preferences */}
			<SectionHeader description={t("settings:diffViewAutoFocusBehavior.description")}>
				<div className="flex items-center gap-2">
					<span className="codicon codicon-check w-4" />
					<div>{t("settings:sections.diffViewAutoFocusBehavior")}</div>
				</div>
			</SectionHeader>

			<Section>
				<div className="flex flex-col gap-1">
					{!fileBasedEditing && diffEnabled && (
						<>
							<DiffViewAutoFocusControl
								diffViewAutoFocus={diffViewAutoFocus}
								disabled={isDiffDisabled}
								onChange={handleDiffViewAutoFocusChange}
							/>
							<OpenTabsInCorrectGroupControl
								openTabsInCorrectGroup={openTabsInCorrectGroup}
								disabled={otherTogglesDisabled}
								onChange={handleOpenTabsInCorrectGroupChange}
							/>
							<OpenTabsAtEndOfListControl
								openTabsAtEndOfList={openTabsAtEndOfList}
								disabled={otherTogglesDisabled}
								onChange={handleOpenTabsAtEndOfListChange}
							/>
						</>
					)}

					{fileBasedEditing && (
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
