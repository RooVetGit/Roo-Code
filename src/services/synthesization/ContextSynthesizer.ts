import { Anthropic } from "@anthropic-ai/sdk"

import { ApiHandler } from "../../api"

/**
 * Service responsible for synthesizing conversation history segments.
 */
export class ContextSynthesizer {
	private apiHandler: ApiHandler

	constructor(apiHandler: ApiHandler) {
		this.apiHandler = apiHandler
		// TODO: Consider if a specific, potentially faster/cheaper model should be configured for synthesizing,
		// possibly by accepting a separate ApiConfiguration or model ID in the constructor.
	}

	/**
	 * Synthesizes a given array of conversation messages using an LLM.
	 * @param messagesToSynthesize The array of messages to be synthesized.
	 * @returns A promise that resolves to a new message object containing the synthesis,
	 *          or null if synthesizing fails or is not possible.
	 */
	async synthesize(messagesToSynthesize: Anthropic.MessageParam[]): Promise<Anthropic.MessageParam | null> {
		if (messagesToSynthesize.length === 0) {
			return null // Nothing to synthesize
		}

		// Construct the prompt for the synthesizing model (User Final Refinement)
		const systemPrompt = `You are a specialized context compression system for Roo-Code, a VS Code extension that enables AI coding agents. Your sole purpose is to condense conversation history while preserving maximum technical context with minimum tokens.

**Context Schema:**
- You are synthesizing the MIDDLE portion of a conversation
- The original system prompt and initial interactions remain intact before your synthesis
- Recent conversation turns remain intact after your synthesis
- Your synthesis will be the critical bridge connecting these preserved segments

**Content Priorities (Highest to Lowest):**
1. **Code Context:**
		 - Repository structure and file relationships
		 - Code snippets with their functionality and modifications
		 - Bugs/errors encountered and their solutions
		 - API endpoints and data structures
		 - Implementation decisions and their rationales

2. **Tool Usage:**
		 - Tools that were invoked and their outputs
		 - File operations performed (creation, reading, modification)
		 - Files examined or referenced
		 - Terminal commands executed
		 - External APIs or services utilized

3. **Task Progress:**
		 - Original user requirements and specifications
		 - Current implementation status
		 - Remaining tasks or issues
		 - Alternative approaches discussed and decisions made
		 - User feedback on implementations

4. **Technical Information:**
		 - Language/framework specifics
		 - Environment configuration details
		 - Performance considerations
		 - Security requirements
		 - Testing approaches

**Output Requirements:**
- Produce ONLY the synthesis text with no meta-commentary
- Use precise, technical language optimized for information density
- Structure with minimal formatting (use ## for major sections if necessary)
- Omit pleasantries, acknowledgments, and conversational elements
- Format sequences of related facts as compact, semicolon-separated phrases
- Use minimal tokens while maximizing preserved information
- Prioritize factual over instructional content

This synthesis must enable seamless conversation continuity with no perceived context loss between the earlier and later preserved segments.`

		// Format the messages for the prompt. Simple stringification might be too verbose or lose structure.
		// Let's try a more readable format.
		const formattedMessages = messagesToSynthesize
			.map((msg) => {
				let contentText = ""
				if (Array.isArray(msg.content)) {
					contentText = msg.content
						.map((block) => {
							if (block.type === "text") return block.text
							if (block.type === "image") return "[Image Content]" // Represent images concisely
							// Add handling for other potential block types if necessary
							return `[Unsupported Content: ${block.type}]`
						})
						.join("\n")
				} else {
					contentText = msg.content
				}
				return `${msg.role.toUpperCase()}:\n${contentText}`
			})
			.join("\n\n---\n\n")

		const userPrompt = `Please synthesize the following conversation turns:\n\n${formattedMessages}`

		try {
			// Use the configured API handler to make the synthesizing call
			// Note: This uses the main configured model. Consider allowing a specific synthesizing model.
			// Disable prompt caching for synthesizing calls? - Currently not directly supported per-call.
			// It will use the handler's configured caching setting.
			const stream = this.apiHandler.createMessage(
				systemPrompt,
				[{ role: "user", content: userPrompt }],
				undefined, // No specific cache key for synthesizing
				// { promptCachingEnabled: false } // Removed incorrect 4th argument
			)

			let synthesisText = ""
			let finalUsage = null

			// Consume the stream to get the full response
			for await (const chunk of stream) {
				if (chunk.type === "text") {
					synthesisText += chunk.text
				} else if (chunk.type === "usage") {
					// Capture usage details if needed for cost tracking/logging
					finalUsage = chunk
				}
			}

			if (finalUsage) {
				// Optional: Log synthesizing cost/tokens
				console.log(
					`[Synthesizing] Usage: In=${finalUsage.inputTokens}, Out=${finalUsage.outputTokens}, Cost=${finalUsage.totalCost?.toFixed(6) ?? "N/A"}`,
				)
			}

			if (!synthesisText || synthesisText.trim() === "") {
				console.warn("Context synthesizing resulted in an empty synthesis.")
				return null
			}

			// Return the synthesis as a user message, representing the synthesized history.
			return {
				role: "user", // Represents the synthesized user/assistant interaction leading up to the current point.
				content: `[Synthesized Conversation History]\n${synthesisText.trim()}`,
			}
		} catch (error) {
			console.error("Context synthesizing API call failed:", error)
			// TODO: Add more robust error handling/logging (e.g., telemetry)
			return null // Indicate failure
		}
	}
}
