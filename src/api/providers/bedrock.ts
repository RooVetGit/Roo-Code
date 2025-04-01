import {
	BedrockRuntimeClient,
	ConverseStreamCommand,
	ConverseCommand,
	BedrockRuntimeClientConfig,
} from "@aws-sdk/client-bedrock-runtime"
import { fromIni } from "@aws-sdk/credential-providers"
import { Anthropic } from "@anthropic-ai/sdk"
import { SingleCompletionHandler } from "../"
import {
	BedrockModelId,
	ModelInfo as SharedModelInfo,
	bedrockDefaultModelId,
	bedrockModels,
	bedrockDefaultPromptRouterModelId,
} from "../../shared/api"
import { ProviderSettings } from "../../schemas"
import { ApiStream } from "../transform/stream"
import { BaseProvider } from "./base-provider"
import { logger } from "../../utils/logging"
import { Message, SystemContentBlock } from "@aws-sdk/client-bedrock-runtime"
// New cache-related imports
import { MultiPointStrategy } from "../transform/cache-strategy/multi-point-strategy"
import { ModelInfo as CacheModelInfo } from "../transform/cache-strategy/types"

const BEDROCK_DEFAULT_TEMPERATURE = 0.3
const BEDROCK_MAX_TOKENS = 4096

/************************************************************************************
 *
 *     TYPES
 *
 *************************************************************************************/

// Define interface for Bedrock inference config
interface BedrockInferenceConfig {
	maxTokens: number
	temperature: number
	topP: number
}

// Define types for stream events based on AWS SDK
export interface StreamEvent {
	messageStart?: {
		role?: string
	}
	messageStop?: {
		stopReason?: "end_turn" | "tool_use" | "max_tokens" | "stop_sequence"
		additionalModelResponseFields?: Record<string, unknown>
	}
	contentBlockStart?: {
		start?: {
			text?: string
		}
		contentBlockIndex?: number
	}
	contentBlockDelta?: {
		delta?: {
			text?: string
		}
		contentBlockIndex?: number
	}
	metadata?: {
		usage?: {
			inputTokens: number
			outputTokens: number
			totalTokens?: number // Made optional since we don't use it
			// New cache-related fields
			cacheReadInputTokens?: number
			cacheWriteInputTokens?: number
			cacheReadInputTokenCount?: number
			cacheWriteInputTokenCount?: number
		}
		metrics?: {
			latencyMs: number
		}
	}
	// New trace field for prompt router
	trace?: {
		promptRouter?: {
			invokedModelId?: string
			usage?: {
				inputTokens: number
				outputTokens: number
				totalTokens?: number // Made optional since we don't use it
				// New cache-related fields
				cacheReadTokens?: number
				cacheWriteTokens?: number
				cacheReadInputTokenCount?: number
				cacheWriteInputTokenCount?: number
			}
		}
	}
}

// Type for usage information in stream events
export type UsageType = {
	inputTokens?: number
	outputTokens?: number
	cacheReadInputTokens?: number
	cacheWriteInputTokens?: number
	cacheReadInputTokenCount?: number
	cacheWriteInputTokenCount?: number
}

/************************************************************************************
 *
 *     PROVIDER
 *
 *************************************************************************************/

export class AwsBedrockHandler extends BaseProvider implements SingleCompletionHandler {
	protected options: ProviderSettings
	private client: BedrockRuntimeClient
	private arnInfo: any

	constructor(options: ProviderSettings) {
		super()
		this.options = options
		let region = this.options.awsRegion

		// process the various user input options, be opinionated about the intent of the options
		// and determine the model to use during inference and for cost caclulations
		// There are variations on ARN strings that can be entered making the conditional logic
		// more involved than the non-ARN branch of logic
		if (this.options.awsCustomArn) {
			this.arnInfo = this.parseArn(this.options.awsCustomArn, region)

			if (!this.arnInfo.isValid) {
				logger.error("Invalid ARN format", {
					ctx: "bedrock",
					errorMessage: this.arnInfo.errorMessage,
				})

				// Throw a consistent error with a prefix that can be detected by callers
				const errorMessage =
					this.arnInfo.errorMessage ||
					"Invalid ARN format. ARN should follow the pattern: arn:aws:bedrock:region:account-id:resource-type/resource-name"
				throw new Error("INVALID_ARN_FORMAT:" + errorMessage)
			}

			if (this.arnInfo.region && this.arnInfo.region !== this.options.awsRegion) {
				// Log  if there's a region mismatch between the ARN and the region selected by the user
				// We will use the ARNs region, so execution can continue, but log an info statement.
				// Log a warning if there's a region mismatch between the ARN and the region selected by the user
				// We will use the ARNs region, so execution can continue, but log an info statement.
				logger.info(this.arnInfo.errorMessage, {
					ctx: "bedrock",
					selectedRegion: this.options.awsRegion,
					arnRegion: this.arnInfo.region,
				})

				this.options.awsRegion = this.arnInfo.region
			}

			this.options.apiModelId = this.arnInfo.modelId
			if (this.arnInfo.awsUseCrossRegionInference) this.options.awsUseCrossRegionInference = true
		}

		this.options.modelTemperature ?? BEDROCK_DEFAULT_TEMPERATURE
		this.costModelConfig = this.getModel()

		if (this.options.awsUseCrossRegionInference) {
			// Get the current region
			const region = this.options.awsRegion || ""
			// Use the helper method to get the appropriate prefix for this region
			const prefix = AwsBedrockHandler.getPrefixForRegion(region)

			// Apply the prefix if one was found, otherwise use the model ID as is
			this.costModelConfig.id = prefix ? `${prefix}${this.costModelConfig.id}` : this.costModelConfig.id
		}

		const clientConfig: BedrockRuntimeClientConfig = {
			region: this.options.awsRegion,
		}

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

		this.client = new BedrockRuntimeClient(clientConfig)
	}

