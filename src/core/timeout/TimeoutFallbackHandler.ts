import type { ToolName } from "@roo-code/types"
import type { Task } from "../task/Task"
import type { SingleCompletionHandler } from "../../api"
import {
	createTimeoutFallbackPrompt,
	parseTimeoutFallbackResponse,
	type TimeoutFallbackContext,
} from "../prompts/instructions/timeout-fallback"
import { formatResponse } from "../prompts/responses"

export interface TimeoutFallbackResult {
	success: boolean
	toolCall?: {
		name: "ask_followup_question"
		params: {
			question: string
			follow_up: string
		}
	}
	error?: string
}

/**
 * Unified timeout fallback handler that generates AI-powered fallback suggestions
 * and creates timeout responses in a single optimized flow
 */
export class TimeoutFallbackHandler {
	private static readonly BACKGROUND_OPERATION_TOOLS = ["execute_command", "browser_action"]

	/**
	 * Helper method to generate the timeout question message
	 */
	private static generateTimeoutQuestion(toolName: ToolName, timeoutMs: number): string {
		const mightContinueInBackground = this.BACKGROUND_OPERATION_TOOLS.includes(toolName)
		const baseMessage = `The ${toolName} operation timed out after ${Math.round(timeoutMs / 1000)} seconds`
		const backgroundSuffix = mightContinueInBackground ? " but may still be running in the background" : ""
		return `${baseMessage}${backgroundSuffix}. How would you like to proceed?`
	}

	/**
	 * Create a timeout response with AI-generated fallback question in a single optimized query
	 */
	public static async createTimeoutResponse(
		toolName: ToolName,
		timeoutMs: number,
		executionTimeMs: number,
		context?: any,
		task?: Task,
	): Promise<string> {
		const baseResponse = formatResponse.toolTimeout(toolName, timeoutMs, executionTimeMs)

		// Create a timeout message for display in the chat
		if (task) {
			const mightContinueInBackground = this.BACKGROUND_OPERATION_TOOLS.includes(toolName)

			// Pass a JSON string with the tool info so the UI can determine if it should show a background warning
			const timeoutInfo = JSON.stringify({ toolName, mightContinueInBackground })
			await task.say("tool_timeout", timeoutInfo, undefined, false, undefined, undefined, {
				isNonInteractive: true,
			})
		}

		// Create context for AI fallback generation
		const aiContext: TimeoutFallbackContext = {
			toolName,
			timeoutMs,
			executionTimeMs,
			toolParams: context,
			taskContext: task
				? {
						workingDirectory: task.cwd,
					}
				: undefined,
		}

		// Generate AI-powered fallback (with static fallback if AI fails) in a single call
		const aiResult = await this.generateAiFallback(aiContext, task)

		if (aiResult.success && aiResult.toolCall) {
			// Return a response that instructs the model to ask a follow-up question
			const { question, follow_up } = aiResult.toolCall.params

			// Format the response to explicitly instruct the model to ask the follow-up question
			return `${baseResponse}

The operation timed out. You MUST now use the ask_followup_question tool with the following parameters:

<ask_followup_question>
<question>${question}</question>
<follow_up>
${follow_up}
</follow_up>
</ask_followup_question>

This is required to help the user decide how to proceed after the timeout.`
		}

		// This should rarely happen since generateAiFallback always provides static fallback
		return `${baseResponse}\n\nThe operation timed out. Please consider breaking this into smaller steps or trying a different approach.`
	}

	/**
	 * Generate an AI-powered ask_followup_question tool call for timeout scenarios
	 */
	public static async generateAiFallback(
		context: TimeoutFallbackContext,
		task?: Task,
	): Promise<TimeoutFallbackResult> {
		// Try to use AI to generate contextual suggestions
		if (task?.api && "completePrompt" in task.api) {
			try {
				// Pass the timeout from context to use exact tool timeout
				const aiResult = await this.generateAiSuggestions(
					context,
					task.api as SingleCompletionHandler,
					context.timeoutMs,
				)
				if (aiResult.success) {
					console.log(`[TimeoutFallbackHandler] AI suggestions generated successfully`)
					return aiResult
				}
				console.error(`[TimeoutFallbackHandler] AI suggestions failed:`, aiResult.error)
			} catch (error) {
				// AI failed, fall through to static suggestions
			}
		}

		// Fallback to static suggestions if AI fails or is unavailable
		const toolCall = this.generateStaticToolCall(context)

		return {
			success: true,
			toolCall,
		}
	}

	/**
	 * Generate AI-powered suggestions using the task's API handler
	 */
	private static async generateAiSuggestions(
		context: TimeoutFallbackContext,
		apiHandler: SingleCompletionHandler,
		timeoutMs: number,
	): Promise<TimeoutFallbackResult> {
		try {
			const prompt = createTimeoutFallbackPrompt(context)

			// Create a timeout promise using exactly the same timeout as the tool
			const timeoutPromise = new Promise<never>((_, reject) => {
				setTimeout(() => {
					reject(new Error(`AI fallback generation timed out after ${timeoutMs / 1000} seconds`))
				}, timeoutMs)
			})

			// Race between AI completion and timeout
			const aiResponse = await Promise.race([apiHandler.completePrompt(prompt), timeoutPromise])

			// Parse the AI response to extract suggestions
			const suggestions = parseTimeoutFallbackResponse(aiResponse)

			if (suggestions.length === 0) {
				throw new Error("No valid suggestions generated by AI")
			}

			const question = this.generateTimeoutQuestion(context.toolName, context.timeoutMs)

			const followUpXml = suggestions
				.map((suggestion) =>
					suggestion.mode
						? `<suggest mode="${suggestion.mode}">${suggestion.text}</suggest>`
						: `<suggest>${suggestion.text}</suggest>`,
				)
				.join("\n")

			return {
				success: true,
				toolCall: {
					name: "ask_followup_question",
					params: {
						question,
						follow_up: followUpXml,
					},
				},
			}
		} catch (error) {
			// If it's a timeout error, include that in the error message
			const errorMessage = error instanceof Error ? error.message : "Unknown error generating AI suggestions"

			return {
				success: false,
				error: errorMessage,
			}
		}
	}

	/**
	 * Generate static fallback suggestions when AI is unavailable
	 */
	private static generateStaticToolCall(context: TimeoutFallbackContext): TimeoutFallbackResult["toolCall"] {
		const suggestions = formatResponse.timeoutFallbackSuggestions.generateContextualSuggestions(
			context.toolName,
			context.toolParams,
		)

		const question = this.generateTimeoutQuestion(context.toolName, context.timeoutMs)

		const followUpXml = suggestions
			.map((suggestion) =>
				suggestion.mode
					? `<suggest mode="${suggestion.mode}">${suggestion.text}</suggest>`
					: `<suggest>${suggestion.text}</suggest>`,
			)
			.join("\n")

		return {
			name: "ask_followup_question",
			params: {
				question,
				follow_up: followUpXml,
			},
		}
	}
}
