import { getCost } from "../cost"

describe("getCost", () => {
	it("should return the correct cost for Bedrock provider with invokedModelId", () => {
		// For 1000 tokens with 25% input (250) and 75% output (750)
		// Claude-3-5-sonnet: (0.003/1000 * 250) + (0.015/1000 * 750) = 0.00075 + 0.01125 = 0.012
		const cost = getCost("bedrock", "test prompt", "gpt-3.5-turbo", 1000, "claude-3-5-sonnet")
		expect(cost).toBeCloseTo(0.012, 5)
	})

	it("should return 0 for Bedrock provider without invokedModelId", () => {
		// Since GPT models are not supported on Bedrock and we've removed the fallback,
		// this should return 0
		const cost = getCost("bedrock", "test prompt", "any-model", 1000)
		expect(cost).toBe(0)
	})

	it("should return 0 for unknown provider", () => {
		const cost = getCost("unknown" as any, "test prompt", "gpt-3.5-turbo", 1000)
		expect(cost).toBe(0)
	})

	it("should use provided input and output tokens when available", () => {
		// For specific input (300) and output (700) tokens
		// Claude-3-5-sonnet: (0.003/1000 * 300) + (0.015/1000 * 700) = 0.0009 + 0.0105 = 0.0114
		const cost = getCost("bedrock", "test prompt", "gpt-3.5-turbo", 1000, "claude-3-5-sonnet", 300, 700)
		expect(cost).toBeCloseTo(0.0114, 5)
	})

	it("should handle cache write and cache read tokens", () => {
		// For specific input (300), output (700), cache write (200), and cache read (100) tokens
		// Claude-3-5-sonnet:
		// Input: (0.003/1000 * 300) = 0.0009
		// Output: (0.015/1000 * 700) = 0.0105
		// Cache Write: (0.00375/1000 * 200) = 0.00075
		// Cache Read: (0.0003/1000 * 100) = 0.00003
		// Total: 0.0009 + 0.0105 + 0.00075 + 0.00003 = 0.01218
		const cost = getCost("bedrock", "test prompt", "gpt-3.5-turbo", 1000, "claude-3-5-sonnet", 300, 700, 200, 100)
		expect(cost).toBeCloseTo(0.01218, 5)
	})

	it("should handle models without cache pricing", () => {
		// For specific input (300), output (700), cache write (200), and cache read (100) tokens
		// Claude-3-opus:
		// Input: (0.015/1000 * 300) = 0.0045
		// Output: (0.075/1000 * 700) = 0.0525
		// Cache Write: (0/1000 * 200) = 0
		// Cache Read: (0/1000 * 100) = 0
		// Total: 0.0045 + 0.0525 + 0 + 0 = 0.057
		const cost = getCost("bedrock", "test prompt", "gpt-3.5-turbo", 1000, "claude-3-opus", 300, 700, 200, 100)
		expect(cost).toBeCloseTo(0.057, 5)
	})
})

