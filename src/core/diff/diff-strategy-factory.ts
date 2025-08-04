import { DiffStrategy } from "../../shared/tools"
import { MultiSearchReplaceDiffStrategy } from "./strategies/multi-search-replace"
import { MultiFileSearchReplaceDiffStrategy } from "./strategies/multi-file-search-replace"
import { SimpleSearchReplaceDiffStrategy } from "./strategies/simple-search-replace"

export interface DiffStrategyFactoryOptions {
	modelId: string
	fuzzyMatchThreshold?: number
	bufferLines?: number
	useMultiFile?: boolean
}

/**
 * Factory function to create the appropriate diff strategy based on the model being used.
 * Claude models get the full-featured strategy with complex markers,
 * while other models get a simplified strategy that's easier to understand.
 */
export function createDiffStrategy(options: DiffStrategyFactoryOptions): DiffStrategy {
	const { modelId, fuzzyMatchThreshold, bufferLines, useMultiFile } = options

	// Check if the model is a Claude model (case-insensitive)
	const isClaudeModel = modelId.toLowerCase().includes("claude")

	// Claude models can handle the complex format
	if (isClaudeModel) {
		if (useMultiFile) {
			return new MultiFileSearchReplaceDiffStrategy(fuzzyMatchThreshold, bufferLines)
		} else {
			return new MultiSearchReplaceDiffStrategy(fuzzyMatchThreshold, bufferLines)
		}
	}

	// Non-Claude models get the simplified strategy
	// Note: We don't have a multi-file version of the simple strategy yet,
	// so we always use the single-file version for now
	return new SimpleSearchReplaceDiffStrategy(fuzzyMatchThreshold, bufferLines)
}

/**
 * Get the name of the diff strategy that would be used for a given model.
 * Useful for logging and debugging.
 */
export function getDiffStrategyName(modelId: string, useMultiFile?: boolean): string {
	const isClaudeModel = modelId.toLowerCase().includes("claude")

	if (isClaudeModel) {
		return useMultiFile ? "MultiFileSearchReplace" : "MultiSearchReplace"
	}

	return "SimpleSearchReplace"
}
