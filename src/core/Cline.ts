import { formatSearchResults } from "../services/ripgrep/index"
import { Anthropic } from "@anthropic-ai/sdk"
import cloneDeep from "clone-deep"
import { DiffStrategy, getDiffStrategy, UnifiedDiffStrategy } from "./diff/DiffStrategy"
import { validateToolUse, isToolAllowedForMode, ToolName } from "./mode-validator"
import delay from "delay"
import fs from "fs/promises"
import os from "os"
import pWaitFor from "p-wait-for"
import * as path from "path"
import { serializeError } from "serialize-error"
import * as vscode from "vscode"
import { ApiHandler, SingleCompletionHandler, buildApiHandler } from "../api"
import { ApiStream } from "../api/transform/stream"
import { DiffViewProvider } from "../integrations/editor/DiffViewProvider"
import { findToolName, formatContentBlockToMarkdown } from "../integrations/misc/export-markdown"
import {
	extractTextFromFile,
	addLineNumbers,
	stripLineNumbers,
	everyLineHasLineNumbers,
	truncateOutput,
} from "../integrations/misc/extract-text"
import { TerminalManager } from "../integrations/terminal/TerminalManager"
import { UrlContentFetcher } from "../services/browser/UrlContentFetcher"
import { listFiles } from "../services/glob/list-files"
import { regexSearchFiles } from "../services/ripgrep"
import { parseSourceCodeForDefinitionsTopLevel } from "../services/tree-sitter"
import { ApiConfiguration } from "../shared/api"
import { findLastIndex } from "../shared/array"
import { combineApiRequests } from "../shared/combineApiRequests"
import { combineCommandSequences } from "../shared/combineCommandSequences"
import {
	BrowserAction,
	BrowserActionResult,
	browserActions,
	ClineApiReqCancelReason,
	ClineApiReqInfo,
	ClineAsk,
	ClineAskUseMcpServer,
	ClineMessage,
	ClineSay,
	ClineSayBrowserAction,
	ClineSayTool,
} from "../shared/ExtensionMessage"
import { getApiMetrics } from "../shared/getApiMetrics"
import { HistoryItem } from "../shared/HistoryItem"
import { ClineAskResponse } from "../shared/WebviewMessage"
import { calculateApiCost } from "../utils/cost"
import { fileExistsAtPath } from "../utils/fs"
import { arePathsEqual, getReadablePath } from "../utils/path"
import { parseMentions } from "./mentions"
import { AssistantMessageContent, parseAssistantMessage, ToolParamName, ToolUseName } from "./assistant-message"
import { formatResponse } from "./prompts/responses"
import { SYSTEM_PROMPT } from "./prompts/system"
import { modes, defaultModeSlug, getModeBySlug } from "../shared/modes"
import { truncateConversationIfNeeded } from "./sliding-window"
import { ClineProvider, GlobalFileNames } from "./webview/ClineProvider"
import { detectCodeOmission } from "../integrations/editor/detect-omission"
import { BrowserSession } from "../services/browser/BrowserSession"
import { OpenRouterHandler } from "../api/providers/openrouter"
import { McpHub } from "../services/mcp/McpHub"
import crypto from "crypto"
import { insertGroups } from "./diff/insert-groups"
import { EXPERIMENT_IDS, experiments as Experiments } from "../shared/experiments"
const cwd =
	vscode.workspace.workspaceFolders?.map((folder) => folder.uri.fsPath).at(0) ?? path.join(os.homedir(), "Desktop")

type ToolResponse = string | Array<Anthropic.TextBlockParam | Anthropic.ImageBlockParam>
type UserContent = Array<
	Anthropic.TextBlockParam | Anthropic.ImageBlockParam | Anthropic.ToolUseBlockParam | Anthropic.ToolResultBlockParam
>
/**
 * Represents the core class for handling Cline-specific logic and interactions within the VS Code extension.
 * Manages API interactions, terminal processes, workspace tracking, and task lifecycle.
 *
 * @remarks
 * The `Cline` class is central to the Roo-Code extension, orchestrating communication with language models,
 * managing terminal instances for command execution, tracking workspace changes, and handling the lifecycle
 * of user tasks. It encapsulates the business logic for processing user requests, interacting with APIs,
 * and managing the state of a coding task.
 */
export class Cline {
	/**
	 * A unique identifier for the current task, ensuring proper context and separation between different user interactions.
	 */
	readonly taskId: string
	/**
	 * Handler for interacting with the chosen API provider, encapsulating API-specific logic and configurations.
	 */
	api: ApiHandler
	/**
	 * Manages terminal instances, allowing the execution of CLI commands within VS Code's integrated terminal.
	 */
	private terminalManager: TerminalManager
	/**
	 * Fetches content from URLs, enabling the extension to process and incorporate web-based information.
	 */
	private urlContentFetcher: UrlContentFetcher
	/**
	 * Manages browser sessions for web-based interactions, facilitating tasks that require browser automation.
	 */
	private browserSession: BrowserSession
	/**
	 * Flag indicating if a file has been edited during the current task, used to optimize terminal and diagnostics updates.
	 */
	private didEditFile: boolean = false
	/**
	 * User-defined custom instructions that provide additional context and guidance for the language model.
	 */
	customInstructions?: string
	/**
	 * Strategy for applying code diffs, allowing for different approaches based on model capabilities and user preferences.
	 */
	diffStrategy?: DiffStrategy
	/**
	 * Flag indicating whether diff functionality is enabled, influencing the tools and strategies available.
	 */
	diffEnabled: boolean = false
	/**
	 * Threshold for fuzzy matching algorithms, controlling the sensitivity of code similarity checks during diff applications.
	 */
	fuzzyMatchThreshold: number = 1.0
	/**
	 * History of API conversation turns, used to maintain context across multiple requests to the language model.
	 */
	apiConversationHistory: (Anthropic.MessageParam & { ts?: number })[] = []
	/**
	 * Messages exchanged within the Cline UI, representing the chat history and interactions presented to the user.
	 */
	clineMessages: ClineMessage[] = []
	/**
	 * Response from the webview to an 'ask' message, used to handle asynchronous communication flow.
	 */
	private askResponse?: ClineAskResponse
	/**
	 * Text response from the webview to an 'ask' message, part of the asynchronous communication handling.
	 */
	private askResponseText?: string
	/**
	 * Image responses from the webview to an 'ask' message, part of the asynchronous communication handling for visual content.
	 */
	private askResponseImages?: string[]
	/**
	 * Timestamp of the last message, used for tracking message timing and potential timeouts.
	 */
	private lastMessageTs?: number
	/**
	 * Counter for consecutive mistakes made by the language model, used to implement retry or fallback logic.
	 */
	private consecutiveMistakeCount: number = 0
	/**
	 * Map to track consecutive mistake counts for specific file paths during diff applications, used for granular error handling.
	 */
	private consecutiveMistakeCountForApplyDiff: Map<string, number> = new Map()
	/**
	 * Weak reference to the ClineProvider instance, allowing access to provider methods without creating strong circular dependencies.
	 */
	private providerRef: WeakRef<ClineProvider>
	/**
	 * Flag to signal abortion of the current task, used to interrupt long-running processes or requests.
	 */
	private abort: boolean = false
	/**
	 * Flag to indicate completion of the abortion process, ensuring proper cleanup and state management after task cancellation.
	 */
	didFinishAborting = false
	/**
	 * Flag to indicate if the task was abandoned, often used in error handling or cleanup scenarios.
	 */
	abandoned = false
	/**
	 * Provider for displaying diff views within VS Code, enabling users to review and accept code changes.
	 */
	private diffViewProvider: DiffViewProvider
	private lastApiRequestTime?: number

	/**
	 * Index of the current streaming content block, used to manage streaming output and UI updates.
	 */
	private currentStreamingContentIndex = 0
	/**
	 * Array to store the content blocks of the assistant's message during streaming, allowing for partial updates and structured content.
	 */
	private assistantMessageContent: AssistantMessageContent[] = []
	/**
	 * Lock to prevent concurrent updates to the assistant message presentation, ensuring UI consistency during streaming.
	 */
	private presentAssistantMessageLocked = false
	/**
	 * Flag to indicate if there are pending updates to the assistant message presentation, used to optimize UI updates during streaming.
	 */
	private presentAssistantMessageHasPendingUpdates = false
	/**
	 * Array to store the content blocks of the user's message, used for structured user input and context.
	 */
	private userMessageContent: (Anthropic.TextBlockParam | Anthropic.ImageBlockParam)[] = []
	/**
	 * Flag to indicate if the user message content is ready for processing, used for synchronization in asynchronous operations.
	 */
	private userMessageContentReady = false
	/**
	 * Flag to track if a tool was rejected by the user, influencing subsequent tool use and response generation.
	 */
	private didRejectTool = false
	/**
	 * Flag to track if a tool has already been used within the current message, limiting tool use to one per message.
	 */
	private didAlreadyUseTool = false
	/**
	 * Flag to indicate if the stream reading process is complete, used for managing the end of asynchronous API responses.
	 */
	private didCompleteReadingStream = false
	/**
	 * Constructor for the Cline class, initializing core functionalities and dependencies.
	 *
	 * @param provider - The ClineProvider instance managing the webview and extension context.
	 * @param apiConfiguration - Configuration for the API handler, specifying the provider and model to use.
	 * @param customInstructions - User-defined instructions to guide the language model's behavior.
	 * @param enableDiff - Flag to enable or disable diff functionality for code edits.
	 * @param fuzzyMatchThreshold - Threshold for fuzzy matching in diff operations.
	 * @param task - Initial task description provided by the user.
	 * @param images - Array of image data URIs for visual context in the task.
	 * @param historyItem - History item to resume a previous task, if available.
	 * @param experiments - Map of experiment IDs to their enabled state.
	 *
	 * @throws {Error} If neither historyItem nor task/images are provided for task initialization.
	 */
	constructor(
		provider: ClineProvider,
		apiConfiguration: ApiConfiguration,
		customInstructions?: string,
		enableDiff?: boolean,
		fuzzyMatchThreshold?: number,
		task?: string | undefined,
		images?: string[] | undefined,
		historyItem?: HistoryItem | undefined,
		experiments?: Record<string, boolean>,
	) {
		if (!task && !images && !historyItem) {
			throw new Error("Either historyItem or task/images must be provided")
		}

		this.taskId = crypto.randomUUID()
		this.api = buildApiHandler(apiConfiguration)
		this.terminalManager = new TerminalManager()
		this.urlContentFetcher = new UrlContentFetcher(provider.context)
		this.browserSession = new BrowserSession(provider.context)
		this.customInstructions = customInstructions
		this.diffEnabled = enableDiff ?? false
		this.fuzzyMatchThreshold = fuzzyMatchThreshold ?? 1.0
		this.providerRef = new WeakRef(provider)
		this.diffViewProvider = new DiffViewProvider(cwd)

		if (historyItem) {
			this.taskId = historyItem.id
		}

		this.updateDiffStrategy(Experiments.isEnabled(experiments ?? {}, EXPERIMENT_IDS.DIFF_STRATEGY))

		if (task || images) {
			this.startTask(task, images)
		} else if (historyItem) {
			this.resumeTaskFromHistory()
		}
	}

	/**
	 * Updates the diff strategy based on the experimental diff strategy setting.
	 *
	 * @param experimentalDiffStrategy - Optional boolean to force update based on experimental setting; if undefined, uses current state.
	 * @returns A promise that resolves when the diff strategy is updated.
	 */
	async updateDiffStrategy(experimentalDiffStrategy?: boolean) {
		if (experimentalDiffStrategy === undefined) {
			const { experiments: stateExperimental } = (await this.providerRef.deref()?.getState()) ?? {}
			experimentalDiffStrategy = stateExperimental?.[EXPERIMENT_IDS.DIFF_STRATEGY] ?? false
		}
		this.diffStrategy = getDiffStrategy(this.api.getModel().id, this.fuzzyMatchThreshold, experimentalDiffStrategy)
	}

