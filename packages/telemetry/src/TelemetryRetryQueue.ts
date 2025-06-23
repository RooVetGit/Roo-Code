import * as vscode from "vscode"
import { TelemetryEvent } from "@roo-code/types"

export interface QueuedTelemetryEvent {
	id: string
	event: TelemetryEvent
	timestamp: number
	retryCount: number
	nextRetryAt: number
	priority: "high" | "normal"
}

export interface RetryQueueConfig {
	maxRetries: number
	baseDelayMs: number
	maxDelayMs: number
	maxQueueSize: number
	batchSize: number
	enableNotifications: boolean
}

export const DEFAULT_RETRY_CONFIG: RetryQueueConfig = {
	maxRetries: 5,
	baseDelayMs: 1000, // 1 second
	maxDelayMs: 300000, // 5 minutes
	maxQueueSize: 1000,
	batchSize: 10,
	enableNotifications: true,
}

export interface ConnectionStatus {
	isConnected: boolean
	lastSuccessfulSend: number
	consecutiveFailures: number
}

/**
 * TelemetryRetryQueue manages persistent storage and retry logic for failed telemetry events.
 * Features:
 * - Persistent storage using VSCode's globalState
 * - Exponential backoff retry strategy
 * - Priority-based event handling
 * - Connection status monitoring
 * - Configurable queue limits and retry behavior
 */
export class TelemetryRetryQueue {
	private context: vscode.ExtensionContext
	private config: RetryQueueConfig
	private connectionStatus: ConnectionStatus
	private retryTimer: NodeJS.Timeout | null = null
	private isProcessing = false
	private statusBarItem: vscode.StatusBarItem | null = null

