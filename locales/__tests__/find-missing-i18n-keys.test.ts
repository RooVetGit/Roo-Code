const fs = require("fs")
const path = require("path")
import { languages as schemaLanguages } from "../../src/schemas/index"
import { fileExists, loadFileContent, parseJsonContent, getValueAtPath } from "./lint-translations.test"

const languages = schemaLanguages

let logBuffer: string[] = []

function bufferLog(message: string) {
	logBuffer.push(message)
}

function printLogs(): string {
	const output = logBuffer.join("\n")
	logBuffer = []
	return output
}

// findMissingI18nKeys: Directories to traverse and their corresponding locales
const SCAN_SOURCE_DIRS = {
	components: {
		path: "webview-ui/src/components",
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
]

// Check if the key exists in all official language files, return a list of missing language files
function checkKeyInLocales(key: string, localesDir: string): Array<[string, boolean]> {
	const [file, ...pathParts] = key.split(":")
	const jsonPath = pathParts.join(".")
	const missingLocales = new Map<string, boolean>() // true = file missing, false = key missing

	// Check all official languages except English (source)
	languages
		.filter((lang) => lang !== "en")
		.forEach((locale) => {
			const filePath = path.join(localesDir, locale, `${file}.json`)
			const localePath = `${locale}/${file}.json`

			// If file doesn't exist or can't be loaded, mark entire file as missing
			if (!fileExists(filePath)) {
				missingLocales.set(localePath, true)
				return
			}

			const content = loadFileContent(filePath)
			if (!content) {
				missingLocales.set(localePath, true)
				return
			}

			const json = parseJsonContent(content, filePath)
			if (!json) {
				missingLocales.set(localePath, true)
				return
			}

			// Only check for missing key if file exists and is valid
			if (getValueAtPath(json, jsonPath) === undefined) {
				missingLocales.set(localePath, false)
			}
		})

	return Array.from(missingLocales.entries())
}

// Recursively traverse the directory
export function findMissingI18nKeys(): { output: string } {
	logBuffer = [] // Clear buffer at start
	let results: Array<{ key: string; file: string; missingLocales: Array<{ path: string; isFileMissing: boolean }> }> =
		[]

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
				const relPath = path.relative(process.cwd(), filePath)
				const content = fs.readFileSync(filePath, "utf8")

				// Match all i18n keys
				const matches = new Set<string>()
				for (const pattern of i18nScanPatterns) {
					let match
					while ((match = pattern.exec(content)) !== null) {
						matches.add(match[1])
					}
				}

				// Check each unique key against all official languages
				matches.forEach((key) => {
					const missingLocales = checkKeyInLocales(key, localesDir)
					if (missingLocales.length > 0) {
						results.push({
							key,
							missingLocales: missingLocales.map(([locale, isFileMissing]) => ({
								path: path.join(path.relative(process.cwd(), localesDir), locale),
								isFileMissing,
							})),
							file: relPath,
						})
					}
				})
			}
		}
	}

	// Walk through all directories and check against official languages
	Object.entries(SCAN_SOURCE_DIRS).forEach(([_name, config]) => {
		// Create locales directory if it doesn't exist
		if (!fs.existsSync(config.localesDir)) {
			bufferLog(`Warning: Creating missing locales directory: ${config.localesDir}`)
			fs.mkdirSync(config.localesDir, { recursive: true })
		}
		walk(config.path, config.path, config.localesDir)
	})

	// Process results
	bufferLog("=== i18n Key Check ===")

	if (!results || results.length === 0) {
		bufferLog("\n✅ All i18n keys are present!")
	} else {
		bufferLog("\n❌ Missing i18n keys:")

		// Group by file status
		const missingFiles = new Set<string>()
		const missingKeys = new Map<string, Set<string>>()

		results.forEach(({ key, missingLocales }) => {
			missingLocales.forEach(({ path: locale, isFileMissing }) => {
				if (isFileMissing) {
					missingFiles.add(locale)
				} else {
					if (!missingKeys.has(locale)) {
						missingKeys.set(locale, new Set())
					}
					missingKeys.get(locale)?.add(key)
				}
			})
		})

		// Show missing files first
		if (missingFiles.size > 0) {
			bufferLog("\nMissing translation files:")
			Array.from(missingFiles)
				.sort()
				.forEach((file) => {
					bufferLog(`  - ${file}`)
				})
		}

		// Then show files with missing keys
		if (missingKeys.size > 0) {
			bufferLog("\nFiles with missing keys:")

			// Group by file path to collect all keys per file
			const fileKeys = new Map<string, Map<string, Set<string>>>()
			results.forEach(({ key, file, missingLocales }) => {
				missingLocales.forEach(({ path: locale, isFileMissing }) => {
					if (!isFileMissing) {
						const [_localeDir, _localeFile] = locale.split("/")
						const filePath = locale
						if (!fileKeys.has(filePath)) {
							fileKeys.set(filePath, new Map())
						}
						if (!fileKeys.get(filePath)?.has(file)) {
							fileKeys.get(filePath)?.set(file, new Set())
						}
						fileKeys.get(filePath)?.get(file)?.add(key)
					}
				})
			})

			// Show missing keys grouped by file
			Array.from(fileKeys.entries())
				.sort()
				.forEach(([file, sourceFiles]) => {
					bufferLog(`  - ${file}:`)
					Array.from(sourceFiles.entries())
						.sort()
						.forEach(([_sourceFile, keys]) => {
							Array.from(keys)
								.sort()
								.forEach((key) => {
									bufferLog(`      ${key}`)
								})
						})
				})
		}

		// Add simple command line example
		if (missingKeys.size > 0) {
			bufferLog("\nTo add missing translations:")
			bufferLog(
				"   node scripts/manage-translations.js <locale_file> 'key' 'translation' [ 'key2' 'translation2' ... ]",
			)
		}
	}

	return { output: printLogs() }
}

describe("Find Missing i18n Keys", () => {
	test("findMissingI18nKeys scans for missing translations", () => {
		const result = findMissingI18nKeys()
		expect(result.output).toContain("✅ All i18n keys are present!")
	})
})