	/**
	 * Asynchronously ensures that the task-specific directory exists within the global storage path.
	 *
	 * @returns A Promise that resolves to the path of the task directory.
	 * @throws {Error} If the global storage URI is invalid.
	 */
	private async ensureTaskDirectoryExists(): Promise<string> {
		const globalStoragePath = this.providerRef.deref()?.context.globalStorageUri.fsPath
		if (!globalStoragePath) {
			throw new Error("Global storage uri is invalid")
		}
		const taskDir = path.join(globalStoragePath, "tasks", this.taskId)
		await fs.mkdir(taskDir, { recursive: true })
		return taskDir
	}
	/**
	 * Asynchronously retrieves the API conversation history from a JSON file in the task directory.
	 *
	 * @returns A Promise that resolves to an array of Anthropic messages, representing the API conversation history.
	 */
	private async getSavedApiConversationHistory(): Promise<Anthropic.MessageParam[]> {
		const filePath = path.join(await this.ensureTaskDirectoryExists(), GlobalFileNames.apiConversationHistory)
		const fileExists = await fileExistsAtPath(filePath)
		if (fileExists) {
			return JSON.parse(await fs.readFile(filePath, "utf8"))
		}
		return []
	}
	/**
	 * Asynchronously adds a new message to the API conversation history and saves the updated history to file.
	 *
	 * @param message - The Anthropic message to add to the conversation history.
	 */
	private async addToApiConversationHistory(message: Anthropic.MessageParam) {
		const messageWithTs = { ...message, ts: Date.now() }
		this.apiConversationHistory.push(messageWithTs)
		await this.saveApiConversationHistory()
	}
	/**
	 * Overwrites the current API conversation history with a new history and saves it to file.
	 *
	 * @param newHistory - The new array of Anthropic messages to replace the existing history.
	 */
	async overwriteApiConversationHistory(newHistory: Anthropic.MessageParam[]) {
		this.apiConversationHistory = newHistory
		await this.saveApiConversationHistory()
	}
	/**
	 * Asynchronously saves the current API conversation history to a JSON file in the task directory.
	 */
	private async saveApiConversationHistory() {
		try {
			const filePath = path.join(await this.ensureTaskDirectoryExists(), GlobalFileNames.apiConversationHistory)
			await fs.writeFile(filePath, JSON.stringify(this.apiConversationHistory))
		} catch (error) {
			console.error("Failed to save API conversation history:", error)
		}
	}
	/**
	 * Asynchronously retrieves the Cline UI messages from a JSON file in the task directory.
	 *
	 * @returns A Promise that resolves to an array of ClineMessage objects, representing the UI message history.
	 */
	private async getSavedClineMessages(): Promise<ClineMessage[]> {
		const filePath = path.join(await this.ensureTaskDirectoryExists(), GlobalFileNames.uiMessages)
		if (await fileExistsAtPath(filePath)) {
			return JSON.parse(await fs.readFile(filePath, "utf8"))
		} else {
			const oldPath = path.join(await this.ensureTaskDirectoryExists(), "claude_messages.json")
			if (await fileExistsAtPath(oldPath)) {
				const data = JSON.parse(await fs.readFile(oldPath, "utf8"))
				await fs.unlink(oldPath)
				return data
			}
		}
		return []
	}
	/**
	 * Asynchronously adds a new message to the Cline UI messages and saves the updated messages to file.
	 *
	 * @param message - The ClineMessage to add to the UI message history.
	 */
	private async addToClineMessages(message: ClineMessage) {
		// Token counting is handled by getApiMetrics.ts
		this.clineMessages.push(message)
		await this.saveClineMessages()
	}
	/**
	 * Overwrites the current Cline UI messages with new messages and saves them to file.
	 *
	 * @param newMessages - The new array of ClineMessage objects to replace the existing UI messages.
	 */
	public async overwriteClineMessages(newMessages: ClineMessage[]) {
		this.clineMessages = newMessages
		await this.saveClineMessages()
	}
	/**
	 * Asynchronously saves the current Cline UI messages to a JSON file in the task directory.
	 */
	private async saveClineMessages() {
		try {
			const filePath = path.join(await this.ensureTaskDirectoryExists(), GlobalFileNames.uiMessages)
			await fs.writeFile(filePath, JSON.stringify(this.clineMessages))

			const apiMetrics = getApiMetrics(combineApiRequests(combineCommandSequences(this.clineMessages.slice(1))))
			const taskMessage = this.clineMessages[0]
			const lastRelevantMessage =
				this.clineMessages[
					findLastIndex(
						this.clineMessages,
						(m) => !(m.ask === "resume_task" || m.ask === "resume_completed_task"),
					)
				]
			await this.providerRef.deref()?.updateTaskHistory({
				id: this.taskId,
				ts: lastRelevantMessage.ts,
				task: taskMessage.text ?? "",
				tokensIn: apiMetrics.totalTokensIn,
				tokensOut: apiMetrics.totalTokensOut,
				cacheWrites: apiMetrics.totalCacheWrites,
				cacheReads: apiMetrics.totalCacheReads,
				totalCost: apiMetrics.totalCost,
			})
		} catch (error) {
			console.error("Failed to save cline messages:", error)
		}
	}

	/**
	 * Sends an 'ask' type message to the webview and waits for a response.
	 *
	 * @param type - The type of ask message (e.g., 'followup', 'command').
	 * @param text - The text content of the ask message.
	 * @param partial - Optional boolean indicating if the message is partial (for streaming).
	 *
	 * @returns A Promise that resolves to an object containing the webview's ClineAskResponse and optional text/images.
	 * @throws {Error} If the Roo Code instance is aborted or the current ask promise is ignored due to concurrent asks.
	 */
	async ask(
		type: ClineAsk,
		text?: string,
		partial?: boolean,
	): Promise<{ response: ClineAskResponse; text?: string; images?: string[] }> {
		if (this.abort) {
			throw new Error("Roo Code instance aborted")
		}
		let askTs: number
		if (partial !== undefined) {
			const lastMessage = this.clineMessages.at(-1)
			const isUpdatingPreviousPartial =
				lastMessage && lastMessage.partial && lastMessage.type === "ask" && lastMessage.ask === type
			if (partial) {
				if (isUpdatingPreviousPartial) {
					lastMessage.text = text
					lastMessage.partial = partial

					await this.providerRef
						.deref()
						?.postMessageToWebview({ type: "partialMessage", partialMessage: lastMessage })
					throw new Error("Current ask promise was ignored 1")
				} else {
					askTs = Date.now()
					this.lastMessageTs = askTs
					await this.addToClineMessages({ ts: askTs, type: "ask", ask: type, text, partial })
					await this.providerRef.deref()?.postStateToWebview()
					throw new Error("Current ask promise was ignored 2")
				}
			} else {
				if (isUpdatingPreviousPartial) {
					this.askResponse = undefined
					this.askResponseText = undefined
					this.askResponseImages = undefined
					askTs = lastMessage.ts
					this.lastMessageTs = askTs

					lastMessage.text = text
					lastMessage.partial = false
					await this.saveClineMessages()

					await this.providerRef
						.deref()
						?.postMessageToWebview({ type: "partialMessage", partialMessage: lastMessage })
				} else {
					this.askResponse = undefined
					this.askResponseText = undefined
					this.askResponseImages = undefined
					askTs = Date.now()
					this.lastMessageTs = askTs
					await this.addToClineMessages({ ts: askTs, type: "ask", ask: type, text })
					await this.providerRef.deref()?.postStateToWebview()
				}
			}
		} else {
			this.askResponse = undefined
			this.askResponseText = undefined
			this.askResponseImages = undefined
			askTs = Date.now()
			this.lastMessageTs = askTs
			await this.addToClineMessages({ ts: askTs, type: "ask", ask: type, text })
			await this.providerRef.deref()?.postStateToWebview()
		}

		await pWaitFor(() => this.askResponse !== undefined || this.lastMessageTs !== askTs, { interval: 100 })
		if (this.lastMessageTs !== askTs) {
			throw new Error("Current ask promise was ignored")
		}
		const result = { response: this.askResponse!, text: this.askResponseText, images: this.askResponseImages }
		this.askResponse = undefined
		this.askResponseText = undefined
		this.askResponseImages = undefined
		return result
	}
	/**
	 * Handles the ask response from the webview, resolving the pending ask promise.
	 *
	 * @param askResponse - The ClineAskResponse from the webview.
	 * @param text - Optional text content of the response.
	 * @param images - Optional array of image data URIs in the response.
	 */
	async handleWebviewAskResponse(askResponse: ClineAskResponse, text?: string, images?: string[]) {
		this.askResponse = askResponse
		this.askResponseText = text
		this.askResponseImages = images
	}
	/**
	 * Sends a 'say' type message to the webview to display information to the user.
	 *
	 * @param type - The type of say message (e.g., 'task', 'error', 'text').
	 * @param text - The text content of the say message.
	 * @param images - Optional array of image data URIs for visual content.
	 * @param partial - Optional boolean indicating if the message is partial (for streaming).
	 *
	 * @returns A Promise that resolves when the message is posted to the webview.
	 * @throws {Error} If the Roo Code instance is aborted.
	 */
	async say(type: ClineSay, text?: string, images?: string[], partial?: boolean): Promise<undefined> {
		if (this.abort) {
			throw new Error("Roo Code instance aborted")
		}

		if (partial !== undefined) {
			const lastMessage = this.clineMessages.at(-1)
			const isUpdatingPreviousPartial =
				lastMessage && lastMessage.partial && lastMessage.type === "say" && lastMessage.say === type
			if (partial) {
				if (isUpdatingPreviousPartial) {
					lastMessage.text = text
					lastMessage.images = images
					lastMessage.partial = partial
					await this.providerRef
						.deref()
						?.postMessageToWebview({ type: "partialMessage", partialMessage: lastMessage })
				} else {
					const sayTs = Date.now()
					this.lastMessageTs = sayTs
					await this.addToClineMessages({ ts: sayTs, type: "say", say: type, text, images, partial })
					await this.providerRef.deref()?.postStateToWebview()
				}
			} else {
				if (isUpdatingPreviousPartial) {
					this.lastMessageTs = lastMessage.ts

					lastMessage.text = text
					lastMessage.images = images
					lastMessage.partial = false

					await this.saveClineMessages()

					await this.providerRef
						.deref()
						?.postMessageToWebview({ type: "partialMessage", partialMessage: lastMessage })
				} else {
					const sayTs = Date.now()
					this.lastMessageTs = sayTs
					await this.addToClineMessages({ ts: sayTs, type: "say", say: type, text, images })
					await this.providerRef.deref()?.postStateToWebview()
				}
			}
		} else {
			const sayTs = Date.now()
			this.lastMessageTs = sayTs
			await this.addToClineMessages({ ts: sayTs, type: "say", say: type, text, images })
			await this.providerRef.deref()?.postStateToWebview()
		}
	}
	/**
	 * Sends an 'error' type message to the webview indicating a missing parameter and prompts the user to retry.
	 *
	 * @param toolName - The name of the tool that encountered the missing parameter.
	 * @param paramName - The name of the missing parameter.
	 * @param relPath - Optional relative file path, if applicable to the tool and parameter.
	 * @returns A Promise that resolves to a formatted tool error response.
	 */
	async sayAndCreateMissingParamError(toolName: ToolUseName, paramName: string, relPath?: string) {
		await this.say(
			"error",
			`Roo tried to use ${toolName}${
				relPath ? ` for '${relPath.toPosix()}'` : ""
			} without value for required parameter '${paramName}'. Retrying...`,
		)
		return formatResponse.toolError(formatResponse.missingToolParameterError(paramName))
	}

