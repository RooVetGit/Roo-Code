import { useCallback, useEffect, useMemo, useState } from "react"
import { Trans } from "react-i18next"
import { VSCodeCheckbox, VSCodeLink, VSCodeTextField } from "@vscode/webview-ui-toolkit/react"

import { vscode } from "@src/utils/vscode"
import { useExtensionState } from "@src/context/ExtensionStateContext"
import { useAppTranslation } from "@src/i18n/TranslationContext"
import { AutoApproveToggle, AutoApproveSetting, autoApproveSettingsConfig } from "../settings/AutoApproveToggle"

interface AutoApproveMenuProps {
	style?: React.CSSProperties
}

const AutoApproveMenu = ({ style }: AutoApproveMenuProps) => {
	const [isExpanded, setIsExpanded] = useState(false)

	const {
		autoApprovalEnabled,
		setAutoApprovalEnabled,
		alwaysAllowReadOnly,
		alwaysAllowWrite,
		alwaysAllowExecute,
		alwaysAllowBrowser,
		alwaysAllowMcp,
		alwaysAllowModeSwitch,
		alwaysAllowSubtasks,
		alwaysApproveResubmit,
		alwaysAllowApplyDiff,
		alwaysAllowInsertContent,
		alwaysAllowSearchAndReplace,
		allowedMaxRequests,
		setAlwaysAllowReadOnly,
		setAlwaysAllowWrite,
		setAlwaysAllowExecute,
		setAlwaysAllowBrowser,
		setAlwaysAllowMcp,
		setAlwaysAllowModeSwitch,
		setAlwaysAllowSubtasks,
		setAlwaysApproveResubmit,
		setAlwaysAllowApplyDiff,
		setAlwaysAllowInsertContent,
		setAlwaysAllowSearchAndReplace,
		setAllowedMaxRequests,
	} = useExtensionState()

	const { t } = useAppTranslation()

	const onAutoApproveToggle = useCallback(
		(key: AutoApproveSetting, value: boolean) => {
			// Cast key to any to bypass TypeScript error until shared types are updated
			vscode.postMessage({ type: key as any, bool: value })

			switch (key) {
				case "alwaysAllowReadOnly":
					setAlwaysAllowReadOnly(value)
					break
				case "alwaysAllowWrite":
					setAlwaysAllowWrite(value)
					break
				case "alwaysAllowExecute":
					setAlwaysAllowExecute(value)
					break
				case "alwaysAllowBrowser":
					setAlwaysAllowBrowser(value)
					break
				case "alwaysAllowMcp":
					setAlwaysAllowMcp(value)
					break
				case "alwaysAllowModeSwitch":
					setAlwaysAllowModeSwitch(value)
					break
				case "alwaysAllowSubtasks":
					setAlwaysAllowSubtasks(value)
					break
				case "alwaysApproveResubmit":
					setAlwaysApproveResubmit(value)
					break
				case "alwaysAllowApplyDiff":
					setAlwaysAllowApplyDiff(value)
					break
				case "alwaysAllowInsertContent":
					setAlwaysAllowInsertContent(value)
					break
				case "alwaysAllowSearchAndReplace":
					setAlwaysAllowSearchAndReplace(value)
					break
			}
		},
		[
			setAlwaysAllowReadOnly,
			setAlwaysAllowWrite,
			setAlwaysAllowExecute,
			setAlwaysAllowBrowser,
			setAlwaysAllowMcp,
			setAlwaysAllowModeSwitch,
			setAlwaysAllowSubtasks,
			setAlwaysApproveResubmit,
			setAlwaysAllowApplyDiff,
			setAlwaysAllowInsertContent,
			setAlwaysAllowSearchAndReplace,
		],
	)

	const toggleExpanded = useCallback(() => setIsExpanded((prev) => !prev), [])

	const toggles = useMemo(
		() => ({
			alwaysAllowReadOnly: alwaysAllowReadOnly,
			alwaysAllowWrite: alwaysAllowWrite,
			alwaysAllowExecute: alwaysAllowExecute,
			alwaysAllowBrowser: alwaysAllowBrowser,
			alwaysAllowMcp: alwaysAllowMcp,
			alwaysAllowModeSwitch: alwaysAllowModeSwitch,
			alwaysAllowSubtasks: alwaysAllowSubtasks,
			alwaysApproveResubmit: alwaysApproveResubmit,
			alwaysAllowApplyDiff: alwaysAllowApplyDiff,
			alwaysAllowInsertContent: alwaysAllowInsertContent,
			alwaysAllowSearchAndReplace: alwaysAllowSearchAndReplace,
		}),
		[
			alwaysAllowReadOnly,
			alwaysAllowWrite,
			alwaysAllowExecute,
			alwaysAllowBrowser,
			alwaysAllowMcp,
			alwaysAllowModeSwitch,
			alwaysAllowSubtasks,
			alwaysApproveResubmit,
			alwaysAllowApplyDiff,
			alwaysAllowInsertContent,
			alwaysAllowSearchAndReplace,
		],
	)

	const numSelectedActions = useMemo(() => {
		return Object.values(toggles).filter(Boolean).length
	}, [toggles])

	const enabledActionsText = useMemo(() => {
		if (isExpanded) {
			if (numSelectedActions === 0) return t("chat:autoApprove.none")
			return Object.entries(toggles)
				.filter(([, value]) => !!value)
				.map(([key]) => t(autoApproveSettingsConfig[key as AutoApproveSetting].labelKey))
				.join(", ")
		} else {
			if (!autoApprovalEnabled || numSelectedActions === 0) {
				return t("chat:autoApprove.none")
			}
			return Object.entries(toggles)
				.filter(([, value]) => !!value)
				.map(([key]) => t(autoApproveSettingsConfig[key as AutoApproveSetting].labelKey))
				.join(", ")
		}
	}, [toggles, autoApprovalEnabled, numSelectedActions, t, isExpanded])

	const isCheckboxActuallyDisabled = useMemo(() => {
		if (isExpanded) return true
		return numSelectedActions === 0
	}, [isExpanded, numSelectedActions])

	const isCheckboxActuallyChecked = useMemo(() => {
		if (isExpanded) return numSelectedActions > 0
		return autoApprovalEnabled && numSelectedActions > 0
	}, [isExpanded, autoApprovalEnabled, numSelectedActions])

	const handleMainCheckboxChange = useCallback(() => {
		if (isCheckboxActuallyDisabled) return
		const newValue = !autoApprovalEnabled
		setAutoApprovalEnabled(newValue)
		vscode.postMessage({ type: "autoApprovalEnabled", bool: newValue })
	}, [isCheckboxActuallyDisabled, autoApprovalEnabled, setAutoApprovalEnabled])

	useEffect(() => {
		if (numSelectedActions === 0 && autoApprovalEnabled) {
			setAutoApprovalEnabled(false)
			// vscode.postMessage({ type: "autoApprovalEnabled", bool: false }); // Optionally notify if needed
		}
	}, [numSelectedActions, autoApprovalEnabled, setAutoApprovalEnabled])

	const handleOpenSettings = useCallback(
		() =>
			window.postMessage({ type: "action", action: "settingsButtonClicked", values: { section: "autoApprove" } }),
		[],
	)

	return (
		<div
			style={{
				padding: "0 15px",
				userSelect: "none",
				borderTop: isExpanded
					? `0.5px solid color-mix(in srgb, var(--vscode-titleBar-inactiveForeground) 20%, transparent)`
					: "none",
				overflowY: "auto",
				...style,
			}}>
			<div
				style={{
					display: "flex",
					alignItems: "center",
					gap: "8px",
					padding: isExpanded ? "8px 0" : "8px 0 0 0",
					cursor: "pointer", // Always allow pointer cursor for the toggle area
				}}
				onClick={toggleExpanded} // Always allow toggleExpanded for this div
				role={"button"} // Always a button for accessibility
				tabIndex={0} // Always focusable for accessibility
				onKeyDown={(e) => {
					// Allow keyboard toggle always for this clickable area
					if (e.key === "Enter" || e.key === " ") {
						toggleExpanded()
						e.preventDefault()
					}
				}}
			>
				<div onClick={(e) => e.stopPropagation()}>
					<VSCodeCheckbox
						checked={isCheckboxActuallyChecked}
						onChange={handleMainCheckboxChange}
						disabled={isCheckboxActuallyDisabled}
					/>
				</div>
				<div
					style={{
						display: "flex",
						alignItems: "center",
						gap: "4px",
						flex: 1,
						minWidth: 0,
					}}>
					<span
						style={{
							color: "var(--vscode-foreground)",
							flexShrink: 0,
						}}>
						{t("chat:autoApprove.title")}
					</span>
					<span
						style={{
							color: "var(--vscode-descriptionForeground)",
							overflow: "hidden",
							textOverflow: "ellipsis",
							whiteSpace: "nowrap",
							flex: 1,
							minWidth: 0,
						}}
						title={enabledActionsText}
            >
						{enabledActionsText}
					</span>
					<span
						className={`codicon codicon-chevron-${isExpanded ? "down" : "right"}`}
						style={{
							flexShrink: 0,
							marginLeft: isExpanded ? "2px" : "-2px",
						}}
					/>
				</div>
			</div>

			{isExpanded && (
				<div className="flex flex-col gap-2">
					<div
						style={{
							color: "var(--vscode-descriptionForeground)",
							fontSize: "12px",
						}}>
						<Trans
							i18nKey="chat:autoApprove.description"
							components={{
								settingsLink: <VSCodeLink href="#" onClick={handleOpenSettings} />,
							}}
						/>
					</div>

					<AutoApproveToggle {...toggles} onToggle={onAutoApproveToggle} />

					<div
						style={{
							display: "flex",
							alignItems: "center",
							gap: "8px",
							marginTop: "10px",
							marginBottom: "8px",
							color: "var(--vscode-descriptionForeground)",
						}}>
						<span style={{ flexShrink: 1, minWidth: 0 }}>
							<Trans i18nKey="settings:autoApprove.apiRequestLimit.title" />:
						</span>
						<VSCodeTextField
							placeholder={t("settings:autoApprove.apiRequestLimit.unlimited")}
							value={(allowedMaxRequests ?? Infinity) === Infinity ? "" : allowedMaxRequests?.toString()}
							onInput={(e) => {
								const input = e.target as HTMLInputElement
								input.value = input.value.replace(/[^0-9]/g, "")
								const value = parseInt(input.value)
								const parsedValue = !isNaN(value) && value > 0 ? value : undefined
								setAllowedMaxRequests(parsedValue)
								vscode.postMessage({ type: "allowedMaxRequests", value: parsedValue })
							}}
							style={{ flex: 1 }}
						/>
					</div>
					<div
						style={{
							color: "var(--vscode-descriptionForeground)",
							fontSize: "12px",
							marginBottom: "10px",
						}}>
						<Trans i18nKey="settings:autoApprove.apiRequestLimit.description" />
					</div>
				</div>
			)}
		</div>
	)
}

export default AutoApproveMenu
