import { EventEmitter } from "events"
import type { ToolName } from "@roo-code/types"
import { TelemetryService } from "@roo-code/telemetry"

export interface TimeoutConfig {
	toolName: ToolName
	timeoutMs: number
	enableFallback: boolean
	taskId?: string
}

export interface TimeoutResult<T> {
	success: boolean
	result?: T
	timedOut: boolean
	fallbackTriggered: boolean
	error?: Error
	executionTimeMs: number
}

export interface TimeoutEvent {
	toolName: ToolName
	timeoutMs: number
	executionTimeMs: number
	taskId?: string
	timestamp: number
}

/**
 * Manages timeouts for all tool executions with configurable fallback mechanisms
 */
export class TimeoutManager extends EventEmitter {
	private static instance: TimeoutManager | undefined
	private activeOperations = new Map<string, AbortController>()
	/**
	 * Assumes there is only one active tool-- does not timeout edge cases
	 * like "Proceed While Running"
	 */
	private lastTimeoutEvent: TimeoutEvent | null = null
	private logger: (...args: any[]) => void

	private constructor(logger?: (...args: any[]) => void) {
		super()
		this.logger = logger || console.log
	}

	public static getInstance(logger?: (...args: any[]) => void): TimeoutManager {
		if (!TimeoutManager.instance) {
			TimeoutManager.instance = new TimeoutManager(logger)
		}
		return TimeoutManager.instance
	}

	/**
	 * Execute a function with timeout protection
	 */
	public async executeWithTimeout<T>(
		operation: (signal: AbortSignal) => Promise<T>,
		config: TimeoutConfig,
	): Promise<TimeoutResult<T>> {
		const operationId = this.generateOperationId(config.toolName, config.taskId)
		const controller = new AbortController()
		const startTime = Date.now()

		this.logger(`[TimeoutManager] Starting operation ${operationId} with timeout ${config.timeoutMs}ms`)

		// Store the controller for potential cancellation
		this.activeOperations.set(operationId, controller)

		try {
			// Create timeout promise
			const timeoutPromise = new Promise<never>((_, reject) => {
				const timeoutId = setTimeout(() => {
					controller.abort()
					reject(new Error(`Operation timed out after ${config.timeoutMs}ms`))
				}, config.timeoutMs)

				// Clean up timeout if operation completes
				controller.signal.addEventListener("abort", () => {
					clearTimeout(timeoutId)
				})
			})

			// Race between operation and timeout
			const result = await Promise.race([operation(controller.signal), timeoutPromise])

			const executionTimeMs = Date.now() - startTime

			this.logger(`[TimeoutManager] Operation ${operationId} completed successfully in ${executionTimeMs}ms`)

			return {
				success: true,
				result,
				timedOut: false,
				fallbackTriggered: false,
				executionTimeMs,
			}
		} catch (error) {
			const executionTimeMs = Date.now() - startTime
			const timedOut = controller.signal.aborted

			if (timedOut) {
				// Store the last timeout event
				const timeoutEvent: TimeoutEvent = {
					toolName: config.toolName,
					timeoutMs: config.timeoutMs,
					executionTimeMs,
					taskId: config.taskId,
					timestamp: Date.now(),
				}

				this.lastTimeoutEvent = timeoutEvent
				this.emit("timeout", timeoutEvent)

				// Log timeout event
				this.logger(
					`[TimeoutManager] Operation ${operationId} timed out after ${executionTimeMs}ms (limit: ${config.timeoutMs}ms)`,
				)

				// Capture telemetry if TelemetryService is available
				if (TelemetryService.hasInstance() && config.taskId) {
					TelemetryService.instance.captureToolTimeout(
						config.taskId,
						config.toolName,
						config.timeoutMs,
						executionTimeMs,
					)
				}

				return {
					success: false,
					timedOut: true,
					fallbackTriggered: config.enableFallback,
					error: error as Error,
					executionTimeMs,
				}
			}

			// Log non-timeout errors
			this.logger(
				`[TimeoutManager] Operation ${operationId} failed after ${executionTimeMs}ms: ${error instanceof Error ? error.message : String(error)}`,
			)

			return {
				success: false,
				timedOut: false,
				fallbackTriggered: false,
				error: error as Error,
				executionTimeMs,
			}
		} finally {
			// Clean up
			this.activeOperations.delete(operationId)
		}
	}

	/**
	 * Cancel a specific operation by tool name and task ID
	 */
	public cancelOperation(toolName: ToolName, taskId?: string): boolean {
		const operationId = this.generateOperationId(toolName, taskId)
		const controller = this.activeOperations.get(operationId)

		if (controller) {
			controller.abort()
			this.activeOperations.delete(operationId)
			return true
		}

		return false
	}

	/**
	 * Cancel all active operations
	 */
	public cancelAllOperations(): void {
		for (const controller of this.activeOperations.values()) {
			controller.abort()
		}
		this.activeOperations.clear()
	}

	/**
	 * Get the last timeout event
	 */
	public getLastTimeoutEvent(): TimeoutEvent | null {
		return this.lastTimeoutEvent
	}

	/**
	 * Clear the last timeout event
	 */
	public clearLastTimeoutEvent(): void {
		this.lastTimeoutEvent = null
	}

	/**
	 * Get active operation count
	 */
	public getActiveOperationCount(): number {
		return this.activeOperations.size
	}

	/**
	 * Check if a specific operation is active
	 */
	public isOperationActive(toolName: ToolName, taskId?: string): boolean {
		const operationId = this.generateOperationId(toolName, taskId)
		return this.activeOperations.has(operationId)
	}

	private generateOperationId(toolName: ToolName, taskId?: string): string {
		return `${toolName}:${taskId || "default"}`
	}

	/**
	 * Get timeout statistics for monitoring
	 */
	public getTimeoutStats(): {
		lastTimeout: TimeoutEvent | null
		activeOperations: number
		operationIds: string[]
	} {
		return {
			lastTimeout: this.lastTimeoutEvent,
			activeOperations: this.activeOperations.size,
			operationIds: Array.from(this.activeOperations.keys()),
		}
	}

	/**
	 * Cleanup method for graceful shutdown
	 */
	public dispose(): void {
		this.cancelAllOperations()
		this.removeAllListeners()
		this.lastTimeoutEvent = null
	}
}

export const timeoutManager = TimeoutManager.getInstance()