	/**
	 * Initiates a new task, clearing previous state and starting a new conversation with the language model.
	 *
	 * @param task - Optional initial task message to start the conversation.
	 * @param images - Optional array of image data URIs for initial visual context.
	 */
	private async startTask(task?: string, images?: string[]): Promise<void> {
		this.clineMessages = []
		this.apiConversationHistory = []
		await this.providerRef.deref()?.postStateToWebview()

		await this.say("text", task, images)

		let imageBlocks: Anthropic.ImageBlockParam[] = formatResponse.imageBlocks(images)
		await this.initiateTaskLoop([
			{
				type: "text",
				text: `<task>\n${task}\n</task>`,
			},
			...imageBlocks,
		])
	}
	/**
	 * Resumes a task from a history item, restoring the conversation history and task state from a previous session.
	 */
	private async resumeTaskFromHistory() {
		const modifiedClineMessages = await this.getSavedClineMessages()

		const lastRelevantMessageIndex = findLastIndex(
			modifiedClineMessages,
			(m) => !(m.ask === "resume_task" || m.ask === "resume_completed_task"),
		)
		if (lastRelevantMessageIndex !== -1) {
			modifiedClineMessages.splice(lastRelevantMessageIndex + 1)
		}

		const lastApiReqStartedIndex = findLastIndex(
			modifiedClineMessages,
			(m) => m.type === "say" && m.say === "api_req_started",
		)
		if (lastApiReqStartedIndex !== -1) {
			const lastApiReqStarted = modifiedClineMessages[lastApiReqStartedIndex]
			const { cost, cancelReason }: ClineApiReqInfo = JSON.parse(lastApiReqStarted.text || "{}")
			if (cost === undefined && cancelReason === undefined) {
				modifiedClineMessages.splice(lastApiReqStartedIndex, 1)
			}
		}

		await this.overwriteClineMessages(modifiedClineMessages)
		this.clineMessages = await this.getSavedClineMessages()

		let existingApiConversationHistory: Anthropic.Messages.MessageParam[] =
			await this.getSavedApiConversationHistory()

		const lastClineMessage = this.clineMessages
			.slice()
			.reverse()
			.find((m) => !(m.ask === "resume_task" || m.ask === "resume_completed_task"))

		let askType: ClineAsk
		if (lastClineMessage?.ask === "completion_result") {
			askType = "resume_completed_task"
		} else {
			askType = "resume_task"
		}

		const { response, text, images } = await this.ask(askType)
		let responseText: string | undefined
		let responseImages: string[] | undefined
		if (response === "messageResponse") {
			await this.say("user_feedback", text, images)
			responseText = text
			responseImages = images
		}

		const conversationWithoutToolBlocks = existingApiConversationHistory.map((message) => {
			if (Array.isArray(message.content)) {
				const newContent = message.content.map((block) => {
					if (block.type === "tool_use") {
						const inputAsXml = Object.entries(block.input as Record<string, string>)
							.map(([key, value]) => `<${key}>\n${value}\n</${key}>`)
							.join("\n")
						return {
							type: "text",
							text: `<${block.name}>\n${inputAsXml}\n</${block.name}>`,
						} as Anthropic.Messages.TextBlockParam
					} else if (block.type === "tool_result") {
						const contentAsTextBlocks = Array.isArray(block.content)
							? block.content.filter((item) => item.type === "text")
							: [{ type: "text", text: block.content }]
						const textContent = contentAsTextBlocks.map((item) => item.text).join("\n\n")
						const toolName = findToolName(block.tool_use_id, existingApiConversationHistory)
						return {
							type: "text",
							text: `[${toolName} Result]\n\n${textContent}`,
						} as Anthropic.Messages.TextBlockParam
					}
					return block
				})
				return { ...message, content: newContent }
			}
			return message
		})
		existingApiConversationHistory = conversationWithoutToolBlocks

		let modifiedOldUserContent: UserContent
		let modifiedApiConversationHistory: Anthropic.Messages.MessageParam[]
		if (existingApiConversationHistory.length > 0) {
			const lastMessage = existingApiConversationHistory[existingApiConversationHistory.length - 1]

			if (lastMessage.role === "assistant") {
				const content = Array.isArray(lastMessage.content)
					? lastMessage.content
					: [{ type: "text", text: lastMessage.content }]
				const hasToolUse = content.some((block) => block.type === "tool_use")

				if (hasToolUse) {
					const toolUseBlocks = content.filter(
						(block) => block.type === "tool_use",
					) as Anthropic.Messages.ToolUseBlock[]
					const toolResponses: Anthropic.ToolResultBlockParam[] = toolUseBlocks.map((block) => ({
						type: "tool_result",
						tool_use_id: block.id,
						content: "Task was interrupted before this tool call could be completed.",
					}))
					modifiedApiConversationHistory = [...existingApiConversationHistory]
					modifiedOldUserContent = [...toolResponses]
				} else {
					modifiedApiConversationHistory = [...existingApiConversationHistory]
					modifiedOldUserContent = []
				}
			} else if (lastMessage.role === "user") {
				const previousAssistantMessage: Anthropic.Messages.MessageParam | undefined =
					existingApiConversationHistory[existingApiConversationHistory.length - 2]

				const existingUserContent: UserContent = Array.isArray(lastMessage.content)
					? lastMessage.content
					: [{ type: "text", text: lastMessage.content }]
				if (previousAssistantMessage && previousAssistantMessage.role === "assistant") {
					const assistantContent = Array.isArray(previousAssistantMessage.content)
						? previousAssistantMessage.content
						: [{ type: "text", text: previousAssistantMessage.content }]

					const toolUseBlocks = assistantContent.filter(
						(block) => block.type === "tool_use",
					) as Anthropic.Messages.ToolUseBlock[]

					if (toolUseBlocks.length > 0) {
						const existingToolResults = existingUserContent.filter(
							(block) => block.type === "tool_result",
						) as Anthropic.ToolResultBlockParam[]

						const missingToolResponses: Anthropic.ToolResultBlockParam[] = toolUseBlocks
							.filter(
								(toolUse) => !existingToolResults.some((result) => result.tool_use_id === toolUse.id),
							)
							.map((toolUse) => ({
								type: "tool_result",
								tool_use_id: toolUse.id,
								content: "Task was interrupted before this tool call could be completed.",
							}))

						modifiedApiConversationHistory = existingApiConversationHistory.slice(0, -1)
						modifiedOldUserContent = [...existingUserContent, ...missingToolResponses]
					} else {
						modifiedApiConversationHistory = existingApiConversationHistory.slice(0, -1)
						modifiedOldUserContent = [...existingUserContent]
					}
				} else {
					modifiedApiConversationHistory = existingApiConversationHistory.slice(0, -1)
					modifiedOldUserContent = [...existingUserContent]
				}
			} else {
				throw new Error("Unexpected: Last message is not a user or assistant message")
			}
		} else {
			throw new Error("Unexpected: No existing API conversation history")
		}

		let newUserContent: UserContent = [...modifiedOldUserContent]

		const agoText = ((): string => {
			const timestamp = lastClineMessage?.ts ?? Date.now()
			const now = Date.now()
			const diff = now - timestamp
			const minutes = Math.floor(diff / 60000)
			const hours = Math.floor(minutes / 60)
			const days = Math.floor(hours / 24)

			if (days > 0) {
				return `${days} day${days > 1 ? "s" : ""} ago`
			}
			if (hours > 0) {
				return `${hours} hour${hours > 1 ? "s" : ""} ago`
			}
			if (minutes > 0) {
				return `${minutes} minute${minutes > 1 ? "s" : ""} ago`
			}
			return "just now"
		})()

		const wasRecent = lastClineMessage?.ts && Date.now() - lastClineMessage.ts < 30_000

		newUserContent.push({
			type: "text",
			text:
				`[TASK RESUMPTION] This task was interrupted ${agoText}. It may or may not be complete, so please reassess the task context. Be aware that the project state may have changed since then. The current working directory is now '${cwd.toPosix()}'. If the task has not been completed, retry the last step before interruption and proceed with completing the task.\n\nNote: If you previously attempted a tool use that the user did not provide a result for, you should assume the tool use was not successful and assess whether you should retry. If the last tool was a browser_action, the browser has been closed and you must launch a new browser if needed.${
					wasRecent
						? "\n\nIMPORTANT: If the last tool use was a write_to_file that was interrupted, the file was reverted back to its original state before the interrupted edit, and you do NOT need to re-read the file as you already have its up-to-date contents."
						: ""
				}` +
				(responseText
					? `\n\nNew instructions for task continuation:\n<user_message>\n${responseText}\n</user_message>`
					: ""),
		})

		if (responseImages && responseImages.length > 0) {
			newUserContent.push(...formatResponse.imageBlocks(responseImages))
		}

		await this.overwriteApiConversationHistory(modifiedApiConversationHistory)
		await this.initiateTaskLoop(newUserContent)
	}
	/**
	 * Initiates the main task execution loop, iteratively processing user requests and tool responses.
	 *
	 * @param userContent - Initial user content blocks to start the task loop.
	 */
	private async initiateTaskLoop(userContent: UserContent): Promise<void> {
		let nextUserContent = userContent
		let includeFileDetails = true
		while (!this.abort) {
			const didEndLoop = await this.recursivelyMakeClineRequests(nextUserContent, includeFileDetails)
			includeFileDetails = false

			if (didEndLoop) {
				break
			} else {
				nextUserContent = [
					{
						type: "text",
						text: formatResponse.noToolsUsed(),
					},
				]
				this.consecutiveMistakeCount++
			}
		}
	}
	/**
	 * Aborts the current task, terminating any active processes and cleaning up resources.
	 */
	abortTask() {
		this.abort = true
		this.terminalManager.disposeAll()
		this.urlContentFetcher.closeBrowser()
		this.browserSession.closeBrowser()
	}

