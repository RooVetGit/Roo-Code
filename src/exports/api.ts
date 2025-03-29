import { EventEmitter } from "events"
import * as vscode from "vscode"

import { ClineProvider } from "../core/webview/ClineProvider"
import { openClineInNewTab } from "../activate/registerCommands"

import { TokenUsage, RooCodeSettings, RooCodeEvents, RooCodeEventName } from "../schemas"
import { IpcOrigin, IpcMessageType, TaskCommandName, TaskEvent } from "../schemas/ipc"
import { RooCodeAPI } from "./interface"
import { MessageHistory } from "./message-history"
import { IpcServer } from "./ipc"

export class API extends EventEmitter<RooCodeEvents> implements RooCodeAPI {
	private readonly outputChannel: vscode.OutputChannel
	private provider: ClineProvider
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
			cline.on("message", (message) => this.emit(RooCodeEventName.Message, { taskId: cline.taskId, ...message }))
			cline.on("taskStarted", () => this.emit(RooCodeEventName.TaskStarted, cline.taskId))
			cline.on("taskPaused", () => this.emit(RooCodeEventName.TaskPaused, cline.taskId))
			cline.on("taskUnpaused", () => this.emit(RooCodeEventName.TaskUnpaused, cline.taskId))
			cline.on("taskAskResponded", () => this.emit(RooCodeEventName.TaskAskResponded, cline.taskId))
			cline.on("taskAborted", () => this.emit(RooCodeEventName.TaskAborted, cline.taskId))
			cline.on("taskSpawned", (childTaskId) => this.emit(RooCodeEventName.TaskSpawned, cline.taskId, childTaskId))
			cline.on("taskCompleted", (_, usage) => this.emit(RooCodeEventName.TaskCompleted, cline.taskId, usage))
			cline.on("taskTokenUsageUpdated", (_, usage) =>
				this.emit(RooCodeEventName.TaskTokenUsageUpdated, cline.taskId, usage),
			)
			this.emit(RooCodeEventName.TaskCreated, cline.taskId)
		})

		this.on(RooCodeEventName.Message, ({ taskId, action, message }) => {
			if (action === "created") {
				this.history.add(taskId, message)
			} else if (action === "updated") {
				this.history.update(taskId, message)
			}
		})

		this.on(RooCodeEventName.TaskTokenUsageUpdated, (taskId, usage) => (this.tokenUsage[taskId] = usage))

		if (socketPath) {
			this.ipc = new IpcServer(socketPath)
			this.ipc.listen()
			this.outputChannel.appendLine(`IPC server started: ${socketPath}`)

			this.ipc.on("taskCommand", async (_clientId, command) => {
				switch (command.commandName) {
					case TaskCommandName.GetSettings:
						this.getConfiguration()
						break
					case TaskCommandName.PutSettings:
						this.setConfiguration(command.data)
						break
					case TaskCommandName.StartNewTask:
						this.setConfiguration({
							apiProvider: "openrouter",
							openRouterModelId: "anthropic/claude-3.7-sonnet",
							openRouterModelInfo: {
								maxTokens: 8192,
								contextWindow: 200000,
								supportsImages: true,
								supportsComputerUse: true,
								supportsPromptCache: true,
								inputPrice: 3,
								outputPrice: 15,
								cacheWritesPrice: 3.75,
								cacheReadsPrice: 0.3,
								description:
									"Claude 3.7 Sonnet is an advanced large language model with improved reasoning, coding, and problem-solving capabilities. It introduces a hybrid reasoning approach, allowing users to choose between rapid responses and extended, step-by-step processing for complex tasks. The model demonstrates notable improvements in coding, particularly in front-end development and full-stack updates, and excels in agentic workflows, where it can autonomously navigate multi-step processes. \n\nClaude 3.7 Sonnet maintains performance parity with its predecessor in standard mode while offering an extended reasoning mode for enhanced accuracy in math, coding, and instruction-following tasks.\n\nRead more at the [blog post here](https://www.anthropic.com/news/claude-3-7-sonnet)",
								thinking: false,
							},

							pinnedApiConfigs: {},
							lastShownAnnouncementId: "mar-20-2025-3-10",

							autoApprovalEnabled: true,
							alwaysAllowReadOnly: true,
							alwaysAllowReadOnlyOutsideWorkspace: false,
							alwaysAllowWrite: true,
							alwaysAllowWriteOutsideWorkspace: false,
							writeDelayMs: 200,
							alwaysAllowBrowser: true,
							alwaysApproveResubmit: true,
							requestDelaySeconds: 5,
							alwaysAllowMcp: true,
							alwaysAllowModeSwitch: true,
							alwaysAllowSubtasks: true,
							alwaysAllowExecute: true,
							allowedCommands: ["*"],

							browserToolEnabled: false,
							browserViewportSize: "900x600",
							screenshotQuality: 38,
							remoteBrowserEnabled: true,

							enableCheckpoints: false,
							checkpointStorage: "task",

							ttsEnabled: false,
							ttsSpeed: 1,
							soundEnabled: false,
							soundVolume: 0.5,

							maxOpenTabsContext: 20,
							maxWorkspaceFiles: 200,
							showRooIgnoredFiles: true,
							maxReadFileLine: 500,

							terminalOutputLineLimit: 500,
							terminalShellIntegrationTimeout: 5000,

							rateLimitSeconds: 0,
							diffEnabled: true,
							fuzzyMatchThreshold: 1.0,
							experiments: {
								experimentalDiffStrategy: false, // unified diff
								multi_search_and_replace: false, // multi-line search and replace
								search_and_replace: true, // single-line search and replace
								insert_content: false,
								powerSteering: false,
							},

							language: "en",

							telemetrySetting: "enabled",

							mcpEnabled: false,
							mode: "code",
							customModes: [],
						})

						this.provider = await openClineInNewTab({
							context: this.provider.context,
							outputChannel: this.outputChannel,
						})

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
		const data = { eventName: eventName as RooCodeEventName, payload: args } as TaskEvent
		this.ipc?.broadcast({ type: IpcMessageType.TaskEvent, origin: IpcOrigin.Server, data })
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
