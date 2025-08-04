import { IReranker, RerankerConfig } from "../interfaces/reranker"
import { LocalReranker } from "./local"

/**
 * Factory class for creating reranker instances based on configuration
 */
export class RerankerFactory {
	/**
	 * Creates a reranker instance based on the provided configuration
	 * @param config The reranker configuration
	 * @returns IReranker instance or undefined if configuration is invalid
	 */
	static async create(config: RerankerConfig): Promise<IReranker | undefined> {
		try {
			// Check if reranking is enabled
			if (!config.enabled) {
				console.log("Reranking is disabled in configuration")
				return undefined
			}

			// Create appropriate reranker based on provider
			let reranker: IReranker | undefined

			switch (config.provider) {
				case "local":
					reranker = new LocalReranker(config)
					break

				case "cohere":
					// TODO: Implement Cohere reranker
					console.warn("Cohere reranker not yet implemented")
					return undefined

				case "openai":
					// TODO: Implement OpenAI reranker
					console.warn("OpenAI reranker not yet implemented")
					return undefined

				case "custom":
					// TODO: Implement custom reranker
					console.warn("Custom reranker not yet implemented")
					return undefined

				default:
					console.error(`Unknown reranker provider: ${config.provider}`)
					return undefined
			}

			// Validate the configuration
			const validation = await reranker.validateConfiguration()
			if (!validation.valid) {
				console.error(`Reranker configuration validation failed: ${validation.error}`)
				return undefined
			}

			// Perform initial health check
			const isHealthy = await reranker.healthCheck()
			if (!isHealthy) {
				console.warn("Reranker health check failed, but continuing with initialization")
			}

			console.log(`Successfully created ${config.provider} reranker`)
			return reranker
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error)
			console.error(`Failed to create reranker: ${errorMessage}`)
			return undefined
		}
	}

	/**
	 * Validates a reranker configuration without creating an instance
	 * @param config The reranker configuration to validate
	 * @returns Validation result
	 */
	static validateConfig(config: RerankerConfig): { valid: boolean; error?: string } {
		// Check required fields
		if (!config.provider) {
			return { valid: false, error: "Provider is required" }
		}

		if (!config.enabled) {
			return { valid: true } // Disabled is valid
		}

		// Check provider-specific requirements
		switch (config.provider) {
			case "local":
				if (!config.url) {
					return { valid: false, error: "Local reranker requires a URL" }
				}
				if (!config.apiKey) {
					return { valid: false, error: "Local reranker requires an API key" }
				}
				break

			case "cohere":
				if (!config.apiKey) {
					return { valid: false, error: "Cohere reranker requires an API key" }
				}
				break

			case "openai":
				if (!config.apiKey) {
					return { valid: false, error: "OpenAI reranker requires an API key" }
				}
				break

			case "custom":
				if (!config.url) {
					return { valid: false, error: "Custom reranker requires a URL" }
				}
				break

			default:
				return { valid: false, error: `Unknown provider: ${config.provider}` }
		}

		// Validate numeric fields
		if (config.topN !== undefined && config.topN <= 0) {
			return { valid: false, error: "topN must be greater than 0" }
		}

		if (config.topK !== undefined && config.topK <= 0) {
			return { valid: false, error: "topK must be greater than 0" }
		}

		if (config.topN !== undefined && config.topK !== undefined && config.topK > config.topN) {
			return { valid: false, error: "topK cannot be greater than topN" }
		}

		if (config.timeout !== undefined && config.timeout <= 0) {
			return { valid: false, error: "timeout must be greater than 0" }
		}

		return { valid: true }
	}

	/**
	 * Gets the list of supported reranker providers
	 * @returns Array of supported provider names
	 */
	static getSupportedProviders(): string[] {
		return ["local", "cohere", "openai", "custom"]
	}

	/**
	 * Checks if a provider is currently implemented
	 * @param provider The provider name to check
	 * @returns True if the provider is implemented
	 */
	static isProviderImplemented(provider: string): boolean {
		switch (provider) {
			case "local":
				return true
			case "cohere":
			case "openai":
			case "custom":
				return false
			default:
				return false
		}
	}
}
