import { EventEmitter } from "events"
import * as vscode from "vscode"

import { ClineProvider } from "../core/webview/ClineProvider"

import { RooCodeAPI, RooCodeEvents, TokenUsage, RooCodeSettings, ClineMessage } from "./roo-code"
import { MessageHistory } from "./message-history"
import { IpcOrigin, IpcMessageType, IpcServer, TaskCommandName, TaskEventName } from "./ipc"

export class API extends EventEmitter<RooCodeEvents> implements RooCodeAPI {
	private readonly outputChannel: vscode.OutputChannel
	private readonly provider: ClineProvider
	private readonly history: MessageHistory
	private readonly tokenUsage: Record<string, TokenUsage>
	private readonly ipc?: IpcServer

	constructor(outputChannel: vscode.OutputChannel, provider: ClineProvider, socketPath?: string) {
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

		if (socketPath) {
			this.ipc = new IpcServer(socketPath)
			this.ipc.listen()

			this.ipc.on("taskCommand", (_clientId, command) => {
				switch (command.commandName) {
					case TaskCommandName.StartNewTask:
						this.startNewTask(command.data.text, command.data.images)
						break
				}
			})
		}
	}

	public override emit<K extends keyof RooCodeEvents>(
		eventName: K,
		...args: K extends keyof RooCodeEvents ? RooCodeEvents[K] : never
	) {
		if (this.ipc) {
			switch (eventName) {
				case TaskEventName.Message:
					this.ipc.broadcast({
						type: IpcMessageType.TaskEvent,
						data: {
							eventName: TaskEventName.Message,
							data: args[0] as RooCodeEvents[TaskEventName.Message][0],
						},
						origin: IpcOrigin.Server,
					})
					break
				case TaskEventName.TaskCreated:
					this.ipc.broadcast({
						type: IpcMessageType.TaskEvent,
						data: {
							eventName: TaskEventName.TaskCreated,
							data: { taskId: args[0] as RooCodeEvents[TaskEventName.TaskCreated][0] },
						},
						origin: IpcOrigin.Server,
					})
					break
				case TaskEventName.TaskStarted:
					this.ipc.broadcast({
						type: IpcMessageType.TaskEvent,
						data: {
							eventName: TaskEventName.TaskStarted,
							data: { taskId: args[0] as RooCodeEvents[TaskEventName.TaskStarted][0] },
						},
						origin: IpcOrigin.Server,
					})
					break
				case TaskEventName.TaskPaused:
					this.ipc.broadcast({
						type: IpcMessageType.TaskEvent,
						data: {
							eventName: TaskEventName.TaskPaused,
							data: { taskId: args[0] as RooCodeEvents[TaskEventName.TaskPaused][0] },
						},
						origin: IpcOrigin.Server,
					})
					break
				case TaskEventName.TaskUnpaused:
					this.ipc.broadcast({
						type: IpcMessageType.TaskEvent,
						data: {
							eventName: TaskEventName.TaskUnpaused,
							data: { taskId: args[0] as RooCodeEvents[TaskEventName.TaskUnpaused][0] },
						},
						origin: IpcOrigin.Server,
					})
					break
				case TaskEventName.TaskAskResponded:
					this.ipc.broadcast({
						type: IpcMessageType.TaskEvent,
						data: {
							eventName: TaskEventName.TaskAskResponded,
							data: { taskId: args[0] as RooCodeEvents[TaskEventName.TaskAskResponded][0] },
						},
						origin: IpcOrigin.Server,
					})
					break
				case TaskEventName.TaskAborted:
					this.ipc.broadcast({
						type: IpcMessageType.TaskEvent,
						data: {
							eventName: TaskEventName.TaskAborted,
							data: { taskId: args[0] as RooCodeEvents[TaskEventName.TaskAborted][0] },
						},
						origin: IpcOrigin.Server,
					})
					break
				case TaskEventName.TaskSpawned:
					this.ipc.broadcast({
						type: IpcMessageType.TaskEvent,
						data: {
							eventName: TaskEventName.TaskSpawned,
							data: {
								taskId: args[0] as RooCodeEvents[TaskEventName.TaskSpawned][0],
								childTaskId: args[1] as RooCodeEvents[TaskEventName.TaskSpawned][1],
							},
						},
						origin: IpcOrigin.Server,
					})
					break
				case TaskEventName.TaskCompleted:
					this.ipc.broadcast({
						type: IpcMessageType.TaskEvent,
						data: {
							eventName: TaskEventName.TaskCompleted,
							data: {
								taskId: args[0] as RooCodeEvents[TaskEventName.TaskCompleted][0],
								usage: args[1] as RooCodeEvents[TaskEventName.TaskCompleted][1],
							},
						},
						origin: IpcOrigin.Server,
					})
					break
				case TaskEventName.TaskTokenUsageUpdated:
					this.ipc.broadcast({
						type: IpcMessageType.TaskEvent,
						data: {
							eventName: TaskEventName.TaskTokenUsageUpdated,
							data: {
								taskId: args[0] as RooCodeEvents[TaskEventName.TaskTokenUsageUpdated][0],
								usage: args[1] as RooCodeEvents[TaskEventName.TaskTokenUsageUpdated][1],
							},
						},
						origin: IpcOrigin.Server,
					})
					break
			}
		}

		return super.emit(eventName, ...args)
	}

	public async startNewTask(text?: string, images?: string[]) {
		await this.provider.removeClineFromStack()
		await this.provider.postStateToWebview()
		await this.provider.postMessageToWebview({ type: "action", action: "chatButtonClicked" })
		await this.provider.postMessageToWebview({ type: "invoke", invoke: "newChat", text, images })

		const cline = await this.provider.initClineWithTask(text, images)
		return cline.taskId
	}

	public getCurrentTaskStack() {
		return this.provider.getCurrentTaskStack()
	}

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

	public getConfiguration() {
		return this.provider.getValues()
	}

	public getConfigurationValue<K extends keyof RooCodeSettings>(key: K) {
		return this.provider.getValue(key)
	}

	public async setConfiguration(values: RooCodeSettings) {
		await this.provider.setValues(values)
	}

	public async setConfigurationValue<K extends keyof RooCodeSettings>(key: K, value: RooCodeSettings[K]) {
		await this.provider.setValue(key, value)
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