describe("getBedrockCost", () => {
	it("should return the correct cost for claude-3-5-sonnet", () => {
		// For 1000 tokens with 25% input (250) and 75% output (750)
		// Claude-3-5-sonnet: (0.003/1000 * 250) + (0.015/1000 * 750) = 0.00075 + 0.01125 = 0.012
		const cost = getCost("bedrock", "test prompt", "any-model", 1000, "claude-3-5-sonnet")
		expect(cost).toBeCloseTo(0.012, 5)
	})

	// GPT model tests removed as they are not supported on Bedrock

	it("should return 0 for unknown invokedModelId", () => {
		const cost = getCost("bedrock", "test prompt", "any-model", 1000, "unknown-model")
		expect(cost).toBe(0)
	})

	it("should return 0 when invokedModelId is not provided", () => {
		// Since we've removed the fallback to model-based cost calculation,
		// this should return 0
		const cost = getCost("bedrock", "test prompt", "any-model", 1000)
		expect(cost).toBe(0)
	})

	it("should handle intelligent prompt router ARN format", () => {
		// Test with a full ARN from an intelligent prompt router
		// For 1000 tokens with 25% input (250) and 75% output (750)
		// Claude-3-5-sonnet: (0.003/1000 * 250) + (0.015/1000 * 750) = 0.00075 + 0.01125 = 0.012
		const cost = getCost(
			"bedrock",
			"test prompt",
			"custom-arn",
			1000,
			"arn:aws:bedrock:us-west-2:699475926481:inference-profile/us.anthropic.claude-3-5-sonnet-20240620-v1:0",
		)
		expect(cost).toBeCloseTo(0.012, 5)
	})

	it("should return the correct cost for Amazon Nova Pro", () => {
		// For 1000 tokens with 25% input (250) and 75% output (750)
		// Amazon Nova Pro: (0.0008/1000 * 250) + (0.0032/1000 * 750) = 0.0002 + 0.0024 = 0.0026
		const cost = getCost("bedrock", "test prompt", "any-model", 1000, "amazon.nova-pro")
		expect(cost).toBeCloseTo(0.0026, 5)
	})

	it("should return the correct cost for Amazon Nova Micro", () => {
		// For 1000 tokens with 25% input (250) and 75% output (750)
		// Amazon Nova Micro: (0.000035/1000 * 250) + (0.00014/1000 * 750) = 0.00000875 + 0.000105 = 0.00011375
		const cost = getCost("bedrock", "test prompt", "any-model", 1000, "amazon.nova-micro")
		expect(cost).toBeCloseTo(0.00011375, 8)
	})

	it("should return the correct cost for Amazon Titan Text Express", () => {
		// For 1000 tokens with 25% input (250) and 75% output (750)
		// Amazon Titan Text Express: (0.0002/1000 * 250) + (0.0006/1000 * 750) = 0.00005 + 0.00045 = 0.0005
		const cost = getCost("bedrock", "test prompt", "any-model", 1000, "amazon.titan-text-express")
		expect(cost).toBeCloseTo(0.0005, 5)
	})

	it("should return the correct cost for Amazon Titan Text Lite", () => {
		// For 1000 tokens with 25% input (250) and 75% output (750)
		// Amazon Titan Text Lite: (0.00015/1000 * 250) + (0.0002/1000 * 750) = 0.0000375 + 0.00015 = 0.0001875
		const cost = getCost("bedrock", "test prompt", "any-model", 1000, "amazon.titan-text-lite")
		expect(cost).toBeCloseTo(0.0001875, 7)
	})

	it("should return the correct cost for Amazon Titan Text Embeddings", () => {
		// For embeddings, with the default 1:3 input/output split (250 input, 750 output)
		// Amazon Titan Text Embeddings: (0.0001/1000 * 250) = 0.000025
		// Note: Even though embeddings don't have output tokens, the getCost function
		// still splits tokens using a 1:3 ratio by default
		const cost = getCost("bedrock", "test prompt", "any-model", 1000, "amazon.titan-text-embeddings")
		expect(cost).toBeCloseTo(0.000025, 6)
	})

	it("should return the correct cost for Llama 3.2 (11B)", () => {
		// For 1000 tokens with 25% input (250) and 75% output (750)
		// Llama 3.2 (11B): (0.00016/1000 * 250) + (0.00016/1000 * 750) = 0.00004 + 0.00012 = 0.00016
		const cost = getCost("bedrock", "test prompt", "any-model", 1000, "llama-3.2-11b")
		expect(cost).toBeCloseTo(0.00016, 6)
	})

	it("should return the correct cost for Llama 3.2 (90B)", () => {
		// For 1000 tokens with 25% input (250) and 75% output (750)
		// Llama 3.2 (90B): (0.00072/1000 * 250) + (0.00072/1000 * 750) = 0.00018 + 0.00054 = 0.00072
		const cost = getCost("bedrock", "test prompt", "any-model", 1000, "llama-3.2-90b")
		expect(cost).toBeCloseTo(0.00072, 6)
	})

	it("should return the correct cost for Llama 3.3 (70B)", () => {
		// For 1000 tokens with 25% input (250) and 75% output (750)
		// Llama 3.3 (70B): (0.00072/1000 * 250) + (0.00072/1000 * 750) = 0.00018 + 0.00054 = 0.00072
		const cost = getCost("bedrock", "test prompt", "any-model", 1000, "llama-3.3-70b")
		expect(cost).toBeCloseTo(0.00072, 6)
	})
})