	override async *createMessage(systemPrompt: string, messages: Anthropic.Messages.MessageParam[]): ApiStream {
		let modelConfig = this.getModel()
		// Handle cross-region inference
		const usePromptCache = Boolean(this.options.awsUsePromptCache && this.supportsAwsPromptCache(modelConfig))

		// Generate a conversation ID based on the first few messages to maintain cache consistency
		// This is a simple approach - in a real application, you might want to use a more robust ID system
		const conversationId =
			messages.length > 0
				? `conv_${messages[0].role}_${
						typeof messages[0].content === "string"
							? messages[0].content.substring(0, 20)
							: "complex_content"
					}`
				: "default_conversation"

		// Convert messages to Bedrock format, passing the model info and conversation ID
		const formatted = this.convertToBedrockConverseMessages(
			messages,
			systemPrompt,
			usePromptCache,
			modelConfig.info,
			conversationId,
		)

		// Construct the payload
		const inferenceConfig: BedrockInferenceConfig = {
			maxTokens: modelConfig.info.maxTokens as number,
			temperature: this.options.modelTemperature as number,
			topP: 0.1,
		}

		const payload = {
			modelId: modelConfig.id,
			messages: formatted.messages,
			system: formatted.system,
			inferenceConfig,
		}

		// Create AbortController with 10 minute timeout
		const controller = new AbortController()
		let timeoutId: NodeJS.Timeout | undefined

		try {
			timeoutId = setTimeout(
				() => {
					controller.abort()
				},
				10 * 60 * 1000,
			)

			// Log the payload for debugging custom ARN issues
			if (this.options.awsCustomArn) {
				// logger.debug("Using custom ARN for Bedrock request", {
				// 	ctx: "bedrock",
				// 	customArn: this.options.awsCustomArn,
				// 	clientRegion: this.client.config.region,
				// 	payload: JSON.stringify(payload, null, 2),
				// })
			}

			const command = new ConverseStreamCommand(payload)
			const response = await this.client.send(command, {
				abortSignal: controller.signal,
			})

			if (!response.stream) {
				clearTimeout(timeoutId)
				throw new Error("No stream available in the response")
			}

			for await (const chunk of response.stream) {
				// Parse the chunk as JSON if it's a string (for tests)
				let streamEvent: StreamEvent
				try {
					streamEvent = typeof chunk === "string" ? JSON.parse(chunk) : (chunk as unknown as StreamEvent)
				} catch (e) {
					logger.error("Failed to parse stream event", {
						ctx: "bedrock",
						error: e instanceof Error ? e : String(e),
						chunk: typeof chunk === "string" ? chunk : "binary data",
					})
					continue
				}

				// Handle metadata events first
				if (streamEvent.metadata?.usage) {
					const usage = (streamEvent.metadata?.usage || {}) as UsageType

					// Check both field naming conventions for cache tokens
					const cacheReadTokens = usage.cacheReadInputTokens || usage.cacheReadInputTokenCount || 0
					const cacheWriteTokens = usage.cacheWriteInputTokens || usage.cacheWriteInputTokenCount || 0

					// logger.debug("Bedrock usage amounts before yielding", {
					// 	ctx: "bedrock",
					// 	inputTokens: usage.inputTokens || 0,
					// 	outputTokens: usage.outputTokens || 0,
					// 	cacheReadTokens,
					// 	cacheWriteTokens,
					// 	modelId: modelId,
					// })

					// Always include all available token information
					yield {
						type: "usage",
						inputTokens: usage.inputTokens || 0,
						outputTokens: usage.outputTokens || 0,
						cacheReadTokens: cacheReadTokens,
						cacheWriteTokens: cacheWriteTokens,
					}
					continue
				}

				if (streamEvent?.trace?.promptRouter?.invokedModelId) {
					try {
						let invokedModelArn = this.parseArn(streamEvent.trace.promptRouter.invokedModelId)
						if (invokedModelArn.modelId) {
							//update the in-use model info to be based on the invoked Model Id for the router
							//so that pricing, context window, caching etc have values that can be used
							//However, we want to keep the id of the model to be the ID for the router for
							//subsequent requests so they are sent back through the router
							let invokedModel = this.getModelById(invokedModelArn.modelId as string)
							if (invokedModel) {
								invokedModel.id = modelConfig.id
								this.costModelConfig = invokedModel
							}
						}

						// Handle metadata events for the promptRouter.
						if (streamEvent?.trace?.promptRouter?.usage) {
							const routerUsage = streamEvent.trace.promptRouter.usage

							// Check both field naming conventions for cache tokens
							const cacheReadTokens =
								routerUsage.cacheReadTokens || routerUsage.cacheReadInputTokenCount || 0
							const cacheWriteTokens =
								routerUsage.cacheWriteTokens || routerUsage.cacheWriteInputTokenCount || 0

							// logger.debug("Bedrock prompt router usage amounts before yielding", {
							// 	ctx: "bedrock",
							// 	inputTokens: routerUsage.inputTokens || 0,
							// 	outputTokens: routerUsage.outputTokens || 0,
							// 	cacheReadTokens,
							// 	cacheWriteTokens,
							// 	invokedModelId: streamEvent.trace.promptRouter.invokedModelId,
							// })

							yield {
								type: "usage",
								inputTokens: routerUsage.inputTokens || 0,
								outputTokens: routerUsage.outputTokens || 0,
								cacheReadTokens: cacheReadTokens,
								cacheWriteTokens: cacheWriteTokens,
							}
						}
					} catch (error) {
						logger.error("Error handling Bedrock invokedModelId", {
							ctx: "bedrock",
							error: error instanceof Error ? error : String(error),
						})
					} finally {
						continue
					}
				}

				// Handle message start
				if (streamEvent.messageStart) {
					continue
				}

				// Handle content blocks
				if (streamEvent.contentBlockStart?.start?.text) {
					yield {
						type: "text",
						text: streamEvent.contentBlockStart.start.text,
					}
					continue
				}

				// Handle content deltas
				if (streamEvent.contentBlockDelta?.delta?.text) {
					yield {
						type: "text",
						text: streamEvent.contentBlockDelta.delta.text,
					}
					continue
				}
				// Handle message stop
				if (streamEvent.messageStop) {
					continue
				}
			}
			// Clear timeout after stream completes
			clearTimeout(timeoutId)
		} catch (error: unknown) {
			// Clear timeout on error
			clearTimeout(timeoutId)

			// Use the extracted error handling method for all errors
			const errorChunks = this.handleBedrockError(error, true) // true for streaming context
			// Yield each chunk individually to ensure type compatibility
			for (const chunk of errorChunks) {
				yield chunk as any // Cast to any to bypass type checking since we know the structure is correct
			}

			// Re-throw the error
			if (error instanceof Error) {
				throw error
			} else {
				throw new Error("An unknown error occurred")
			}
		}
	}

