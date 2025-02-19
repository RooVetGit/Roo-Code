import { VSCodeCheckbox } from "@vscode/webview-ui-toolkit/react"
import { useCallback, useState } from "react"
import { useTranslation } from "react-i18next"
import { useExtensionState } from "../../context/ExtensionStateContext"
import { vscode } from "../../utils/vscode"

interface AutoApproveAction {
	id: string
	label: string
	enabled: boolean
	shortName: string
	description: string
}

interface AutoApproveMenuProps {
	style?: React.CSSProperties
}

const AutoApproveMenu = ({ style }: AutoApproveMenuProps) => {
	const { t } = useTranslation()
	const [isExpanded, setIsExpanded] = useState(false)
	const {
		alwaysAllowReadOnly,
		setAlwaysAllowReadOnly,
		alwaysAllowWrite,
		setAlwaysAllowWrite,
		alwaysAllowExecute,
		setAlwaysAllowExecute,
		alwaysAllowBrowser,
		setAlwaysAllowBrowser,
		alwaysAllowMcp,
		setAlwaysAllowMcp,
		alwaysAllowModeSwitch,
		setAlwaysAllowModeSwitch,
		alwaysApproveResubmit,
		setAlwaysApproveResubmit,
		autoApprovalEnabled,
		setAutoApprovalEnabled,
	} = useExtensionState()

	const actions: AutoApproveAction[] = [
		{
			id: "readFiles",
			label: t("autoApprove.readFiles.label"),
			shortName: t("autoApprove.readFiles.shortName"),
			enabled: alwaysAllowReadOnly ?? false,
			description: t("autoApprove.readFiles.description"),
		},
		{
			id: "editFiles",
			label: t("autoApprove.editFiles.label"),
			shortName: t("autoApprove.editFiles.shortName"),
			enabled: alwaysAllowWrite ?? false,
			description: t("autoApprove.editFiles.description"),
		},
		{
			id: "executeCommands",
			label: t("autoApprove.executeCommands.label"),
			shortName: t("autoApprove.executeCommands.shortName"),
			enabled: alwaysAllowExecute ?? false,
			description: t("autoApprove.executeCommands.description"),
		},
		{
			id: "useBrowser",
			label: t("autoApprove.useBrowser.label"),
			shortName: t("autoApprove.useBrowser.shortName"),
			enabled: alwaysAllowBrowser ?? false,
			description: t("autoApprove.useBrowser.description"),
		},
		{
			id: "useMcp",
			label: t("autoApprove.useMcp.label"),
			shortName: t("autoApprove.useMcp.shortName"),
			enabled: alwaysAllowMcp ?? false,
			description: t("autoApprove.useMcp.description"),
		},
		{
			id: "switchModes",
			label: t("autoApprove.switchModes.label"),
			shortName: t("autoApprove.switchModes.shortName"),
			enabled: alwaysAllowModeSwitch ?? false,
			description: t("autoApprove.switchModes.description"),
		},
		{
			id: "retryRequests",
			label: t("autoApprove.retryRequests.label"),
			shortName: t("autoApprove.retryRequests.shortName"),
			enabled: alwaysApproveResubmit ?? false,
			description: t("autoApprove.retryRequests.description"),
		},
	]

	const toggleExpanded = useCallback(() => {
		setIsExpanded((prev) => !prev)
	}, [])

	const enabledActionsList = actions
		.filter((action) => action.enabled)
		.map((action) => action.shortName)
		.join(", ")

	// Individual checkbox handlers - each one only updates its own state
	const handleReadOnlyChange = useCallback(() => {
		const newValue = !(alwaysAllowReadOnly ?? false)
		setAlwaysAllowReadOnly(newValue)
		vscode.postMessage({ type: "alwaysAllowReadOnly", bool: newValue })
	}, [alwaysAllowReadOnly, setAlwaysAllowReadOnly])

	const handleWriteChange = useCallback(() => {
		const newValue = !(alwaysAllowWrite ?? false)
		setAlwaysAllowWrite(newValue)
		vscode.postMessage({ type: "alwaysAllowWrite", bool: newValue })
	}, [alwaysAllowWrite, setAlwaysAllowWrite])

	const handleExecuteChange = useCallback(() => {
		const newValue = !(alwaysAllowExecute ?? false)
		setAlwaysAllowExecute(newValue)
		vscode.postMessage({ type: "alwaysAllowExecute", bool: newValue })
	}, [alwaysAllowExecute, setAlwaysAllowExecute])

	const handleBrowserChange = useCallback(() => {
		const newValue = !(alwaysAllowBrowser ?? false)
		setAlwaysAllowBrowser(newValue)
		vscode.postMessage({ type: "alwaysAllowBrowser", bool: newValue })
	}, [alwaysAllowBrowser, setAlwaysAllowBrowser])

	const handleMcpChange = useCallback(() => {
		const newValue = !(alwaysAllowMcp ?? false)
		setAlwaysAllowMcp(newValue)
		vscode.postMessage({ type: "alwaysAllowMcp", bool: newValue })
	}, [alwaysAllowMcp, setAlwaysAllowMcp])

	const handleModeSwitchChange = useCallback(() => {
		const newValue = !(alwaysAllowModeSwitch ?? false)
		setAlwaysAllowModeSwitch(newValue)
		vscode.postMessage({ type: "alwaysAllowModeSwitch", bool: newValue })
	}, [alwaysAllowModeSwitch, setAlwaysAllowModeSwitch])

	const handleRetryChange = useCallback(() => {
		const newValue = !(alwaysApproveResubmit ?? false)
		setAlwaysApproveResubmit(newValue)
		vscode.postMessage({ type: "alwaysApproveResubmit", bool: newValue })
	}, [alwaysApproveResubmit, setAlwaysApproveResubmit])

	// Map action IDs to their specific handlers
	const actionHandlers: Record<AutoApproveAction["id"], () => void> = {
		readFiles: handleReadOnlyChange,
		editFiles: handleWriteChange,
		executeCommands: handleExecuteChange,
		useBrowser: handleBrowserChange,
		useMcp: handleMcpChange,
		switchModes: handleModeSwitchChange,
		retryRequests: handleRetryChange,
	}

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
					cursor: "pointer",
				}}
				onClick={toggleExpanded}>
				<div onClick={(e) => e.stopPropagation()}>
					<VSCodeCheckbox
						checked={autoApprovalEnabled ?? false}
						onChange={() => {
							const newValue = !(autoApprovalEnabled ?? false)
							setAutoApprovalEnabled(newValue)
							vscode.postMessage({ type: "autoApprovalEnabled", bool: newValue })
						}}
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
						{t("autoApprove.title")}
					</span>
					<span
						style={{
							color: "var(--vscode-descriptionForeground)",
							overflow: "hidden",
							textOverflow: "ellipsis",
							whiteSpace: "nowrap",
							flex: 1,
							minWidth: 0,
						}}>
						{enabledActionsList || "None"}
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
				<div style={{ padding: "0" }}>
					<div
						style={{
							marginBottom: "10px",
							color: "var(--vscode-descriptionForeground)",
							fontSize: "12px",
						}}>
						{t("autoApprove.description")}
					</div>
					{actions.map((action) => (
						<div key={action.id} style={{ margin: "6px 0" }}>
							<div onClick={(e) => e.stopPropagation()}>
								<VSCodeCheckbox checked={action.enabled} onChange={actionHandlers[action.id]}>
									{action.label}
								</VSCodeCheckbox>
							</div>
							<div
								style={{
									marginLeft: "28px",
									color: "var(--vscode-descriptionForeground)",
									fontSize: "12px",
								}}>
								{action.description}
							</div>
						</div>
					))}
				</div>
			)}
		</div>
	)
}

export default AutoApproveMenu
