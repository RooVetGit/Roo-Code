import { z } from "zod"

// Default configurations
export const defaultRequestConfig = {
	url: "http://localhost:1234/v1/chat/completions",
	method: "POST" as const,
	headers: {
		"Content-Type": "application/json",
	},
}

export const defaultFormatConfig = {
	method: "POST" as const,
	messages: "array" as const,
	data: '{"temperature":0.7,"stream":true, "model":"gpt-4o"}',
}

export const defaultProviderVariables = {
	temperature: 0.7,
	stream: true,
	model: "gpt-3.5-turbo",
	maxOutputTokens: 4096,
}

export const defaultProviderConfig = {
	maxTokens: 4096,
	contextWindow: 8192,
	supportsImages: false,
	supportsComputerUse: false,
	request: defaultRequestConfig,
	format: defaultFormatConfig,
	responsePath: "choices[0].message.content",
	variables: defaultProviderVariables,
}

export const providerVariablesSchema = z.object({
	temperature: z
		.number()
		.min(0)
		.max(2)
		.default(defaultProviderVariables.temperature)
		.describe(
			"Temperature controls randomness in the response. Higher values make the output more random, lower values make it more focused and deterministic.",
		),
	stream: z
		.boolean()
		.default(defaultProviderVariables.stream)
		.describe("Whether to stream the response as it's generated."),
	model: z.string().default(defaultProviderVariables.model).describe("The model to use for generating responses."),
	maxOutputTokens: z
		.number()
		.int()
		.positive()
		.default(defaultProviderVariables.maxOutputTokens)
		.describe("Maximum number of tokens in the response."),
})

// Zod schemas
export const requestConfigSchema = z.object({
	url: z.string().url().default(defaultRequestConfig.url),
	method: z.enum(["GET", "POST", "PUT", "DELETE", "PATCH"]).default(defaultRequestConfig.method),
	headers: z.record(z.string()).default(defaultRequestConfig.headers),
	data: z.any().optional(),
})

export const formatConfigSchema = z.object({
	method: z.enum(["POST"]).default(defaultFormatConfig.method),
	messages: z.enum(["array", "string"]).default(defaultFormatConfig.messages),
	data: z.string().default(defaultFormatConfig.data),
})

export const customVariableSchema = z.object({
	name: z.string(),
	value: z.string(),
	description: z.string().optional(),
})

export const customProviderConfigSchema = z
	.object({
		id: z.string(),
		name: z.string(),
		model: z.string().optional(),
		maxTokens: z.number().int().positive().default(defaultProviderConfig.maxTokens),
		contextWindow: z.number().int().positive().default(defaultProviderConfig.contextWindow),
		supportsImages: z.boolean().default(defaultProviderConfig.supportsImages),
		supportsComputerUse: z.boolean().default(defaultProviderConfig.supportsComputerUse),
		request: requestConfigSchema.default(defaultRequestConfig),
		format: formatConfigSchema.default(defaultFormatConfig),
		responsePath: z.string().default(defaultProviderConfig.responsePath),
		description: z.string().optional(),
		customVariables: z.record(customVariableSchema).optional(),
		apiKey: z.string().optional(),
		variables: providerVariablesSchema
			.default(defaultProviderVariables)
			.describe("Common configuration variables that will be substituted in the request format."),
	})
	.default({
		...defaultProviderConfig,
		id: "",
		name: "",
	})

export const customProvidersConfigSchema = z.object({
	providers: z.record(customProviderConfigSchema),
})

export type CustomProvidersSchemaType = z.infer<typeof customProvidersConfigSchema>
