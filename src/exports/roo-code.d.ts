import * as vscode from "vscode"

import { EventEmitter } from "events"

import type { ProviderSettings, GlobalSettings } from "./types"

export type RooCodeSettings = GlobalSettings & ProviderSettings

export interface TokenUsage {
	totalTokensIn: number
	totalTokensOut: number
	totalCacheWrites?: number
	totalCacheReads?: number
	totalCost: number
	contextTokens: number
}

export interface RooCodeEvents {
	message: [{ taskId: string; action: "created" | "updated"; message: ClineMessage }]
	taskCreated: [taskId: string]
	taskStarted: [taskId: string]
	taskPaused: [taskId: string]
	taskUnpaused: [taskId: string]
	taskAskResponded: [taskId: string]
	taskAborted: [taskId: string]
	taskSpawned: [taskId: string, childTaskId: string]
	taskCompleted: [taskId: string, usage: TokenUsage]
	taskTokenUsageUpdated: [taskId: string, usage: TokenUsage]
}

export interface RooCodeAPI extends EventEmitter<RooCodeEvents> {
	/**
	 * Starts a new task with an optional initial message and images.
	 * @param task Optional initial task message.
	 * @param images Optional array of image data URIs (e.g., "data:image/webp;base64,...").
	 * @returns The ID of the new task.
	 */
	startNewTask(task?: string, images?: string[]): Promise<string>

	/**
	 * Returns the current task stack.
	 * @returns An array of task IDs.
	 */
	getCurrentTaskStack(): string[]

	/**
	 * Clears the current task.
	 */
	clearCurrentTask(lastMessage?: string): Promise<void>

	/**
	 * Cancels the current task.
	 */
	cancelCurrentTask(): Promise<void>

	/**
	 * Sends a message to the current task.
	 * @param message Optional message to send.
	 * @param images Optional array of image data URIs (e.g., "data:image/webp;base64,...").
	 */
	sendMessage(message?: string, images?: string[]): Promise<void>

	/**
	 * Simulates pressing the primary button in the chat interface.
	 */
	pressPrimaryButton(): Promise<void>

	/**
	 * Simulates pressing the secondary button in the chat interface.
	 */
	pressSecondaryButton(): Promise<void>

	/**
	 * Sets the configuration for the current task.
	 * @param values An object containing key-value pairs to set.
	 */
	setConfiguration(values: RooCodeSettings): Promise<void>

	/**
	 * Returns true if the API is ready to use.
	 */
	isReady(): boolean

	/**
	 * Returns the messages for a given task.
	 * @param taskId The ID of the task.
	 * @returns An array of ClineMessage objects.
	 */
	getMessages(taskId: string): ClineMessage[]

	/**
	 * Returns the token usage for a given task.
	 * @param taskId The ID of the task.
	 * @returns A TokenUsage object.
	 */
	getTokenUsage(taskId: string): TokenUsage

	/**
	 * Logs a message to the output channel.
	 * @param message The message to log.
	 */
	log(message: string): void
}

export type ClineAsk =
	| "followup"
	| "command"
	| "command_output"
	| "completion_result"
	| "tool"
	| "api_req_failed"
	| "resume_task"
	| "resume_completed_task"
	| "mistake_limit_reached"
	| "browser_action_launch"
	| "use_mcp_server"
	| "finishTask"

export type ClineSay =
	| "task"
	| "error"
	| "api_req_started"
	| "api_req_finished"
	| "api_req_retried"
	| "api_req_retry_delayed"
	| "api_req_deleted"
	| "text"
	| "reasoning"
	| "completion_result"
	| "user_feedback"
	| "user_feedback_diff"
	| "command_output"
	| "tool"
	| "shell_integration_warning"
	| "browser_action"
	| "browser_action_result"
	| "command"
	| "mcp_server_request_started"
	| "mcp_server_response"
	| "new_task_started"
	| "new_task"
	| "checkpoint_saved"
	| "rooignore_error"

export type ToolProgressStatus = {
	icon?: string
	text?: string
}

export interface ClineMessage {
	ts: number
	type: "ask" | "say"
	ask?: ClineAsk
	say?: ClineSay
	text?: string
	images?: string[]
	partial?: boolean
	reasoning?: string
	conversationHistoryIndex?: number
	checkpoint?: Record<string, unknown>
	progressStatus?: ToolProgressStatus
}
