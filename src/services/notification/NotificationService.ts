import * as vscode from "vscode"
import * as notifier from "node-notifier"
import * as path from "path"
import { NotificationService, NotificationTrigger, NotificationPreferences } from "./types"
import { t } from "../../i18n"

// Extended notification options to include platform-specific properties
interface ExtendedNotificationOptions extends notifier.Notification {
	sound?: boolean
	subtitle?: string
	appID?: string
	timeout?: number
	id?: number
	wait?: boolean
}

export class DesktopNotificationService implements NotificationService {
	private preferences!: NotificationPreferences
	private notificationMap: Map<string, any> = new Map()
	private iconPath: string
	private log: (...args: unknown[]) => void

	constructor(
		private context: vscode.ExtensionContext,
		initialPreferences?: NotificationPreferences,
		log?: (...args: unknown[]) => void,
	) {
		this.log = log || console.log
		this.iconPath = path.join(context.extensionPath, "assets", "icons", "icon.png")
		if (initialPreferences) {
			this.preferences = initialPreferences
		} else {
			this.loadPreferences()
		}
	}

	async initialize(): Promise<void> {
		// Test notification support
		if (!this.isSupported()) {
			this.log("[DesktopNotificationService] Desktop notifications are not supported on this system")
		}
	}

	isSupported(): boolean {
		try {
			// Check if node-notifier can work on this system
			return notifier.notify !== undefined
		} catch {
			return false
		}
	}

	private loadPreferences(): void {
		// Default preferences when no initial preferences are provided
		this.preferences = {
			enabled: true,
			showApprovalRequests: true,
			showErrors: true,
			showTaskCompletion: true,
			showUserInputRequired: true,
			showSessionTimeouts: true,
			timeout: 10,
			sound: true,
		}
	}

	async setUserPreferences(preferences: NotificationPreferences): Promise<void> {
		this.preferences = preferences
	}

	async sendNotification(notification: NotificationTrigger): Promise<boolean> {
		if (!this.preferences.enabled || !this.shouldShowNotification(notification.type)) {
			return false
		}

		try {
			const notificationId = `roo-${Date.now()}`

			const notifierOptions: ExtendedNotificationOptions = {
				title: notification.title,
				message: notification.message,
				icon: this.iconPath,
				sound: this.preferences.sound,
				timeout: this.preferences.timeout,
				id: parseInt(notificationId.replace("roo-", "")),
				appID: "Roo Code",
				wait: notification.type === "approval_request",
			}

			// Platform-specific options
			if (process.platform === "darwin") {
				// macOS specific
				notifierOptions.subtitle = "Roo Code"
			} else if (process.platform === "win32") {
				// Windows specific
				notifierOptions.appID = "RooVeterinaryInc.roo-cline"
			}

			notifier.notify(notifierOptions, (err: Error | null, response: string) => {
				if (err) {
					this.log(`[DesktopNotificationService] Notification error for ${notification.type}:`, err)
					// Fallback to VSCode notification
					this.fallbackToVSCodeNotification(notification)
				}
			})

			this.notificationMap.set(notificationId, notification)
			return true
		} catch (error) {
			this.log(
				`[DesktopNotificationService] Failed to send desktop notification for ${notification.type}:`,
				error,
			)
			// Fallback to VSCode notification
			this.fallbackToVSCodeNotification(notification)
			return false
		}
	}

	private shouldShowNotification(type: NotificationTrigger["type"]): boolean {
		switch (type) {
			case "approval_request":
				return this.preferences.showApprovalRequests
			case "error":
				return this.preferences.showErrors
			case "completion":
				return this.preferences.showTaskCompletion
			case "input_required":
				return this.preferences.showUserInputRequired
			case "timeout_warning":
				return this.preferences.showSessionTimeouts
			default:
				return true
		}
	}

	private fallbackToVSCodeNotification(notification: NotificationTrigger): void {
		const message = `${notification.title}: ${notification.message}`

		switch (notification.priority) {
			case "critical":
				vscode.window.showErrorMessage(message)
				break
			case "high":
				vscode.window.showWarningMessage(message)
				break
			default:
				vscode.window.showInformationMessage(message)
		}
	}

	async updateNotification(id: string, updates: Partial<NotificationTrigger>): Promise<boolean> {
		// node-notifier doesn't support updating notifications
		// We'll dismiss the old one and send a new one
		await this.dismissNotification(id)
		const existing = this.notificationMap.get(id)
		if (existing) {
			return this.sendNotification({ ...existing, ...updates })
		}
		return false
	}

	async dismissNotification(id: string): Promise<boolean> {
		// node-notifier doesn't provide a direct dismiss API
		// This is a limitation we'll document
		this.notificationMap.delete(id)
		return true
	}
}