	async completePrompt(prompt: string): Promise<string> {
		try {
			const modelConfig = this.getModel()

			const inferenceConfig: BedrockInferenceConfig = {
				maxTokens: modelConfig.info.maxTokens as number,
				temperature: this.options.modelTemperature as number,
				topP: 0.1,
			}

			// For completePrompt, use a unique conversation ID based on the prompt
			const conversationId = `prompt_${prompt.substring(0, 20)}`

			const payload = {
				modelId: modelConfig.id,
				messages: this.convertToBedrockConverseMessages(
					[
						{
							role: "user",
							content: prompt,
						},
					],
					undefined,
					false,
					modelConfig.info,
					conversationId,
				).messages,
				inferenceConfig,
			}

			const command = new ConverseCommand(payload)
			const response = await this.client.send(command)

			if (response.output && response.output instanceof Uint8Array) {
				try {
					const outputStr = new TextDecoder().decode(response.output)
					const output = JSON.parse(outputStr)
					if (output.content) {
						return output.content
					}
				} catch (parseError) {
					logger.error("Failed to parse Bedrock response", {
						ctx: "bedrock",
						error: parseError instanceof Error ? parseError : String(parseError),
					})
				}
			}
			return ""
		} catch (error) {
			// Use the extracted error handling method for all errors
			const errorResult = this.handleBedrockError(error, false) // false for non-streaming context
			// Since we're in a non-streaming context, we know the result is a string
			const errorMessage = errorResult as string
			throw new Error(errorMessage)
		}
	}

