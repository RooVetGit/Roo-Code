<<<<<<< Updated upstream
import AnthropicBedrock from "@anthropic-ai/bedrock-sdk"
import { Anthropic } from "@anthropic-ai/sdk"
import { withRetry } from "../retry"
import { ApiHandler } from "../"
import { convertToR1Format } from "../transform/r1-format"
import { ApiHandlerOptions, bedrockDefaultModelId, BedrockModelId, bedrockModels, ModelInfo } from "../../shared/api"
import { calculateApiCostOpenAI } from "../../utils/cost"
=======
import {
	BedrockRuntimeClient,
	ConverseStreamCommand,
	ConverseCommand,
	BedrockRuntimeClientConfig,
	ConverseStreamCommandOutput,
} from "@aws-sdk/client-bedrock-runtime"
import { STSClient, GetSessionTokenCommand } from "@aws-sdk/client-sts"
import { fromIni } from "@aws-sdk/credential-providers"
import { Anthropic } from "@anthropic-ai/sdk"
import * as vscode from "vscode"
import { SingleCompletionHandler } from "../"
import {
	ApiHandlerOptions,
	BedrockModelId,
	ModelInfo,
	bedrockDefaultModelId,
	bedrockModels,
	bedrockDefaultPromptRouterModelId,
} from "../../shared/api"
>>>>>>> Stashed changes
import { ApiStream } from "../transform/stream"
import { fromNodeProviderChain } from "@aws-sdk/credential-providers"
import { BedrockRuntimeClient, InvokeModelWithResponseStreamCommand } from "@aws-sdk/client-bedrock-runtime"

// https://docs.anthropic.com/en/api/claude-on-amazon-bedrock
export class AwsBedrockHandler implements ApiHandler {
	private options: ApiHandlerOptions

	/**
	 * Prompts the user for an MFA code and gets temporary credentials using AWS STS
	 * @param region The AWS region to use
	 * @returns Temporary credentials object with accessKeyId, secretAccessKey, and sessionToken
	 */
	private async getMfaCredentials(region: string): Promise<{
		accessKeyId: string
		secretAccessKey: string
		sessionToken: string
	}> {
		// Prompt the user for the MFA code
		const mfaCode = await vscode.window.showInputBox({
			prompt: `Enter MFA code for device ${this.options.awsMfaDevice}`,
			placeHolder: "123456",
			ignoreFocusOut: true,
			validateInput: (value: string) => {
				// MFA codes are typically 6 digits
				return /^\d{6}$/.test(value) ? null : "Please enter a valid 6-digit MFA code"
			},
		})

		if (!mfaCode) {
			throw new Error("MFA code is required")
		}

		// Create STS client
		const stsClient = new STSClient({
			region: region,
			credentials: {
				accessKeyId: this.options.awsAccessKey!,
				secretAccessKey: this.options.awsSecretKey!,
			},
		})

		// Get temporary credentials
		try {
			const command = new GetSessionTokenCommand({
				DurationSeconds: 3600, // 1 hour
				SerialNumber: this.options.awsMfaDevice,
				TokenCode: mfaCode,
			})

			const response = await stsClient.send(command)

			if (!response.Credentials) {
				throw new Error("Failed to get temporary credentials")
			}

			return {
				accessKeyId: response.Credentials.AccessKeyId!,
				secretAccessKey: response.Credentials.SecretAccessKey!,
				sessionToken: response.Credentials.SessionToken!,
			}
		} catch (error) {
			logger.error("Failed to get temporary credentials", {
				ctx: "bedrock",
				error: error instanceof Error ? error : String(error),
			})
			throw new Error(`Failed to get temporary credentials: ${error instanceof Error ? error.message : String(error)}`)
		}
	}

