import * as fs from "fs/promises"
import * as path from "path"
import * as chardet from "chardet"
import * as iconv from "iconv-lite"

/**
 * Common text file extensions that should always be treated as text
 */
const alwaysTextExtensions = [
	"txt",
	"md",
	"log",
	"rst",
	"tex",
	"json",
	"yaml",
	"yml",
	"ini",
	"conf",
	"cfg",
	"env",
	"toml",
	"properties",
	"js",
	"jsx",
	"ts",
	"tsx",
	"c",
	"cpp",
	"h",
	"hpp",
	"java",
	"py",
	"rb",
	"php",
	"go",
	"rs",
	"swift",
	"scala",
	"pl",
	"lua",
	"sh",
	"bat",
	"ps1",
	"html",
	"xml",
	"css",
	"scss",
	"less",
	"styl",
	"vue",
	"csv",
	"tsv",
]

/**
 * Scores text based on presence of Chinese/full-width characters
 * Higher score means more likely to be Chinese text
 * Pure ASCII text gets penalty score
 */
export function scoreText(text: string): number {
	const total = text.length
	if (total === 0) return 0
	const zh = (text.match(/[\u4e00-\u9fff]/g) || []).length
	const fullWidth = (text.match(/[\u3000-\u303F\uff00-\uffef]/g) || []).length
	const ascii = (text.match(/[\x00-\x7F]/g) || []).length
	return (zh * 2 + fullWidth) / total - (ascii === total ? 1 : 0)
}

/**
 * Gets candidate encodings to try, prioritizing UTF-8 and Chinese-related encodings
 * @param detected - Auto-detected encoding from chardet
 */
export function getCandidateEncodings(detected: string): string[] {
	const baseEncodings = ["utf-8", "gb18030", "gbk", "shift_jis"]
	const encSet = new Set(baseEncodings)
	if (detected) encSet.add(detected.toLowerCase())
	return Array.from(encSet)
}

/**
 * Attempts to decode buffer with multiple encodings and returns best result
 * @param buffer - File content buffer
 * @param encodings - List of encodings to try
 * @returns Object with decoded text, score and used encoding
 */
export function tryDecodeBuffer(
	buffer: Buffer,
	encodings: string[],
): { text: string; score: number; encoding: string } {
	let bestScore = -Infinity
	let bestText = ""
	let bestEncoding = "utf-8"

	for (const enc of encodings) {
		try {
			const text = enc === "utf-8" || enc === "utf8" ? buffer.toString("utf8") : iconv.decode(buffer, enc)
			const score = scoreText(text)
			if (score > bestScore) {
				bestScore = score
				bestText = text
				bestEncoding = enc
			}
		} catch {
			continue
		}
	}

	return { text: bestText, score: bestScore, encoding: bestEncoding }
}

/**
 * Reads file with automatic encoding detection and decoding
 * @param filePath - Path to file
 * @param toUtf8 - Whether to force convert to UTF-8 (default false)
 * @returns Decoded file content
 */
export async function readFileSmart(filePath: string, toUtf8: boolean = false): Promise<string> {
	const buffer = await fs.readFile(filePath)
	const ext = path.extname(filePath).slice(1).toLowerCase() || ""
	const detectedEncoding = (chardet.detect(buffer) || "utf-8").toString().toLowerCase()
	const encodings = getCandidateEncodings(detectedEncoding)

	const shouldTryAll = alwaysTextExtensions.includes(ext)
	const { text: bestText, score } = tryDecodeBuffer(buffer, encodings)

	if (shouldTryAll || score > 0.05) {
		return toUtf8 ? Buffer.from(bestText).toString("utf8") : bestText
	}

	try {
		let text: string
		if (["gbk", "gb2312", "gb18030"].includes(detectedEncoding)) {
			text = iconv.decode(buffer, "gb18030")
		} else if (detectedEncoding === "shift_jis") {
			const gbText = iconv.decode(buffer, "gb18030")
			if (/[\u4e00-\u9fa5]/.test(gbText)) {
				text = gbText
			} else {
				text = iconv.decode(buffer, "shift_jis")
			}
		} else if (detectedEncoding === "utf-8" || detectedEncoding === "utf8") {
			text = buffer.toString("utf8")
		} else {
			text = iconv.decode(buffer, detectedEncoding)
		}

		return toUtf8 ? Buffer.from(text).toString("utf8") : text
	} catch {
		const fallback = buffer.toString("utf8")
		return toUtf8 ? fallback : fallback
	}
}
