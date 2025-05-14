const fs = require("fs")
const path = require("path")
import { languages as schemaLanguages } from "../../src/schemas/index"

export const languages = schemaLanguages
export type Language = (typeof languages)[number]

let logBuffer: string[] = []

export function bufferLog(message: string) {
	logBuffer.push(message)
}

export function printLogs(): string {
	const output = logBuffer.join("\n")
	logBuffer = []
	return output
}

export function clearLogs(): void {
	logBuffer = []
}

export function fileExists(filePath: string): boolean {
	return fs.existsSync(path.join("./", filePath))
}

export function loadFileContent(filePath: string): string | null {
	try {
		return fs.readFileSync(filePath, "utf8")
	} catch (error) {
		return null
	}
}

// Track unique errors to avoid duplication
const seenErrors = new Set<string>()

export function parseJsonContent(content: string | null, filePath: string): any | null {
	if (!content) return null

	try {
		return JSON.parse(content)
	} catch (error) {
		// Only log first occurrence of each unique error
		const errorKey = `${filePath}:${(error as Error).message}`
		if (!seenErrors.has(errorKey)) {
			seenErrors.add(errorKey)
			bufferLog(`Error parsing ${path.basename(filePath)}: ${(error as Error).message}`)
		}
		return null
	}
}

export function getValueAtPath(obj: any, path: string): any {
	if (obj && typeof obj === "object" && Object.prototype.hasOwnProperty.call(obj, path)) {
		return obj[path]
	}

	const parts = path.split(".")
	let current = obj

	for (const part of parts) {
		if (current === undefined || current === null) {
			return undefined
		}
		current = current[part]
	}

	return current
}

// Utility function to escape dots in keys for display purposes
export function escapeDotsForDisplay(key: string): string {
	return key.replace(/\./g, "..")
}