	constructor(options: ApiHandlerOptions) {
		this.options = options
<<<<<<< Updated upstream
=======

		// Extract region from custom ARN if provided
		let region = this.options.awsRegion || "us-east-1"

		// If using custom ARN, extract region from the ARN
		if (this.options.awsCustomArn) {
			const validation = validateBedrockArn(this.options.awsCustomArn, region)

			if (validation.isValid && validation.arnRegion) {
				// If there's a region mismatch warning, log it and use the ARN region
				if (validation.errorMessage) {
					logger.info(
						`Region mismatch: Selected region is ${region}, but ARN region is ${validation.arnRegion}. Using ARN region.`,
						{
							ctx: "bedrock",
							selectedRegion: region,
							arnRegion: validation.arnRegion,
						},
					)
					region = validation.arnRegion
				}
			}
		}

		const clientConfig: BedrockRuntimeClientConfig = {
			region: region,
		}

		// Set up credentials based on the options
		if (this.options.awsUseProfile && this.options.awsProfile) {
			// Use profile-based credentials if enabled and profile is set
			clientConfig.credentials = fromIni({
				profile: this.options.awsProfile,
			})
		} else if (this.options.awsAccessKey && this.options.awsSecretKey) {
			// Use direct credentials if provided
			clientConfig.credentials = {
				accessKeyId: this.options.awsAccessKey,
				secretAccessKey: this.options.awsSecretKey,
				...(this.options.awsSessionToken ? { sessionToken: this.options.awsSessionToken } : {}),
			}
		}

		// Initialize the client with the basic credentials
		this.client = new BedrockRuntimeClient(clientConfig)

		// If MFA is enabled, we'll update the client with temporary credentials when needed
		if (this.options.awsUseMfa && this.options.awsAccessKey && this.options.awsSecretKey && this.options.awsMfaDevice) {
			// We'll get MFA credentials when the first request is made
			this.updateClientWithMfaCredentials(region).catch(error => {
				logger.error("Failed to get MFA credentials", {
					ctx: "bedrock",
					error: error instanceof Error ? error : String(error),
				})
			})
		}
	}

	/**
	 * Updates the Bedrock client with temporary credentials from MFA authentication
	 * @param region The AWS region
	 */
	private async updateClientWithMfaCredentials(region: string): Promise<void> {
		try {
			const tempCredentials = await this.getMfaCredentials(region)
			
			// Create a new client with the temporary credentials
			this.client = new BedrockRuntimeClient({
				region: region,
				credentials: {
					accessKeyId: tempCredentials.accessKeyId,
					secretAccessKey: tempCredentials.secretAccessKey,
					sessionToken: tempCredentials.sessionToken,
				},
			})
			
			logger.info("Successfully updated Bedrock client with MFA credentials", {
				ctx: "bedrock",
			})
		} catch (error) {
			logger.error("Failed to update client with MFA credentials", {
				ctx: "bedrock",
				error: error instanceof Error ? error : String(error),
			})
			// We'll continue using the client with the basic credentials
		}
>>>>>>> Stashed changes
	}

