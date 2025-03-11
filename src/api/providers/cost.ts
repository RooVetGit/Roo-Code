export function getCost(
	provider:
		| "anthropic"
		| "bedrock"
		| "openai"
		| "openai-native"
		| "vertex"
		| "unbound"
		| "glama"
		| "deepseek"
		| "ollama"
		| "mistral"
		| "requesty"
		| "gemini"
		| "human-relay"
		| "lmstudio"
		| "openrouter",
	prompt: string,
	model: string,
	tokens: number,
	invokedModelId?: string,
	inputTokens?: number,
	outputTokens?: number,
	cacheWriteTokens?: number,
	cacheReadTokens?: number,
): number {
	// For Bedrock, handle the case where we have actual input and output token counts
	if (provider === "bedrock") {
		// If we have specific input and output token counts, use them
		if (inputTokens !== undefined && outputTokens !== undefined) {
			return getBedrockCost(
				model,
				inputTokens,
				outputTokens,
				invokedModelId,
				cacheWriteTokens || 0,
				cacheReadTokens || 0,
			)
		}

		// Otherwise, split the tokens between input and output using a 1:3 ratio
		// This is a reasonable approximation for most conversational use cases
		const estimatedInputTokens = Math.round(tokens * 0.25)
		const estimatedOutputTokens = tokens - estimatedInputTokens
		return getBedrockCost(
			model,
			estimatedInputTokens,
			estimatedOutputTokens,
			invokedModelId,
			cacheWriteTokens || 0,
			cacheReadTokens || 0,
		)
	}

	switch (provider) {
		case "anthropic":
			return getAnthropicCost(model, tokens)
		// ... other provider cases
		default:
			return 0
	}
}

