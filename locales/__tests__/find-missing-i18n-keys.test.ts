const fs = require("fs")
const path = require("path")
import { bufferLog, printLogs, clearLogs, loadFileContent, parseJsonContent } from "./utils"

// findMissingI18nKeys: Directories to traverse and their corresponding locales
const SCAN_SOURCE_DIRS = {
	components: {
		path: "webview-ui/src",
		localesDir: "webview-ui/src/i18n/locales",
	},
	src: {
		path: "src",
		localesDir: "src/i18n/locales",
	},
}

// i18n key patterns for findMissingI18nKeys
const i18nScanPatterns = [
	/{t\("([^"]+)"\)}/g,
	/i18nKey="([^"]+)"/g,
	/t\("([a-zA-Z][a-zA-Z0-9_]*[:.][a-zA-Z0-9_.]+)"\)/g,
	// Add pattern to match t() calls with parameters
	/t\("([a-zA-Z][a-zA-Z0-9_]*[:.][a-zA-Z0-9_.]+)",/g,
]

// Check if the key exists in all official language files, return a list of missing language files

// Function 1: Accumulate source keys
function accumulateSourceKeys(): Set<string> {
	const sourceCodeKeys = new Set<string>()

	function walk(dir: string, baseDir: string, localesDir: string) {
		const files = fs.readdirSync(dir)

		for (const file of files) {
			const filePath = path.join(dir, file)
			const stat = fs.statSync(filePath)

			// Exclude test files and __mocks__ directory
			if (filePath.includes(".test.") || filePath.includes("__mocks__")) continue

			if (stat.isDirectory()) {
				walk(filePath, baseDir, localesDir) // Recursively traverse subdirectories
			} else if (stat.isFile() && [".ts", ".tsx", ".js", ".jsx"].includes(path.extname(filePath))) {
				// Read file content
				const content = fs.readFileSync(filePath, "utf8")

				// Match all i18n keys
				const matches = new Set<string>()
				for (const pattern of i18nScanPatterns) {
					let match
					while ((match = pattern.exec(content)) !== null) {
						matches.add(match[1])
						sourceCodeKeys.add(match[1]) // Add to global set for unused key detection
					}
				}
			}
		}
	}

	// Walk through all directories to collect source code keys
	Object.entries(SCAN_SOURCE_DIRS).forEach(([_name, config]) => {
		// Create locales directory if it doesn't exist
		if (!fs.existsSync(config.localesDir)) {
			fs.mkdirSync(config.localesDir, { recursive: true })
		}
		walk(config.path, config.path, config.localesDir)
	})

	return sourceCodeKeys
}

// Function 2: Accumulate translation keys
function accumulateTranslationKeys(): Set<string> {
	const translationFileKeys = new Set<string>()

	// Helper function to extract all keys from a JSON object with their full paths
	function extractKeysFromJson(obj: any, prefix: string): string[] {
		const keys: string[] = []

		function traverse(o: any, p: string) {
			if (o && typeof o === "object") {
				Object.keys(o).forEach((key) => {
					const newPath = p ? `${p}.${key}` : key
					if (o[key] && typeof o[key] === "object") {
						traverse(o[key], newPath)
					} else {
						keys.push(`${prefix}:${newPath}`)
					}
				})
			}
		}

		traverse(obj, "")
		return keys
	}

	// Check all locale directories for translation keys
	Object.entries(SCAN_SOURCE_DIRS).forEach(([_name, config]) => {
		const enLocalesDir = path.join(config.localesDir, "en")
		if (fs.existsSync(enLocalesDir)) {
			const enFiles = fs.readdirSync(enLocalesDir)

			for (const file of enFiles) {
				if (path.extname(file) === ".json") {
					const filePath = path.join(enLocalesDir, file)
					const content = loadFileContent(filePath)
					const json = parseJsonContent(content, filePath)

					if (json) {
						// Extract all keys from the JSON file
						const fileKeys = extractKeysFromJson(json, file.replace(".json", ""))

						// Add all keys to the translation file keys set
						fileKeys.forEach((key) => {
							translationFileKeys.add(key)
						})
					}
				}
			}
		}
	})

	return translationFileKeys
}

// Function 3: Return all keys in source that are not in translations
function getKeysInSourceNotInTranslation(sourceKeys: Set<string>, translationKeys: Set<string>): string[] {
	return Array.from(sourceKeys)
		.filter((key) => !translationKeys.has(key))
		.sort()
}

