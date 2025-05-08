import fs from "fs/promises"
import path from "path"
import { Mode } from "../../../shared/modes"
import { fileExistsAtPath } from "../../../utils/fs"

export type PromptVariables = {
	workspace?: string
	mode?: string
	language?: string
	shell?: string
	operatingSystem?: string
}

/**
 * Replace variable placeholders in template strings with their values
 * @param content - Template content with {{variable}} placeholders
 * @param variables - Object containing variable values to insert
 * @returns Interpolated content with variables replaced
 */
function interpolatePromptContent(content: string, variables: PromptVariables): string {
	let interpolatedContent = content
	for (const key in variables) {
		if (
			Object.prototype.hasOwnProperty.call(variables, key) &&
			variables[key as keyof PromptVariables] !== undefined
		) {
			const placeholder = new RegExp(`\\{\\{${key}\\}\\}`, "g")
			interpolatedContent = interpolatedContent.replace(placeholder, variables[key as keyof PromptVariables]!)
		}
	}
	return interpolatedContent
}

/**
 * Safely reads a file, returning an empty string if the file doesn't exist
 * @param filePath - Path to the file to read
 * @returns Trimmed file content or empty string on file not found
 * @throws Error if the file exists but there's an error reading it
 */
async function safeReadFile(filePath: string): Promise<string> {
	try {
		const content = await fs.readFile(filePath, "utf-8")
		// When reading with "utf-8" encoding, content should be a string
		return content.trim()
	} catch (err) {
		const errorCode = (err as NodeJS.ErrnoException).code
		if (!errorCode || !["ENOENT", "EISDIR"].includes(errorCode)) {
			throw err
		}
		return ""
	}
}

/**
 * Get the path to a system prompt file for a specific mode
 * @param cwd - Current working directory
 * @param mode - Mode identifier
 * @returns Full path to the mode-specific system prompt file
 */
export function getSystemPromptFilePath(cwd: string, mode: Mode): string {
	return path.join(cwd, ".roo", `system-prompt-${mode}`)
}

/**
 * Loads and processes custom system prompt from a file
 * @param cwd - Current working directory
 * @param mode - Mode identifier
 * @param variables - Variables to interpolate into the prompt template
 * @returns Processed system prompt or empty string if file doesn't exist
 */
export async function loadSystemPromptFile(cwd: string, mode: Mode, variables: PromptVariables): Promise<string> {
	const filePath = getSystemPromptFilePath(cwd, mode)
	const rawContent = await safeReadFile(filePath)
	if (!rawContent) {
		return ""
	}
	const interpolatedContent = interpolatePromptContent(rawContent, variables)
	return interpolatedContent
}

/**
 * Ensures the .roo directory exists, creating it if necessary
 * @param cwd - Current working directory where .roo directory should exist
 * @throws Error if directory creation fails (except for race condition)
 */
export async function ensureRooDirectory(cwd: string): Promise<void> {
	const rooDir = path.join(cwd, ".roo")

	// Check if directory already exists
	if (await fileExistsAtPath(rooDir)) {
		return
	}

	// Create the directory
	try {
		await fs.mkdir(rooDir, { recursive: true })
	} catch (err) {
		// If directory already exists (race condition), ignore the error
		const errorCode = (err as NodeJS.ErrnoException).code
		if (errorCode !== "EEXIST") {
			throw err
		}
	}
}
