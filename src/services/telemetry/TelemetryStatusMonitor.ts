import * as vscode from "vscode"
import { CloudService } from "@roo-code/cloud"
import { t } from "../../i18n"

/**
 * TelemetryStatusMonitor provides visual feedback about telemetry connection status
 * and queue buildup through VSCode notifications and status bar items.
 */
export class TelemetryStatusMonitor {
	private statusBarItem: vscode.StatusBarItem
	private lastNotificationTime = 0
	private notificationInterval = 300000 // 5 minutes
	private isConnected = true
	private queueSize = 0
	private isAboveThreshold = false

	constructor(private context: vscode.ExtensionContext) {
		// Create status bar item
		this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100)
		this.statusBarItem.command = "roo-code.showTelemetryStatus"
		this.context.subscriptions.push(this.statusBarItem)

		// Register command
		this.context.subscriptions.push(
			vscode.commands.registerCommand("roo-code.showTelemetryStatus", () => {
				this.showTelemetryStatusQuickPick()
			}),
		)

		// Initialize status
		this.updateStatusBar()
	}

	/**
	 * Initializes monitoring with CloudService callbacks
	 */
	public initialize(): void {
		if (!CloudService.hasInstance()) {
			return
		}

		// Set up callbacks
		CloudService.instance.setTelemetryConnectionStatusCallback((isConnected) => {
			this.onConnectionStatusChange(isConnected)
		})

		CloudService.instance.setTelemetryQueueSizeCallback((size, isAboveWarningThreshold) => {
			this.onQueueSizeChange(size, isAboveWarningThreshold)
		})

		// Get initial status
		this.isConnected = CloudService.instance.getTelemetryConnectionStatus()
		this.updateStatusBar()
	}

	/**
	 * Handles connection status changes
	 */
	private onConnectionStatusChange(isConnected: boolean): void {
		const wasConnected = this.isConnected
		this.isConnected = isConnected

		// Update status bar
		this.updateStatusBar()

		// Show notification on status change
		if (wasConnected && !isConnected) {
			this.showNotification(t("telemetry:connectionLost"), "warning")
		} else if (!wasConnected && isConnected) {
			this.showNotification(t("telemetry:connectionRestored"), "info")
		}
	}

	/**
	 * Handles queue size changes
	 */
	private onQueueSizeChange(size: number, isAboveWarningThreshold: boolean): void {
		this.queueSize = size
		const wasAboveThreshold = this.isAboveThreshold
		this.isAboveThreshold = isAboveWarningThreshold

		// Update status bar
		this.updateStatusBar()

		// Show notification when crossing threshold
		if (!wasAboveThreshold && isAboveWarningThreshold) {
			this.showNotification(t("telemetry:queueBuildingUp", { count: size }), "warning")
		} else if (wasAboveThreshold && !isAboveWarningThreshold && size === 0) {
			this.showNotification(t("telemetry:queueCleared"), "info")
		}
	}

	/**
	 * Updates the status bar item
	 */
	private updateStatusBar(): void {
		if (!this.isConnected || this.queueSize > 0) {
			// Show status bar when there are issues
			let icon = this.isConnected ? "$(cloud-upload)" : "$(cloud-offline)"
			let text = this.isConnected ? "Telemetry" : "Telemetry Offline"

			if (this.queueSize > 0) {
				text += ` (${this.queueSize} queued)`
				if (this.isAboveThreshold) {
					icon = "$(warning)"
				}
			}

			this.statusBarItem.text = `${icon} ${text}`
			this.statusBarItem.tooltip = this.getTooltip()
			this.statusBarItem.backgroundColor = this.isAboveThreshold
				? new vscode.ThemeColor("statusBarItem.warningBackground")
				: undefined
			this.statusBarItem.show()
		} else {
			// Hide when everything is normal
			this.statusBarItem.hide()
		}
	}

	/**
	 * Gets the tooltip text for the status bar item
	 */
	private getTooltip(): string {
		const lines = ["Roo Code Telemetry Status"]

		if (this.isConnected) {
			lines.push("✓ Connected to Roo Code Cloud")
		} else {
			lines.push("✗ Disconnected from Roo Code Cloud")
		}

		if (this.queueSize > 0) {
			lines.push(`${this.queueSize} events queued for retry`)
			if (this.isAboveThreshold) {
				lines.push("⚠ Queue size above warning threshold")
			}
		}

		lines.push("", "Click for more options")
		return lines.join("\n")
	}

	/**
	 * Shows a notification with rate limiting
	 */
	private showNotification(message: string, severity: "info" | "warning"): void {
		const now = Date.now()

		// Rate limit notifications
		if (now - this.lastNotificationTime < this.notificationInterval) {
			return
		}

		this.lastNotificationTime = now

		const showNotification =
			severity === "warning" ? vscode.window.showWarningMessage : vscode.window.showInformationMessage

		showNotification(message, "View Status", "Retry Now").then((selection) => {
			if (selection === "View Status") {
				this.showTelemetryStatusQuickPick()
			} else if (selection === "Retry Now") {
				this.triggerManualRetry()
			}
		})
	}

	/**
	 * Shows a quick pick with telemetry status and options
	 */
	private async showTelemetryStatusQuickPick(): Promise<void> {
		const metadata = await CloudService.instance.getTelemetryQueueMetadata()

		const items: vscode.QuickPickItem[] = [
			{
				label: "$(info) Telemetry Status",
				description: this.isConnected ? "Connected" : "Disconnected",
				detail: this.isConnected
					? "Telemetry is being sent to Roo Code Cloud"
					: "Telemetry is being queued for later delivery",
			},
		]

		if (metadata) {
			items.push({
				label: "$(database) Queue Status",
				description: `${metadata.size} events`,
				detail:
					metadata.size > 0
						? `Oldest event: ${new Date(metadata.oldestEventTimestamp!).toLocaleString()}`
						: "Queue is empty",
			})
		}

		items.push(
			{ label: "", kind: vscode.QuickPickItemKind.Separator },
			{
				label: "$(sync) Retry Queued Events",
				description: "Manually trigger retry",
				detail: "Attempt to send all queued telemetry events now",
			},
			{
				label: "$(gear) Telemetry Settings",
				description: "Open settings",
				detail: "Configure telemetry preferences",
			},
		)

		const selected = await vscode.window.showQuickPick(items, {
			placeHolder: "Telemetry Status and Actions",
		})

		if (selected?.label === "$(sync) Retry Queued Events") {
			await this.triggerManualRetry()
		} else if (selected?.label === "$(gear) Telemetry Settings") {
			vscode.commands.executeCommand("workbench.action.openSettings", "roo-code.telemetry")
		}
	}

	/**
	 * Triggers a manual retry of queued events
	 */
	private async triggerManualRetry(): Promise<void> {
		try {
			await vscode.window.withProgress(
				{
					location: vscode.ProgressLocation.Notification,
					title: "Retrying telemetry events...",
					cancellable: false,
				},
				async () => {
					await CloudService.instance.triggerTelemetryRetry()
				},
			)
		} catch (error) {
			vscode.window.showErrorMessage(`Failed to retry telemetry events: ${error}`)
		}
	}

	/**
	 * Disposes the monitor
	 */
	public dispose(): void {
		this.statusBarItem.dispose()
	}
}