// Function 4: Return all keys in translations that are not in source
function getKeysInTranslationNotInSource(sourceKeys: Set<string>, translationKeys: Set<string>): string[] {
	return Array.from(translationKeys)
		.filter((key) => !sourceKeys.has(key))
		.sort()
}

// Recursively traverse the directory
export function findMissingI18nKeys(): { output: string } {
	clearLogs() // Clear buffer at start

	// Get source code keys and translation keys
	const sourceCodeKeys = accumulateSourceKeys()
	const translationFileKeys = accumulateTranslationKeys()

	// Find keys in source not in translations and vice versa
	const missingTranslationKeys = getKeysInSourceNotInTranslation(sourceCodeKeys, translationFileKeys)
	const unusedTranslationKeys = getKeysInTranslationNotInSource(sourceCodeKeys, translationFileKeys)

	// Track unused keys in English locale files
	const unusedKeys: Array<{ key: string; file: string }> = []

	// Populate unusedKeys for the original output format
	Object.entries(SCAN_SOURCE_DIRS).forEach(([_name, config]) => {
		const enLocalesDir = path.join(config.localesDir, "en")
		if (fs.existsSync(enLocalesDir)) {
			const enFiles = fs.readdirSync(enLocalesDir)

			for (const file of enFiles) {
				if (path.extname(file) === ".json") {
					const filePath = path.join(enLocalesDir, file)
					const content = loadFileContent(filePath)
					const json = parseJsonContent(content, filePath)

					if (json) {
						// Extract all keys from the JSON file
						const fileKeys = extractKeysFromJson(json, file.replace(".json", ""))

						// Check if each key is used in source code
						fileKeys.forEach((key) => {
							if (!sourceCodeKeys.has(key)) {
								unusedKeys.push({
									key,
									file: path.relative(process.cwd(), filePath),
								})
							}
						})
					}
				}
			}
		}
	})

	// Accumulate all debug information into a single string
	let summaryOutput = "\n=== i18n Keys Summary ===\n"

	// Add summary counts
	summaryOutput += `\nTotal source code keys: ${sourceCodeKeys.size}\n`
	summaryOutput += `Total translation file keys: ${translationFileKeys.size}\n`

	// Keys in source code but not in translation files
	summaryOutput += `\n1. Keys in source code but not in translation files (${missingTranslationKeys.length}):\n`
	if (missingTranslationKeys.length === 0) {
		summaryOutput += "  None - all source code keys have translations\n"
	} else {
		missingTranslationKeys.forEach((key) => {
			summaryOutput += `  - ${key}\n`
		})
	}

	// Keys in translation files but not in source code
	summaryOutput += `\n2. Keys in translation files but not in source code (${unusedTranslationKeys.length}):\n`
	if (unusedTranslationKeys.length === 0) {
		summaryOutput += "  None - all translation keys are used in source code\n"
	} else {
		// Group keys by locale directory and file
		const localeFileMap = new Map<string, Map<string, string[]>>()

		// Process each key to extract file path and actual key
		unusedTranslationKeys.forEach((fullKey) => {
			// Extract file name and key path
			const parts = fullKey.split(":")
			if (parts.length >= 2) {
				const filePrefix = parts[0]
				const keyPath = parts.slice(1).join(".")

				// Find the locale directory for this file prefix
				let foundLocaleDir = ""
				Object.entries(SCAN_SOURCE_DIRS).forEach(([_name, config]) => {
					const enLocalesDir = path.join(config.localesDir, "en")
					const jsonFilePath = path.join(enLocalesDir, `${filePrefix}.json`)
					if (fs.existsSync(jsonFilePath)) {
						foundLocaleDir = path.relative(process.cwd(), jsonFilePath)
					}
				})

				// If we found the locale directory, add the key to the map
				if (foundLocaleDir) {
					if (!localeFileMap.has(foundLocaleDir)) {
						localeFileMap.set(foundLocaleDir, new Map())
					}

					if (!localeFileMap.get(foundLocaleDir)?.has(filePrefix)) {
						localeFileMap.get(foundLocaleDir)?.set(filePrefix, [])
					}

					localeFileMap.get(foundLocaleDir)?.get(filePrefix)?.push(keyPath)
				} else {
					// Fallback to the old behavior if we can't find the locale directory
					if (!localeFileMap.has(filePrefix)) {
						localeFileMap.set(filePrefix, new Map())
					}

					if (!localeFileMap.get(filePrefix)?.has("unknown")) {
						localeFileMap.get(filePrefix)?.set("unknown", [])
					}

					localeFileMap.get(filePrefix)?.get("unknown")?.push(keyPath)
				}
			}
		})

		// Display keys grouped by file
		Array.from(localeFileMap.entries())
			.sort()
			.forEach(([filePath, prefixMap]) => {
				summaryOutput += `  - ${filePath}:\n`

				Array.from(prefixMap.entries())
					.sort()
					.forEach(([_prefix, keys]) => {
						keys.sort().forEach((key) => {
							summaryOutput += `      ${key}\n`
						})
					})
			})
	}

	// Add to buffer as a single log entry
	bufferLog(summaryOutput)

	// Helper function to extract all keys from a JSON object with their full paths
	function extractKeysFromJson(obj: any, prefix: string): string[] {
		const keys: string[] = []

		function traverse(o: any, p: string) {
			if (o && typeof o === "object") {
				Object.keys(o).forEach((key) => {
					const newPath = p ? `${p}.${key}` : key
					if (o[key] && typeof o[key] === "object") {
						traverse(o[key], newPath)
					} else {
						keys.push(`${prefix}:${newPath}`)
					}
				})
			}
		}

		traverse(obj, "")
		return keys
	}

	return { output: printLogs() }
}

