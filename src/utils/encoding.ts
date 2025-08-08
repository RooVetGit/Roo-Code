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