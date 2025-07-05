import * as vscode from "vscode"
import * as fs from "fs/promises"
import * as path from "path"

export class ConversationLogger {
	private logFilePath!: string
	private sessionId: string
	private isEnabled: boolean = false

	constructor(workspaceRoot: string) {
		this.sessionId = this.generateSessionId()
		this.isEnabled = vscode.workspace.getConfiguration("roo-cline.logging").get("enabled", false)

		const logDir = path.join(workspaceRoot, ".roo-logs")
		this.logFilePath = path.join(logDir, `${this.sessionId}.jsonl`)
		this.ensureLogDirectory(logDir)
	}

	public onConfigurationChanged(): void {
		this.isEnabled = vscode.workspace.getConfiguration("roo-cline.logging").get("enabled", false)
		console.log(`[ConversationLogger] Logging enabled: ${this.isEnabled}`)
	}

	private generateSessionId(): string {
		return `sess_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`
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