describe("Find Missing i18n Keys", () => {
	// Cache the source and translation keys
	let sourceKeys: Set<string>
	let translationKeys: Set<string>
	let keysInSourceNotInTranslation: string[]
	let keysInTranslationNotInSource: string[]

	beforeAll(() => {
		// Accumulate keys once for all tests
		sourceKeys = accumulateSourceKeys()
		translationKeys = accumulateTranslationKeys()

		// Find differences
		keysInSourceNotInTranslation = getKeysInSourceNotInTranslation(sourceKeys, translationKeys)
		keysInTranslationNotInSource = getKeysInTranslationNotInSource(sourceKeys, translationKeys)

		// Clear logs at start
		clearLogs()

		// Accumulate debug information into a buffer
		bufferLog("\n=== DEBUG: i18n Keys Summary ===")
		bufferLog(`\nTotal source code keys: ${sourceKeys.size}`)
		bufferLog(`Total translation file keys: ${translationKeys.size}`)

		bufferLog(`\n1. Keys in source code but not in translation files (${keysInSourceNotInTranslation.length}):`)
		if (keysInSourceNotInTranslation.length === 0) {
			bufferLog("  None - all source code keys have translations")
		} else {
			keysInSourceNotInTranslation.forEach((key) => {
				bufferLog(`  - ${key}`)
			})
		}

		bufferLog(`\n2. Keys in translation files but not in source code (${keysInTranslationNotInSource.length}):`)
		if (keysInTranslationNotInSource.length === 0) {
			bufferLog("  None - all translation keys are used in source code")
		} else {
			// Group keys by file prefix for better readability
			const filePathMap = new Map<string, string[]>()

			keysInTranslationNotInSource.forEach((fullKey) => {
				const parts = fullKey.split(":")
				if (parts.length >= 2) {
					const filePrefix = parts[0]

					if (!filePathMap.has(filePrefix)) {
						filePathMap.set(filePrefix, [])
					}

					filePathMap.get(filePrefix)?.push(parts.slice(1).join("."))
				}
			})

			Array.from(filePathMap.entries())
				.sort()
				.forEach(([filePrefix, keys]) => {
					bufferLog(`  - ${filePrefix}:`)
					keys.sort().forEach((key) => {
						bufferLog(`      ${key}`)
					})
				})
		}

		// Store the buffer output for tests
		printLogs()
	})

	// Test 1: Fail if there are keys in source not in translations
	test("Test 1: Fail if there are keys in source not in translations", () => {
		// Run the original function to get the output
		const result = findMissingI18nKeys()

		// Check for the expected message in the output
		expect(result.output).toContain("None - all source code keys have translations")

		// This test should fail if there are any keys in source not in translations
		expect(keysInSourceNotInTranslation.length).toBe(0)
	})

	// Test 2: Fail if there are keys in translations not in source
	test("Test 2: Fail if there are keys in translations not in source", () => {
		// Run the original function to get the output
		const result = findMissingI18nKeys()

		// Check for the expected message in the output
		expect(result.output).toContain("None - all translation keys are used in source code")

		// This test should fail if there are any keys in translations not in source
		// We expect this test to fail in the current codebase
		expect(keysInTranslationNotInSource.length).toBe(0)
	})
})