function getBedrockCost(
	model: string,
	inputTokens: number,
	outputTokens: number,
	invokedModelId?: string,
	cacheWriteTokens: number = 0,
	cacheReadTokens: number = 0,
): number {
	if (invokedModelId) {
		// Extract model name from ARN if applicable
		let modelIdentifier = invokedModelId

		// Check if invokedModelId is an ARN from an intelligent prompt router
		if (invokedModelId.startsWith("arn:aws:bedrock:")) {
			// Example ARN: arn:aws:bedrock:us-west-2:699475926481:inference-profile/us.anthropic.claude-3-5-sonnet-20240620-v1:0
			const modelMatch = invokedModelId.match(/\/([^\/]+)(?::|$)/)
			if (modelMatch && modelMatch[1]) {
				modelIdentifier = modelMatch[1]
			}
		}

		// March 11, 2025 US region model costs, US-West-2 where specific region is required, per https://aws.amazon.com/bedrock/pricing/
		//
		// Define model costs with separate input, output, cache write, and cache read prices per 1000 tokens
		const modelCosts = [
			// Claude models - prices from AWS Bedrock pricing documentation
			{
				ids: ["claude-3-7-sonnet", "claude-3.7-sonnet"],
				inputPrice: 0.003,
				outputPrice: 0.015,
				cacheWritePrice: 0.00375,
				cacheReadPrice: 0.0003,
			},
			{
				ids: ["claude-3-5-sonnet", "claude-3.5-sonnet"],
				inputPrice: 0.003,
				outputPrice: 0.015,
				cacheWritePrice: 0.00375,
				cacheReadPrice: 0.0003,
			},
			{
				ids: ["claude-3-5-haiku", "claude-3.5-haiku"],
				inputPrice: 0.0008,
				outputPrice: 0.004,
				cacheWritePrice: 0.001,
				cacheReadPrice: 0.00008,
			},
			{
				ids: ["claude-3-opus", "claude-3.0-opus"],
				inputPrice: 0.015,
				outputPrice: 0.075,
				cacheWritePrice: 0, // Not available for this model
				cacheReadPrice: 0, // Not available for this model
			},
			{
				ids: ["claude-3-haiku", "claude-3.0-haiku"],
				inputPrice: 0.00025,
				outputPrice: 0.00125,
				cacheWritePrice: 0, // Not available for this model
				cacheReadPrice: 0, // Not available for this model
			},
			{
				ids: ["claude-3-sonnet", "claude-3.0-sonnet"],
				inputPrice: 0.003,
				outputPrice: 0.015,
				cacheWritePrice: 0, // Not available for this model
				cacheReadPrice: 0, // Not available for this model
			},
			{
				ids: ["claude-2-1", "claude-2.1"],
				inputPrice: 0.008,
				outputPrice: 0.024,
				cacheWritePrice: 0, // Not available for this model
				cacheReadPrice: 0, // Not available for this model
			},
			{
				ids: ["claude-2"],
				inputPrice: 0.008,
				outputPrice: 0.024,
				cacheWritePrice: 0, // Not available for this model
				cacheReadPrice: 0, // Not available for this model
			},
			{
				ids: ["claude-instant"],
				inputPrice: 0.0008,
				outputPrice: 0.0024,
				cacheWritePrice: 0, // Not available for this model
				cacheReadPrice: 0, // Not available for this model
			},

			// Note: GPT models removed as they are not supported on Bedrock

			// Llama models
			{
				ids: ["llama-3-8b", "llama-3.0-8b"],
				inputPrice: 0.0001,
				outputPrice: 0.0002,
				cacheWritePrice: 0.00005,
				cacheReadPrice: 0.00001,
			},
			{
				ids: ["llama-3-70b", "llama-3.0-70b"],
				inputPrice: 0.0003,
				outputPrice: 0.0006,
				cacheWritePrice: 0.00015,
				cacheReadPrice: 0.00003,
			},
			// Llama 3.2 models
			{
				ids: ["llama-3.2-1b", "llama-3.2-1b-instruct"],
				inputPrice: 0.0001,
				outputPrice: 0.0001,
				cacheWritePrice: 0.00005,
				cacheReadPrice: 0.00005,
			},
			{
				ids: ["llama-3.2-3b", "llama-3.2-3b-instruct"],
				inputPrice: 0.00015,
				outputPrice: 0.00015,
				cacheWritePrice: 0.000075,
				cacheReadPrice: 0.000075,
			},
			{
				ids: ["llama-3.2-11b", "llama-3.2-11b-instruct"],
				inputPrice: 0.00016,
				outputPrice: 0.00016,
				cacheWritePrice: 0.00008,
				cacheReadPrice: 0.00008,
			},
			{
				ids: ["llama-3.2-90b", "llama-3.2-90b-instruct"],
				inputPrice: 0.00072,
				outputPrice: 0.00072,
				cacheWritePrice: 0.00036,
				cacheReadPrice: 0.00036,
			},
			// Llama 3.3 models
			{
				ids: ["llama-3.3-70b", "llama-3.3-70b-instruct"],
				inputPrice: 0.00072,
				outputPrice: 0.00072,
				cacheWritePrice: 0.00036,
				cacheReadPrice: 0.00036,
			},

			// Amazon Titan models
			{
				ids: ["amazon.titan-text-lite", "titan-text-lite"],
				inputPrice: 0.00015,
				outputPrice: 0.0002,
				cacheWritePrice: 0, // Not available for this model
				cacheReadPrice: 0, // Not available for this model
			},
			{
				ids: ["amazon.titan-text-express", "titan-text-express"],
				inputPrice: 0.0002,
				outputPrice: 0.0006,
				cacheWritePrice: 0, // Updated pricing, cache may not be available
				cacheReadPrice: 0, // Updated pricing, cache may not be available
			},
			{
				ids: ["amazon.titan-text-embeddings", "titan-text-embeddings"],
				inputPrice: 0.0001,
				outputPrice: 0, // Embeddings don't have output tokens
				cacheWritePrice: 0, // Not available for this model
				cacheReadPrice: 0, // Not available for this model
			},
			{
				ids: ["amazon.titan-text-embeddings-v2", "titan-text-embeddings-v2"],
				inputPrice: 0.00002,
				outputPrice: 0, // Embeddings don't have output tokens
				cacheWritePrice: 0, // Not available for this model
				cacheReadPrice: 0, // Not available for this model
			},
			// Amazon Nova models
			{
				ids: ["amazon.nova-micro", "nova-micro"],
				inputPrice: 0.000035,
				outputPrice: 0.00014,
				cacheWritePrice: 0, // Not available for this model
				cacheReadPrice: 0, // Not available for this model
			},
			{
				ids: ["amazon.nova-lite", "nova-lite"],
				inputPrice: 0.00006,
				outputPrice: 0.00024,
				cacheWritePrice: 0, // Not available for this model
				cacheReadPrice: 0, // Not available for this model
			},
			{
				ids: ["amazon.nova-pro", "nova-pro"],
				inputPrice: 0.0008,
				outputPrice: 0.0032,
				cacheWritePrice: 0, // Not available for this model
				cacheReadPrice: 0, // Not available for this model
			},
			{
				ids: ["amazon.nova-pro-loi", "nova-pro-loi"],
				inputPrice: 0.001,
				outputPrice: 0.004,
				cacheWritePrice: 0, // Not available for this model
				cacheReadPrice: 0, // Not available for this model
			},
		]

		// Find matching model - check if modelIdentifier matches any of the ids in the ids array
		const matchedModel = modelCosts.find((m) =>
			m.ids.some((id) => modelIdentifier === id || modelIdentifier.includes(id)),
		)

		if (matchedModel) {
			const inputCost = (matchedModel.inputPrice / 1000) * inputTokens
			const outputCost = (matchedModel.outputPrice / 1000) * outputTokens
			const cacheWriteCost = (matchedModel.cacheWritePrice / 1000) * cacheWriteTokens
			const cacheReadCost = (matchedModel.cacheReadPrice / 1000) * cacheReadTokens

			return inputCost + outputCost + cacheWriteCost + cacheReadCost
		}

		// If we don't have a specific price for this model, log it and return 0
		console.warn(`Unknown invokedModelId for cost calculation: ${invokedModelId}`)
		return 0
	} else {
		// No fallback model-based cost calculation for Bedrock
		// GPT models are not supported on Bedrock
		return 0
	}
}

function getAnthropicCost(model: string, tokens: number): number {
	// Anthropic cost calculation logic
	return 0
}

export const parseApiPrice = (price: any) => (price ? parseFloat(price) * 1_000_000 : undefined)
