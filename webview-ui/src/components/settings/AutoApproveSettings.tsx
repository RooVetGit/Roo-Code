import { HTMLAttributes, useMemo, useState, useCallback } from "react"
import { X } from "lucide-react"
// Trans removed as it's not used directly in this component after refactor
// import { Trans } from "react-i18next"

import { useAppTranslation } from "@/i18n/TranslationContext"
import { VSCodeCheckbox, VSCodeTextField } from "@vscode/webview-ui-toolkit/react" // Added VSCodeTextField
import { vscode } from "@/utils/vscode"
import { Button, Input, Slider } from "@/components/ui"
// import { useExtensionState } from "@src/context/ExtensionStateContext" // No longer needed directly here
import { AutoApproveToggle, AutoApproveSetting, autoApproveSettingsConfig } from "./AutoApproveToggle"
import { SetCachedStateField } from "./types"
import { SectionHeader } from "./SectionHeader"
import { Section } from "./Section"

type AutoApproveSettingsProps = HTMLAttributes<HTMLDivElement> & {
	alwaysAllowReadOnly?: boolean
	alwaysAllowReadOnlyOutsideWorkspace?: boolean
	alwaysAllowWrite?: boolean
	alwaysAllowWriteOutsideWorkspace?: boolean
	writeDelayMs: number
	alwaysAllowBrowser?: boolean
	alwaysApproveResubmit?: boolean // This is for Retry
	requestDelaySeconds: number
	alwaysAllowMcp?: boolean
	alwaysAllowModeSwitch?: boolean
	alwaysAllowSubtasks?: boolean
	alwaysAllowExecute?: boolean
	allowedCommands?: string[]
	alwaysAllowApplyDiff?: boolean // New
	alwaysAllowInsertContent?: boolean // New
	alwaysAllowSearchAndReplace?: boolean // New
	allowedMaxRequests?: number | undefined // Added for API request limit

	setCachedStateField: SetCachedStateField<
		| "alwaysAllowReadOnly"
		| "alwaysAllowReadOnlyOutsideWorkspace"
		| "alwaysAllowWrite"
		| "alwaysAllowWriteOutsideWorkspace"
		| "writeDelayMs"
		| "alwaysAllowBrowser"
		| "alwaysApproveResubmit"
		| "requestDelaySeconds"
		| "alwaysAllowMcp"
		| "alwaysAllowModeSwitch"
		| "alwaysAllowSubtasks"
		| "alwaysAllowExecute"
		| "allowedCommands"
		| "alwaysAllowApplyDiff" // New
		| "alwaysAllowInsertContent" // New
		| "alwaysAllowSearchAndReplace" // New
		| "allowedMaxRequests" // Added
	>
}

