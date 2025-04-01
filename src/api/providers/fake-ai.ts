import { Anthropic } from "@anthropic-ai/sdk"
import { ApiHandler, SingleCompletionHandler } from ".."
import { ApiHandlerOptions, ModelInfo } from "../../shared/api"
import { ApiStream } from "../transform/stream"

interface FakeAI {
	createMessage(systemPrompt: string, messages: Anthropic.Messages.MessageParam[]): ApiStream
	getModel(): { id: string; info: ModelInfo }
	countTokens(content: Array<Anthropic.Messages.ContentBlockParam>): Promise<number>
	completePrompt(prompt: string): Promise<string>
}

export class FakeAIHandler implements ApiHandler, SingleCompletionHandler {
	private ai: FakeAI

	constructor(options: ApiHandlerOptions) {
		if (!options.fakeAi) {
			throw new Error("Fake AI is not set")
		}

		this.ai = options.fakeAi as FakeAI
	}

	async *createMessage(systemPrompt: string, messages: Anthropic.Messages.MessageParam[]): ApiStream {
		try {
			yield* this.ai.createMessage(systemPrompt, messages)
		} catch (error) {
			// If error is already formatted, re-throw it
			if (error instanceof Error && error.message.startsWith("{")) {
				throw error
			}

			// Format errors in a consistent way
			console.error("Fake AI error:", error)

			// Handle rate limit errors specifically
			const errorObj = error as any
			if (
				errorObj.status === 429 ||
				(errorObj.message && errorObj.message.toLowerCase().includes("rate limit"))
			) {
				throw new Error(
					JSON.stringify({
						status: 429,
						message: "Rate limit exceeded",
						error: {
							metadata: {
								raw: errorObj.message || "Too many requests, please try again later",
								provider: "fake-ai",
							},
						},
						errorDetails: [
							{
								"@type": "type.googleapis.com/google.rpc.RetryInfo",
								retryDelay: "30s", // Default retry delay if not provided
							},
						],
					}),
				)
			}

			// Handle authentication errors
			if (errorObj.status === 401 || (errorObj.message && errorObj.message.toLowerCase().includes("api key"))) {
				throw new Error(
					JSON.stringify({
						status: 401,
						message: "Authentication error",
						error: {
							metadata: {
								raw: errorObj.message || "Invalid API key or unauthorized access",
								provider: "fake-ai",
							},
						},
					}),
				)
			}

			// Handle bad request errors
			if (errorObj.status === 400 || (errorObj.error && errorObj.error.type === "invalid_request_error")) {
				throw new Error(
					JSON.stringify({
						status: 400,
						message: "Bad request",
						error: {
							metadata: {
								raw: errorObj.message || "Invalid request parameters",
								param: errorObj.error?.param,
								provider: "fake-ai",
							},
						},
					}),
				)
			}

			// Handle other errors
			if (error instanceof Error) {
				throw new Error(
					JSON.stringify({
						status: errorObj.status || 500,
						message: error.message,
						error: {
							metadata: {
								raw: error.message,
								provider: "fake-ai",
							},
						},
					}),
				)
			} else if (typeof error === "object" && error !== null) {
				const errorDetails = JSON.stringify(error, null, 2)
				throw new Error(
					JSON.stringify({
						status: errorObj.status || 500,
						message: errorObj.message || errorDetails,
						error: {
							metadata: {
								raw: errorDetails,
								provider: "fake-ai",
							},
						},
					}),
				)
			} else {
				// Handle primitive errors or other unexpected types
				throw new Error(
					JSON.stringify({
						status: 500,
						message: String(error),
						error: {
							metadata: {
								raw: String(error),
								provider: "fake-ai",
							},
						},
					}),
				)
			}
		}
	}

	getModel(): { id: string; info: ModelInfo } {
		return this.ai.getModel()
	}

	countTokens(content: Array<Anthropic.Messages.ContentBlockParam>): Promise<number> {
		return this.ai.countTokens(content)
	}

	async completePrompt(prompt: string): Promise<string> {
		try {
			return await this.ai.completePrompt(prompt)
		} catch (error) {
			// If error is already formatted, re-throw it
			if (error instanceof Error && error.message.startsWith("{")) {
				throw error
			}

			// Format errors in a consistent way
			console.error("Fake AI completion error:", error)

			// Handle rate limit errors specifically
			const errorObj = error as any
			if (
				errorObj.status === 429 ||
				(errorObj.message && errorObj.message.toLowerCase().includes("rate limit"))
			) {
				throw new Error(
					JSON.stringify({
						status: 429,
						message: "Rate limit exceeded",
						error: {
							metadata: {
								raw: errorObj.message || "Too many requests, please try again later",
								provider: "fake-ai",
							},
						},
						errorDetails: [
							{
								"@type": "type.googleapis.com/google.rpc.RetryInfo",
								retryDelay: "30s", // Default retry delay if not provided
							},
						],
					}),
				)
			}

			// Handle other errors
			throw new Error(
				JSON.stringify({
					status: errorObj.status || 500,
					message: "Fake AI completion error: " + (error instanceof Error ? error.message : String(error)),
					error: {
						metadata: {
							raw: error instanceof Error ? error.message : String(error),
							provider: "fake-ai",
						},
					},
				}),
			)
		}
	}
}
