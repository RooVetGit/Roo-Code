import { ZodError } from "zod"
import * as vscode from "vscode"

import { type TelemetryClient, type TelemetryPropertiesProvider, TelemetryEventName } from "@roo-code/types"
import { TelemetryQueue, QueuedTelemetryEvent } from "./TelemetryQueue"
import { BaseTelemetryClient } from "./BaseTelemetryClient"

/**
 * TelemetryService wrapper class that defers initialization.
 * This ensures that we only create the various clients after environment
 * variables are loaded.
 */
export class TelemetryService {
	private queue?: TelemetryQueue

	constructor(private clients: TelemetryClient[]) {}

	public register(client: TelemetryClient): void {
		this.clients.push(client)
	}

	/**
	 * Sets the ClineProvider reference to use for global properties
	 * @param provider A ClineProvider instance to use
	 */
	public setProvider(provider: TelemetryPropertiesProvider): void {
		// If client is initialized, pass the provider reference.
		if (this.isReady) {
			this.clients.forEach((client) => client.setProvider(provider))
		}
	}

	/**
	 * Base method for all telemetry operations
	 * Checks if the service is initialized before performing any operation
	 * @returns Whether the service is ready to use
	 */
	private get isReady(): boolean {
		return this.clients.length > 0
	}

	/**
	 * Updates the telemetry state based on user preferences and VSCode settings
	 * @param didUserOptIn Whether the user has explicitly opted into telemetry
	 */
	public updateTelemetryState(didUserOptIn: boolean): void {
		if (!this.isReady) {
			return
		}

		this.clients.forEach((client) => client.updateTelemetryState(didUserOptIn))
	}

	/**
	 * Generic method to capture any type of event with specified properties
	 * @param eventName The event name to capture
	 * @param properties The event properties
	 */
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	public captureEvent(eventName: TelemetryEventName, properties?: Record<string, any>): void {
		if (!this.isReady) {
			return
		}

		this.clients.forEach((client) => client.capture({ event: eventName, properties }))
	}

	public captureTaskCreated(taskId: string): void {
		this.captureEvent(TelemetryEventName.TASK_CREATED, { taskId })
	}

	public captureTaskRestarted(taskId: string): void {
		this.captureEvent(TelemetryEventName.TASK_RESTARTED, { taskId })
	}

	public captureTaskCompleted(taskId: string): void {
		this.captureEvent(TelemetryEventName.TASK_COMPLETED, { taskId })
	}

	public captureConversationMessage(taskId: string, source: "user" | "assistant"): void {
		this.captureEvent(TelemetryEventName.TASK_CONVERSATION_MESSAGE, { taskId, source })
	}

	public captureLlmCompletion(
		taskId: string,
		properties: {
			inputTokens: number
			outputTokens: number
			cacheWriteTokens: number
			cacheReadTokens: number
			cost?: number
		},
	): void {
		this.captureEvent(TelemetryEventName.LLM_COMPLETION, { taskId, ...properties })
	}

	public captureModeSwitch(taskId: string, newMode: string): void {
		this.captureEvent(TelemetryEventName.MODE_SWITCH, { taskId, newMode })
	}

	public captureToolUsage(taskId: string, tool: string): void {
		this.captureEvent(TelemetryEventName.TOOL_USED, { taskId, tool })
	}

	public captureCheckpointCreated(taskId: string): void {
		this.captureEvent(TelemetryEventName.CHECKPOINT_CREATED, { taskId })
	}

	public captureCheckpointDiffed(taskId: string): void {
		this.captureEvent(TelemetryEventName.CHECKPOINT_DIFFED, { taskId })
	}

	public captureCheckpointRestored(taskId: string): void {
		this.captureEvent(TelemetryEventName.CHECKPOINT_RESTORED, { taskId })
	}

	public captureContextCondensed(
		taskId: string,
		isAutomaticTrigger: boolean,
		usedCustomPrompt?: boolean,
		usedCustomApiHandler?: boolean,
	): void {
		this.captureEvent(TelemetryEventName.CONTEXT_CONDENSED, {
			taskId,
			isAutomaticTrigger,
			...(usedCustomPrompt !== undefined && { usedCustomPrompt }),
			...(usedCustomApiHandler !== undefined && { usedCustomApiHandler }),
		})
	}

	public captureSlidingWindowTruncation(taskId: string): void {
		this.captureEvent(TelemetryEventName.SLIDING_WINDOW_TRUNCATION, { taskId })
	}

	public captureCodeActionUsed(actionType: string): void {
		this.captureEvent(TelemetryEventName.CODE_ACTION_USED, { actionType })
	}

	public capturePromptEnhanced(taskId?: string): void {
		this.captureEvent(TelemetryEventName.PROMPT_ENHANCED, { ...(taskId && { taskId }) })
	}

	public captureSchemaValidationError({ schemaName, error }: { schemaName: string; error: ZodError }): void {
		// https://zod.dev/ERROR_HANDLING?id=formatting-errors
		this.captureEvent(TelemetryEventName.SCHEMA_VALIDATION_ERROR, { schemaName, error: error.format() })
	}

	public captureDiffApplicationError(taskId: string, consecutiveMistakeCount: number): void {
		this.captureEvent(TelemetryEventName.DIFF_APPLICATION_ERROR, { taskId, consecutiveMistakeCount })
	}

