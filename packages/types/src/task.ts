import { type ClineMessage, type TokenUsage } from "./message.js"
import { type ToolUsage, type ToolName } from "./tool.js"

export type TaskEvents = {
	message: [{ action: "created" | "updated"; message: ClineMessage }]
	taskStarted: []
	taskModeSwitched: [taskId: string, mode: string]
	taskPaused: []
	taskUnpaused: []
	taskAskResponded: []
	taskAborted: []
	taskSpawned: [taskId: string]
	taskCompleted: [taskId: string, tokenUsage: TokenUsage, toolUsage: ToolUsage]
	taskTokenUsageUpdated: [taskId: string, tokenUsage: TokenUsage]
	taskToolFailed: [taskId: string, tool: ToolName, error: string]
}

export type TaskEventHandlers = {
	[K in keyof TaskEvents]: (...args: TaskEvents[K]) => void | Promise<void>
}

export interface TaskLike {
	readonly taskId: string

	on<K extends keyof TaskEvents>(event: K, listener: (...args: TaskEvents[K]) => void | Promise<void>): this
	off<K extends keyof TaskEvents>(event: K, listener: (...args: TaskEvents[K]) => void | Promise<void>): this
	setMessageResponse(text: string, images?: string[]): void
}
