/**
 * Utility functions for detecting temperature-related tool errors
 */

import { Task } from "../../task/Task"

/**
 * Error patterns that indicate temperature-related issues
 */
const TEMPERATURE_ERROR_PATTERNS = [
	// Direct truncation indicators
	/content appears to be truncated/i,
	/found comments indicating omitted code/i,
	/rest of code unchanged/i,
	/previous code/i,
	/code omitted/i,
	/truncated after \d+ lines/i,
	/keep the rest/i,

	// Common AI placeholder patterns when temperature is high
	/\/\/\s*\.\.\./,
	/\/\*\s*\.\.\.\s*\*\//,
	/\[\s*\.\.\.\s*\]/,
	/\{\s*\.\.\.\s*\}/,

	// Incomplete content indicators
	/incomplete file content/i,
	/partial content/i,
	/content was cut off/i,
]

/**
 * Tool names that commonly experience temperature-related failures
 */
const TEMPERATURE_SENSITIVE_TOOLS = ["write_to_file", "apply_diff"]

/**
 * Checks if an error is likely caused by high temperature settings
 * @param toolName The name of the tool that failed
 * @param error The error message or Error object
 * @param task The current task instance to check temperature settings
 * @returns True if the error appears to be temperature-related
 */
export function isTemperatureRelatedError(toolName: string, error: string | Error, task: Task): boolean {
	// Only check for temperature errors on specific tools
	if (!TEMPERATURE_SENSITIVE_TOOLS.includes(toolName)) {
		return false
	}

	// Get current temperature from API configuration
	const currentTemperature = task.apiConfiguration?.modelTemperature ?? 0.0

	// Only consider it a temperature issue if temperature is above 0.2
	if (currentTemperature <= 0.2) {
		return false
	}

	// Check if the user has customized the temperature (not using default)
	// Most providers default to 0.0 or 1.0, so anything else is likely custom
	const isCustomTemperature = currentTemperature !== 0.0 && currentTemperature !== 1.0

	if (!isCustomTemperature) {
		return false
	}

	// Convert error to string for pattern matching
	const errorMessage = typeof error === "string" ? error : error.message || ""

	// Check if error matches any temperature-related patterns
	return TEMPERATURE_ERROR_PATTERNS.some((pattern) => pattern.test(errorMessage))
}

/**
 * Gets a user-friendly message explaining the temperature issue
 * @param currentTemperature The current temperature setting
 * @returns A message explaining the issue
 */
export function getTemperatureErrorMessage(currentTemperature: number): string {
	return (
		`It looks like the tool failed due to your current temperature setting (${currentTemperature.toFixed(1)}). ` +
		`Higher temperature values can cause the AI to generate incomplete or malformed outputs. ` +
		`Reducing the temperature to 0.2 often resolves these issues.`
	)
}

/**
 * Checks if the temperature can be reduced further
 * @param currentTemperature The current temperature setting
 * @returns True if temperature can be reduced to 0.2
 */
export function canReduceTemperature(currentTemperature: number): boolean {
	return currentTemperature > 0.2
}