	/**
	 * Convert Anthropic messages to Bedrock Converse format
	 */
	private convertToBedrockConverseMessages(
		anthropicMessages: Anthropic.Messages.MessageParam[] | { role: string; content: string }[],
		systemMessage?: string,
		usePromptCache: boolean = false,
		modelInfo?: any,
		conversationId?: string, // Optional conversation ID to track cache points across messages
	): { system: SystemContentBlock[]; messages: Message[] } {
		// Convert model info to expected format
		const cacheModelInfo: CacheModelInfo = {
			maxTokens: modelInfo?.maxTokens || 8192,
			contextWindow: modelInfo?.contextWindow || 200_000,
			supportsPromptCache: modelInfo?.supportsPromptCache || false,
			maxCachePoints: modelInfo?.maxCachePoints || 0,
			minTokensPerCachePoint: modelInfo?.minTokensPerCachePoint || 50,
			cachableFields: modelInfo?.cachableFields || [],
		}

		// Clean messages by removing any existing cache points
		const cleanedMessages = anthropicMessages.map((msg) => {
			if (typeof msg.content === "string") {
				return msg
			}
			const cleaned = {
				...msg,
				content: this.removeCachePoints(msg.content),
			}
			return cleaned
		})

		// Get previous cache point placements for this conversation if available
		const previousPlacements =
			conversationId && this.previousCachePointPlacements[conversationId]
				? this.previousCachePointPlacements[conversationId]
				: undefined

		// Create config for cache strategy
		const config = {
			modelInfo: cacheModelInfo,
			systemPrompt: systemMessage,
			messages: cleanedMessages as Anthropic.Messages.MessageParam[],
			usePromptCache,
			previousCachePointPlacements: previousPlacements,
		}

		// Inline the logic from convertWithOptimalCaching and CacheStrategyFactory.createStrategy
		let strategy = new MultiPointStrategy(config)

		// Determine optimal cache points
		const result = strategy.determineOptimalCachePoints()

		// Store cache point placements for future use if conversation ID is provided
		if (conversationId && result.messageCachePointPlacements) {
			this.previousCachePointPlacements[conversationId] = result.messageCachePointPlacements
		}

		return result
	}

	/************************************************************************************
	 *
	 *     MODEL IDENTIFICATION
	 *
	 *************************************************************************************/

	private costModelConfig: { id: BedrockModelId | string; info: SharedModelInfo } = {
		id: "",
		info: { maxTokens: 0, contextWindow: 0, supportsPromptCache: false, supportsImages: false },
	}

	private parseArn(arn: string, region?: string) {
		/*
		 * VIA Roo analysis: platform-independent Regex. It's designed to parse AWS Bedrock ARNs and doesn't rely on any platform-specific features
		 * like file path separators, line endings, or case sensitivity behaviors. The forward slashes in the regex are properly escaped and
		 * represent literal characters in the AWS ARN format, not filesystem paths. This regex will function consistently across Windows,
		 * macOS, Linux, and any other operating system where JavaScript runs.
		 *
		 *  This matches ARNs like:
		 *  - Foundation Model: arn:aws:bedrock:us-west-2::foundation-model/anthropic.claude-v2
		 *  - Prompt Router: arn:aws:bedrock:us-west-2:123456789012:prompt-router/anthropic-claude
		 *  - Inference Profile: arn:aws:bedrock:us-west-2:123456789012:inference-profile/anthropic.claude-v2
		 *  - Cross Region Inference Profile: arn:aws:bedrock:us-west-2:123456789012:inference-profile/us.anthropic.claude-3-5-sonnet-20241022-v2:0
		 *  - Custom Model (Provisioned Throughput): arn:aws:bedrock:us-west-2:123456789012:provisioned-model/my-custom-model
		 *  - Imported Model: arn:aws:bedrock:us-west-2:123456789012:imported-model/my-imported-model
		 *
		 * match[0] - The entire matched string
		 * match[1] - The region (e.g., "us-east-1")
		 * match[2] - The account ID (can be empty string for AWS-managed resources)
		 * match[3] - The resource type (e.g., "foundation-model")
		 * match[4] - The resource ID (e.g., "anthropic.claude-3-sonnet-20240229-v1:0")
		 */

		const arnRegex = /^arn:aws:bedrock:([^:]+):([^:]*):(?:([^\/]+)\/(.+)|([^\/]+))$/
		let match = arn.match(arnRegex)

		if (match && match[1] && match[3] && match[4]) {
			// Create the result object
			const result: {
				isValid: boolean
				region?: string
				modelType?: string
				modelId?: string
				errorMessage?: string
				crossRegionInference: boolean
			} = {
				isValid: true,
				crossRegionInference: false, // Default to false
			}

			result.modelType = match[3]
			const originalModelId = match[4]
			result.modelId = this.parseBaseModelId(originalModelId)

			// Extract the region from the first capture group
			const arnRegion = match[1]
			result.region = arnRegion

			// Check if the original model ID had a region prefix
			if (originalModelId && result.modelId !== originalModelId) {
				// If the model ID changed after parsing, it had a region prefix
				let prefix = originalModelId.replace(result.modelId, "")
				result.crossRegionInference = AwsBedrockHandler.prefixIsMultiRegion(prefix)
			}

			// Check if region in ARN matches provided region (if specified)
			if (region && arnRegion !== region) {
				result.errorMessage = `Region mismatch: The region in your ARN (${arnRegion}) does not match your selected region (${region}). This may cause access issues. The provider will use the region from the ARN.`
				result.region = arnRegion
			}

			return result
		}

		// If we get here, the regex didn't match
		return {
			isValid: false,
			region: undefined,
			modelType: undefined,
			modelId: undefined,
			errorMessage: "Invalid ARN format. ARN should follow the AWS Bedrock ARN pattern.",
			crossRegionInference: false,
		}
	}