	public captureShellIntegrationError(taskId: string): void {
		this.captureEvent(TelemetryEventName.SHELL_INTEGRATION_ERROR, { taskId })
	}

	public captureConsecutiveMistakeError(taskId: string): void {
		this.captureEvent(TelemetryEventName.CONSECUTIVE_MISTAKE_ERROR, { taskId })
	}

	/**
	 * Captures when a tab is shown due to user action
	 * @param tab The tab that was shown
	 */
	public captureTabShown(tab: string): void {
		this.captureEvent(TelemetryEventName.TAB_SHOWN, { tab })
	}

	/**
	 * Captures when a setting is changed in ModesView
	 * @param settingName The name of the setting that was changed
	 */
	public captureModeSettingChanged(settingName: string): void {
		this.captureEvent(TelemetryEventName.MODE_SETTINGS_CHANGED, { settingName })
	}

	/**
	 * Captures when a user creates a new custom mode
	 * @param modeSlug The slug of the custom mode
	 * @param modeName The name of the custom mode
	 */
	public captureCustomModeCreated(modeSlug: string, modeName: string): void {
		this.captureEvent(TelemetryEventName.CUSTOM_MODE_CREATED, { modeSlug, modeName })
	}

	/**
	 * Captures a marketplace item installation event
	 * @param itemId The unique identifier of the marketplace item
	 * @param itemType The type of item (mode or mcp)
	 * @param itemName The human-readable name of the item
	 * @param target The installation target (project or global)
	 * @param properties Additional properties like hasParameters, installationMethod
	 */
	public captureMarketplaceItemInstalled(
		itemId: string,
		itemType: string,
		itemName: string,
		target: string,
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		properties?: Record<string, any>,
	): void {
		this.captureEvent(TelemetryEventName.MARKETPLACE_ITEM_INSTALLED, {
			itemId,
			itemType,
			itemName,
			target,
			...(properties || {}),
		})
	}

	/**
	 * Captures a marketplace item removal event
	 * @param itemId The unique identifier of the marketplace item
	 * @param itemType The type of item (mode or mcp)
	 * @param itemName The human-readable name of the item
	 * @param target The removal target (project or global)
	 */
	public captureMarketplaceItemRemoved(itemId: string, itemType: string, itemName: string, target: string): void {
		this.captureEvent(TelemetryEventName.MARKETPLACE_ITEM_REMOVED, {
			itemId,
			itemType,
			itemName,
			target,
		})
	}

	/**
	 * Captures a title button click event
	 * @param button The button that was clicked
	 */
	public captureTitleButtonClicked(button: string): void {
		this.captureEvent(TelemetryEventName.TITLE_BUTTON_CLICKED, { button })
	}

	/**
	 * Checks if telemetry is currently enabled
	 * @returns Whether telemetry is enabled
	 */
	public isTelemetryEnabled(): boolean {
		return this.isReady && this.clients.some((client) => client.isTelemetryEnabled())
	}

	/**
	 * Initializes the telemetry queue and sets up retry callbacks
	 * @param context VSCode extension context for persistent storage
	 */
	public initializeQueue(context: vscode.ExtensionContext): void {
		if (!this.isReady) {
			return
		}

		// Create the queue
		this.queue = new TelemetryQueue(context)

		// Set up retry callback
		this.queue.setRetryCallback(async (event: QueuedTelemetryEvent) => {
			// Find the appropriate client for this event
			const client = this.clients.find((c) => {
				if (event.clientType === "posthog" && c.constructor.name === "PostHogTelemetryClient") {
					return true
				}
				if (event.clientType === "cloud" && c.constructor.name === "TelemetryClient") {
					return true
				}
				return false
			})

			if (!client || !(client instanceof BaseTelemetryClient)) {
				return false
			}

			// Attempt to send using the client's retry method
			return await client["captureWithRetry"](event.event)
		})

		// Distribute queue to all clients
		this.clients.forEach((client) => {
			if (client instanceof BaseTelemetryClient) {
				client.setQueue(this.queue!)
			}
		})

		// Start processing the queue
		this.queue.start()
	}

	/**
	 * Shuts down the telemetry service and flushes the queue
	 * @param timeoutMs Maximum time to wait for queue flush
	 */
	public async shutdownQueue(timeoutMs?: number): Promise<void> {
		if (this.queue) {
			await this.queue.shutdown(timeoutMs)
		}
	}

	/**
	 * Gets the current queue status
	 * @returns Object with queue size and number of clients
	 */
	public getQueueStatus(): { size: number; clients: number } {
		return {
			size: this.queue?.getQueueSize() || 0,
			clients: this.clients.length,
		}
	}

	public async shutdown(): Promise<void> {
		if (!this.isReady) {
			return
		}

		// Shutdown queue first
		await this.shutdownQueue()

		// Then shutdown clients
		await Promise.all(this.clients.map((client) => client.shutdown()))
	}

	private static _instance: TelemetryService | null = null

	static createInstance(clients: TelemetryClient[] = []) {
		if (this._instance) {
			throw new Error("TelemetryService instance already created")
		}

		this._instance = new TelemetryService(clients)
		return this._instance
	}

	static get instance() {
		if (!this._instance) {
			throw new Error("TelemetryService not initialized")
		}

		return this._instance
	}

	static hasInstance(): boolean {
		return this._instance !== null
	}
}
