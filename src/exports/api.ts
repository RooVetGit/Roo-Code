import { EventEmitter } from "events"
import * as vscode from "vscode"

import { ClineProvider } from "../core/webview/ClineProvider"

import { RooCodeAPI, RooCodeEvents, TokenUsage, RooCodeSettings } from "./roo-code"
import { MessageHistory } from "./message-history"

export class API extends EventEmitter<RooCodeEvents> implements RooCodeAPI {
	private readonly outputChannel: vscode.OutputChannel
	private readonly provider: ClineProvider
	private readonly history: MessageHistory
	private readonly tokenUsage: Record<string, TokenUsage>

	/**
	 * Construct a new API object.
	 *
	 * @param outputChannel The output channel to print any internal logs to.
	 * @param provider The ClineProvider to listen to events from.
	 */
	constructor(outputChannel: vscode.OutputChannel, provider: ClineProvider) {
		super()

		this.outputChannel = outputChannel
		this.provider = provider
		this.history = new MessageHistory()
		this.tokenUsage = {}

		this.provider.on("clineCreated", (cline) => {
			cline.on("message", (message) => this.emit("message", { taskId: cline.taskId, ...message }))
			cline.on("taskStarted", () => this.emit("taskStarted", cline.taskId))
			cline.on("taskPaused", () => this.emit("taskPaused", cline.taskId))
			cline.on("taskUnpaused", () => this.emit("taskUnpaused", cline.taskId))
			cline.on("taskAskResponded", () => this.emit("taskAskResponded", cline.taskId))
			cline.on("taskAborted", () => this.emit("taskAborted", cline.taskId))
			cline.on("taskSpawned", (childTaskId) => this.emit("taskSpawned", cline.taskId, childTaskId))
			cline.on("taskCompleted", (_, usage) => this.emit("taskCompleted", cline.taskId, usage))
			cline.on("taskTokenUsageUpdated", (_, usage) => this.emit("taskTokenUsageUpdated", cline.taskId, usage))
			this.emit("taskCreated", cline.taskId)
		})

		this.on("message", ({ taskId, action, message }) => {
			if (action === "created") {
				this.history.add(taskId, message)
			} else if (action === "updated") {
				this.history.update(taskId, message)
			}
		})

		this.on("taskTokenUsageUpdated", (taskId, usage) => (this.tokenUsage[taskId] = usage))
	}

	public async startNewTask(text?: string, images?: string[]) {
		await this.provider.clineStackManager.removeClineFromStack()
		await this.provider.postStateToWebview()
		await this.provider.postMessageToWebview({ type: "action", action: "chatButtonClicked" })
		await this.provider.postMessageToWebview({ type: "invoke", invoke: "newChat", text, images })

		const cline = await this.provider.initClineWithTask(text, images)
		return cline.taskId
	}

	/**
	 * Returns the current task stack.
	 * todo: currently unused, to remove...
	 * @returns An array of task IDs.
	 */
	public async getCurrentTaskStack() {
		return this.provider.clineStackManager.getCurrentTaskStack()
	}

	/**
	 * Clears the current task.
	 * todo: currently unused, to remove...
	 * @param lastMessage Optional last message to send before clearing.
	 */
	public async clearCurrentTask(lastMessage?: string) {
		await this.provider.finishSubTask(lastMessage)
	}

	public async cancelCurrentTask() {
		await this.provider.cancelTask()
	}

	public async sendMessage(text?: string, images?: string[]) {
		await this.provider.postMessageToWebview({ type: "invoke", invoke: "sendMessage", text, images })
	}

	public async pressPrimaryButton() {
		await this.provider.postMessageToWebview({ type: "invoke", invoke: "primaryButtonClick" })
	}

	public async pressSecondaryButton() {
		await this.provider.postMessageToWebview({ type: "invoke", invoke: "secondaryButtonClick" })
	}

	public async setConfiguration(values: RooCodeSettings) {
		await this.provider.setValues(values)
	}

	public isReady() {
		return this.provider.viewLaunched
	}

	public getMessages(taskId: string) {
		return this.history.getMessages(taskId)
	}

	public getTokenUsage(taskId: string) {
		return this.tokenUsage[taskId]
	}

	public log(message: string) {
		this.outputChannel.appendLine(message)
	}
}