	//This strips any region prefix that used on cross-region model inference ARNs
	private parseBaseModelId(modelId: string) {
		if (!modelId) {
			return modelId
		}

		const knownRegionPrefixes = AwsBedrockHandler.getPrefixList()

		// Find if the model ID starts with any known region prefix
		const matchedPrefix = knownRegionPrefixes.find((prefix) => modelId.startsWith(prefix))

		if (matchedPrefix) {
			// Remove the region prefix from the model ID
			return modelId.substring(matchedPrefix.length)
		} else {
			// If no known prefix was found, check for a generic pattern
			// Look for a pattern where the first segment before a dot doesn't contain dots or colons
			// and the remaining parts still contain at least one dot
			const genericPrefixMatch = modelId.match(/^([^.:]+)\.(.+\..+)$/)
			if (genericPrefixMatch) {
				const genericPrefix = genericPrefixMatch[1] + "."
				return genericPrefixMatch[2]
			}
		}
		return modelId
	}

	//Prompt Router responses come back in a different sequence and the model used is in the response and must be fetched by name
	getModelById(modelId: string): { id: BedrockModelId | string; info: SharedModelInfo } {
		// Try to find the model in bedrockModels
		let baseModelId = this.parseBaseModelId(modelId)
		if (baseModelId in bedrockModels) {
			const id = baseModelId as BedrockModelId

			//Do a deep copy of the model info so that later in the code the model id and maxTokens can be set.
			// The bedrockModels array is a constant and updating the model ID from the returned invokedModelID value
			// in a prompt router response isn't possible on the constant.
			let model = JSON.parse(JSON.stringify(bedrockModels[id]))

			// If modelMaxTokens is explicitly set in options, override the default
			if (this.options.modelMaxTokens && this.options.modelMaxTokens > 0) {
				model.maxTokens = this.options.modelMaxTokens
			}

			return { id, info: model }
		}

		return { id: bedrockDefaultModelId, info: bedrockModels[bedrockDefaultModelId] }
	}

	override getModel(): { id: BedrockModelId | string; info: SharedModelInfo } {
		if (this.costModelConfig?.id?.trim().length > 0) {
			return this.costModelConfig
		}

		let modelConfig = undefined

		// If custom ARN is provided, use it
		if (this.options.awsCustomArn) {
			modelConfig = this.getModelById(this.arnInfo.modelId)

			if (!modelConfig)
				// An ARN was used, but no model info match found, use default model values for cost calculations and context window
				// But continue using the ARN as the identifier in the Bedrock interaction
				modelConfig = this.getModelById(bedrockDefaultPromptRouterModelId)

			//If the user entered an ARN for a foundation-model they've done the same thing as picking from our list of options.
			//We leave the model data matching the same as if a drop-down input method was used by not overwriting the model ID with the user input ARN
			//Otherwise the ARN is not a foundation-model resource type that ARN should be used as the identifier in Bedrock interactions
			if (this.arnInfo.modelType !== "foundation-model") modelConfig.id = this.options.awsCustomArn
		} else {
			//a model was selected from the drop down
			modelConfig = this.getModelById(this.options.apiModelId as string)

			if (this.options.awsUseCrossRegionInference) {
				// Get the current region
				const region = this.options.awsRegion || ""
				// Use the helper method to get the appropriate prefix for this region
				const prefix = AwsBedrockHandler.getPrefixForRegion(region)

				// Apply the prefix if one was found, otherwise use the model ID as is
				modelConfig.id = prefix ? `${prefix}${modelConfig.id}` : modelConfig.id
			}
		}

		modelConfig.info.maxTokens = modelConfig.info.maxTokens || BEDROCK_MAX_TOKENS

		return modelConfig as { id: BedrockModelId | string; info: SharedModelInfo }
	}