	@withRetry()
	async *createMessage(systemPrompt: string, messages: Anthropic.Messages.MessageParam[]): ApiStream {
		// cross region inference requires prefixing the model id with the region
		let modelId = await this.getModelId()
		const model = this.getModel()

		// Check if this is a Deepseek model
		if (modelId.includes("deepseek")) {
			yield* this.createDeepseekMessage(systemPrompt, messages, modelId, model)
			return
		}

		let budget_tokens = this.options.thinkingBudgetTokens || 0
		const reasoningOn = modelId.includes("3-7") && budget_tokens !== 0 ? true : false

		// Get model info and message indices for caching
		const userMsgIndices = messages.reduce((acc, msg, index) => (msg.role === "user" ? [...acc, index] : acc), [] as number[])
		const lastUserMsgIndex = userMsgIndices[userMsgIndices.length - 1] ?? -1
		const secondLastMsgUserIndex = userMsgIndices[userMsgIndices.length - 2] ?? -1

		// Create anthropic client, using sessions created or renewed after this handler's
		// initialization, and allowing for session renewal if necessary as well
		const client = await this.getAnthropicClient()

		const stream = await client.messages.create({
			model: modelId,
			max_tokens: model.info.maxTokens || 8192,
			thinking: reasoningOn ? { type: "enabled", budget_tokens: budget_tokens } : undefined,
			temperature: reasoningOn ? undefined : 0,
			system: [
				{
					text: systemPrompt,
					type: "text",
					...(this.options.awsBedrockUsePromptCache === true && {
						cache_control: { type: "ephemeral" },
					}),
				},
			],
			messages: messages.map((message, index) => {
				if (index === lastUserMsgIndex || index === secondLastMsgUserIndex) {
					return {
						...message,
						content:
							typeof message.content === "string"
								? [
										{
											type: "text",
											text: message.content,
											...(this.options.awsBedrockUsePromptCache === true && {
												cache_control: { type: "ephemeral" },
											}),
										},
									]
								: message.content.map((content, contentIndex) =>
										contentIndex === message.content.length - 1
											? {
													...content,
													...(this.options.awsBedrockUsePromptCache === true && {
														cache_control: { type: "ephemeral" },
													}),
												}
											: content,
									),
					}
				}
				return message
			}),
			stream: true,
		})

		for await (const chunk of stream) {
			switch (chunk.type) {
				case "message_start":
					const usage = chunk.message.usage
					yield {
						type: "usage",
						inputTokens: usage.input_tokens || 0,
						outputTokens: usage.output_tokens || 0,
						cacheWriteTokens: usage.cache_creation_input_tokens || undefined,
						cacheReadTokens: usage.cache_read_input_tokens || undefined,
					}
					break
				case "message_delta":
					yield {
						type: "usage",
						inputTokens: 0,
						outputTokens: chunk.usage.output_tokens || 0,
					}
					break
				case "content_block_start":
					switch (chunk.content_block.type) {
						case "thinking":
							yield {
								type: "reasoning",
								reasoning: chunk.content_block.thinking || "",
							}
							break
						case "redacted_thinking":
							// Handle redacted thinking blocks - we still mark it as reasoning
							// but note that the content is encrypted
							yield {
								type: "reasoning",
								reasoning: "[Redacted thinking block]",
							}
							break
						case "text":
							if (chunk.index > 0) {
								yield {
									type: "text",
									text: "\n",
								}
							}
							yield {
								type: "text",
								text: chunk.content_block.text,
							}
							break
					}
					break
				case "content_block_delta":
					switch (chunk.delta.type) {
						case "thinking_delta":
							yield {
								type: "reasoning",
								reasoning: chunk.delta.thinking,
							}
							break
						case "text_delta":
							yield {
								type: "text",
								text: chunk.delta.text,
							}
							break
					}
					break
			}
		}
	}

	getModel(): { id: BedrockModelId; info: ModelInfo } {
		const modelId = this.options.apiModelId
		if (modelId && modelId in bedrockModels) {
			const id = modelId as BedrockModelId
			return { id, info: bedrockModels[id] }
		}
		return {
			id: bedrockDefaultModelId,
			info: bedrockModels[bedrockDefaultModelId],
		}
	}

	// Default AWS region
	private static readonly DEFAULT_REGION = "us-east-1"

	/**
	 * Gets AWS credentials using the provider chain
	 * Centralizes credential retrieval logic for all AWS services
	 */
	private async getAwsCredentials(): Promise<{
		accessKeyId: string
		secretAccessKey: string
		sessionToken?: string
	}> {
		// Create AWS credentials by executing an AWS provider chain
		const providerChain = fromNodeProviderChain()
		return await AwsBedrockHandler.withTempEnv(
			() => {
				AwsBedrockHandler.setEnv("AWS_REGION", this.options.awsRegion)
				AwsBedrockHandler.setEnv("AWS_ACCESS_KEY_ID", this.options.awsAccessKey)
				AwsBedrockHandler.setEnv("AWS_SECRET_ACCESS_KEY", this.options.awsSecretKey)
				AwsBedrockHandler.setEnv("AWS_SESSION_TOKEN", this.options.awsSessionToken)
				AwsBedrockHandler.setEnv("AWS_PROFILE", this.options.awsProfile)
			},
			() => providerChain(),
		)
	}

	/**
	 * Gets the AWS region to use, with fallback to default
	 */
	private getRegion(): string {
		return this.options.awsRegion || AwsBedrockHandler.DEFAULT_REGION
	}

