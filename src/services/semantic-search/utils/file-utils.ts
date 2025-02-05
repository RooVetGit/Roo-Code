import { fileTypeFromBuffer } from "file-type"
import * as vscode from "vscode"
import * as path from "path"

// Configurable parameters
const TEXT_VALIDATION_SAMPLE_SIZE = 4096 // Check first 4KB for binary indicators
const VALID_BYTE_RATIO = 0.95 // Reduced from 0.99 to 0.95
const CONTROL_CHAR_THRESHOLD = 0.05 // Increased from 0.01 to 0.05

export async function isTextFile(filePath: string, maxSize: number): Promise<boolean> {
	const stats = await vscode.workspace.fs.stat(vscode.Uri.file(filePath))
	if (stats.type === vscode.FileType.Directory) return false
	if (stats.size === 0) return false
	if (stats.size > maxSize) return false

	const fileContent = await vscode.workspace.fs.readFile(vscode.Uri.file(filePath))
	const buffer = Buffer.from(fileContent)

	// 1. Check for known binary types using file-type
	const type = await fileTypeFromBuffer(buffer)
	if (type) {
		// Reject if detected as binary type (non-text)
		const isBinary = !type.mime.startsWith("text/") && !["application/json", "application/xml"].includes(type.mime)
		if (isBinary) {
			console.log(`File ${filePath} rejected: binary MIME type ${type.mime}`)
			return false
		}
	}

	// 2. Validate UTF-8 encoding
	if (!isValidUtf8(buffer)) {
		console.log(`File ${filePath} rejected: invalid UTF-8`)
		return false
	}

	// 3. Check for excessive control characters
	const { controlCount, validCount, totalSampled } = analyzeBytes(buffer)
	const controlRatio = controlCount / totalSampled
	const validRatio = validCount / totalSampled

	console.log(`File ${filePath} metrics:`, {
		controlRatio: controlRatio.toFixed(4),
		validRatio: validRatio.toFixed(4),
		threshold: {
			maxControl: CONTROL_CHAR_THRESHOLD,
			minValid: VALID_BYTE_RATIO,
		},
	})

	const isValid = validRatio >= VALID_BYTE_RATIO && controlRatio <= CONTROL_CHAR_THRESHOLD
	if (!isValid) {
		console.log(`File ${filePath} rejected: failed character ratio checks`)
	}
	return isValid
}

function analyzeBytes(buffer: Buffer): { controlCount: number; validCount: number; totalSampled: number } {
	let controlCount = 0
	let validCount = 0

	// Only check first 4KB for performance
	const sample = buffer.subarray(0, TEXT_VALIDATION_SAMPLE_SIZE)

	if (sample.length === 0) {
		return { controlCount: 0, validCount: 0, totalSampled: 0 }
	}

	for (const byte of sample) {
		if (byte === 0) {
			// Null byte
			controlCount++
			continue
		}

		if (byte < 32 && ![9, 10, 13].includes(byte)) {
			// Control chars
			controlCount++
		}

		if (
			byte === 0x09 || // Tab
			byte === 0x0a || // LF
			byte === 0x0d || // CR
			(byte >= 0x20 && byte <= 0x7e) // Printable ASCII
		) {
			validCount++
		}
	}

	return {
		controlCount: controlCount,
		validCount: validCount,
		totalSampled: sample.length,
	}
}

function isValidUtf8(buffer: Buffer): boolean {
	try {
		// Use Node.js built-in validation
		new TextDecoder("utf-8", { fatal: true }).decode(buffer)
		return true
	} catch {
		return false
	}
}

export async function isCodeFile(filePath: string): Promise<boolean> {
	// 1. Check using VS Code's language detection
	const language = await getVSCodeLanguage(filePath)
	if (language && isProgrammingLanguage(language)) {
		return true
	}

	// 2. Check for common code patterns in content
	const content = await readFileSample(filePath, 512)
	return hasCodePatterns(content)
}

async function getVSCodeLanguage(filePath: string): Promise<string | undefined> {
	try {
		const doc = await vscode.workspace.openTextDocument(filePath)
		return doc.languageId
	} catch (error) {
		if (error instanceof Error && error.message.includes("binary")) {
			console.log(`Skipping binary file: ${filePath}`)
			return undefined
		}
		console.error(`Error opening document ${filePath}:`, error)
		return undefined
	}
}

function isProgrammingLanguage(langId: string): boolean {
	// Exclude markup and documentation formats
	const NON_CODE_LANGUAGES = new Set([
		"plaintext",
		"markdown",
		"html",
		"css",
		"scss",
		"json",
		"xml",
		"yaml",
		"text",
		"log",
	])
	return !NON_CODE_LANGUAGES.has(langId.toLowerCase())
}

async function readFileSample(filePath: string, bytes: number): Promise<string> {
	try {
		const content = await vscode.workspace.fs.readFile(vscode.Uri.file(filePath))
		return new TextDecoder().decode(content.slice(0, bytes))
	} catch {
		return ""
	}
}

function hasCodePatterns(content: string): boolean {
	// Look for code indicators in the first 512 characters
	const CODE_PATTERNS = [
		/\b(function|class|interface|def|fn)\b/, // Common keywords
		/[\{\}\(\)=><+\-*/%]/, // Operators and brackets
		/\/\/|# |\/\*/, // Comments
		/(import|from|require|using)\s+['"]/, // Import statements
	]

	return CODE_PATTERNS.some((pattern) => pattern.test(content))
}
