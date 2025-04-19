import * as vscode from "vscode"; // Needed for ContextProxy interaction (indirectly)
import { ContextProxy } from "../../config/ContextProxy"; // Use Roo Code's config proxy
import { ModelInfo } from "../../../schemas"; // Use Roo Code's ModelInfo type
import { logger } from "../../../utils/logging"; // Use Roo Code's logger

// TODO: Need a way to get the *current* model info, likely passed into ContextManager
// or retrieved via ContextProxy if it holds the current API config/model details.
// This function needs access to the current model's ModelInfo.

/**
 * Gets context window information based on the provided ModelInfo.
 * Adapted for Roo Code to use ModelInfo potentially retrieved via ContextProxy.
 *
 * @param modelInfo The ModelInfo object for the currently selected model.
 * @returns An object containing the raw context window size and the effective max allowed size, or default values if info is missing.
 */
export function getContextWindowInfo(modelInfo: ModelInfo | null | undefined): { contextWindow: number; maxAllowedSize: number } {
	// Default context window size if not specified in modelInfo
	const DEFAULT_CONTEXT_WINDOW = 128_000;
	// Default buffer size (subtracted from contextWindow)
	const DEFAULT_BUFFER = 30_000;

	let contextWindow = modelInfo?.contextWindow || DEFAULT_CONTEXT_WINDOW;
	let maxAllowedSize: number;

	// Apply specific buffer logic based on known context window sizes or a default percentage
	// This logic is retained from the original Cline implementation but might need adjustment
	// based on Roo Code's specific model usage and desired buffer strategies.
	switch (contextWindow) {
		case 64_000: // e.g., deepseek models
			maxAllowedSize = contextWindow - 27_000;
			break;
		case 128_000: // Common size
			maxAllowedSize = contextWindow - DEFAULT_BUFFER;
			break;
		case 200_000: // e.g., claude models
			maxAllowedSize = contextWindow - 40_000;
			break;
		default:
			// Use a percentage-based buffer (e.g., 80%) or a fixed buffer, whichever is larger,
			// ensuring a minimum buffer.
			const percentageBasedBuffer = contextWindow * 0.2; // 20% buffer
			const fixedBuffer = 40_000;
			maxAllowedSize = contextWindow - Math.max(percentageBasedBuffer, fixedBuffer);
			// Ensure maxAllowedSize is not negative or excessively small
			maxAllowedSize = Math.max(maxAllowedSize, contextWindow / 2, 1000); // Ensure at least 1000 tokens or 50%
			break;
	}

    // Log if using default values due to missing model info
    if (!modelInfo?.contextWindow) {
        logger.warn(`Context window info not found for the current model. Using default contextWindow: ${contextWindow}, maxAllowedSize: ${maxAllowedSize}`);
    }


	return { contextWindow, maxAllowedSize };
}

// Note: The original function relied on ApiHandler and specific provider checks (OpenAiHandler).
// This adapted version relies solely on the ModelInfo object, which should contain the necessary
// contextWindow size. The responsibility of getting the *correct* ModelInfo for the *current*
// API configuration lies outside this utility function, likely within Cline.ts or ContextManager's instantiation.