	/**
	 * Creates a BedrockRuntimeClient with the appropriate credentials
	 */
	private async getBedrockClient(): Promise<BedrockRuntimeClient> {
		const credentials = await this.getAwsCredentials()

		return new BedrockRuntimeClient({
			region: this.getRegion(),
			credentials: {
				accessKeyId: credentials.accessKeyId,
				secretAccessKey: credentials.secretAccessKey,
				sessionToken: credentials.sessionToken,
			},
			...(this.options.awsBedrockEndpoint && { endpoint: this.options.awsBedrockEndpoint }),
		})
	}

	/**
	 * Creates an AnthropicBedrock client with the appropriate credentials
	 */
	private async getAnthropicClient(): Promise<AnthropicBedrock> {
		const credentials = await this.getAwsCredentials()

		// Return an AnthropicBedrock client with the resolved/assumed credentials.
		return new AnthropicBedrock({
			awsAccessKey: credentials.accessKeyId,
			awsSecretKey: credentials.secretAccessKey,
			awsSessionToken: credentials.sessionToken,
			awsRegion: this.getRegion(),
			...(this.options.awsBedrockEndpoint && { baseURL: this.options.awsBedrockEndpoint }),
		})
	}

	/**
	 * Gets the appropriate model ID, accounting for cross-region inference if enabled
	 */
	async getModelId(): Promise<string> {
		if (this.options.awsUseCrossRegionInference) {
			let regionPrefix = this.getRegion().slice(0, 3)
			switch (regionPrefix) {
				case "us-":
					return `us.${this.getModel().id}`
				case "eu-":
					return `eu.${this.getModel().id}`
				case "ap-":
					return `apac.${this.getModel().id}`
				default:
					// cross region inference is not supported in this region, falling back to default model
					return this.getModel().id
			}
		}
		return this.getModel().id
	}

	private static async withTempEnv<R>(updateEnv: () => void, fn: () => Promise<R>): Promise<R> {
		const previousEnv = { ...process.env }

		try {
			updateEnv()
			return await fn()
		} finally {
			process.env = previousEnv
		}
	}

	private static setEnv(key: string, value: string | undefined) {
		if (key !== "" && value !== undefined) {
			process.env[key] = value
		}
	}

