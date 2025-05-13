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
	/\bt\([\s\n]*"([^"]+)"/g,
	/\bt\([\s\n]*'([^']+)'/g,
	/\bt\([\s\n]*`([^`]+)`/g,
	/i18nKey="([^"]+)"/g,
]

// Track line numbers for source code keys
const lineMap = new Map<string, { file: string; line: number }>()

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
						const key = match[1]
						const lineNumber = content.slice(0, match.index).split("\n").length
						matches.add(key)
						sourceCodeKeys.add(key)
						lineMap.set(key, {
							file: path.relative(process.cwd(), filePath),
							line: lineNumber,
						})
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

// Function to convert a key into segments and mark dynamic parts as undefined
function keyToSegments(key: string): (string | undefined)[] {
	return key.split(".").map((segment) => (segment.includes("${") ? undefined : segment))
}

// Function to check if a static key matches a dynamic key pattern
function matchesKeyPattern(staticKey: string, dynamicKey: string): boolean {
	const staticSegments = staticKey.split(".")
	const dynamicSegments = keyToSegments(dynamicKey)

	if (staticSegments.length !== dynamicSegments.length) {
		return false
	}

	return dynamicSegments.every((dynSeg, i) => dynSeg === undefined || dynSeg === staticSegments[i])
}

// Function 4: Return all keys in translations that are not in source
function getKeysInTranslationNotInSource(
	sourceKeys: Set<string>,
	translationKeys: Set<string>,
	dynamicKeys: string[] = [],
): string[] {
	return Array.from(translationKeys)
		.filter((key) => {
			// If key is directly used in source, it's not unused
			if (sourceKeys.has(key)) {
				return false
			}

			// If key matches any dynamic key pattern, it's not unused
			if (dynamicKeys.some((dynamicKey) => matchesKeyPattern(key, dynamicKey))) {
				return false
			}

			return true
		})
		.sort()
}

// Function to find dynamic i18n keys (containing ${...})
function findDynamicKeys(sourceKeys: Set<string>): string[] {
	return Array.from(sourceKeys)
		.filter((key) => key.includes("${"))
		.sort()
}

// Function to find non-namespaced t() calls
export function findNonNamespacedI18nKeys(sourceKeys: Set<string>): string[] {
	return Array.from(sourceKeys)
		.filter((key) => !key.includes(":"))
		.sort()
}

export function findMissingI18nKeys(): { output: string; nonNamespacedKeys: string[] } {
	clearLogs() // Clear buffer at start

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

	// Get source code keys and translation keys
	const sourceCodeKeys = accumulateSourceKeys()
	const translationFileKeys = accumulateTranslationKeys()

	// Find special keys
	const dynamicKeys = findDynamicKeys(sourceCodeKeys)
	const nonNamespacedKeys = findNonNamespacedI18nKeys(sourceCodeKeys)

	// Create sets for set operations
	const dynamicSet = new Set(dynamicKeys)
	const nonNamespacedSet = new Set(nonNamespacedKeys)
	const remainingSourceKeys = new Set(
		Array.from(sourceCodeKeys).filter((key) => !dynamicSet.has(key) && !nonNamespacedSet.has(key)),
	)

	// Find keys in source not in translations and vice versa
	const missingTranslationKeys = getKeysInSourceNotInTranslation(remainingSourceKeys, translationFileKeys)
	const unusedTranslationKeys = getKeysInTranslationNotInSource(remainingSourceKeys, translationFileKeys, dynamicKeys)

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

	// Dynamic keys
	summaryOutput += `\n1. Dynamic i18n keys (${dynamicKeys.length}):\n`
	if (dynamicKeys.length === 0) {
		summaryOutput += "  None - all i18n keys are static\n"
	} else {
		dynamicKeys.forEach((key) => {
			const loc = lineMap.get(key)
			summaryOutput += `  - ${loc?.file}:${loc?.line}: ${key}\n`
		})
	}

	// Non-namespaced keys
	summaryOutput += `\n2. Non-namespaced t() calls (${nonNamespacedKeys.length}):\n`
	if (nonNamespacedKeys.length === 0) {
		summaryOutput += "  None - all t() calls use namespaces\n"
	} else {
		nonNamespacedKeys.forEach((key) => {
			const loc = lineMap.get(key)
			summaryOutput += `  - ${loc?.file}:${loc?.line}: ${key}\n`
		})
	}

	// Keys in source code but not in translation files
	summaryOutput += `\n3. Keys in source code but not in translation files (${missingTranslationKeys.length}):\n`
	if (missingTranslationKeys.length === 0) {
		summaryOutput += "  None - all source code keys have translations\n"
	} else {
		missingTranslationKeys.forEach((key) => {
			summaryOutput += `  - ${key}\n`
		})
	}

	// Keys in translation files but not in source code (excluding dynamic matches)
	summaryOutput += `\n4. Unused translation keys (${unusedTranslationKeys.length}):\n`
	if (unusedTranslationKeys.length === 0) {
		summaryOutput += "  None - all translation keys are either directly used or matched by dynamic patterns\n"
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

	return {
		output: printLogs(),
		nonNamespacedKeys,
	}
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

		// Find special keys
		const dynamicKeys = findDynamicKeys(sourceKeys)
		const nonNamespacedKeys = findNonNamespacedI18nKeys(sourceKeys)

		// Create sets for set operations
		const dynamicSet = new Set(dynamicKeys)
		const nonNamespacedSet = new Set(nonNamespacedKeys)
		const remainingSourceKeys = new Set(
			Array.from(sourceKeys).filter((key) => !dynamicSet.has(key) && !nonNamespacedSet.has(key)),
		)

		// Find differences
		keysInSourceNotInTranslation = getKeysInSourceNotInTranslation(remainingSourceKeys, translationKeys)
		keysInTranslationNotInSource = getKeysInTranslationNotInSource(
			remainingSourceKeys,
			translationKeys,
			dynamicKeys,
		)

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
