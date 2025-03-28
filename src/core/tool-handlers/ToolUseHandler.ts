// src/core/tool-handlers/ToolUseHandler.ts
import { ToolUse } from "../assistant-message"
import { Cline } from "../Cline"

export abstract class ToolUseHandler {
	protected cline: Cline
	protected toolUse: ToolUse

	constructor(cline: Cline, toolUse: ToolUse) {
		this.cline = cline
		this.toolUse = toolUse
	}

	/**
	 * Handle the tool use, both partial and complete states
	 * @returns Promise<boolean> true if the tool was handled completely, false if only partially handled (streaming)
	 */
	abstract handle(): Promise<boolean>

	/**
	 * Handle a partial tool use (streaming)
	 * This method should update the UI/state based on the partial data received so far.
	 * It typically returns void as the handling is ongoing.
	 */
	protected abstract handlePartial(): Promise<void>

	/**
	 * Handle a complete tool use
	 * This method performs the final action for the tool use after all data is received.
	 * It typically returns void as the action is completed within this method.
	 */
	protected abstract handleComplete(): Promise<void>

	/**
	 * Validate the tool parameters
	 * @throws Error if validation fails
	 */
	abstract validateParams(): void

	/**
	 * Helper to remove potentially incomplete closing tags from parameters during streaming.
	 * Example: <path>src/my</path> might stream as "src/my</pat" initially.
	 * This helps get the usable value during partial updates.
	 */
	protected removeClosingTag(tag: string, text?: string): string {
		// Only apply removal if it's a partial tool use
		if (!this.toolUse.partial) {
			return text || ""
		}
		if (!text) {
			return ""
		}
		// Regex to match a potentially incomplete closing tag at the end of the string
		// Example: Matches </tag>, </ta>, </t>, </
		const tagRegex = new RegExp(
			`\\s*<\\/?${tag
				.split("")
				.map((char) => `(?:${char})?`) // Match each character optionally
				.join("")}$`,
			"g",
		)
		return text.replace(tagRegex, "")
	}

	/**
	 * Helper to handle missing parameters consistently.
	 * Increments mistake count and formats a standard error message for the API.
	 */
	protected async handleMissingParam(paramName: string): Promise<string> {
		this.cline.consecutiveMistakeCount++ // Assuming consecutiveMistakeCount is accessible or moved
		// Consider making sayAndCreateMissingParamError public or moving it to a shared utility
		// if consecutiveMistakeCount remains private and central to Cline.
		// For now, assuming it can be called or its logic replicated here/in base class.
		return await this.cline.sayAndCreateMissingParamError(
			this.toolUse.name,
			paramName,
			this.toolUse.params.path, // Assuming path might be relevant context, though not always present
		)
	}
}