export const AutoApproveSettings = ({
	alwaysAllowReadOnly,
	alwaysAllowReadOnlyOutsideWorkspace,
	alwaysAllowWrite,
	alwaysAllowWriteOutsideWorkspace,
	writeDelayMs,
	alwaysAllowBrowser,
	alwaysApproveResubmit,
	requestDelaySeconds,
	alwaysAllowMcp,
	alwaysAllowModeSwitch,
	alwaysAllowSubtasks,
	alwaysAllowExecute,
	allowedCommands,
	alwaysAllowApplyDiff, // New
	alwaysAllowInsertContent, // New
	alwaysAllowSearchAndReplace, // New
	allowedMaxRequests, // Added
	setCachedStateField,
	...props
}: AutoApproveSettingsProps) => {
	const { t } = useAppTranslation()
	const [commandInput, setCommandInput] = useState("")

	// Get necessary states for the main checkbox logic
	// const {
	// 	autoApprovalEnabled: globalAutoApprovalEnabled, // Not directly used as checkbox is read-only based on numSelectedActions
	// } = useExtensionState()
	   // autoApprovalEnabled from context is not needed here as the main checkbox
	   // in settings is read-only and its checked state is derived from numSelectedActions.

	const internalToggles = useMemo(
		() => ({
			alwaysAllowReadOnly: alwaysAllowReadOnly ?? false,
			alwaysAllowWrite: alwaysAllowWrite ?? false,
			alwaysAllowBrowser: alwaysAllowBrowser ?? false,
			alwaysApproveResubmit: alwaysApproveResubmit ?? false,
			alwaysAllowMcp: alwaysAllowMcp ?? false,
			alwaysAllowModeSwitch: alwaysAllowModeSwitch ?? false,
			alwaysAllowSubtasks: alwaysAllowSubtasks ?? false,
			alwaysAllowExecute: alwaysAllowExecute ?? false,
			alwaysAllowApplyDiff: alwaysAllowApplyDiff ?? false,
			alwaysAllowInsertContent: alwaysAllowInsertContent ?? false,
			alwaysAllowSearchAndReplace: alwaysAllowSearchAndReplace ?? false,
		}),
		[
			alwaysAllowReadOnly,
			alwaysAllowWrite,
			alwaysAllowBrowser,
			alwaysApproveResubmit,
			alwaysAllowMcp,
			alwaysAllowModeSwitch,
			alwaysAllowSubtasks,
			alwaysAllowExecute,
			alwaysAllowApplyDiff,
			alwaysAllowInsertContent,
			alwaysAllowSearchAndReplace,
		],
	)

	const numSelectedActions = useMemo(() => {
		return Object.values(internalToggles).filter(Boolean).length
	}, [internalToggles])

	const mainCheckboxChecked = useMemo(() => {
		// In settings, main checkbox is always read-only and reflects if any action is on
		return numSelectedActions > 0
	}, [numSelectedActions])

	const mainCheckboxDisplayText = useMemo(() => {
		if (numSelectedActions === 0) return t("chat:autoApprove.none")
		return Object.entries(internalToggles)
			.filter(([, value]) => !!value)
			.map(([key]) => t(autoApproveSettingsConfig[key as AutoApproveSetting].labelKey))
			.join(", ")
	}, [internalToggles, numSelectedActions, t])

	const handleAddCommand = () => {
		const currentCommands = allowedCommands ?? []
		if (commandInput && !currentCommands.includes(commandInput)) {
			const newCommands = [...currentCommands, commandInput]
			setCachedStateField("allowedCommands", newCommands)
			setCommandInput("")
			vscode.postMessage({ type: "allowedCommands", commands: newCommands })
		}
	}

	const onToggleCallback = useCallback(
		(key: AutoApproveSetting, value: boolean) => {
			setCachedStateField(key, value)
			// If all actions are deselected, ensure global autoApprovalEnabled is also false
			// This logic is primarily handled by useEffect in AutoApproveMenu,
			// but good to ensure consistency if this component could also set it.
			// For now, setCachedStateField handles individual toggles.
			// The global autoApprovalEnabled is not directly toggled from this main settings page's checkbox.
		},
		[setCachedStateField],
	)

	return (
		<div {...props}>
			<SectionHeader description={t("settings:autoApprove.description")}>
				<div className="flex items-center gap-2">
					{/* Main Auto-approve Checkbox - Read-only as per spec for settings page expanded view */}
					<VSCodeCheckbox checked={mainCheckboxChecked} disabled={true} />
					<div>{t("settings:sections.autoApprove")}</div>
					<span className="text-sm text-vscode-descriptionForeground ml-2">({mainCheckboxDisplayText})</span>
				</div>
			</SectionHeader>

			<Section>
				<AutoApproveToggle
					alwaysAllowReadOnly={alwaysAllowReadOnly ?? false}
					alwaysAllowWrite={alwaysAllowWrite ?? false}
					alwaysAllowBrowser={alwaysAllowBrowser ?? false}
					alwaysApproveResubmit={alwaysApproveResubmit ?? false}
					alwaysAllowMcp={alwaysAllowMcp ?? false}
					alwaysAllowModeSwitch={alwaysAllowModeSwitch ?? false}
					alwaysAllowSubtasks={alwaysAllowSubtasks ?? false}
					alwaysAllowExecute={alwaysAllowExecute ?? false}
					alwaysAllowApplyDiff={alwaysAllowApplyDiff ?? false}
					alwaysAllowInsertContent={alwaysAllowInsertContent ?? false}
					alwaysAllowSearchAndReplace={alwaysAllowSearchAndReplace ?? false}
					onToggle={onToggleCallback}
				/>

				{/* API Request Limit - Added as per previous implementation summary */}
				<div className="flex flex-col gap-1 mt-4">
					<label className="font-medium">{t("settings:autoApprove.apiRequestLimit.title")}</label>
					<div className="flex items-center gap-2">
						<VSCodeTextField
							className="w-full"
							placeholder={t("settings:autoApprove.apiRequestLimit.unlimited")}
							value={(allowedMaxRequests ?? Infinity) === Infinity ? "" : allowedMaxRequests?.toString()}
							onInput={(e: any) => {
								const inputVal = e.target.value
								// Remove any non-numeric characters
								const numericVal = inputVal.replace(/[^0-9]/g, "")
								const value = parseInt(numericVal)
								const parsedValue = !isNaN(value) && value > 0 ? value : undefined
								setCachedStateField("allowedMaxRequests", parsedValue)
								// Also update the input field directly to show only numeric
								if (e.target.value !== numericVal) {
									e.target.value = numericVal
								}
							}}
						/>
					</div>
					<div className="text-vscode-descriptionForeground text-sm mt-1">
						{t("settings:autoApprove.apiRequestLimit.description")}
					</div>
				</div>

				{/* ADDITIONAL SETTINGS */}
				{alwaysAllowReadOnly && (
					<div className="flex flex-col gap-3 pl-3 mt-4 border-l-2 border-vscode-button-background">
						<div className="flex items-center gap-4 font-bold">
							<span className="codicon codicon-eye" />
							<div>{t("settings:autoApprove.readOnly.label")}</div>
						</div>
						<div>
							<VSCodeCheckbox
								checked={alwaysAllowReadOnlyOutsideWorkspace ?? false}
								onChange={(e: any) =>
									setCachedStateField("alwaysAllowReadOnlyOutsideWorkspace", e.target.checked)
								}
								data-testid="always-allow-readonly-outside-workspace-checkbox">
								<span className="font-medium">
									{t("settings:autoApprove.readOnly.outsideWorkspace.label")}
								</span>
							</VSCodeCheckbox>
							<div className="text-vscode-descriptionForeground text-sm mt-1">
								{t("settings:autoApprove.readOnly.outsideWorkspace.description")}
							</div>
						</div>
					</div>
				)}

				{alwaysAllowWrite && (
					<div className="flex flex-col gap-3 pl-3 mt-4 border-l-2 border-vscode-button-background">
						<div className="flex items-center gap-4 font-bold">
							<span className="codicon codicon-edit" />
							<div>{t("settings:autoApprove.write.label")}</div>
						</div>
						<div>
							<VSCodeCheckbox
								checked={alwaysAllowWriteOutsideWorkspace ?? false}
								onChange={(e: any) =>
									setCachedStateField("alwaysAllowWriteOutsideWorkspace", e.target.checked)
								}
								data-testid="always-allow-write-outside-workspace-checkbox">
								<span className="font-medium">
									{t("settings:autoApprove.write.outsideWorkspace.label")}
								</span>
							</VSCodeCheckbox>
							<div className="text-vscode-descriptionForeground text-sm mt-1 mb-3">
								{t("settings:autoApprove.write.outsideWorkspace.description")}
							</div>
						</div>
						<div>
							<div className="flex items-center gap-2">
								<Slider
									min={0}
									max={5000}
									step={100}
									value={[writeDelayMs]}
									onValueChange={([value]) => setCachedStateField("writeDelayMs", value)}
									data-testid="write-delay-slider"
								/>
								<span className="w-20 text-right">{writeDelayMs}ms</span>
							</div>
							<div className="text-vscode-descriptionForeground text-sm mt-1">
								{t("settings:autoApprove.write.delayLabel")}
							</div>
						</div>
					</div>
				)}

				{alwaysApproveResubmit && ( // This corresponds to "Retry"
					<div className="flex flex-col gap-3 pl-3 mt-4 border-l-2 border-vscode-button-background">
						<div className="flex items-center gap-4 font-bold">
							<span className="codicon codicon-refresh" />
							<div>{t("settings:autoApprove.retry.label")}</div>
						</div>
						<div>
							<div className="flex items-center gap-2">
								<Slider
									min={0} // Changed min to 0 as per typical delay settings
									max={60} // Changed max to 60s for more range
									step={1}
									value={[requestDelaySeconds]}
									onValueChange={([value]) => setCachedStateField("requestDelaySeconds", value)}
									data-testid="request-delay-slider"
								/>
								<span className="w-20 text-right">{requestDelaySeconds}s</span>
							</div>
							<div className="text-vscode-descriptionForeground text-sm mt-1">
								{t("settings:autoApprove.retry.delayLabel")}
							</div>
						</div>
					</div>
				)}

				{alwaysAllowExecute && (
					<div className="flex flex-col gap-3 pl-3 mt-4 border-l-2 border-vscode-button-background">
						<div className="flex items-center gap-4 font-bold">
							<span className="codicon codicon-terminal" />
							<div>{t("settings:autoApprove.execute.label")}</div>
						</div>

						<div>
							<label className="block font-medium mb-1" data-testid="allowed-commands-heading">
								{t("settings:autoApprove.execute.allowedCommands")}
							</label>
							<div className="text-vscode-descriptionForeground text-sm mt-1">
								{t("settings:autoApprove.execute.allowedCommandsDescription")}
							</div>
						</div>

						<div className="flex gap-2">
							<Input
								value={commandInput}
								onChange={(e: any) => setCommandInput(e.target.value)}
								onKeyDown={(e: any) => {
									if (e.key === "Enter") {
										e.preventDefault()
										handleAddCommand()
									}
								}}
								placeholder={t("settings:autoApprove.execute.commandPlaceholder")}
								className="grow"
								data-testid="command-input"
							/>
							<Button className="h-8" onClick={handleAddCommand} data-testid="add-command-button">
								{t("settings:autoApprove.execute.addButton")}
							</Button>
						</div>

						<div className="flex flex-wrap gap-2">
							{(allowedCommands ?? []).map((cmd, index) => (
								<Button
									key={index}
									variant="secondary"
									data-testid={`remove-command-${index}`}
									onClick={() => {
										const newCommands = (allowedCommands ?? []).filter((_, i) => i !== index)
										setCachedStateField("allowedCommands", newCommands)
										vscode.postMessage({ type: "allowedCommands", commands: newCommands })
									}}>
									<div className="flex flex-row items-center gap-1">
										<div>{cmd}</div>
										<X className="text-foreground scale-75" />
									</div>
								</Button>
							))}
						</div>
					</div>
				)}
			</Section>
		</div>
	)
}
