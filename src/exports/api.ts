import { EventEmitter } from "events"
import * as vscode from "vscode"

import { ClineProvider } from "../core/webview/ClineProvider"
import { openClineInNewTab } from "../activate/registerCommands"

import { RooCodeSettings, RooCodeEvents, RooCodeEventName, ClineMessage } from "../schemas"
import { IpcOrigin, IpcMessageType, TaskCommandName, TaskEvent } from "../schemas/ipc"
import { RooCodeAPI } from "./interface"
import { IpcServer } from "./ipc"
import { outputChannelLog } from "./log"

export class API extends EventEmitter<RooCodeEvents> implements RooCodeAPI {
	private readonly outputChannel: vscode.OutputChannel
	private readonly sidebarProvider: ClineProvider
	private tabProvider?: ClineProvider
	private readonly context: vscode.ExtensionContext
	private readonly ipc?: IpcServer
	private readonly taskMap = new Map<string, ClineProvider>()

	constructor(outputChannel: vscode.OutputChannel, provider: ClineProvider, socketPath?: string) {
		super()

		this.outputChannel = outputChannel
		this.sidebarProvider = provider
		this.context = provider.context

		this.registerListeners(this.sidebarProvider)

		if (socketPath) {
			const ipc = (this.ipc = new IpcServer(socketPath, (...args: unknown[]) =>
				outputChannelLog(this.outputChannel, ...args),
			))

			ipc.listen()
			this.log(`[API] ipc server started: socketPath=${socketPath}, pid=${process.pid}, ppid=${process.ppid}`)

			ipc.on(IpcMessageType.TaskCommand, async (_clientId, { commandName, data }) => {
				switch (commandName) {
					case TaskCommandName.StartNewTask:
						this.log(`[API] StartNewTask -> ${data.text}`)
						this.log(`[API] StartNewTask -> ${JSON.stringify(data.configuration)}`)

						try {
							await this.startNewTask(data)

							ipc.broadcast({
								type: IpcMessageType.TaskEvent,
								origin: IpcOrigin.Server,
								data: {
									eventName: RooCodeEventName.Message,
									payload: [
										{
											taskId: "[system]",
											action: "created",
											message: {
												ts: Date.now(),
												type: "say",
												text: `ACK: TaskCommand -> ${commandName}`,
											},
										},
									],
								},
							})
						} catch (error) {
							this.log(`[API] error starting new task: ${error}`)
						}

						break
					case TaskCommandName.CancelTask:
						this.log(`[API] CancelTask -> ${data}`)

						await this.cancelTask(data)

						ipc.broadcast({
							type: IpcMessageType.TaskEvent,
							origin: IpcOrigin.Server,
							data: {
								eventName: RooCodeEventName.Message,
								payload: [
									{
										taskId: "[system]",
										action: "created",
										message: {
											ts: Date.now(),
											type: "say",
											text: `ACK: CancelTask -> ${data}`,
										},
									},
								],
							},
						})

						break
				}
			})

			ipc.on(IpcMessageType.VSCodeCommand, async (_clientId, command) => {
				this.log(`[API] VSCodeCommand -> ${command}`)
				await vscode.commands.executeCommand(command)
			})
		}
	}

	public override emit<K extends keyof RooCodeEvents>(
		eventName: K,
		...args: K extends keyof RooCodeEvents ? RooCodeEvents[K] : never
	) {
		const data = { eventName: eventName as RooCodeEventName, payload: args } as TaskEvent
		this.ipc?.broadcast({ type: IpcMessageType.TaskEvent, origin: IpcOrigin.Server, data })
		return super.emit(eventName, ...args)
	}

