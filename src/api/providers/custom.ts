import { ApiHandler, ApiHandlerOptions, CommonMessage, CustomProviderConfig } from "../../shared/api"
import { ApiStream, ApiStreamChunk, ApiStreamTextChunk } from "../transform/stream"

// Remove duplicate interface definitions since we're importing from shared/api
interface ProviderVariables {
	temperature?: number
	stream?: boolean
	model?: string
	maxOutputTokens?: number
}

export class CustomHandler implements ApiHandler {
	private options: ApiHandlerOptions & { customProvider?: CustomProviderConfig }

	constructor(options: ApiHandlerOptions) {
		this.options = options
	}

	getModel() {
		const provider = this.options.customProvider
		// More permissive check - only validate essential properties
		if (!provider?.name || !provider?.request?.url) {
			throw new Error("Custom provider is not properly configured. Required fields: name, request.url")
		}

		// Check if provider explicitly supports computer use
		const supportsComputerUse = provider.supportsComputerUse ?? false

		// If computer use is enabled, validate required fields for tool support
		if (supportsComputerUse) {
			if (!provider.format || !provider.format.messages) {
				throw new Error("Provider configuration missing format.messages field required for tool support")
			}
		}

		return {
			id: provider.name,
			info: {
				maxTokens: provider.maxTokens ?? 4096,
				contextWindow: provider.contextWindow ?? 8192,
				supportsImages: provider.supportsImages ?? false,
				supportsComputerUse,
				supportsPromptCache: false,
				inputPrice: provider.inputPrice ?? 0,
				outputPrice: provider.outputPrice ?? 0,
				description: provider.description || `Custom provider: ${provider.name}`,
			},
		}
	}

	private formatMessage(message: CommonMessage): { role: string; content: string | Array<any> } {
		// Validate message role
		if (!["user", "assistant", "system"].includes(message.role)) {
			throw new Error(`Invalid message role: ${message.role}`)
		}

		const provider = this.options.customProvider
		const formatAsArray = provider?.format?.messages === "array"

		// Handle string content
		if (typeof message.content === "string") {
			return {
				role: message.role,
				content: message.content.trim() || "",
			}
		}

		// Handle array content
		if (!Array.isArray(message.content)) {
			throw new Error("Message content must be string or array")
		}

		// For array format, preserve the structure for tools and code blocks
		if (formatAsArray) {
			const formattedContent = message.content
				.map((c) => {
					if (!c || typeof c !== "object") return null

					switch (c.type) {
						case "text":
							return { type: "text", text: c.text?.trim() || "" }
						case "image":
							return {
								type: "image",
								url:
									typeof c.image_url === "string"
										? c.image_url
										: typeof c.image_url === "object"
											? c.image_url.url
											: "",
							}
						case "tool_code":
							return {
								type: "tool_call",
								id: c.toolUseId || `tool_${Date.now()}`,
								name: c.name || "execute_code",
								input: c.tool_code?.trim() || "",
								code: c.tool_code?.trim() || "",
							}
						case "tool_result":
							return {
								type: "tool_result",
								tool_call_id: c.toolUseId,
								output: c.output || "",
							}
						default:
							return null
					}
				})
				.filter(Boolean)

			return {
				role: message.role,
				content: formattedContent,
			}
		}

		// For string format, join with appropriate formatting
		const formattedContent = message.content
			.map((c) => {
				if (!c || typeof c !== "object") return ""

				switch (c.type) {
					case "text":
						return c.text?.trim() || ""
					case "image":
						return typeof c.image_url === "string"
							? c.image_url
							: typeof c.image_url === "object"
								? c.image_url.url
								: ""
					case "tool_code":
						return `\`\`\`\n${c.tool_code?.trim() || ""}\n\`\`\``
					case "tool_result":
						return `Tool Result:\n\`\`\`\n${
							typeof c.output === "string" ? c.output : JSON.stringify(c.output, null, 2)
						}\n\`\`\``
					default:
						return ""
				}
			})
			.filter(Boolean)
			.join("\n\n")

		return {
			role: message.role,
			content: formattedContent || "",
		}
	}

	private async buildRequestBody(provider: CustomProviderConfig, formattedMessages: any[]) {
		// Parse format data with variable substitution
		let formatData = provider.format.data || "{}"

		// Replace variables in format data
		if (provider.variables) {
			Object.entries(provider.variables).forEach(([key, value]) => {
				const placeholder = new RegExp(`<${key}>`, "g")
				formatData = formatData.replace(placeholder, JSON.stringify(value))
			})
		}

		console.log("Format data after variable substitution:", formatData) // Debug log

		const baseData = JSON.parse(formatData)

		// Handle messages format
		const formattedMessagesData =
			provider.format.messages === "string" ? JSON.stringify(formattedMessages) : formattedMessages

		// Merge messages with base data
		const requestBody = {
			...baseData,
			messages: formattedMessagesData,
		}

		console.log("Final request body:", JSON.stringify(requestBody, null, 2)) // Debug log
		return requestBody
	}

