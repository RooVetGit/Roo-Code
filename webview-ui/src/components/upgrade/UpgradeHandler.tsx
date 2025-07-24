import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"

import { ExtensionMessage } from "@roo/ExtensionMessage"
import { vscode } from "../../utils/vscode"
import CodeBlock from "../common/CodeBlock"
import RooHero from "../welcome/RooHero"

interface UpgradeHandlerProps {
	onComplete?: () => void
}

export const useUpgradeCheck = () => {
	const [upgradeNeeded, setUpgradeNeeded] = useState<boolean | null>(null)
	const clearUpgradeNeeded = () => setUpgradeNeeded(false)

	useEffect(() => {
		const handleUpgradeMessage = (e: MessageEvent) => {
			const message: ExtensionMessage = e.data

			if (message.type === "upgradeStatus" && message.values) {
				if (message.values.error) {
					console.error("[Upgrade] unable to check for upgrade:", message)
					setUpgradeNeeded(false)
				} else {
					if (message.values.needed) {
						setUpgradeNeeded(true)
					} else if (upgradeNeeded === null) {
						setUpgradeNeeded(false)
					}
				}
			}
		}

		window.addEventListener("message", handleUpgradeMessage)
		vscode.postMessage({ type: "isUpgradeNeeded" })

		return () => window.removeEventListener("message", handleUpgradeMessage)
	}, [upgradeNeeded])

	return {
		upgradeNeeded,
		isCheckingUpgrade: upgradeNeeded === null,
		clearUpgradeNeeded,
	}
}

/**
 * A component that displays the UI for the upgrade process.
 *
 * This module is intended to be generic for any future purpose that may require structure upgrades
 */
export const UpgradeHandler: React.FC<UpgradeHandlerProps> = ({ onComplete }) => {
	const { t } = useTranslation()
	const [upgrading, setUpgrading] = useState(false)
	const [upgradeComplete, setUpgradeComplete] = useState(false)
	const [logs, setLogs] = useState<string[]>([])

	// Listen for messages from the extension
	useEffect(() => {
		const handleMessage = (event: MessageEvent) => {
			const message = event.data

			if (message.type === "upgradeComplete" && message.values) {
				setUpgradeComplete(true)
				setUpgrading(false)
				if (message.values.error) {
					setLogs((prev) => [...prev, "Upgrade failed. Please try again."])
				}
			}

			if (message.type === "loggingOperation" && message.log) {
				setLogs((prev) => [...prev, message.log])
			}
		}

		window.addEventListener("message", handleMessage)
		return () => window.removeEventListener("message", handleMessage)
	}, [upgradeComplete])

	const handleContinue = () => {
		if (onComplete) {
			onComplete()
		}
	}

	const startUpgrade = () => {
		setUpgrading(true)
		vscode.postMessage({ type: "performUpgrade" })
	}

	// Show the upgrade UI
	return (
		<div className="flex flex-col h-full p-4 gap-4">
			<h1 className="text-xl font-semibold text-center">{t("common:upgrade.title")}</h1>

			<div className="flex flex-col items-center mb-4">
				<RooHero />
			</div>

			{/* Initial state - not upgrading and not complete */}
			{!upgrading && !upgradeComplete && (
				<div className="flex flex-col items-center w-full mt-6 mb-8">
					<p className="text-sm text-center">{t("common:upgrade.description")}</p>
					<p className="text-sm text-vscode-descriptionForeground mb-4 text-center">
						{t("common:upgrade.clickToStart")}
					</p>
					<button
						className="flex items-center gap-2 bg-vscode-button-background hover:bg-vscode-button-hoverBackground text-vscode-button-foreground font-medium px-8 py-3 rounded-md shadow-sm transition-colors duration-200"
						onClick={startUpgrade}>
						<span className="codicon codicon-sync"></span>
						{t("common:upgrade.startButton")}
					</button>
				</div>
			)}

			{/* Upgrading state */}
			{upgrading && (
				<div className="flex items-center gap-2 my-2">
					<div className="codicon codicon-loading codicon-modifier-spin"></div>
					<span>{t("common:upgrade.inProgress")}</span>
				</div>
			)}

			{/* Logs section - shown for both upgrading and complete states */}
			{(upgrading || upgradeComplete) && (
				<div
					className={`flex-1 overflow-auto border border-vscode-border rounded ${upgradeComplete ? "mb-4" : ""}`}>
					<div className="p-2">
						<h2 className="text-sm font-semibold mb-2">{t("common:upgrade.logs")}</h2>
						{logs.length > 0 ? (
							<CodeBlock source={logs.join("\n")} language="log" />
						) : (
							<div className="text-sm text-vscode-descriptionForeground">
								{upgrading ? t("common:upgrade.waitingForLogs") : t("common:upgrade.noLogs")}
							</div>
						)}
					</div>
				</div>
			)}

			{/* Continue button - only shown when upgrade is complete */}
			{upgradeComplete && (
				<div className="flex justify-center mt-2">
					<button
						className="flex items-center gap-2 bg-vscode-button-background hover:bg-vscode-button-hoverBackground text-vscode-button-foreground font-medium px-8 py-3 rounded-md shadow-sm transition-colors duration-200"
						onClick={handleContinue}>
						<span className="codicon codicon-check"></span>
						{t("common:upgrade.complete")}
					</button>
				</div>
			)}
		</div>
	)
}

export default UpgradeHandler
