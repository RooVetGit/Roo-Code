export class CacheStrategy {
	config
	systemTokenCount = 0
	constructor(config) {
		this.config = config
		this.initializeMessageGroups()
		this.calculateSystemTokens()
	}
	/**
	 * Initialize message groups from the input messages
	 */
	initializeMessageGroups() {
		if (!this.config.messages.length) return
	}
	/**
	 * Calculate token count for system prompt using a more accurate approach
	 */
	calculateSystemTokens() {
		if (this.config.systemPrompt) {
			const text = this.config.systemPrompt
			// Use a more accurate token estimation than simple character count
			// Count words and add overhead for punctuation and special tokens
			const words = text.split(/\s+/).filter((word) => word.length > 0)
			// Average English word is ~1.3 tokens
			let tokenCount = words.length * 1.3
			// Add overhead for punctuation and special characters
			tokenCount += (text.match(/[.,!?;:()[\]{}""''`]/g) || []).length * 0.3
			// Add overhead for newlines
			tokenCount += (text.match(/\n/g) || []).length * 0.5
			// Add a small overhead for system prompt structure
			tokenCount += 5
			this.systemTokenCount = Math.ceil(tokenCount)
		}
	}
	/**
	 * Create a cache point content block
	 */
	createCachePoint() {
		return { cachePoint: { type: "default" } }
	}
	/**
	 * Convert messages to content blocks
	 */
	messagesToContentBlocks(messages) {
		return messages.map((message) => {
			const role = message.role === "assistant" ? "assistant" : "user"
			const content = Array.isArray(message.content)
				? message.content.map((block) => {
						if (typeof block === "string") {
							return { text: block }
						}
						if ("text" in block) {
							return { text: block.text }
						}
						// Handle other content types if needed
						return { text: "[Unsupported Content]" }
					})
				: [{ text: message.content }]
			return {
				role,
				content,
			}
		})
	}
	/**
	 * Check if a token count meets the minimum threshold for caching
	 */
	meetsMinTokenThreshold(tokenCount) {
		const minTokens = this.config.modelInfo.minTokensPerCachePoint
		if (!minTokens) {
			return false
		}
		return tokenCount >= minTokens
	}
	/**
	 * Estimate token count for a message using a more accurate approach
	 * This implementation is based on the BaseProvider's countTokens method
	 * but adapted to work without requiring an instance of BaseProvider
	 */
	estimateTokenCount(message) {
		// Use a more sophisticated token counting approach
		if (!message.content) return 0
		let totalTokens = 0
		if (Array.isArray(message.content)) {
			for (const block of message.content) {
				if (block.type === "text") {
					// Use a more accurate token estimation than simple character count
					// This is still an approximation but better than character/4
					const text = block.text || ""
					if (text.length > 0) {
						// Count words and add overhead for punctuation and special tokens
						const words = text.split(/\s+/).filter((word) => word.length > 0)
						// Average English word is ~1.3 tokens
						totalTokens += words.length * 1.3
						// Add overhead for punctuation and special characters
						totalTokens += (text.match(/[.,!?;:()[\]{}""''`]/g) || []).length * 0.3
						// Add overhead for newlines
						totalTokens += (text.match(/\n/g) || []).length * 0.5
					}
				} else if (block.type === "image") {
					// For images, use a conservative estimate
					totalTokens += 300
				}
			}
		} else if (typeof message.content === "string") {
			const text = message.content
			// Count words and add overhead for punctuation and special tokens
			const words = text.split(/\s+/).filter((word) => word.length > 0)
			// Average English word is ~1.3 tokens
			totalTokens += words.length * 1.3
			// Add overhead for punctuation and special characters
			totalTokens += (text.match(/[.,!?;:()[\]{}""''`]/g) || []).length * 0.3
			// Add overhead for newlines
			totalTokens += (text.match(/\n/g) || []).length * 0.5
		}
		// Add a small overhead for message structure
		totalTokens += 10
		return Math.ceil(totalTokens)
	}
	/**
	 * Apply cache points to content blocks based on placements
	 */
	applyCachePoints(messages, placements) {
		const result = []
		for (let i = 0; i < messages.length; i++) {
			const placement = placements.find((p) => p.index === i)
			if (placement) {
				messages[i].content?.push(this.createCachePoint())
			}
			result.push(messages[i])
		}
		return result
	}
	/**
	 * Format the final result with cache points applied
	 */
	formatResult(systemBlocks = [], messages) {
		const result = {
			system: systemBlocks,
			messages,
		}
		return result
	}
}
//# sourceMappingURL=base-strategy.js.map