	/************************************************************************************
	 *
	 *     CACHE
	 *
	 *************************************************************************************/

	// Store previous cache point placements for maintaining consistency across consecutive messages
	private previousCachePointPlacements: { [conversationId: string]: any[] } = {}

	private supportsAwsPromptCache(modelConfig: {
		id: BedrockModelId | string
		info: SharedModelInfo
	}): boolean | undefined {
		// Check if the model supports prompt cache
		// The cachableFields property is not part of the ModelInfo type in schemas
		// but it's used in the bedrockModels object in shared/api.ts
		return (
			modelConfig?.info?.supportsPromptCache &&
			// Use optional chaining and type assertion to access cachableFields
			(modelConfig?.info as any)?.cachableFields &&
			(modelConfig?.info as any)?.cachableFields?.length > 0
		)
	}

	/**
	 * Removes any existing cachePoint nodes from content blocks
	 */
	private removeCachePoints(content: any): any {
		if (Array.isArray(content)) {
			return content.map((block) => {
				// Use destructuring to remove cachePoint property
				const { cachePoint, ...rest } = block
				return rest
			})
		}
		return content
	}

	/************************************************************************************
	 *
	 *     AWS REGIONS
	 *
	 *************************************************************************************/

	private static readonly REGION_INFO: Record<
		string,
		{
			regionId: string
			description: string
			pattern?: string
			multiRegion?: boolean
		}
	> = {
		/*
		 * This JSON generated by AWS's AI assistant - Amazon Q on March 29, 2025
		 *
		 *  - Africa (Cape Town) region does not appear to support Amazon Bedrock at this time.
		 *  - Some Asia Pacific regions, such as Asia Pacific (Hong Kong) and Asia Pacific (Jakarta), are not listed among the supported regions for Bedrock services.
		 *  - Middle East regions, including Middle East (Bahrain) and Middle East (UAE), are not mentioned in the list of supported regions for Bedrock. [3]
		 *  - China regions (Beijing and Ningxia) are not listed as supported for Amazon Bedrock.
		 *  - Some newer or specialized AWS regions may not have Bedrock support yet.
		 */
		"us.": { regionId: "us-east-1", description: "US East (N. Virginia)", pattern: "us-", multiRegion: true },
		"use.": { regionId: "us-east-1", description: "US East (N. Virginia)" },
		"use1.": { regionId: "us-east-1", description: "US East (N. Virginia)" },
		"use2.": { regionId: "us-east-2", description: "US East (Ohio)" },
		"usw.": { regionId: "us-west-2", description: "US West (Oregon)" },
		"usw2.": { regionId: "us-west-2", description: "US West (Oregon)" },
		"ug.": {
			regionId: "us-gov-west-1",
			description: "AWS GovCloud (US-West)",
			pattern: "us-gov-",
			multiRegion: true,
		},
		"uge1.": { regionId: "us-gov-east-1", description: "AWS GovCloud (US-East)" },
		"ugw1.": { regionId: "us-gov-west-1", description: "AWS GovCloud (US-West)" },
		"eu.": { regionId: "eu-west-1", description: "Europe (Ireland)", pattern: "eu-", multiRegion: true },
		"euw1.": { regionId: "eu-west-1", description: "Europe (Ireland)" },
		"euw2.": { regionId: "eu-west-2", description: "Europe (London)" },
		"euw3.": { regionId: "eu-west-3", description: "Europe (Paris)" },
		"euc1.": { regionId: "eu-central-1", description: "Europe (Frankfurt)" },
		"eun1.": { regionId: "eu-north-1", description: "Europe (Stockholm)" },
		"eus1.": { regionId: "eu-south-1", description: "Europe (Milan)" },
		"euz1.": { regionId: "eu-central-2", description: "Europe (Zurich)" },
		"ap.": {
			regionId: "ap-southeast-1",
			description: "Asia Pacific (Singapore)",
			pattern: "ap-",
			multiRegion: true,
		},
		"ape1.": { regionId: "ap-east-1", description: "Asia Pacific (Hong Kong)" },
		"apne1.": { regionId: "ap-northeast-1", description: "Asia Pacific (Tokyo)" },
		"apne2.": { regionId: "ap-northeast-2", description: "Asia Pacific (Seoul)" },
		"apne3.": { regionId: "ap-northeast-3", description: "Asia Pacific (Osaka)" },
		"aps1.": { regionId: "ap-south-1", description: "Asia Pacific (Mumbai)" },
		"apse1.": { regionId: "ap-southeast-1", description: "Asia Pacific (Singapore)" },
		"apse2.": { regionId: "ap-southeast-2", description: "Asia Pacific (Sydney)" },
		"ca.": { regionId: "ca-central-1", description: "Canada (Central)", pattern: "ca-", multiRegion: true },
		"cac1.": { regionId: "ca-central-1", description: "Canada (Central)" },
		"sa.": { regionId: "sa-east-1", description: "South America (São Paulo)", pattern: "sa-", multiRegion: true },
		"sae1.": { regionId: "sa-east-1", description: "South America (São Paulo)" },

		//these are not official - they weren't generated by Amazon Q nor were found in
		//the AWS documentation but another roo contributor found apac. was needed so I've
		//added the pattern of the other geo zones
		"apac.": { regionId: "ap-southeast-1", description: "Default APAC region", pattern: "ap-", multiRegion: true },
		"emea.": { regionId: "eu-west-1", description: "Default EMEA region", pattern: "eu-", multiRegion: true },
		"amer.": { regionId: "us-east-1", description: "Default Americas region", pattern: "us-", multiRegion: true },
	}