	async *createMessage(systemPrompt: string, messages: CommonMessage[]): ApiStream {
		const provider = this.options.customProvider

		if (!provider) {
			throw new Error("No custom provider configured")
		}

		if (!provider.request?.url) {
			throw new Error("Custom provider URL not configured")
		}

		if (!provider.apiKey || provider.apiKey.startsWith("${")) {
			throw new Error(`Invalid API key configuration for provider: ${provider.name}`)
		}

		try {
			const formattedMessages = [
				this.formatMessage({ role: "system", content: systemPrompt }),
				...messages.map((msg) => this.formatMessage(msg)),
			]

			// Build request body
			const requestBody = await this.buildRequestBody(provider, formattedMessages)

			const headers = {
				"Content-Type": "application/json",
				Authorization: `Bearer ${provider.apiKey}`,
				...provider.request.headers,
			}

			const response = await fetch(provider.request.url, {
				method: provider.format.method,
				headers,
				body: JSON.stringify(requestBody),
			})

			if (!response.ok) {
				const errorText = await response.text()
				throw new Error(`API request failed with status ${response.status}: ${errorText}`)
			}

			// Handle streaming responses
			const isStreaming =
				response.headers.get("content-type")?.includes("text/event-stream") || !!requestBody.stream
			if (isStreaming) {
				const reader = response.body?.getReader()
				if (!reader) {
					throw new Error("No response body available")
				}

				while (true) {
					const { done, value } = await reader.read()
					if (done) break

					const rawText = new TextDecoder().decode(value)
					console.log("Raw SSE response:", rawText) // Debug log

					// Handle SSE format by splitting on newlines and processing each data line
					const lines = rawText.split(/\r?\n/).filter(Boolean)
					for (const line of lines) {
						if (!line.startsWith("data: ")) continue

						const data = line.slice(6) // Remove 'data: ' prefix
						if (data.trim() === "[DONE]") continue

						try {
							const parsed = JSON.parse(data)
							if (!parsed) continue

							// For streaming responses, we only care about delta content
							const deltaContent = parsed.choices?.[0]?.delta?.content
							if (deltaContent !== undefined && deltaContent !== null) {
								// Yield non-empty chunks immediately
								if (deltaContent) {
									yield {
										type: "text",
										text: deltaContent,
									} as ApiStreamTextChunk
								}
								continue
							}

							// If no delta content, try regular content paths
							if (provider.responsePath) {
								try {
									const content = provider.responsePath
										.split(/[.[\]]/)
										.filter(Boolean)
										.reduce((obj, key) => {
											// Remove any remaining brackets and quotes
											key = key.replace(/[[\]'"]/g, "")
											return obj && key in obj ? obj[key] : undefined
										}, parsed)

									if (content) {
										yield {
											type: "text",
											text: content,
										} as ApiStreamTextChunk
									}
								} catch (pathError) {
									console.log(`Path ${provider.responsePath} not found in response`)
								}
							}
						} catch (e) {
							console.error("Error parsing SSE JSON data:", e, "\nRaw data:", data)
							throw e
						}
					}
				}
			} else {
				// Handle regular JSON response
				const rawText = await response.text()
				console.log("Raw response:", rawText) // Debug log

				let contentFound = false
				try {
					const parsed = JSON.parse(rawText)
					if (parsed) {
						// Handle token usage information
						let inputTokens = 0
						let outputTokens = 0
						let foundUsage = false

						// First try OpenAI-compatible usage format
						if (parsed.usage?.prompt_tokens && parsed.usage?.completion_tokens) {
							inputTokens = parsed.usage.prompt_tokens
							outputTokens = parsed.usage.completion_tokens
							foundUsage = true
						}
						// Then try custom usage paths if configured
						else if (provider.usagePaths) {
							if (provider.usagePaths.promptTokens) {
								const value = provider.usagePaths.promptTokens
									.split(".")
									.reduce((obj, key) => obj?.[key], parsed)
								if (typeof value === "number") {
									inputTokens = value
									foundUsage = true
								}
							}
							if (provider.usagePaths.outputTokens) {
								const value = provider.usagePaths.outputTokens
									.split(".")
									.reduce((obj, key) => obj?.[key], parsed)
								if (typeof value === "number") {
									outputTokens = value
									foundUsage = true
								}
							}
						}

						if (foundUsage) {
							yield {
								type: "usage",
								inputTokens,
								outputTokens,
							} as ApiStreamChunk
						}

						// Try common response paths
						const paths = [
							"choices[0].message.content", // OpenAI format
							provider.responsePath, // Configured path
						].filter(Boolean) // Remove undefined paths

						for (const path of paths) {
							if (!path) continue

							try {
								const content = path
									.split(/[.[\]]/)
									.filter(Boolean)
									.reduce((obj, key) => {
										key = key.replace(/[[\]'"]/g, "")
										return obj && key in obj ? obj[key] : undefined
									}, parsed)

								if (content) {
									yield {
										type: "text",
										text: content,
									} as ApiStreamTextChunk
									contentFound = true
									break
								}
							} catch (pathError) {
								console.log(`Path ${path} not found in response`)
								continue
							}
						}
					}
				} catch (e) {
					console.error("Error parsing JSON data:", e)
				}

				// If no content was found through paths, use raw text as fallback
				if (!contentFound) {
					yield {
						type: "text",
						text: rawText,
					} as ApiStreamTextChunk
				}
			}
		} catch (error: any) {
			console.error("Error in custom provider:", error)
			throw error // Let Cline handle the error
		}
	}
}