	constructor(context: vscode.ExtensionContext, config: Partial<RetryQueueConfig> = {}) {
		this.context = context
		this.config = { ...DEFAULT_RETRY_CONFIG, ...config }
		this.connectionStatus = {
			isConnected: true,
			lastSuccessfulSend: Date.now(),
			consecutiveFailures: 0,
		}

		// Initialize status bar item for connection status
		this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100)
		this.updateStatusBar()
	}

	/**
	 * Adds a telemetry event to the retry queue
	 */
	public async enqueue(event: TelemetryEvent, priority: "high" | "normal" = "normal"): Promise<void> {
		const queue = await this.getQueue()

		// Check queue size limit
		if (queue.length >= this.config.maxQueueSize) {
			// Remove oldest normal priority events to make room
			const normalPriorityIndex = queue.findIndex((item) => item.priority === "normal")
			if (normalPriorityIndex !== -1) {
				queue.splice(normalPriorityIndex, 1)
			} else {
				// If no normal priority events, remove oldest event
				queue.shift()
			}
		}

		const queuedEvent: QueuedTelemetryEvent = {
			id: this.generateId(),
			event,
			timestamp: Date.now(),
			retryCount: 0,
			nextRetryAt: Date.now(),
			priority,
		}

		// Insert based on priority (high priority events go first)
		if (priority === "high") {
			const firstNormalIndex = queue.findIndex((item) => item.priority === "normal")
			if (firstNormalIndex === -1) {
				queue.push(queuedEvent)
			} else {
				queue.splice(firstNormalIndex, 0, queuedEvent)
			}
		} else {
			queue.push(queuedEvent)
		}

		await this.saveQueue(queue)
		this.scheduleNextRetry()
	}

	/**
	 * Processes the retry queue, attempting to send failed events
	 */
	public async processQueue(sendFunction: (event: TelemetryEvent) => Promise<boolean>): Promise<void> {
		if (this.isProcessing) {
			return
		}

		this.isProcessing = true

		try {
			const queue = await this.getQueue()
			const now = Date.now()
			const eventsToRetry = queue.filter((item) => item.nextRetryAt <= now)

			if (eventsToRetry.length === 0) {
				return
			}

			// Process events in batches
			const batch = eventsToRetry.slice(0, this.config.batchSize)
			const results = await Promise.allSettled(
				batch.map(async (queuedEvent) => {
					const success = await sendFunction(queuedEvent.event)
					return { queuedEvent, success }
				}),
			)

			let hasSuccessfulSend = false
			const updatedQueue = [...queue]

			for (const result of results) {
				if (result.status === "fulfilled") {
					const { queuedEvent, success } = result.value

					if (success) {
						// Remove successful event from queue
						const index = updatedQueue.findIndex((item) => item.id === queuedEvent.id)
						if (index !== -1) {
							updatedQueue.splice(index, 1)
						}
						hasSuccessfulSend = true
					} else {
						// Update retry information for failed event
						const index = updatedQueue.findIndex((item) => item.id === queuedEvent.id)
						if (index !== -1) {
							updatedQueue[index].retryCount++

							if (updatedQueue[index].retryCount >= this.config.maxRetries) {
								// Remove event that has exceeded max retries
								updatedQueue.splice(index, 1)
							} else {
								// Calculate next retry time with exponential backoff
								const delay = Math.min(
									this.config.baseDelayMs * Math.pow(2, updatedQueue[index].retryCount),
									this.config.maxDelayMs,
								)
								updatedQueue[index].nextRetryAt = now + delay
							}
						}
					}
				}
			}

			await this.saveQueue(updatedQueue)
			this.updateConnectionStatus(hasSuccessfulSend)
			this.scheduleNextRetry()
		} finally {
			this.isProcessing = false
		}
	}

	/**
	 * Gets the current queue size
	 */
	public async getQueueSize(): Promise<number> {
		const queue = await this.getQueue()
		return queue.length
	}

	/**
	 * Clears all events from the queue
	 */
	public async clearQueue(): Promise<void> {
		await this.saveQueue([])
		this.updateConnectionStatus(true)
	}

	/**
	 * Gets connection status information
	 */
	public getConnectionStatus(): ConnectionStatus {
		return { ...this.connectionStatus }
	}

	/**
	 * Updates the retry queue configuration
	 */
	public updateConfig(newConfig: Partial<RetryQueueConfig>): void {
		this.config = { ...this.config, ...newConfig }
	}

	/**
	 * Disposes of the retry queue and cleans up resources
	 */
	public dispose(): void {
		if (this.retryTimer) {
			clearTimeout(this.retryTimer)
			this.retryTimer = null
		}
		if (this.statusBarItem) {
			this.statusBarItem.dispose()
			this.statusBarItem = null
		}
	}

	/**
	 * Manually triggers a retry attempt
	 */
	public async triggerRetry(sendFunction: (event: TelemetryEvent) => Promise<boolean>): Promise<void> {
		await this.processQueue(sendFunction)
	}

	private async getQueue(): Promise<QueuedTelemetryEvent[]> {
		const stored = this.context.globalState.get<QueuedTelemetryEvent[]>("telemetryRetryQueue", [])
		return stored
	}

	private async saveQueue(queue: QueuedTelemetryEvent[]): Promise<void> {
		await this.context.globalState.update("telemetryRetryQueue", queue)
		this.updateStatusBar()
	}

	private generateId(): string {
		return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
	}

	private scheduleNextRetry(): void {
		if (this.retryTimer) {
			clearTimeout(this.retryTimer)
		}

		// Schedule next retry based on the earliest nextRetryAt time
		this.getQueue().then((queue) => {
			if (queue.length === 0) {
				return
			}

			const now = Date.now()
			const nextRetryTime = Math.min(...queue.map((item) => item.nextRetryAt))
			const delay = Math.max(0, nextRetryTime - now)

			this.retryTimer = setTimeout(() => {
				// The actual retry will be triggered by the telemetry client
				this.retryTimer = null
			}, delay)
		})
	}

	private updateConnectionStatus(hasSuccessfulSend: boolean): void {
		if (hasSuccessfulSend) {
			this.connectionStatus.isConnected = true
			this.connectionStatus.lastSuccessfulSend = Date.now()
			this.connectionStatus.consecutiveFailures = 0
		} else {
			this.connectionStatus.consecutiveFailures++

			// Consider disconnected after 3 consecutive failures
			if (this.connectionStatus.consecutiveFailures >= 3) {
				this.connectionStatus.isConnected = false
			}
		}

		this.updateStatusBar()
		this.showNotificationIfNeeded()
	}

	private updateStatusBar(): void {
		if (!this.statusBarItem) {
			return
		}

		this.getQueue()
			.then((queue) => {
				if (!this.statusBarItem) {
					return
				}

				if (queue.length === 0) {
					this.statusBarItem.hide()
					return
				}

				const queueSize = queue.length
				const isConnected = this.connectionStatus.isConnected

				if (!isConnected) {
					this.statusBarItem.text = `$(warning) Telemetry: ${queueSize} queued`
					this.statusBarItem.tooltip = `${queueSize} telemetry events queued due to connection issues`
					this.statusBarItem.backgroundColor = new vscode.ThemeColor("statusBarItem.warningBackground")
				} else {
					this.statusBarItem.text = `$(sync) Telemetry: ${queueSize} pending`
					this.statusBarItem.tooltip = `${queueSize} telemetry events pending retry`
					this.statusBarItem.backgroundColor = undefined
				}

				this.statusBarItem.command = "roo-code.telemetry.showQueue"
				this.statusBarItem.show()
			})
			.catch((error) => {
				console.warn("[TelemetryRetryQueue] Error updating status bar:", error)
			})
	}

	private showNotificationIfNeeded(): void {
		if (!this.config.enableNotifications) {
			return
		}

		const timeSinceLastSuccess = Date.now() - this.connectionStatus.lastSuccessfulSend
		const fiveMinutes = 5 * 60 * 1000

		// Show notification if disconnected for more than 5 minutes
		if (!this.connectionStatus.isConnected && timeSinceLastSuccess > fiveMinutes) {
			this.getQueue().then((queue) => {
				if (queue.length > 0) {
					vscode.window
						.showWarningMessage(
							`Telemetry connection issues detected. ${queue.length} events queued for retry.`,
							"Retry Now",
							"Disable Notifications",
						)
						.then((selection) => {
							if (selection === "Retry Now") {
								// Trigger manual retry - this will be handled by the telemetry client
								vscode.commands.executeCommand("roo-code.telemetry.retryNow")
							} else if (selection === "Disable Notifications") {
								this.config.enableNotifications = false
							}
						})
				}
			})
		}
	}
}