	private static getPrefixList(): string[] {
		return Object.keys(this.REGION_INFO)
	}

	private static getPrefixForRegion(region: string): string | undefined {
		for (const [prefix, info] of Object.entries(this.REGION_INFO)) {
			if (info.pattern && region.startsWith(info.pattern)) {
				return prefix
			}
		}
		return undefined
	}

	private static prefixIsMultiRegion(arnPrefix: string): boolean {
		for (const [prefix, info] of Object.entries(this.REGION_INFO)) {
			if (arnPrefix === prefix) {
				if (info?.multiRegion) return info.multiRegion
				else return false
			}
		}
		return false
	}

	/************************************************************************************
	 *
	 *     ERROR HANDLING
	 *
	 *************************************************************************************/

	/**
	 * Error type definitions for Bedrock API errors
	 */
	private static readonly ERROR_TYPES: Record<
		string,
		{
			patterns: string[] // Strings to match in lowercase error message or name
			messageTemplate: string // Template with placeholders like {region}, {modelId}, etc.
			logLevel: "error" | "warn" | "info" // Log level for this error type
		}
	> = {
		ACCESS_DENIED: {
			patterns: ["access", "denied", "permission"],
			messageTemplate: `You don't have access to the model with the specified ARN. Please verify:
1. The ARN is correct and points to a valid model
2. Your AWS credentials have permission to access this model (check IAM policies)
3. The region in the ARN {regionInfo} matches the region where the model is deployed
4. If using a provisioned model, ensure it's active and not in a failed state {customModelInfo}`,
			logLevel: "error",
		},
		NOT_FOUND: {
			patterns: ["not found", "does not exist"],
			messageTemplate: `The specified ARN does not exist or is invalid. Please check:
1. The ARN format is correct (arn:aws:bedrock:region:account-id:resource-type/resource-name)
2. The model exists in the specified region
3. The account ID in the ARN is correct`,
			logLevel: "error",
		},
		THROTTLING: {
			patterns: ["throttl", "rate", "limit"],
			messageTemplate: `Request was throttled or rate limited. Please try:
1. Reducing the frequency of requests
2. If using a provisioned model, check its throughput settings
3. Contact AWS support to request a quota increase if needed`,
			logLevel: "error",
		},
		TOO_MANY_TOKENS: {
			patterns: ["too many tokens"],
			messageTemplate: `"Too many tokens" error detected.
Possible Causes:
1. Input exceeds model's context window limit
2. Rate limiting (too many tokens per minute)
3. Quota exceeded for token usage
4. Other token-related service limitations

Suggestions:
1. Reduce the size of your input
2. Split your request into smaller chunks
3. Use a model with a larger context window
4. If rate limited, reduce request frequency
5. Check your AWS Bedrock quotas and limits`,
			logLevel: "error",
		},
		ABORT: {
			patterns: ["aborterror"], // This will match error.name.toLowerCase() for AbortError
			messageTemplate: `Request was aborted: The operation timed out or was manually cancelled. Please try again or check your network connection.`,
			logLevel: "info",
		},
		INVALID_ARN_FORMAT: {
			patterns: ["invalid_arn_format:", "invalid arn format"],
			messageTemplate: `Invalid ARN format. ARN should follow the pattern: arn:aws:bedrock:region:account-id:resource-type/resource-name`,
			logLevel: "error",
		},
		// Default/generic error
		GENERIC: {
			patterns: [], // Empty patterns array means this is the default
			messageTemplate: `Unknown Error`,
			logLevel: "error",
		},
	}

