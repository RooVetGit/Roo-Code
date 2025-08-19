/**
 * Configuration for models that should use simplified single-file read_file tool
 * These models will use the simpler <read_file><path>...</path></read_file> format
 * instead of the more complex multi-file args format
 */

// List of model IDs (or patterns) that should use single file reads only
export const SINGLE_FILE_READ_MODELS = new Set<string>(["roo/sonic"])

/**
 * Check if a model should use single file read format
 * @param modelId The model ID to check
 * @returns true if the model should use single file reads
 */
export function shouldUseSingleFileRead(modelId: string): boolean {
	// Direct match
	if (SINGLE_FILE_READ_MODELS.has(modelId)) {
		return true
	}

	// Pattern matching for model families
	// Check if model ID starts with any configured pattern
	for (const pattern of SINGLE_FILE_READ_MODELS) {
		if (pattern.endsWith("*") && modelId.startsWith(pattern.slice(0, -1))) {
			return true
		}
	}

	return false
}
