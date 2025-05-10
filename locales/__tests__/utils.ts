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
	return fs.existsSync(filePath)
}

export function loadFileContent(filePath: string): string | null {
	try {
		return fs.readFileSync(filePath, "utf8")
	} catch (error) {
		return null
	}
}

export function parseJsonContent(content: string | null, filePath: string): any | null {
	if (!content) {
		return null
	}
	try {
		return JSON.parse(content)
	} catch (error) {
		bufferLog(`Error parsing JSON in ${filePath}: ${error}`)
		return null
	}
}

export function getValueAtPath(obj: any, path: string): any {
	const parts = path.split(".")
	let current = obj
	for (const part of parts) {
		if (current === null || current === undefined) {
			return undefined
		}
		current = current[part]
	}
	return current
}