	public async startNewTask({
		configuration,
		text,
		images,
		newTab,
	}: {
		configuration: RooCodeSettings
		text?: string
		images?: string[]
		newTab?: boolean
	}) {
		let provider: ClineProvider

		if (newTab) {
			await vscode.commands.executeCommand("workbench.action.closeAllEditors")

			if (!this.tabProvider) {
				this.tabProvider = await openClineInNewTab({ context: this.context, outputChannel: this.outputChannel })
				this.registerListeners(this.tabProvider)
			}

			provider = this.tabProvider
		} else {
			provider = this.sidebarProvider
		}

		if (configuration) {
			await provider.setValues(configuration)

			if (configuration.allowedCommands) {
				await vscode.workspace
					.getConfiguration("roo-cline")
					.update("allowedCommands", configuration.allowedCommands, vscode.ConfigurationTarget.Global)
			}
		}

		await provider.removeClineFromStack()
		await provider.postStateToWebview()
		await provider.postMessageToWebview({ type: "action", action: "chatButtonClicked" })
		await provider.postMessageToWebview({ type: "invoke", invoke: "newChat", text, images })

		const { taskId } = await provider.initClineWithTask(text, images)
		return taskId
	}

	public getCurrentTaskStack() {
		return this.sidebarProvider.getCurrentTaskStack()
	}

	public async clearCurrentTask(lastMessage?: string) {
		await this.sidebarProvider.finishSubTask(lastMessage)
	}

	public async cancelTask(taskId: string) {
		const provider = this.taskMap.get(taskId)

		if (provider) {
			await provider.cancelTask()
			this.taskMap.delete(taskId)
		}
	}

	public async cancelCurrentTask() {
		await this.sidebarProvider.cancelTask()
	}

	public async sendMessage(text?: string, images?: string[]) {
		await this.sidebarProvider.postMessageToWebview({ type: "invoke", invoke: "sendMessage", text, images })
	}

	public async pressPrimaryButton() {
		await this.sidebarProvider.postMessageToWebview({ type: "invoke", invoke: "primaryButtonClick" })
	}

	public async pressSecondaryButton() {
		await this.sidebarProvider.postMessageToWebview({ type: "invoke", invoke: "secondaryButtonClick" })
	}

	public getConfiguration() {
		return this.sidebarProvider.getValues()
	}

	public getConfigurationValue<K extends keyof RooCodeSettings>(key: K) {
		return this.sidebarProvider.getValue(key)
	}

	public async setConfiguration(values: RooCodeSettings) {
		await this.sidebarProvider.setValues(values)
	}

	public async setConfigurationValue<K extends keyof RooCodeSettings>(key: K, value: RooCodeSettings[K]) {
		await this.sidebarProvider.setValue(key, value)
	}

	public isReady() {
		return this.sidebarProvider.viewLaunched
	}

	public log(message: string) {
		this.outputChannel.appendLine(message)
		console.log(`${message}\n`)
	}

	private registerListeners(provider: ClineProvider) {
		provider.on("clineCreated", (cline) => {
			cline.on("taskStarted", () => {
				this.emit(RooCodeEventName.TaskStarted, cline.taskId)
				this.taskMap.set(cline.taskId, provider)
			})

			cline.on("message", (message) => this.emit(RooCodeEventName.Message, { taskId: cline.taskId, ...message }))

			cline.on("taskTokenUsageUpdated", (_, usage) =>
				this.emit(RooCodeEventName.TaskTokenUsageUpdated, cline.taskId, usage),
			)

			cline.on("taskAskResponded", () => this.emit(RooCodeEventName.TaskAskResponded, cline.taskId))

			cline.on("taskAborted", () => {
				this.emit(RooCodeEventName.TaskAborted, cline.taskId)
				this.taskMap.delete(cline.taskId)
			})

			cline.on("taskCompleted", (_, usage) => {
				this.emit(RooCodeEventName.TaskCompleted, cline.taskId, usage)
				this.taskMap.delete(cline.taskId)
			})

			cline.on("taskSpawned", (childTaskId) => this.emit(RooCodeEventName.TaskSpawned, cline.taskId, childTaskId))
			cline.on("taskPaused", () => this.emit(RooCodeEventName.TaskPaused, cline.taskId))
			cline.on("taskUnpaused", () => this.emit(RooCodeEventName.TaskUnpaused, cline.taskId))

			this.emit(RooCodeEventName.TaskCreated, cline.taskId)
		})
	}
}