	/**
	 * Executes a CLI command using the terminal manager and handles command output streaming and completion.
	 *
	 * @param command - The CLI command to execute.
	 * @returns A Promise that resolves to a tuple containing a boolean indicating user feedback and the tool response string.
	 */
	async executeCommandTool(command: string): Promise<[boolean, ToolResponse]> {
		const terminalInfo = await this.terminalManager.getOrCreateTerminal(cwd)
		terminalInfo.terminal.show()
		const process = this.terminalManager.runCommand(terminalInfo, command)

		let userFeedback: { text?: string; images?: string[] } | undefined
		let didContinue = false
		const sendCommandOutput = async (line: string): Promise<void> => {
			try {
				const { response, text, images } = await this.ask("command_output", line)
				if (response === "yesButtonClicked") {
				} else {
					userFeedback = { text, images }
				}
				didContinue = true
				process.continue()
			} catch {}
		}

		let lines: string[] = []
		process.on("line", (line) => {
			lines.push(line)
			if (!didContinue) {
				sendCommandOutput(line)
			} else {
				this.say("command_output", line)
			}
		})

		let completed = false
		process.once("completed", () => {
			completed = true
		})

		process.once("no_shell_integration", () => {
			this.say("shell_integration_warning").catch((error) => {
				console.error("Error in shell integration warning:", error)
			})
		})

		await process

		await delay(50)

		const { terminalOutputLineLimit } = (await this.providerRef.deref()?.getState()) ?? {}
		const output = truncateOutput(lines.join("\n"), terminalOutputLineLimit)
		const result = output.trim()

		if (userFeedback) {
			await this.say("user_feedback", userFeedback.text, userFeedback.images)
			return [
				true,
				formatResponse.toolResult(
					`Command is still running in the user's terminal.${
						result.length > 0 ? `\nHere's the output so far:\n${result}` : ""
					}\n\nThe user provided the following feedback:\n<feedback>\n${userFeedback.text}\n</feedback>`,
					userFeedback.images,
				),
			]
		}

		if (completed) {
			return [false, `Command executed.${result.length > 0 ? `\nOutput:\n${result}` : ""}`]
		} else {
			return [
				false,
				`Command is still running in the user's terminal.${
					result.length > 0 ? `\nHere's the output so far:\n${result}` : ""
				}\n\nYou will be updated on the terminal status and new output in the future.`,
			]
		}
	}

	async *attemptApiRequest(previousApiReqIndex: number, retryAttempt: number = 0): ApiStream {
		let mcpHub: McpHub | undefined

		const { mcpEnabled, alwaysApproveResubmit, requestDelaySeconds, rateLimitSeconds } =
			(await this.providerRef.deref()?.getState()) ?? {}

		let finalDelay = 0

		// Only apply rate limiting if this isn't the first request
		if (this.lastApiRequestTime) {
			const now = Date.now()
			const timeSinceLastRequest = now - this.lastApiRequestTime
			const rateLimit = rateLimitSeconds || 0
			const rateLimitDelay = Math.max(0, rateLimit * 1000 - timeSinceLastRequest)
			finalDelay = rateLimitDelay
		}

		// Add exponential backoff delay for retries
		if (retryAttempt > 0) {
			const baseDelay = requestDelaySeconds || 5
			const exponentialDelay = Math.ceil(baseDelay * Math.pow(2, retryAttempt)) * 1000
			finalDelay = Math.max(finalDelay, exponentialDelay)
		}

		if (finalDelay > 0) {
			// Show countdown timer
			for (let i = Math.ceil(finalDelay / 1000); i > 0; i--) {
				const delayMessage =
					retryAttempt > 0 ? `Retrying in ${i} seconds...` : `Rate limiting for ${i} seconds...`
				await this.say("api_req_retry_delayed", delayMessage, undefined, true)
				await delay(1000)
			}
		}

		// Update last request time before making the request
		this.lastApiRequestTime = Date.now()

		if (mcpEnabled ?? true) {
			mcpHub = this.providerRef.deref()?.mcpHub
			if (!mcpHub) {
				throw new Error("MCP hub not available")
			}

			await pWaitFor(() => mcpHub!.isConnecting !== true, { timeout: 10_000 }).catch(() => {
				console.error("MCP servers failed to connect in time")
			})
		}

		const { browserViewportSize, mode, customModePrompts, preferredLanguage, experiments } =
			(await this.providerRef.deref()?.getState()) ?? {}
		const { customModes } = (await this.providerRef.deref()?.getState()) ?? {}
		const systemPrompt = await (async () => {
			const provider = this.providerRef.deref()
			if (!provider) {
				throw new Error("Provider not available")
			}
			return SYSTEM_PROMPT(
				provider.context,
				cwd,
				this.api.getModel().info.supportsComputerUse ?? false,
				mcpHub,
				this.diffStrategy,
				browserViewportSize,
				mode,
				customModePrompts,
				customModes,
				this.customInstructions,
				preferredLanguage,
				this.diffEnabled,
				experiments,
			)
		})()

		if (previousApiReqIndex >= 0) {
			const previousRequest = this.clineMessages[previousApiReqIndex]?.text
			if (!previousRequest) return

			const {
				tokensIn = 0,
				tokensOut = 0,
				cacheWrites = 0,
				cacheReads = 0,
			}: ClineApiReqInfo = JSON.parse(previousRequest)
			const totalTokens = tokensIn + tokensOut + cacheWrites + cacheReads

			const trimmedMessages = truncateConversationIfNeeded(
				this.apiConversationHistory,
				totalTokens,
				this.api.getModel().info,
			)

			if (trimmedMessages !== this.apiConversationHistory) {
				await this.overwriteApiConversationHistory(trimmedMessages)
			}
		}

		const cleanConversationHistory = this.apiConversationHistory.map(({ role, content }) => {
			if (Array.isArray(content)) {
				if (!this.api.getModel().info.supportsImages) {
					content = content.map((block) => {
						if (block.type === "image") {
							return {
								type: "text",
								text: "[Referenced image in conversation]",
							}
						}
						return block
					})
				}
			}
			return { role, content }
		})
		const stream = this.api.createMessage(systemPrompt, cleanConversationHistory)
		const iterator = stream[Symbol.asyncIterator]()

		try {
			const firstChunk = await iterator.next()
			yield firstChunk.value
		} catch (error) {
			if (alwaysApproveResubmit) {
				const errorMsg = error.message ?? "Unknown error"
				const baseDelay = requestDelaySeconds || 5
				const exponentialDelay = Math.ceil(baseDelay * Math.pow(2, retryAttempt))

				for (let i = exponentialDelay; i > 0; i--) {
					await this.say(
						"api_req_retry_delayed",
						`${errorMsg}\n\nRetry attempt ${retryAttempt + 1}\nRetrying in ${i} seconds...`,
						undefined,
						true,
					)
					await delay(1000)
				}

				await this.say(
					"api_req_retry_delayed",
					`${errorMsg}\n\nRetry attempt ${retryAttempt + 1}\nRetrying now...`,
					undefined,
					false,
				)

				yield* this.attemptApiRequest(previousApiReqIndex, retryAttempt + 1)
				return
			} else {
				const { response } = await this.ask(
					"api_req_failed",
					error.message ?? JSON.stringify(serializeError(error), null, 2),
				)
				if (response !== "yesButtonClicked") {
					throw new Error("API request failed")
				}
				await this.say("api_req_retried")

				yield* this.attemptApiRequest(previousApiReqIndex)
				return
			}
		}

		yield* iterator
	}
	/**
	 * Presents the assistant's message content to the user via the webview, handling different content block types and partial updates.
	 */
	async presentAssistantMessage() {
		if (this.abort) {
			throw new Error("Roo Code instance aborted")
		}

		if (this.presentAssistantMessageLocked) {
			this.presentAssistantMessageHasPendingUpdates = true
			return
		}
		this.presentAssistantMessageLocked = true
		this.presentAssistantMessageHasPendingUpdates = false

		if (this.currentStreamingContentIndex >= this.assistantMessageContent.length) {
			if (this.didCompleteReadingStream) {
				this.userMessageContentReady = true
			}

			this.presentAssistantMessageLocked = false
			return
		}

		const block = cloneDeep(this.assistantMessageContent[this.currentStreamingContentIndex])
		switch (block.type) {
			case "text": {
				if (this.didRejectTool || this.didAlreadyUseTool) {
					break
				}
				let content = block.content
				if (content) {
					content = content.replace(/<thinking>\s?/g, "")
					content = content.replace(/\s?<\/thinking>/g, "")

					const lastOpenBracketIndex = content.lastIndexOf("<")
					if (lastOpenBracketIndex !== -1) {
						const possibleTag = content.slice(lastOpenBracketIndex)

						const hasCloseBracket = possibleTag.includes(">")
						if (!hasCloseBracket) {
							let tagContent: string
							if (possibleTag.startsWith("</")) {
								tagContent = possibleTag.slice(2).trim()
							} else {
								tagContent = possibleTag.slice(1).trim()
							}

							const isLikelyTagName = /^[a-zA-Z_]+$/.test(tagContent)

							const isOpeningOrClosing = possibleTag === "<" || possibleTag === "</"

							if (isOpeningOrClosing || isLikelyTagName) {
								content = content.slice(0, lastOpenBracketIndex).trim()
							}
						}
					}
				}
				await this.say("text", content, undefined, block.partial)
				break
			}
			case "tool_use":
				const toolDescription = (): string => {
					switch (block.name) {
						case "execute_command":
							return `[${block.name} for '${block.params.command}']`
						case "read_file":
							return `[${block.name} for '${block.params.path}']`
						case "write_to_file":
							return `[${block.name} for '${block.params.path}']`
						case "apply_diff":
							return `[${block.name} for '${block.params.path}']`
						case "search_files":
							return `[${block.name} for '${block.params.regex}'${
								block.params.file_pattern ? ` in '${block.params.file_pattern}'` : ""
							}]`
						case "insert_content":
							return `[${block.name} for '${block.params.path}']`
						case "search_and_replace":
							return `[${block.name} for '${block.params.path}']`
						case "list_files":
							return `[${block.name} for '${block.params.path}']`
						case "list_code_definition_names":
							return `[${block.name} for '${block.params.path}']`
						case "browser_action":
							return `[${block.name} for '${block.params.action}']`
						case "use_mcp_tool":
							return `[${block.name} for '${block.params.server_name}']`
						case "access_mcp_resource":
							return `[${block.name} for '${block.params.server_name}']`
						case "ask_followup_question":
							return `[${block.name} for '${block.params.question}']`
						case "attempt_completion":
							return `[${block.name}]`
						case "switch_mode":
							return `[${block.name} to '${block.params.mode_slug}'${block.params.reason ? ` because: ${block.params.reason}` : ""}]`
						case "new_task": {
							const mode = block.params.mode ?? defaultModeSlug
							const message = block.params.message ?? "(no message)"
							const modeName = getModeBySlug(mode, customModes)?.name ?? mode
							return `[${block.name} in ${modeName} mode: '${message}']`
						}
					}
				}

				if (this.didRejectTool) {
					if (!block.partial) {
						this.userMessageContent.push({
							type: "text",
							text: `Skipping tool ${toolDescription()} due to user rejecting a previous tool.`,
						})
					} else {
						this.userMessageContent.push({
							type: "text",
							text: `Tool ${toolDescription()} was interrupted and not executed due to user rejecting a previous tool.`,
						})
					}
					break
				}

				if (this.didAlreadyUseTool) {
					this.userMessageContent.push({
						type: "text",
						text: `Tool [${block.name}] was not executed because a tool has already been used in this message. Only one tool may be used per message. You must assess the first tool's result before proceeding to use the next tool.`,
					})
					break
				}

				const pushToolResult = (content: ToolResponse) => {
					this.userMessageContent.push({
						type: "text",
						text: `${toolDescription()} Result:`,
					})
					if (typeof content === "string") {
						this.userMessageContent.push({
							type: "text",
							text: content || "(tool did not return anything)",
						})
					} else {
						this.userMessageContent.push(...content)
					}

					this.didAlreadyUseTool = true
				}

				const askApproval = async (type: ClineAsk, partialMessage?: string) => {
					const { response, text, images } = await this.ask(type, partialMessage, false)
					if (response !== "yesButtonClicked") {
						// Handle both messageResponse and noButtonClicked with text
						if (text) {
							await this.say("user_feedback", text, images)
							pushToolResult(
								formatResponse.toolResult(formatResponse.toolDeniedWithFeedback(text), images),
							)
						} else {
							pushToolResult(formatResponse.toolDenied())
						}
						this.didRejectTool = true
						return false
					}
					// Handle yesButtonClicked with text
					if (text) {
						await this.say("user_feedback", text, images)
						pushToolResult(formatResponse.toolResult(formatResponse.toolApprovedWithFeedback(text), images))
					}
					return true
				}

				const handleError = async (action: string, error: Error) => {
					const errorString = `Error ${action}: ${JSON.stringify(serializeError(error))}`
					await this.say(
						"error",
						`Error ${action}:\n${error.message ?? JSON.stringify(serializeError(error), null, 2)}`,
					)

					pushToolResult(formatResponse.toolError(errorString))
				}

				const removeClosingTag = (tag: ToolParamName, text?: string) => {
					if (!block.partial) {
						return text || ""
					}
					if (!text) {
						return ""
					}

					const tagRegex = new RegExp(
						`\\s?<\/?${tag
							.split("")
							.map((char) => `(?:${char})?`)
							.join("")}$`,
						"g",
					)
					return text.replace(tagRegex, "")
				}

				if (block.name !== "browser_action") {
					await this.browserSession.closeBrowser()
				}

				const { mode, customModes } = (await this.providerRef.deref()?.getState()) ?? {}
				try {
					validateToolUse(
						block.name as ToolName,
						mode ?? defaultModeSlug,
						customModes ?? [],
						{
							apply_diff: this.diffEnabled,
						},
						block.params,
					)
				} catch (error) {
					this.consecutiveMistakeCount++
					pushToolResult(formatResponse.toolError(error.message))
					break
				}

				switch (block.name) {
					case "write_to_file": {
						const relPath: string | undefined = block.params.path
						let newContent: string | undefined = block.params.content
						let predictedLineCount: number | undefined = parseInt(block.params.line_count ?? "0")
						if (!relPath || !newContent) {
							break
						}

						let fileExists: boolean
						if (this.diffViewProvider.editType !== undefined) {
							fileExists = this.diffViewProvider.editType === "modify"
						} else {
							const absolutePath = path.resolve(cwd, relPath)
							fileExists = await fileExistsAtPath(absolutePath)
							this.diffViewProvider.editType = fileExists ? "modify" : "create"
						}

						if (newContent.startsWith("```")) {
							newContent = newContent.split("\n").slice(1).join("\n").trim()
						}
						if (newContent.endsWith("```")) {
							newContent = newContent.split("\n").slice(0, -1).join("\n").trim()
						}

						if (!this.api.getModel().id.includes("claude")) {
							if (
								newContent.includes("&gt;") ||
								newContent.includes("&lt;") ||
								newContent.includes("&quot;")
							) {
								newContent = newContent
									.replace(/&gt;/g, ">")
									.replace(/&lt;/g, "<")
									.replace(/&quot;/g, '"')
							}
						}

						const sharedMessageProps: ClineSayTool = {
							tool: fileExists ? "editedExistingFile" : "newFileCreated",
							path: getReadablePath(cwd, removeClosingTag("path", relPath)),
						}
						try {
							if (block.partial) {
								const partialMessage = JSON.stringify(sharedMessageProps)
								await this.ask("tool", partialMessage, block.partial).catch(() => {})

								if (!this.diffViewProvider.isEditing) {
									await this.diffViewProvider.open(relPath)
								}

								await this.diffViewProvider.update(
									everyLineHasLineNumbers(newContent) ? stripLineNumbers(newContent) : newContent,
									false,
								)
								break
							} else {
								if (!relPath) {
									this.consecutiveMistakeCount++
									pushToolResult(await this.sayAndCreateMissingParamError("write_to_file", "path"))
									await this.diffViewProvider.reset()
									break
								}
								if (!newContent) {
									this.consecutiveMistakeCount++
									pushToolResult(await this.sayAndCreateMissingParamError("write_to_file", "content"))
									await this.diffViewProvider.reset()
									break
								}
								if (!predictedLineCount) {
									this.consecutiveMistakeCount++
									pushToolResult(
										await this.sayAndCreateMissingParamError("write_to_file", "line_count"),
									)
									await this.diffViewProvider.reset()
									break
								}
								this.consecutiveMistakeCount = 0

								if (!this.diffViewProvider.isEditing) {
									const partialMessage = JSON.stringify(sharedMessageProps)
									await this.ask("tool", partialMessage, true).catch(() => {})
									await this.diffViewProvider.open(relPath)
								}
								await this.diffViewProvider.update(
									everyLineHasLineNumbers(newContent) ? stripLineNumbers(newContent) : newContent,
									true,
								)
								await delay(300)
								this.diffViewProvider.scrollToFirstDiff()

								if (
									detectCodeOmission(
										this.diffViewProvider.originalContent || "",
										newContent,
										predictedLineCount,
									)
								) {
									if (this.diffStrategy) {
										await this.diffViewProvider.revertChanges()
										pushToolResult(
											formatResponse.toolError(
												`Content appears to be truncated (file has ${
													newContent.split("\n").length
												} lines but was predicted to have ${predictedLineCount} lines), and found comments indicating omitted code (e.g., '// rest of code unchanged', '/* previous code */'). Please provide the complete file content without any omissions if possible, or otherwise use the 'apply_diff' tool to apply the diff to the original file.`,
											),
										)
										break
									} else {
										vscode.window
											.showWarningMessage(
												"Potential code truncation detected. This happens when the AI reaches its max output limit.",
												"Follow this guide to fix the issue",
											)
											.then((selection) => {
												if (selection === "Follow this guide to fix the issue") {
													vscode.env.openExternal(
														vscode.Uri.parse(
															"https://github.com/cline/cline/wiki/Troubleshooting-%E2%80%90-Cline-Deleting-Code-with-%22Rest-of-Code-Here%22-Comments",
														),
													)
												}
											})
									}
								}

								const completeMessage = JSON.stringify({
									...sharedMessageProps,
									content: fileExists ? undefined : newContent,
									diff: fileExists
										? formatResponse.createPrettyPatch(
												relPath,
												this.diffViewProvider.originalContent,
												newContent,
											)
										: undefined,
								} satisfies ClineSayTool)
								const didApprove = await askApproval("tool", completeMessage)
								if (!didApprove) {
									await this.diffViewProvider.revertChanges()
									break
								}
								const { newProblemsMessage, userEdits, finalContent } =
									await this.diffViewProvider.saveChanges()
								this.didEditFile = true
								if (userEdits) {
									await this.say(
										"user_feedback_diff",
										JSON.stringify({
											tool: fileExists ? "editedExistingFile" : "newFileCreated",
											path: getReadablePath(cwd, relPath),
											diff: userEdits,
										} satisfies ClineSayTool),
									)
									pushToolResult(
										`The user made the following updates to your content:\n\n${userEdits}\n\n` +
											`The updated content, which includes both your original modifications and the user's edits, has been successfully saved to ${relPath.toPosix()}. Here is the full, updated content of the file, including line numbers:\n\n` +
											`<final_file_content path="${relPath.toPosix()}">\n${addLineNumbers(
												finalContent || "",
											)}\n</final_file_content>\n\n` +
											`Please note:\n` +
											`1. You do not need to re-write the file with these changes, as they have already been applied.\n` +
											`2. Proceed with the task using this updated file content as the new baseline.\n` +
											`3. If the user's edits have addressed part of the task or changed the requirements, adjust your approach accordingly.` +
											`${newProblemsMessage}`,
									)
								} else {
									pushToolResult(
										`The content was successfully saved to ${relPath.toPosix()}.${newProblemsMessage}`,
									)
								}
								await this.diffViewProvider.reset()
								break
							}
						} catch (error) {
							await handleError("writing file", error)
							await this.diffViewProvider.reset()
							break
						}
					}
					case "apply_diff": {
						const relPath: string | undefined = block.params.path
						const diffContent: string | undefined = block.params.diff

						const sharedMessageProps: ClineSayTool = {
							tool: "appliedDiff",
							path: getReadablePath(cwd, removeClosingTag("path", relPath)),
						}

						try {
							if (block.partial) {
								const partialMessage = JSON.stringify(sharedMessageProps)
								await this.ask("tool", partialMessage, block.partial).catch(() => {})
								break
							} else {
								if (!relPath) {
									this.consecutiveMistakeCount++
									pushToolResult(await this.sayAndCreateMissingParamError("apply_diff", "path"))
									break
								}
								if (!diffContent) {
									this.consecutiveMistakeCount++
									pushToolResult(await this.sayAndCreateMissingParamError("apply_diff", "diff"))
									break
								}

								const absolutePath = path.resolve(cwd, relPath)
								const fileExists = await fileExistsAtPath(absolutePath)

								if (!fileExists) {
									this.consecutiveMistakeCount++
									const formattedError = `File does not exist at path: ${absolutePath}\n\n<error_details>\nThe specified file could not be found. Please verify the file path and try again.\n</error_details>`
									await this.say("error", formattedError)
									pushToolResult(formattedError)
									break
								}

								const originalContent = await fs.readFile(absolutePath, "utf-8")

								const diffResult = (await this.diffStrategy?.applyDiff(
									originalContent,
									diffContent,
									parseInt(block.params.start_line ?? ""),
									parseInt(block.params.end_line ?? ""),
								)) ?? {
									success: false,
									error: "No diff strategy available",
								}
								if (!diffResult.success) {
									this.consecutiveMistakeCount++
									const currentCount =
										(this.consecutiveMistakeCountForApplyDiff.get(relPath) || 0) + 1
									this.consecutiveMistakeCountForApplyDiff.set(relPath, currentCount)
									const errorDetails = diffResult.details
										? JSON.stringify(diffResult.details, null, 2)
										: ""
									const formattedError = `Unable to apply diff to file: ${absolutePath}\n\n<error_details>\n${
										diffResult.error
									}${errorDetails ? `\n\nDetails:\n${errorDetails}` : ""}\n</error_details>`
									if (currentCount >= 2) {
										await this.say("error", formattedError)
									}
									pushToolResult(formattedError)
									break
								}

								this.consecutiveMistakeCount = 0
								this.consecutiveMistakeCountForApplyDiff.delete(relPath)

								this.diffViewProvider.editType = "modify"
								await this.diffViewProvider.open(relPath)
								await this.diffViewProvider.update(diffResult.content, true)
								await this.diffViewProvider.scrollToFirstDiff()

								const completeMessage = JSON.stringify({
									...sharedMessageProps,
									diff: diffContent,
								} satisfies ClineSayTool)

								const didApprove = await askApproval("tool", completeMessage)
								if (!didApprove) {
									await this.diffViewProvider.revertChanges()
									break
								}

								const { newProblemsMessage, userEdits, finalContent } =
									await this.diffViewProvider.saveChanges()
								this.didEditFile = true
								if (userEdits) {
									await this.say(
										"user_feedback_diff",
										JSON.stringify({
											tool: fileExists ? "editedExistingFile" : "newFileCreated",
											path: getReadablePath(cwd, relPath),
											diff: userEdits,
										} satisfies ClineSayTool),
									)
									pushToolResult(
										`The user made the following updates to your content:\n\n${userEdits}\n\n` +
											`The updated content, which includes both your original modifications and the user's edits, has been successfully saved to ${relPath.toPosix()}. Here is the full, updated content of the file, including line numbers:\n\n` +
											`<final_file_content path="${relPath.toPosix()}">\n${addLineNumbers(
												finalContent || "",
											)}\n</final_file_content>\n\n` +
											`Please note:\n` +
											`1. You do not need to re-write the file with these changes, as they have already been applied.\n` +
											`2. Proceed with the task using this updated file content as the new baseline.\n` +
											`3. If the user's edits have addressed part of the task or changed the requirements, adjust your approach accordingly.` +
											`${newProblemsMessage}`,
									)
								} else {
									pushToolResult(
										`Changes successfully applied to ${relPath.toPosix()}:\n\n${newProblemsMessage}`,
									)
								}
								await this.diffViewProvider.reset()
								break
							}
						} catch (error) {
							await handleError("applying diff", error)
							await this.diffViewProvider.reset()
							break
						}
					}

					case "insert_content": {
						const relPath: string | undefined = block.params.path
						const operations: string | undefined = block.params.operations

						const sharedMessageProps: ClineSayTool = {
							tool: "appliedDiff",
							path: getReadablePath(cwd, removeClosingTag("path", relPath)),
						}

						try {
							if (block.partial) {
								const partialMessage = JSON.stringify(sharedMessageProps)
								await this.ask("tool", partialMessage, block.partial).catch(() => {})
								break
							}

							if (!relPath) {
								this.consecutiveMistakeCount++
								pushToolResult(await this.sayAndCreateMissingParamError("insert_content", "path"))
								break
							}

							if (!operations) {
								this.consecutiveMistakeCount++
								pushToolResult(await this.sayAndCreateMissingParamError("insert_content", "operations"))
								break
							}

							const absolutePath = path.resolve(cwd, relPath)
							const fileExists = await fileExistsAtPath(absolutePath)

							if (!fileExists) {
								this.consecutiveMistakeCount++
								const formattedError = `File does not exist at path: ${absolutePath}\n\n<error_details>\nThe specified file could not be found. Please verify the file path and try again.\n</error_details>`
								await this.say("error", formattedError)
								pushToolResult(formattedError)
								break
							}

							let parsedOperations: Array<{
								start_line: number
								content: string
							}>

							try {
								parsedOperations = JSON.parse(operations)
								if (!Array.isArray(parsedOperations)) {
									throw new Error("Operations must be an array")
								}
							} catch (error) {
								this.consecutiveMistakeCount++
								await this.say("error", `Failed to parse operations JSON: ${error.message}`)
								pushToolResult(formatResponse.toolError("Invalid operations JSON format"))
								break
							}

							this.consecutiveMistakeCount = 0

							const fileContent = await fs.readFile(absolutePath, "utf8")
							this.diffViewProvider.editType = "modify"
							this.diffViewProvider.originalContent = fileContent
							const lines = fileContent.split("\n")

							const updatedContent = insertGroups(
								lines,
								parsedOperations.map((elem) => {
									return {
										index: elem.start_line - 1,
										elements: elem.content.split("\n"),
									}
								}),
							).join("\n")

							if (!this.diffViewProvider.isEditing) {
								await this.ask("tool", JSON.stringify(sharedMessageProps), true).catch(() => {})

								await this.diffViewProvider.open(relPath)
								await this.diffViewProvider.update(fileContent, false)
								this.diffViewProvider.scrollToFirstDiff()
								await delay(200)
							}

							const diff = formatResponse.createPrettyPatch(relPath, fileContent, updatedContent)

							if (!diff) {
								pushToolResult(`No changes needed for '${relPath}'`)
								break
							}

							await this.diffViewProvider.update(updatedContent, true)

							const completeMessage = JSON.stringify({
								...sharedMessageProps,
								diff,
							} satisfies ClineSayTool)

							const didApprove = await this.ask("tool", completeMessage, false).then(
								(response) => response.response === "yesButtonClicked",
							)

							if (!didApprove) {
								await this.diffViewProvider.revertChanges()
								pushToolResult("Changes were rejected by the user.")
								break
							}

							const { newProblemsMessage, userEdits, finalContent } =
								await this.diffViewProvider.saveChanges()
							this.didEditFile = true

							if (!userEdits) {
								pushToolResult(
									`The content was successfully inserted in ${relPath.toPosix()}.${newProblemsMessage}`,
								)
								await this.diffViewProvider.reset()
								break
							}

							const userFeedbackDiff = JSON.stringify({
								tool: "appliedDiff",
								path: getReadablePath(cwd, relPath),
								diff: userEdits,
							} satisfies ClineSayTool)

							console.debug("[DEBUG] User made edits, sending feedback diff:", userFeedbackDiff)
							await this.say("user_feedback_diff", userFeedbackDiff)
							pushToolResult(
								`The user made the following updates to your content:\n\n${userEdits}\n\n` +
									`The updated content, which includes both your original modifications and the user's edits, has been successfully saved to ${relPath.toPosix()}. Here is the full, updated content of the file:\n\n` +
									`<final_file_content path="${relPath.toPosix()}">\n${finalContent}\n</final_file_content>\n\n` +
									`Please note:\n` +
									`1. You do not need to re-write the file with these changes, as they have already been applied.\n` +
									`2. Proceed with the task using this updated file content as the new baseline.\n` +
									`3. If the user's edits have addressed part of the task or changed the requirements, adjust your approach accordingly.` +
									`${newProblemsMessage}`,
							)
							await this.diffViewProvider.reset()
						} catch (error) {
							handleError("insert content", error)
							await this.diffViewProvider.reset()
						}
						break
					}

					case "search_and_replace": {
						const relPath: string | undefined = block.params.path
						const operations: string | undefined = block.params.operations

						const sharedMessageProps: ClineSayTool = {
							tool: "appliedDiff",
							path: getReadablePath(cwd, removeClosingTag("path", relPath)),
						}

						try {
							if (block.partial) {
								const partialMessage = JSON.stringify({
									path: removeClosingTag("path", relPath),
									operations: removeClosingTag("operations", operations),
								})
								await this.ask("tool", partialMessage, block.partial).catch(() => {})
								break
							} else {
								if (!relPath) {
									this.consecutiveMistakeCount++
									pushToolResult(
										await this.sayAndCreateMissingParamError("search_and_replace", "path"),
									)
									break
								}
								if (!operations) {
									this.consecutiveMistakeCount++
									pushToolResult(
										await this.sayAndCreateMissingParamError("search_and_replace", "operations"),
									)
									break
								}

								const absolutePath = path.resolve(cwd, relPath)
								const fileExists = await fileExistsAtPath(absolutePath)

								if (!fileExists) {
									this.consecutiveMistakeCount++
									const formattedError = `File does not exist at path: ${absolutePath}\n\n<error_details>\nThe specified file could not be found. Please verify the file path and try again.\n</error_details>`
									await this.say("error", formattedError)
									pushToolResult(formattedError)
									break
								}

								let parsedOperations: Array<{
									search: string
									replace: string
									start_line?: number
									end_line?: number
									use_regex?: boolean
									ignore_case?: boolean
									regex_flags?: string
								}>

								try {
									parsedOperations = JSON.parse(operations)
									if (!Array.isArray(parsedOperations)) {
										throw new Error("Operations must be an array")
									}
								} catch (error) {
									this.consecutiveMistakeCount++
									await this.say("error", `Failed to parse operations JSON: ${error.message}`)
									pushToolResult(formatResponse.toolError("Invalid operations JSON format"))
									break
								}

								const fileContent = await fs.readFile(absolutePath, "utf-8")
								this.diffViewProvider.editType = "modify"
								this.diffViewProvider.originalContent = fileContent
								let lines = fileContent.split("\n")

								for (const op of parsedOperations) {
									const flags = op.regex_flags ?? (op.ignore_case ? "gi" : "g")
									const multilineFlags = flags.includes("m") ? flags : flags + "m"

									const searchPattern = op.use_regex
										? new RegExp(op.search, multilineFlags)
										: new RegExp(escapeRegExp(op.search), multilineFlags)

									if (op.start_line || op.end_line) {
										const startLine = Math.max((op.start_line ?? 1) - 1, 0)
										const endLine = Math.min((op.end_line ?? lines.length) - 1, lines.length - 1)

										const beforeLines = lines.slice(0, startLine)
										const afterLines = lines.slice(endLine + 1)

										const targetContent = lines.slice(startLine, endLine + 1).join("\n")
										const modifiedContent = targetContent.replace(searchPattern, op.replace)
										const modifiedLines = modifiedContent.split("\n")

										lines = [...beforeLines, ...modifiedLines, ...afterLines]
									} else {
										const fullContent = lines.join("\n")
										const modifiedContent = fullContent.replace(searchPattern, op.replace)
										lines = modifiedContent.split("\n")
									}
								}

								const newContent = lines.join("\n")

								this.consecutiveMistakeCount = 0

								const diff = formatResponse.createPrettyPatch(relPath, fileContent, newContent)

								if (!diff) {
									pushToolResult(`No changes needed for '${relPath}'`)
									break
								}

								await this.diffViewProvider.open(relPath)
								await this.diffViewProvider.update(newContent, true)
								this.diffViewProvider.scrollToFirstDiff()

								const completeMessage = JSON.stringify({
									...sharedMessageProps,
									diff: diff,
								} satisfies ClineSayTool)

								const didApprove = await askApproval("tool", completeMessage)
								if (!didApprove) {
									await this.diffViewProvider.revertChanges()
									break
								}

								const { newProblemsMessage, userEdits, finalContent } =
									await this.diffViewProvider.saveChanges()
								this.didEditFile = true
								if (userEdits) {
									await this.say(
										"user_feedback_diff",
										JSON.stringify({
											tool: fileExists ? "editedExistingFile" : "newFileCreated",
											path: getReadablePath(cwd, relPath),
											diff: userEdits,
										} satisfies ClineSayTool),
									)
									pushToolResult(
										`The user made the following updates to your content:\n\n${userEdits}\n\n` +
											`The updated content, which includes both your original modifications and the user's edits, has been successfully saved to ${relPath.toPosix()}. Here is the full, updated content of the file, including line numbers:\n\n` +
											`<final_file_content path="${relPath.toPosix()}">\n${addLineNumbers(finalContent || "")}\n</final_file_content>\n\n` +
											`Please note:\n` +
											`1. You do not need to re-write the file with these changes, as they have already been applied.\n` +
											`2. Proceed with the task using this updated file content as the new baseline.\n` +
											`3. If the user's edits have addressed part of the task or changed the requirements, adjust your approach accordingly.` +
											`${newProblemsMessage}`,
									)
								} else {
									pushToolResult(
										`Changes successfully applied to ${relPath.toPosix()}:\n\n${newProblemsMessage}`,
									)
								}
								await this.diffViewProvider.reset()
								break
							}
						} catch (error) {
							await handleError("applying search and replace", error)
							await this.diffViewProvider.reset()
							break
						}
					}

					case "read_file": {
						const relPath: string | undefined = block.params.path
						const sharedMessageProps: ClineSayTool = {
							tool: "readFile",
							path: getReadablePath(cwd, removeClosingTag("path", relPath)),
						}
						try {
							if (block.partial) {
								const partialMessage = JSON.stringify({
									...sharedMessageProps,
									content: undefined,
								} satisfies ClineSayTool)
								await this.ask("tool", partialMessage, block.partial).catch(() => {})
								break
							} else {
								if (!relPath) {
									this.consecutiveMistakeCount++
									pushToolResult(await this.sayAndCreateMissingParamError("read_file", "path"))
									break
								}
								this.consecutiveMistakeCount = 0
								const absolutePath = path.resolve(cwd, relPath)
								const completeMessage = JSON.stringify({
									...sharedMessageProps,
									content: absolutePath,
								} satisfies ClineSayTool)
								const didApprove = await askApproval("tool", completeMessage)
								if (!didApprove) {
									break
								}

								const content = await extractTextFromFile(absolutePath)
								pushToolResult(content)
								break
							}
						} catch (error) {
							await handleError("reading file", error)
							break
						}
					}
					case "list_files": {
						const relDirPath: string | undefined = block.params.path
						const recursiveRaw: string | undefined = block.params.recursive
						const recursive = recursiveRaw?.toLowerCase() === "true"
						const sharedMessageProps: ClineSayTool = {
							tool: !recursive ? "listFilesTopLevel" : "listFilesRecursive",
							path: getReadablePath(cwd, removeClosingTag("path", relDirPath)),
						}
						try {
							if (block.partial) {
								const partialMessage = JSON.stringify({
									...sharedMessageProps,
									content: "",
								} satisfies ClineSayTool)
								await this.ask("tool", partialMessage, block.partial).catch(() => {})
								break
							} else {
								if (!relDirPath) {
									this.consecutiveMistakeCount++
									pushToolResult(await this.sayAndCreateMissingParamError("list_files", "path"))
									break
								}
								this.consecutiveMistakeCount = 0
								const absolutePath = path.resolve(cwd, relDirPath)
								const [files, didHitLimit] = await listFiles(absolutePath, {
									path: absolutePath,
									format: "tree",
									recursive: recursive,
									limit: 200,
								})
								const result = JSON.stringify(files, null, 2)
								const completeMessage = JSON.stringify({
									...sharedMessageProps,
									content: result,
								} satisfies ClineSayTool)
								const didApprove = await askApproval("tool", completeMessage)
								if (!didApprove) {
									break
								}
								pushToolResult(result)
								break
							}
						} catch (error) {
							await handleError("listing files", error)
							break
						}
					}
					case "list_code_definition_names": {
						const relDirPath: string | undefined = block.params.path
						const sharedMessageProps: ClineSayTool = {
							tool: "listCodeDefinitionNames",
							path: getReadablePath(cwd, removeClosingTag("path", relDirPath)),
						}
						try {
							if (block.partial) {
								const partialMessage = JSON.stringify({
									...sharedMessageProps,
									content: "",
								} satisfies ClineSayTool)
								await this.ask("tool", partialMessage, block.partial).catch(() => {})
								break
							} else {
								if (!relDirPath) {
									this.consecutiveMistakeCount++
									pushToolResult(
										await this.sayAndCreateMissingParamError("list_code_definition_names", "path"),
									)
									break
								}
								this.consecutiveMistakeCount = 0
								const absolutePath = path.resolve(cwd, relDirPath)
								const result = await parseSourceCodeForDefinitionsTopLevel(absolutePath)
								const completeMessage = JSON.stringify({
									...sharedMessageProps,
									content: result,
								} satisfies ClineSayTool)
								const didApprove = await askApproval("tool", completeMessage)
								if (!didApprove) {
									break
								}
								pushToolResult(result)
								break
							}
						} catch (error) {
							await handleError("parsing source code definitions", error)
							break
						}
					}
					case "search_files": {
						const relDirPath: string | undefined = block.params.path
						const regex: string | undefined = block.params.regex
						const filePattern: string | undefined = block.params.file_pattern
						const sharedMessageProps: ClineSayTool = {
							tool: "searchFiles",
							path: getReadablePath(cwd, removeClosingTag("path", relDirPath)),
							regex: removeClosingTag("regex", regex),
							filePattern: removeClosingTag("file_pattern", filePattern),
						}
						try {
							if (block.partial) {
								const partialMessage = JSON.stringify({
									...sharedMessageProps,
									content: "",
								} satisfies ClineSayTool)
								await this.ask("tool", partialMessage, block.partial).catch(() => {})
								break
							} else {
								if (!relDirPath) {
									this.consecutiveMistakeCount++
									pushToolResult(await this.sayAndCreateMissingParamError("search_files", "path"))
									break
								}
								if (!regex) {
									this.consecutiveMistakeCount++
									pushToolResult(await this.sayAndCreateMissingParamError("search_files", "regex"))
									break
								}
								this.consecutiveMistakeCount = 0
								const absolutePath = path.resolve(cwd, relDirPath)
								const results = await regexSearchFiles(cwd, absolutePath, regex, filePattern)
								const completeMessage = JSON.stringify({
									...sharedMessageProps,
									content: formatSearchResults(results),
								} satisfies ClineSayTool)
								const didApprove = await askApproval("tool", completeMessage)
								if (!didApprove) {
									break
								}
								pushToolResult(formatSearchResults(results))
								break
							}
						} catch (error) {
							await handleError("searching files", error)
							break
						}
					}
					case "browser_action": {
						const action: BrowserAction | undefined = block.params.action as BrowserAction
						const url: string | undefined = block.params.url
						const coordinate: string | undefined = block.params.coordinate
						const text: string | undefined = block.params.text
						if (!action || !browserActions.includes(action)) {
							if (!block.partial) {
								this.consecutiveMistakeCount++
								pushToolResult(await this.sayAndCreateMissingParamError("browser_action", "action"))
								await this.browserSession.closeBrowser()
							}
							break
						}

						try {
							if (block.partial) {
								if (action === "launch") {
									await this.ask(
										"browser_action_launch",
										removeClosingTag("url", url),
										block.partial,
									).catch(() => {})
								} else {
									await this.say(
										"browser_action",
										JSON.stringify({
											action: action as BrowserAction,
											coordinate: removeClosingTag("coordinate", coordinate),
											text: removeClosingTag("text", text),
										} satisfies ClineSayBrowserAction),
										undefined,
										block.partial,
									)
								}
								break
							} else {
								let browserActionResult: BrowserActionResult
								if (action === "launch") {
									if (!url) {
										this.consecutiveMistakeCount++
										pushToolResult(
											await this.sayAndCreateMissingParamError("browser_action", "url"),
										)
										await this.browserSession.closeBrowser()
										break
									}
									this.consecutiveMistakeCount = 0
									const didApprove = await askApproval("browser_action_launch", url)
									if (!didApprove) {
										break
									}

									await this.say("browser_action_result", "")

									await this.browserSession.launchBrowser()
									browserActionResult = await this.browserSession.navigateToUrl(url)
								} else {
									if (action === "click") {
										if (!coordinate) {
											this.consecutiveMistakeCount++
											pushToolResult(
												await this.sayAndCreateMissingParamError(
													"browser_action",
													"coordinate",
												),
											)
											await this.browserSession.closeBrowser()
											break
										}
									}
									if (action === "type") {
										if (!text) {
											this.consecutiveMistakeCount++
											pushToolResult(
												await this.sayAndCreateMissingParamError("browser_action", "text"),
											)
											await this.browserSession.closeBrowser()
											break
										}
									}
									this.consecutiveMistakeCount = 0
									await this.say(
										"browser_action",
										JSON.stringify({
											action: action as BrowserAction,
											coordinate,
											text,
										} satisfies ClineSayBrowserAction),
										undefined,
										false,
									)
									switch (action) {
										case "click":
											browserActionResult = await this.browserSession.click(coordinate!)
											break
										case "type":
											browserActionResult = await this.browserSession.type(text!)
											break
										case "scroll_down":
											browserActionResult = await this.browserSession.scrollDown()
											break
										case "scroll_up":
											browserActionResult = await this.browserSession.scrollUp()
											break
										case "close":
											browserActionResult = await this.browserSession.closeBrowser()
											break
									}
								}

								switch (action) {
									case "launch":
									case "click":
									case "type":
									case "scroll_down":
									case "scroll_up":
										await this.say("browser_action_result", JSON.stringify(browserActionResult))
										pushToolResult(
											formatResponse.toolResult(
												`The browser action has been executed. The console logs and screenshot have been captured for your analysis.\n\nConsole logs:\n${
													browserActionResult.logs || "(No new logs)"
												}\n\n(REMEMBER: if you need to proceed to using non-\`browser_action\` tools or launch a new browser, you MUST first close this browser. For example, if after analyzing the logs and screenshot you need to edit a file, you must first close the browser before you can use the write_to_file tool.)`,
												browserActionResult.screenshot ? [browserActionResult.screenshot] : [],
											),
										)
										break
									case "close":
										pushToolResult(
											formatResponse.toolResult(
												`The browser has been closed. You may now proceed to using other tools.`,
											),
										)
										break
								}
								break
							}
						} catch (error) {
							await this.browserSession.closeBrowser()
							await handleError("executing browser action", error)
							break
						}
					}
					case "execute_command": {
						const command: string | undefined = block.params.command
						try {
							if (block.partial) {
								await this.ask("command", removeClosingTag("command", command), block.partial).catch(
									() => {},
								)
								break
							} else {
								if (!command) {
									this.consecutiveMistakeCount++
									pushToolResult(
										await this.sayAndCreateMissingParamError("execute_command", "command"),
									)
									break
								}
								this.consecutiveMistakeCount = 0

								const didApprove = await askApproval("command", command)
								if (!didApprove) {
									break
								}
								const [userRejected, result] = await this.executeCommandTool(command)
								if (userRejected) {
									this.didRejectTool = true
								}
								pushToolResult(result)
								break
							}
						} catch (error) {
							await handleError("executing command", error)
							break
						}
					}
					case "use_mcp_tool": {
						const server_name: string | undefined = block.params.server_name
						const tool_name: string | undefined = block.params.tool_name
						const mcp_arguments: string | undefined = block.params.arguments
						try {
							if (block.partial) {
								const partialMessage = JSON.stringify({
									type: "use_mcp_tool",
									serverName: removeClosingTag("server_name", server_name),
									toolName: removeClosingTag("tool_name", tool_name),
									arguments: removeClosingTag("arguments", mcp_arguments),
								} satisfies ClineAskUseMcpServer)
								await this.ask("use_mcp_server", partialMessage, block.partial).catch(() => {})
								break
							} else {
								if (!server_name) {
									this.consecutiveMistakeCount++
									pushToolResult(
										await this.sayAndCreateMissingParamError("use_mcp_tool", "server_name"),
									)
									break
								}
								if (!tool_name) {
									this.consecutiveMistakeCount++
									pushToolResult(
										await this.sayAndCreateMissingParamError("use_mcp_tool", "tool_name"),
									)
									break
								}

								let parsedArguments: Record<string, unknown> | undefined
								if (mcp_arguments) {
									try {
										parsedArguments = JSON.parse(mcp_arguments)
									} catch (error) {
										this.consecutiveMistakeCount++
										await this.say(
											"error",
											`Roo tried to use ${tool_name} with an invalid JSON argument. Retrying...`,
										)
										pushToolResult(
											formatResponse.toolError(
												formatResponse.invalidMcpToolArgumentError(server_name, tool_name),
											),
										)
										break
									}
								}
								this.consecutiveMistakeCount = 0
								const completeMessage = JSON.stringify({
									type: "use_mcp_tool",
									serverName: server_name,
									toolName: tool_name,
									arguments: mcp_arguments,
								} satisfies ClineAskUseMcpServer)
								const didApprove = await askApproval("use_mcp_server", completeMessage)
								if (!didApprove) {
									break
								}

								await this.say("mcp_server_request_started")
								const toolResult = await this.providerRef
									.deref()
									?.mcpHub?.callTool(server_name, tool_name, parsedArguments)

								const toolResultPretty =
									(toolResult?.isError ? "Error:\n" : "") +
										toolResult?.content
											.map((item) => {
												if (item.type === "text") {
													return item.text
												}
												if (item.type === "resource") {
													const { blob, ...rest } = item.resource
													return JSON.stringify(rest, null, 2)
												}
												return ""
											})
											.filter(Boolean)
											.join("\n\n") || "(No response)"
								await this.say("mcp_server_response", toolResultPretty)
								pushToolResult(formatResponse.toolResult(toolResultPretty))
								break
							}
						} catch (error) {
							await handleError("executing MCP tool", error)
							break
						}
					}
					case "access_mcp_resource": {
						const server_name: string | undefined = block.params.server_name
						const uri: string | undefined = block.params.uri
						try {
							if (block.partial) {
								const partialMessage = JSON.stringify({
									type: "access_mcp_resource",
									serverName: removeClosingTag("server_name", server_name),
									uri: removeClosingTag("uri", uri),
								} satisfies ClineAskUseMcpServer)
								await this.ask("use_mcp_server", partialMessage, block.partial).catch(() => {})
								break
							} else {
								if (!server_name) {
									this.consecutiveMistakeCount++
									pushToolResult(
										await this.sayAndCreateMissingParamError("access_mcp_resource", "server_name"),
									)
									break
								}
								if (!uri) {
									this.consecutiveMistakeCount++
									pushToolResult(
										await this.sayAndCreateMissingParamError("access_mcp_resource", "uri"),
									)
									break
								}
								this.consecutiveMistakeCount = 0
								const completeMessage = JSON.stringify({
									type: "access_mcp_resource",
									serverName: server_name,
									uri,
								} satisfies ClineAskUseMcpServer)
								const didApprove = await askApproval("use_mcp_server", completeMessage)
								if (!didApprove) {
									break
								}

								await this.say("mcp_server_request_started")
								const resourceResult = await this.providerRef
									.deref()
									?.mcpHub?.readResource(server_name, uri)
								const resourceResultPretty =
									resourceResult?.contents
										.map((item) => {
											if (item.text) {
												return item.text
											}
											return ""
										})
										.filter(Boolean)
										.join("\n\n") || "(Empty response)"
								await this.say("mcp_server_response", resourceResultPretty)
								pushToolResult(formatResponse.toolResult(resourceResultPretty))
								break
							}
						} catch (error) {
							await handleError("accessing MCP resource", error)
							break
						}
					}
					case "ask_followup_question": {
						const question: string | undefined = block.params.question
						try {
							if (block.partial) {
								await this.ask("followup", removeClosingTag("question", question), block.partial).catch(
									() => {},
								)
								break
							} else {
								if (!question) {
									this.consecutiveMistakeCount++
									pushToolResult(
										await this.sayAndCreateMissingParamError("ask_followup_question", "question"),
									)
									break
								}
								this.consecutiveMistakeCount = 0
								const { text, images } = await this.ask("followup", question, false)
								await this.say("user_feedback", text ?? "", images)
								pushToolResult(formatResponse.toolResult(`<answer>\n${text}\n</answer>`, images))
								break
							}
						} catch (error) {
							await handleError("asking question", error)
							break
						}
					}
					case "switch_mode": {
						const mode_slug: string | undefined = block.params.mode_slug
						const reason: string | undefined = block.params.reason
						try {
							if (block.partial) {
								const partialMessage = JSON.stringify({
									tool: "switchMode",
									mode: removeClosingTag("mode_slug", mode_slug),
									reason: removeClosingTag("reason", reason),
								})
								await this.ask("tool", partialMessage, block.partial).catch(() => {})
								break
							} else {
								if (!mode_slug) {
									this.consecutiveMistakeCount++
									pushToolResult(await this.sayAndCreateMissingParamError("switch_mode", "mode_slug"))
									break
								}
								this.consecutiveMistakeCount = 0

								const targetMode = getModeBySlug(
									mode_slug,
									(await this.providerRef.deref()?.getState())?.customModes,
								)
								if (!targetMode) {
									pushToolResult(formatResponse.toolError(`Invalid mode: ${mode_slug}`))
									break
								}

								const currentMode =
									(await this.providerRef.deref()?.getState())?.mode ?? defaultModeSlug
								if (currentMode === mode_slug) {
									pushToolResult(`Already in ${targetMode.name} mode.`)
									break
								}

								const completeMessage = JSON.stringify({
									tool: "switchMode",
									mode: mode_slug,
									reason,
								})

								const didApprove = await askApproval("tool", completeMessage)
								if (!didApprove) {
									break
								}

								const provider = this.providerRef.deref()
								if (provider) {
									await provider.handleModeSwitch(mode_slug)
								}
								pushToolResult(
									`Successfully switched from ${getModeBySlug(currentMode)?.name ?? currentMode} mode to ${
										targetMode.name
									} mode${reason ? ` because: ${reason}` : ""}.`,
								)
								await delay(500)
								break
							}
						} catch (error) {
							await handleError("switching mode", error)
							break
						}
					}

					case "new_task": {
						const mode: string | undefined = block.params.mode
						const message: string | undefined = block.params.message
						try {
							if (block.partial) {
								const partialMessage = JSON.stringify({
									tool: "newTask",
									mode: removeClosingTag("mode", mode),
									message: removeClosingTag("message", message),
								})
								await this.ask("tool", partialMessage, block.partial).catch(() => {})
								break
							} else {
								if (!mode) {
									this.consecutiveMistakeCount++
									pushToolResult(await this.sayAndCreateMissingParamError("new_task", "mode"))
									break
								}
								if (!message) {
									this.consecutiveMistakeCount++
									pushToolResult(await this.sayAndCreateMissingParamError("new_task", "message"))
									break
								}
								this.consecutiveMistakeCount = 0

								const targetMode = getModeBySlug(
									mode,
									(await this.providerRef.deref()?.getState())?.customModes,
								)
								if (!targetMode) {
									pushToolResult(formatResponse.toolError(`Invalid mode: ${mode}`))
									break
								}

								const toolMessage = JSON.stringify({
									tool: "newTask",
									mode: targetMode.name,
									content: message,
								})

								const didApprove = await askApproval("tool", toolMessage)
								if (!didApprove) {
									break
								}

								const provider = this.providerRef.deref()
								if (provider) {
									await provider.handleModeSwitch(mode)
									await provider.initClineWithTask(message)
									pushToolResult(
										`Successfully created new task in ${targetMode.name} mode with message: ${message}`,
									)
								} else {
									pushToolResult(
										formatResponse.toolError("Failed to create new task: provider not available"),
									)
								}
								break
							}
						} catch (error) {
							await handleError("creating new task", error)
							break
						}
					}

					case "attempt_completion": {
						const result: string | undefined = block.params.result
						const command: string | undefined = block.params.command
						try {
							const lastMessage = this.clineMessages.at(-1)
							if (block.partial) {
								if (command) {
									if (lastMessage && lastMessage.ask === "command") {
										await this.ask(
											"command",
											removeClosingTag("command", command),
											block.partial,
										).catch(() => {})
									} else {
										await this.say(
											"completion_result",
											removeClosingTag("result", result),
											undefined,
											false,
										)
										await this.ask(
											"command",
											removeClosingTag("command", command),
											block.partial,
										).catch(() => {})
									}
								} else {
									await this.say(
										"completion_result",
										removeClosingTag("result", result),
										undefined,
										block.partial,
									)
								}
								break
							} else {
								if (!result) {
									this.consecutiveMistakeCount++
									pushToolResult(
										await this.sayAndCreateMissingParamError("attempt_completion", "result"),
									)
									break
								}
								this.consecutiveMistakeCount = 0

								let commandResult: ToolResponse | undefined
								if (command) {
									if (lastMessage && lastMessage.ask !== "command") {
										await this.say("completion_result", result, undefined, false)
									}

									const didApprove = await askApproval("command", command)
									if (!didApprove) {
										break
									}
									const [userRejected, execCommandResult] = await this.executeCommandTool(command!)
									if (userRejected) {
										this.didRejectTool = true
										pushToolResult(execCommandResult)
										break
									}

									commandResult = execCommandResult
								} else {
									await this.say("completion_result", result, undefined, false)
								}

								const { response, text, images } = await this.ask("completion_result", "", false)
								if (response === "yesButtonClicked") {
									pushToolResult("")
									break
								}
								await this.say("user_feedback", text ?? "", images)

								const toolResults: (Anthropic.TextBlockParam | Anthropic.ImageBlockParam)[] = []
								if (commandResult) {
									if (typeof commandResult === "string") {
										toolResults.push({ type: "text", text: commandResult })
									} else if (Array.isArray(commandResult)) {
										toolResults.push(...commandResult)
									}
								}
								toolResults.push({
									type: "text",
									text: `The user has provided feedback on the results. Consider their input to continue the task, and then attempt completion again.\n<feedback>\n${text}\n</feedback>`,
								})
								toolResults.push(...formatResponse.imageBlocks(images))
								this.userMessageContent.push({
									type: "text",
									text: `${toolDescription()} Result:`,
								})
								this.userMessageContent.push(...toolResults)

								break
							}
						} catch (error) {
							await handleError("inspecting site", error)
							break
						}
					}
				}
				break
		}

		this.presentAssistantMessageLocked = false

		if (!block.partial || this.didRejectTool || this.didAlreadyUseTool) {
			if (this.currentStreamingContentIndex === this.assistantMessageContent.length - 1) {
				this.userMessageContentReady = true
			}

			this.currentStreamingContentIndex++

			if (this.currentStreamingContentIndex < this.assistantMessageContent.length) {
				this.presentAssistantMessage()
				return
			}
		}

		if (this.presentAssistantMessageHasPendingUpdates) {
			this.presentAssistantMessage()
		}
	}
	/**
	 * Recursively manages the Cline request loop, sending user prompts, processing assistant responses, and handling tool use.
	 *
	 * @param userContent - Array of user content blocks to process in the current request loop.
	 * @param includeFileDetails - Boolean indicating whether to include detailed file listings.
	 * @returns A Promise that resolves to a boolean indicating if the task loop should end.
	 * @throws {Error} - If the Roo Code instance is aborted or API request stream encounters an error.
	 */
	async recursivelyMakeClineRequests(
		userContent: UserContent,
		includeFileDetails: boolean = false,
	): Promise<boolean> {
		if (this.abort) {
			throw new Error("Roo Code instance aborted")
		}

		if (this.consecutiveMistakeCount >= 3) {
			const { response, text, images } = await this.ask(
				"mistake_limit_reached",
				this.api.getModel().id.includes("claude")
					? `This may indicate a failure in his thought process or inability to use a tool properly, which can be mitigated with some user guidance (e.g. "Try breaking down the task into smaller steps").`
					: "Roo Code uses complex prompts and iterative task execution that may be challenging for less capable models. For best results, it's recommended to use Claude 3.5 Sonnet for its advanced agentic coding capabilities.",
			)
			if (response === "messageResponse") {
				userContent.push(
					...[
						{
							type: "text",
							text: formatResponse.tooManyMistakes(text),
						} as Anthropic.Messages.TextBlockParam,
						...formatResponse.imageBlocks(images),
					],
				)
			}
			this.consecutiveMistakeCount = 0
		}

		const previousApiReqIndex = findLastIndex(this.clineMessages, (m) => m.say === "api_req_started")

		await this.say(
			"api_req_started",
			JSON.stringify({
				request:
					userContent.map((block) => formatContentBlockToMarkdown(block)).join("\n\n") + "\n\nLoading...",
			}),
		)

		const [parsedUserContent, environmentDetails] = await this.loadContext(userContent, includeFileDetails)
		userContent = parsedUserContent

		userContent.push({ type: "text", text: environmentDetails })

		await this.addToApiConversationHistory({ role: "user", content: userContent })

		const lastApiReqIndex = findLastIndex(this.clineMessages, (m) => m.say === "api_req_started")
		this.clineMessages[lastApiReqIndex].text = JSON.stringify({
			request: userContent.map((block) => formatContentBlockToMarkdown(block)).join("\n\n"),
		} satisfies ClineApiReqInfo)
		await this.saveClineMessages()
		await this.providerRef.deref()?.postStateToWebview()

		try {
			let cacheWriteTokens = 0
			let cacheReadTokens = 0
			let inputTokens = 0
			let outputTokens = 0
			let totalCost: number | undefined

			const updateApiReqMsg = (cancelReason?: ClineApiReqCancelReason, streamingFailedMessage?: string) => {
				this.clineMessages[lastApiReqIndex].text = JSON.stringify({
					...JSON.parse(this.clineMessages[lastApiReqIndex].text || "{}"),
					tokensIn: inputTokens,
					tokensOut: outputTokens,
					cacheWrites: cacheWriteTokens,
					cacheReads: cacheReadTokens,
					cost:
						totalCost ??
						calculateApiCost(
							this.api.getModel().info,
							inputTokens,
							outputTokens,
							cacheWriteTokens,
							cacheReadTokens,
						),
					cancelReason,
					streamingFailedMessage,
				} satisfies ClineApiReqInfo)
			}

			const abortStream = async (cancelReason: ClineApiReqCancelReason, streamingFailedMessage?: string) => {
				if (this.diffViewProvider.isEditing) {
					await this.diffViewProvider.revertChanges()
				}

				const lastMessage = this.clineMessages.at(-1)
				if (lastMessage && lastMessage.partial) {
					lastMessage.partial = false

					console.log("updating partial message", lastMessage)
				}

				await this.addToApiConversationHistory({
					role: "assistant",
					content: [
						{
							type: "text",
							text:
								assistantMessage +
								`\n\n[${
									cancelReason === "streaming_failed"
										? "Response interrupted by API Error"
										: "Response interrupted by user"
								}]`,
						},
					],
				})

				updateApiReqMsg(cancelReason, streamingFailedMessage)
				await this.saveClineMessages()

				this.didFinishAborting = true
			}

			this.currentStreamingContentIndex = 0
			this.assistantMessageContent = []
			this.didCompleteReadingStream = false
			this.userMessageContent = []
			this.userMessageContentReady = false
			this.didRejectTool = false
			this.didAlreadyUseTool = false
			this.presentAssistantMessageLocked = false
			this.presentAssistantMessageHasPendingUpdates = false
			await this.diffViewProvider.reset()

			const stream = this.attemptApiRequest(previousApiReqIndex)
			let assistantMessage = ""
			let reasoningMessage = ""
			try {
				for await (const chunk of stream) {
					if (!chunk) {
						continue
					}
					switch (chunk.type) {
						case "reasoning":
							reasoningMessage += chunk.text
							await this.say("reasoning", reasoningMessage, undefined, true)
							break
						case "usage":
							inputTokens += chunk.inputTokens
							outputTokens += chunk.outputTokens
							cacheWriteTokens += chunk.cacheWriteTokens ?? 0
							cacheReadTokens += chunk.cacheReadTokens ?? 0
							totalCost = chunk.totalCost
							break
						case "text":
							assistantMessage += chunk.text

							const prevLength = this.assistantMessageContent.length
							this.assistantMessageContent = parseAssistantMessage(assistantMessage)
							if (this.assistantMessageContent.length > prevLength) {
								this.userMessageContentReady = false
							}

							this.presentAssistantMessage()
							break
					}

					if (this.abort) {
						console.log("aborting stream...")
						if (!this.abandoned) {
							await abortStream("user_cancelled")
						}
						break
					}

					if (this.didRejectTool) {
						assistantMessage += "\n\n[Response interrupted by user feedback]"

						break
					}

					if (this.didAlreadyUseTool) {
						assistantMessage +=
							"\n\n[Response interrupted by a tool use result. Only one tool may be used at a time and should be placed at the end of the message.]"
						break
					}
				}
			} catch (error) {
				if (!this.abandoned) {
					this.abortTask()
					await abortStream(
						"streaming_failed",
						error.message ?? JSON.stringify(serializeError(error), null, 2),
					)
					const history = await this.providerRef.deref()?.getTaskWithId(this.taskId)
					if (history) {
						await this.providerRef.deref()?.initClineWithHistoryItem(history.historyItem)
					}
				}
			}

			if (this.abort) {
				throw new Error("Roo Code instance aborted")
			}

			this.didCompleteReadingStream = true

			const partialBlocks = this.assistantMessageContent.filter((block) => block.partial)
			partialBlocks.forEach((block) => {
				block.partial = false
			})

			if (partialBlocks.length > 0) {
				this.presentAssistantMessage()
			}

			updateApiReqMsg()
			await this.saveClineMessages()
			await this.providerRef.deref()?.postStateToWebview()

			let didEndLoop = false
			if (assistantMessage.length > 0) {
				await this.addToApiConversationHistory({
					role: "assistant",
					content: [{ type: "text", text: assistantMessage }],
				})

				await pWaitFor(() => this.userMessageContentReady)

				const didToolUse = this.assistantMessageContent.some((block) => block.type === "tool_use")
				if (!didToolUse) {
					this.userMessageContent.push({
						type: "text",
						text: formatResponse.noToolsUsed(),
					})
					this.consecutiveMistakeCount++
				}

				const recDidEndLoop = await this.recursivelyMakeClineRequests(this.userMessageContent)
				didEndLoop = recDidEndLoop
			} else {
				await this.say(
					"error",
					"Unexpected API Response: The language model did not provide any assistant messages. This may indicate an issue with the API or the model's output.",
				)
				await this.addToApiConversationHistory({
					role: "assistant",
					content: [{ type: "text", text: "Failure: I did not provide a response." }],
				})
			}

			return didEndLoop
		} catch (error) {
			return true
		}
	}
	//TODO: For models that do not support prompt caching, track read files as pinned files that are re-read each user message such that the model a) always has the correct current version, and b) does not have any outdated versions.
	/**
	 * Loads context information for the current task, including file details and environment information.
	 *
	 * @param userContent - Array of user content blocks to load context for.
	 * @param includeFileDetails - Boolean indicating whether to include detailed file listings.
	 * @returns A Promise that resolves to a tuple containing parsed user content and environment details string.
	 */
	async loadContext(userContent: UserContent, includeFileDetails: boolean = false) {
		return Promise.all([
			Promise.all(
				userContent.map(async (block) => {
					const shouldProcessMentions = (text: string) =>
						text.includes("<task>") || text.includes("<feedback>")

					if (block.type === "text") {
						if (shouldProcessMentions(block.text)) {
							return {
								...block,
								text: await parseMentions(block.text, cwd, this.urlContentFetcher),
							}
						}
						return block
					} else if (block.type === "tool_result") {
						if (typeof block.content === "string") {
							if (shouldProcessMentions(block.content)) {
								return {
									...block,
									content: await parseMentions(block.content, cwd, this.urlContentFetcher),
								}
							}
							return block
						} else if (Array.isArray(block.content)) {
							const parsedContent = await Promise.all(
								block.content.map(async (contentBlock) => {
									if (contentBlock.type === "text" && shouldProcessMentions(contentBlock.text)) {
										return {
											...contentBlock,
											text: await parseMentions(contentBlock.text, cwd, this.urlContentFetcher),
										}
									}
									return contentBlock
								}),
							)
							return {
								...block,
								content: parsedContent,
							}
						}
						return block
					}
					return block
				}),
			),
			this.getEnvironmentDetails(includeFileDetails),
		])
	}
	/**
	 * Retrieves detailed environment information, including visible files, open tabs, terminal outputs, and system details.
	 *
	 * @param includeFileDetails - Boolean indicating whether to include detailed file listings.
	 * @returns A Promise that resolves to a string containing formatted environment details.
	 */
	async getEnvironmentDetails(includeFileDetails: boolean = false) {
		let details = ""

		details += "\n\n# VSCode Visible Files"
		const visibleFiles = vscode.window.visibleTextEditors
			?.map((editor) => editor.document?.uri?.fsPath)
			.filter(Boolean)
			.map((absolutePath) => path.relative(cwd, absolutePath).toPosix())
			.join("\n")
		if (visibleFiles) {
			details += `\n${visibleFiles}`
		} else {
			details += "\n(No visible files)"
		}

		details += "\n\n# VSCode Open Tabs"
		const openTabs = vscode.window.tabGroups.all
			.flatMap((group) => group.tabs)
			.map((tab) => (tab.input as vscode.TabInputText)?.uri?.fsPath)
			.filter(Boolean)
			.map((absolutePath) => path.relative(cwd, absolutePath).toPosix())
			.join("\n")
		if (openTabs) {
			details += `\n${openTabs}`
		} else {
			details += "\n(No open tabs)"
		}

		const busyTerminals = this.terminalManager.getTerminals(true)
		const inactiveTerminals = this.terminalManager.getTerminals(false)

		if (busyTerminals.length > 0 && this.didEditFile) {
			await delay(300)
		}

		if (busyTerminals.length > 0) {
			await pWaitFor(() => busyTerminals.every((t) => !this.terminalManager.isProcessHot(t.id)), {
				interval: 100,
				timeout: 15_000,
			}).catch(() => {})
		}

		this.didEditFile = false

		let terminalDetails = ""
		if (busyTerminals.length > 0) {
			terminalDetails += "\n\n# Actively Running Terminals"
			for (const busyTerminal of busyTerminals) {
				terminalDetails += `\n## Original command: \`${busyTerminal.lastCommand}\``
				const newOutput = this.terminalManager.getUnretrievedOutput(busyTerminal.id)
				if (newOutput) {
					terminalDetails += `\n### New Output\n${newOutput}`
				} else {
				}
			}
		}

		if (inactiveTerminals.length > 0) {
			const inactiveTerminalOutputs = new Map<number, string>()
			for (const inactiveTerminal of inactiveTerminals) {
				const newOutput = this.terminalManager.getUnretrievedOutput(inactiveTerminal.id)
				if (newOutput) {
					inactiveTerminalOutputs.set(inactiveTerminal.id, newOutput)
				}
			}
			if (inactiveTerminalOutputs.size > 0) {
				terminalDetails += "\n\n# Inactive Terminals"
				for (const [terminalId, newOutput] of inactiveTerminalOutputs) {
					const inactiveTerminal = inactiveTerminals.find((t) => t.id === terminalId)
					if (inactiveTerminal) {
						terminalDetails += `\n## ${inactiveTerminal.lastCommand}`
						terminalDetails += `\n### New Output\n${newOutput}`
					}
				}
			}
		}

		if (terminalDetails) {
			details += terminalDetails
		}

		const now = new Date()
		const formatter = new Intl.DateTimeFormat(undefined, {
			year: "numeric",
			month: "numeric",
			day: "numeric",
			hour: "numeric",
			minute: "numeric",
			second: "numeric",
			hour12: true,
		})
		const timeZone = formatter.resolvedOptions().timeZone
		const timeZoneOffset = -now.getTimezoneOffset() / 60
		const timeZoneOffsetStr = `${timeZoneOffset >= 0 ? "+" : ""}${timeZoneOffset}:00`
		details += `\n\n# Current Time\n${formatter.format(now)} (${timeZone}, UTC${timeZoneOffsetStr})`

		const { contextTokens } = getApiMetrics(this.clineMessages)
		const modelInfo = this.api.getModel().info
		const contextWindow = modelInfo.contextWindow
		const contextPercentage =
			contextTokens && contextWindow ? Math.round((contextTokens / contextWindow) * 100) : undefined
		details += `\n\n# Current Context Size (Tokens)\n${contextTokens ? `${contextTokens.toLocaleString()} (${contextPercentage}%)` : "(Not available)"}`

		const { mode, customModes } = (await this.providerRef.deref()?.getState()) ?? {}
		const currentMode = mode ?? defaultModeSlug
		details += `\n\n# Current Mode\n${currentMode}`

		if (
			!isToolAllowedForMode("write_to_file", currentMode, customModes ?? [], {
				apply_diff: this.diffEnabled,
			}) &&
			!isToolAllowedForMode("apply_diff", currentMode, customModes ?? [], { apply_diff: this.diffEnabled })
		) {
			const currentModeName = getModeBySlug(currentMode, customModes)?.name ?? currentMode
			const defaultModeName = getModeBySlug(defaultModeSlug, customModes)?.name ?? defaultModeSlug
			details += `\n\nNOTE: You are currently in '${currentModeName}' mode which only allows read-only operations. To write files or execute commands, the user will need to switch to '${defaultModeName}' mode. Note that only the user can switch modes.`
		}

		if (includeFileDetails) {
			details += `\n\n# Current Working Directory (${cwd.toPosix()}) Files\n`
			const isDesktop = arePathsEqual(cwd, path.join(os.homedir(), "Desktop"))
			if (isDesktop) {
				details += "(Desktop files not shown automatically. Use list_files to explore if needed.)"
			} else {
				const [files, didHitLimit] = await listFiles(cwd, {
					path: cwd,
					format: "tree",
					recursive: true,
					limit: 200,
				})
				const result = JSON.stringify(files, null, 2)
				details += result
			}
		}

		return `<environment_details>\n${details.trim()}\n</environment_details>`
	}
}

function escapeRegExp(string: string): string {
	return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}
