import * as jschardet from "jschardet"
import * as iconv from "iconv-lite"
import { isBinaryFile } from "isbinaryfile"
import fs from "fs/promises"
import path from "path"

/**
 * Detect the encoding of a file buffer
 * @param fileBuffer The file buffer
 * @param fileExtension Optional file extension
 * @returns The detected encoding
 */
export async function detectEncoding(fileBuffer: Buffer, fileExtension?: string): Promise<string> {
	// 1. First check if it's a binary file
	if (fileExtension) {
		const isBinary = await isBinaryFile(fileBuffer).catch(() => false)
		if (isBinary) {
			throw new Error(`Cannot read text for file type: ${fileExtension}`)
		}
	}

	// 2. Perform encoding detection
	const detected = jschardet.detect(fileBuffer)
	let encoding: string
	let originalEncoding: string | undefined
	
	if (typeof detected === "string") {
		encoding = detected
		originalEncoding = detected
	} else if (detected && detected.encoding) {
		originalEncoding = detected.encoding
		// Check confidence level, use default encoding if too low
		// 0.7 is a conservative threshold that works well when UTF-8 is the dominant encoding
		// and we prefer to fall back rather than risk mis-decoding
		if (detected.confidence < 0.7) {
			console.warn(`Low confidence encoding detection: ${originalEncoding} (confidence: ${detected.confidence}), falling back to utf8`)
			encoding = "utf8"
		} else {
			encoding = detected.encoding
		}
	} else {
		console.warn(`No encoding detected, falling back to utf8`)
		encoding = "utf8"
	}

	// 3. Verify if the encoding is supported by iconv-lite
	if (!iconv.encodingExists(encoding)) {
		console.warn(`Unsupported encoding detected: ${encoding}${originalEncoding && originalEncoding !== encoding ? ` (originally detected as: ${originalEncoding})` : ''}, falling back to utf8`)
		encoding = "utf8"
	}

	return encoding
}

/**
 * Read file with automatic encoding detection
 * @param filePath Path to the file
 * @returns File content as string
 */
export async function readFileWithEncodingDetection(filePath: string): Promise<string> {
	const buffer = await fs.readFile(filePath)
	const fileExtension = path.extname(filePath).toLowerCase()
	
	const encoding = await detectEncoding(buffer, fileExtension)
	return iconv.decode(buffer, encoding)
}

/**
 * Detect the encoding of an existing file
 * @param filePath Path to the file
 * @returns Detected encoding, returns 'utf8' if file does not exist
 */
export async function detectFileEncoding(filePath: string): Promise<string> {
	try {
		const buffer = await fs.readFile(filePath)
		const fileExtension = path.extname(filePath).toLowerCase()
		return await detectEncoding(buffer, fileExtension)
	} catch (error) {
		// File does not exist or cannot be read, default to UTF-8
		return "utf8"
	}
}

/**
 * Write file using the same encoding as the original file
 * If the file is new, use UTF-8 encoding
 * @param filePath Path to the file
 * @param content Content to write (UTF-8 string)
 * @returns Promise<void>
 */
export async function writeFileWithEncodingPreservation(filePath: string, content: string): Promise<void> {
	// Detect original file encoding
	const originalEncoding = await detectFileEncoding(filePath)
	
	// If original file is UTF-8 or does not exist, write directly
	if (originalEncoding === "utf8") {
		await fs.writeFile(filePath, content, "utf8")
		return
	}
	
	// Convert UTF-8 content to original file encoding
	const encodedBuffer = iconv.encode(content, originalEncoding)
	await fs.writeFile(filePath, encodedBuffer)
}