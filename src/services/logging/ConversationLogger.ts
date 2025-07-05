import * as vscode from "vscode"
import * as fs from "fs/promises"
import * as path from "path"

/**
 * Logs conversations in a structured format to be used for fine-tuning models.
 * Each conversation is logged as a separate session, with a unique session ID.
 * The logs are stored in the `.roo-logs` directory in the workspace root.
 *
 * This class is designed to capture the back-and-forth between the user and the AI,
 * including user messages, AI responses, and tool calls. The structured logs are
 * then processed by the `create-finetuning-data.ts` script to generate datasets
 * compatible with Gemini on Vertex AI for supervised fine-tuning.
 */
export class ConversationLogger {
	private logFilePath!: string
	private sessionId!: string
	private isEnabled: boolean = false
	private readonly logDir: string

	/**
	 * @param workspaceRoot The root path of the current VS Code workspace.
	 */
	constructor(private readonly workspaceRoot: string) {
		this.isEnabled = vscode.workspace.getConfiguration("roo-cline.logging").get("enabled", false)
		this.logDir = path.join(this.workspaceRoot, ".roo-logs")
		this.ensureLogDirectory(this.logDir)
		this.startNewSession()
	}

	/**
	 * Starts a new logging session by generating a new session ID and setting the log file path.
	 * This should be called at the beginning of a new conversation or task.
	 * @returns The new session ID.
	 */
	public startNewSession(): string {
		this.sessionId = this.generateSessionId()
		this.logFilePath = path.join(this.logDir, `${this.sessionId}.jsonl`)
		return this.sessionId
	}

	/**
	 * Responds to configuration changes, enabling or disabling logging accordingly.
	 */
	public onConfigurationChanged(): void {
		this.isEnabled = vscode.workspace.getConfiguration("roo-cline.logging").get("enabled", false)
		console.log(`[ConversationLogger] Logging enabled: ${this.isEnabled}`)
	}

	private generateSessionId(): string {
		return `session_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`
	}

	private async ensureLogDirectory(logDir: string): Promise<void> {
		try {
			await fs.mkdir(logDir, { recursive: true })
		} catch (error) {
			console.error("Failed to create log directory:", error)
		}
	}

	private async appendToLog(entry: any): Promise<void> {
		if (!this.isEnabled) return

		try {
			const logLine = JSON.stringify(entry) + "\n"
			await fs.appendFile(this.logFilePath, logLine, "utf8")
		} catch (error) {
			console.error("Failed to write to log file:", error)
		}
	}

	/**
	 * Logs a message from the user.
	 * @param message The content of the user's message.
	 * @param mode The Roo Code mode active when the message was sent.
	 * @param context Additional context about the message.
	 */
	async logUserMessage(message: string, mode: string = "code", context?: any): Promise<void> {
		const entry = {
			timestamp: new Date().toISOString(),
			session_id: this.sessionId,
			type: "user_message",
			mode: mode,
			content: message,
			context: context || {},
		}
		await this.appendToLog(entry)
	}

	/**
	 * Logs a response from the AI.
	 * @param response The content of the AI's response.
	 * @param mode The Roo Code mode active during the response.
	 * @param toolCalls Any tool calls made by the AI in this response.
	 */
	async logAIResponse(response: string, mode: string = "code", toolCalls?: any[]): Promise<void> {
		const entry = {
			timestamp: new Date().toISOString(),
			session_id: this.sessionId,
			type: "ai_response",
			mode: mode,
			content: response,
			tool_calls: toolCalls || [],
		}
		await this.appendToLog(entry)
	}

	/**
	 * Logs the execution of a tool.
	 * @param toolName The name of the tool that was called.
	 * @param parameters The parameters passed to the tool.
	 * @param result The result of the tool's execution.
	 */
	async logToolCall(toolName: string, parameters: any, result?: any): Promise<void> {
		const entry = {
			timestamp: new Date().toISOString(),
			session_id: this.sessionId,
			type: "tool_call",
			tool_name: toolName,
			parameters: parameters,
			result: result,
		}
		await this.appendToLog(entry)
	}
}