	/**
	 * Determines the error type based on the error message or name
	 */
	private getErrorType(error: unknown): string {
		if (!(error instanceof Error)) {
			return "GENERIC"
		}

		const errorMessage = error.message.toLowerCase()
		const errorName = error.name.toLowerCase()

		// Check each error type's patterns
		for (const [errorType, definition] of Object.entries(AwsBedrockHandler.ERROR_TYPES)) {
			if (errorType === "GENERIC") continue // Skip the generic type

			// If any pattern matches in either message or name, return this error type
			if (definition.patterns.some((pattern) => errorMessage.includes(pattern) || errorName.includes(pattern))) {
				return errorType
			}
		}

		// Default to generic error
		return "GENERIC"
	}

	/**
	 * Formats an error message based on the error type and context
	 */
	private formatErrorMessage(error: unknown, errorType: string, isStreamContext: boolean): string {
		const definition = AwsBedrockHandler.ERROR_TYPES[errorType] || AwsBedrockHandler.ERROR_TYPES.GENERIC
		let template = definition.messageTemplate

		// Prepare template variables
		const templateVars: Record<string, string> = {}

		if (error instanceof Error) {
			templateVars.errorMessage = error.message
			templateVars.errorName = error.name

			const modelConfig = this.getModel()
			templateVars.modelId = modelConfig.id
			templateVars.contextWindow = String(modelConfig.info.contextWindow || "unknown")

			// Format error details
			const errorDetails: Record<string, any> = {}
			Object.getOwnPropertyNames(error).forEach((prop) => {
				if (prop !== "stack") {
					errorDetails[prop] = (error as any)[prop]
				}
			})

			// Safely stringify error details to avoid circular references
			templateVars.formattedErrorDetails = Object.entries(errorDetails)
				.map(([key, value]) => {
					let valueStr
					if (typeof value === "object" && value !== null) {
						try {
							// Use a replacer function to handle circular references
							valueStr = JSON.stringify(value, (k, v) => {
								if (k && typeof v === "object" && v !== null) {
									return "[Object]"
								}
								return v
							})
						} catch (e) {
							valueStr = "[Complex Object]"
						}
					} else {
						valueStr = String(value)
					}
					return `- ${key}: ${valueStr}`
				})
				.join("\n")
		}

		// Add context-specific template variables
		const region =
			typeof this?.client?.config?.region === "function"
				? this?.client?.config?.region()
				: this?.client?.config?.region
		templateVars.regionInfo = `(${region})`

		// Replace template variables
		for (const [key, value] of Object.entries(templateVars)) {
			template = template.replace(new RegExp(`{${key}}`, "g"), value || "")
		}

		return template
	}

	/**
	 * Handles Bedrock API errors and generates appropriate error messages
	 * @param error The error that occurred
	 * @param isStreamContext Whether the error occurred in a streaming context (true) or not (false)
	 * @returns Error message string for non-streaming context or array of stream chunks for streaming context
	 */
	private handleBedrockError(
		error: unknown,
		isStreamContext: boolean,
	): string | Array<{ type: string; text?: string; inputTokens?: number; outputTokens?: number }> {
		// Determine error type
		const errorType = this.getErrorType(error)

		// Format error message
		const errorMessage = this.formatErrorMessage(error, errorType, isStreamContext)

		// Log the error
		const definition = AwsBedrockHandler.ERROR_TYPES[errorType]
		const logMethod = definition.logLevel
		const contextName = isStreamContext ? "createMessage" : "completePrompt"
		logger[logMethod](`${errorType} error in ${contextName}`, {
			ctx: "bedrock",
			customArn: this.options.awsCustomArn,
			errorType,
			errorMessage: error instanceof Error ? error.message : String(error),
			...(error instanceof Error && error.stack ? { errorStack: error.stack } : {}),
			...(this.client?.config?.region ? { clientRegion: this.client.config.region } : {}),
		})

		// Return appropriate response based on isStreamContext
		if (isStreamContext) {
			return [
				{ type: "text", text: `Error: ${errorMessage}` },
				{ type: "usage", inputTokens: 0, outputTokens: 0 },
			]
		} else {
			// For non-streaming context, add the expected prefix
			return `Bedrock completion error: ${errorMessage}`
		}
	}
}
