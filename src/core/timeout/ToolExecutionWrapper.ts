import type { ToolName } from "@roo-code/types"
import { timeoutManager, type TimeoutConfig, type TimeoutResult } from "./TimeoutManager"

export interface ToolExecutionOptions {
	toolName: ToolName
	taskId?: string
	timeoutMs?: number
	enableFallback?: boolean
}

/**
 * Wrapper for executing tools with timeout protection
 */
export class ToolExecutionWrapper {
	/**
	 * Execute a tool operation with timeout protection
	 */
	public static async execute<T>(
		operation: (signal: AbortSignal) => Promise<T>,
		options: ToolExecutionOptions,
		defaultTimeoutMs = 60000, // 1 minute default
	): Promise<TimeoutResult<T>> {
		const config: TimeoutConfig = {
			toolName: options.toolName,
			timeoutMs: options.timeoutMs ?? defaultTimeoutMs,
			enableFallback: options.enableFallback ?? true,
			taskId: options.taskId,
		}

		return timeoutManager.executeWithTimeout(operation, config)
	}
}