	/**
	 * Creates a message using the Deepseek R1 model through AWS Bedrock
	 */
	private async *createDeepseekMessage(
		systemPrompt: string,
		messages: Anthropic.Messages.MessageParam[],
		modelId: string,
		model: { id: BedrockModelId; info: ModelInfo },
	): ApiStream {
		// Get Bedrock client with proper credentials
		const client = await this.getBedrockClient()

		// Format prompt for DeepSeek R1 according to documentation
		const formattedPrompt = this.formatDeepseekR1Prompt(systemPrompt, messages)

		// Prepare the request based on DeepSeek R1's expected format
		const command = new InvokeModelWithResponseStreamCommand({
			modelId: modelId,
			contentType: "application/json",
			accept: "application/json",
			body: JSON.stringify({
				prompt: formattedPrompt,
				max_tokens: model.info.maxTokens || 8000,
				temperature: 0,
			}),
		})

		// Track token usage
		const inputTokenEstimate = this.estimateInputTokens(systemPrompt, messages)
		let outputTokens = 0
		let isFirstChunk = true
		let accumulatedTokens = 0
		const TOKEN_REPORT_THRESHOLD = 100 // Report usage after accumulating this many tokens

		// Execute the streaming request
		const response = await client.send(command)

		if (response.body) {
			for await (const chunk of response.body) {
				if (chunk.chunk?.bytes) {
					try {
						// Parse the response chunk
						const decodedChunk = new TextDecoder().decode(chunk.chunk.bytes)
						const parsedChunk = JSON.parse(decodedChunk)

						// Report usage on first chunk
						if (isFirstChunk) {
							isFirstChunk = false
							const totalCost = calculateApiCostOpenAI(model.info, inputTokenEstimate, 0, 0, 0)
							yield {
								type: "usage",
								inputTokens: inputTokenEstimate,
								outputTokens: 0,
								totalCost: totalCost,
							}
						}

						// Handle DeepSeek R1 response format
						if (parsedChunk.choices && parsedChunk.choices.length > 0) {
							// For non-streaming response (full response)
							const text = parsedChunk.choices[0].text
							if (text) {
								const chunkTokens = this.estimateTokenCount(text)
								outputTokens += chunkTokens
								accumulatedTokens += chunkTokens

								yield {
									type: "text",
									text: text,
								}

								if (accumulatedTokens >= TOKEN_REPORT_THRESHOLD) {
									const totalCost = calculateApiCostOpenAI(model.info, 0, accumulatedTokens, 0, 0)
									yield {
										type: "usage",
										inputTokens: 0,
										outputTokens: accumulatedTokens,
										totalCost: totalCost,
									}
									accumulatedTokens = 0
								}
							}
						} else if (parsedChunk.delta?.text) {
							// For streaming response (delta updates)
							const text = parsedChunk.delta.text
							const chunkTokens = this.estimateTokenCount(text)
							outputTokens += chunkTokens
							accumulatedTokens += chunkTokens

							yield {
								type: "text",
								text: text,
							}
							// Report aggregated token usage only when threshold is reached
							if (accumulatedTokens >= TOKEN_REPORT_THRESHOLD) {
								const totalCost = calculateApiCostOpenAI(model.info, 0, accumulatedTokens, 0, 0)
								yield {
									type: "usage",
									inputTokens: 0,
									outputTokens: accumulatedTokens,
									totalCost: totalCost,
								}
								accumulatedTokens = 0
							}
						}
					} catch (error) {
						console.error("Error parsing Deepseek response chunk:", error)
						// Propagate the error by yielding a text response with error information
						yield {
							type: "text",
							text: `[ERROR] Failed to parse Deepseek response: ${error instanceof Error ? error.message : String(error)}`,
						}
					}
				}
			}

			// Report any remaining accumulated tokens at the end of the stream
			if (accumulatedTokens > 0) {
				const totalCost = calculateApiCostOpenAI(model.info, 0, accumulatedTokens, 0, 0)
				yield {
					type: "usage",
					inputTokens: 0,
					outputTokens: accumulatedTokens,
					totalCost: totalCost,
				}
			}

			// Add final total cost calculation that includes both input and output tokens
			const finalTotalCost = calculateApiCostOpenAI(model.info, inputTokenEstimate, outputTokens, 0, 0)
			yield {
				type: "usage",
				inputTokens: inputTokenEstimate,
				outputTokens: outputTokens,
				totalCost: finalTotalCost,
			}
		}
	}

	/**
	 * Formats prompt for DeepSeek R1 model according to documentation
	 * First uses convertToR1Format to merge consecutive messages with the same role,
	 * then converts to the string format that DeepSeek R1 expects
	 */
	private formatDeepseekR1Prompt(systemPrompt: string, messages: Anthropic.Messages.MessageParam[]): string {
		// First use convertToR1Format to merge consecutive messages with the same role
		const r1Messages = convertToR1Format([{ role: "user", content: systemPrompt }, ...messages])

		// Then convert to the special string format expected by DeepSeek R1
		let combinedContent = ""

		for (const message of r1Messages) {
			let content = ""

			if (message.content) {
				if (typeof message.content === "string") {
					content = message.content
				} else {
					// Extract text content from message parts
					content = message.content
						.filter((part) => part.type === "text")
						.map((part) => part.text)
						.join("\n")
				}
			}

			combinedContent += message.role === "user" ? "User: " + content + "\n" : "Assistant: " + content + "\n"
		}

		// Format according to DeepSeek R1's expected prompt format
		return `<｜begin▁of▁sentence｜><｜User｜>${combinedContent}<｜Assistant｜><think>\n`
	}

	/**
	 * Estimates token count based on text length (approximate)
	 * Note: This is a rough estimation, as the actual token count depends on the tokenizer
	 */
	private estimateInputTokens(systemPrompt: string, messages: Anthropic.Messages.MessageParam[]): number {
		// For Deepseek R1, we estimate the token count of the formatted prompt
		// The formatted prompt includes special tokens and consistent formatting
		const formattedPrompt = this.formatDeepseekR1Prompt(systemPrompt, messages)
		return Math.ceil(formattedPrompt.length / 4)
	}

	/**
	 * Estimates token count for a text string
	 */
	private estimateTokenCount(text: string): number {
		// Approximate 4 characters per token
		return Math.ceil(text.length / 4)
	}
}
