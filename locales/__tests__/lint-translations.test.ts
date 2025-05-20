const fs = require("fs")
const path = require("path")
import {
	languages as originalLanguages,
	type Language,
	bufferLog,
	printLogs,
	clearLogs,
	fileExists,
	loadFileContent,
	parseJsonContent,
	getValueAtPath,
	escapeDotsForDisplay,
} from "./utils"

// Create a mutable copy of the languages array that can be overridden
let languages = [...originalLanguages]

// Track unique errors to avoid duplication
const seenErrors = new Set<string>()

interface PathMapping {
	name: string
	area: "docs" | "core" | "webview" | "package-nls"
	source: string | string[]
	targetTemplate: string
	useFilenameAsNamespace?: boolean // New property
}

interface LintOptions {
	locale?: string[]
	file?: string[]
	area?: string[]
	check?: ("missing" | "extra" | "all")[]
	help?: boolean
	verbose?: boolean
	allowUnknownLocales?: boolean
}

interface TranslationIssue {
	key: string[] // Changed from string to string[]
	sourceValue?: any
	localeValue?: any
}

interface FileResult {
	missing: TranslationIssue[]
	extra: TranslationIssue[]
	error?: string
}

interface Results {
	[area: string]: {
		[locale: string]: {
			[file: string]: FileResult
		}
	}
}

const PATH_MAPPINGS: PathMapping[] = [
	{
		name: "Documentation",
		area: "docs",
		source: ["CODE_OF_CONDUCT.md", "CONTRIBUTING.md", "README.md", "PRIVACY.md"],
		targetTemplate: "locales/<lang>/",
		// useFilenameAsNamespace defaults to false or undefined
	},
	{
		name: "Core UI Components",
		area: "core",
		source: "src/i18n/locales/en",
		targetTemplate: "src/i18n/locales/<lang>/",
		useFilenameAsNamespace: true,
	},
	{
		name: "Webview UI Components",
		area: "webview",
		source: "webview-ui/src/i18n/locales/en",
		targetTemplate: "webview-ui/src/i18n/locales/<lang>/",
		useFilenameAsNamespace: true,
	},
	{
		name: "Package NLS",
		area: "package-nls",
		source: "package.nls.json",
		targetTemplate: "package.nls.<lang>.json",
		// useFilenameAsNamespace defaults to false or undefined
	},
]

function enumerateSourceFiles(source: string | string[]): string[] {
	if (Array.isArray(source)) {
		return source.map((file) => (file.startsWith("/") ? file.slice(1) : file))
	}

	const files: string[] = []
	const sourcePath = path.join("./", source)

	if (!fs.existsSync(sourcePath)) {
		bufferLog(`Source path does not exist: ${sourcePath}`)
		return files
	}

	const stats = fs.statSync(sourcePath)
	if (stats.isFile()) {
		files.push(source)
	} else {
		const entries = fs.readdirSync(sourcePath, { withFileTypes: true })
		for (const entry of entries) {
			if (entry.isFile()) {
				files.push(path.join(source, entry.name))
			}
		}
	}

	return files
}

function resolveTargetPath(sourceFile: string, targetTemplate: string, locale: string): string {
	const targetPath = targetTemplate.replace("<lang>", locale)

	if (targetTemplate === "/") {
		return sourceFile.replace(".json", `.${locale}.json`)
	}

	if (!targetTemplate.endsWith("/")) {
		return targetPath
	}

	const fileName = path.basename(sourceFile)
	return path.join(targetPath, fileName)
}

// Helper function to recursively compare objects and identify differences
function compareObjects(
	sourceObj: any,
	targetObj: any,
	currentPath: string[] = [],
): { missing: TranslationIssue[]; extra: TranslationIssue[] } {
	const missing: TranslationIssue[] = []
	const extra: TranslationIssue[] = []

	// Check for missing keys (present in source, not in target)
	for (const key in sourceObj) {
		if (Object.prototype.hasOwnProperty.call(sourceObj, key)) {
			const newPath = [...currentPath, key]
			if (!Object.prototype.hasOwnProperty.call(targetObj, key)) {
				missing.push({ key: newPath, sourceValue: sourceObj[key] })
			} else if (
				typeof sourceObj[key] === "object" &&
				sourceObj[key] !== null &&
				typeof targetObj[key] === "object" &&
				targetObj[key] !== null
			) {
				const nestedResult = compareObjects(sourceObj[key], targetObj[key], newPath)
				missing.push(...nestedResult.missing)
				extra.push(...nestedResult.extra)
			}
		}
	}

	// Check for extra keys (present in target, not in source)
	for (const key in targetObj) {
		if (Object.prototype.hasOwnProperty.call(targetObj, key)) {
			const newPath = [...currentPath, key]
			if (!Object.prototype.hasOwnProperty.call(sourceObj, key)) {
				// Filter out object values from being reported as extra
				if (typeof targetObj[key] !== "object" || targetObj[key] === null) {
					extra.push({ key: newPath, localeValue: targetObj[key] })
				}
			}
		}
	}
	return { missing, extra }
}

function checkMissingTranslations(sourceContent: any, targetContent: any): TranslationIssue[] {
	if (
		typeof sourceContent !== "object" ||
		sourceContent === null ||
		typeof targetContent !== "object" ||
		targetContent === null
	) {
		return []
	}
	return compareObjects(sourceContent, targetContent).missing
}

function checkExtraTranslations(sourceContent: any, targetContent: any): TranslationIssue[] {
	if (
		typeof sourceContent !== "object" ||
		sourceContent === null ||
		typeof targetContent !== "object" ||
		targetContent === null
	) {
		return []
	}
	return compareObjects(sourceContent, targetContent).extra
}

function getFilteredLocales(localeArgs?: string[]): Language[] {
	const baseLocales = languages.filter((locale) => locale !== "en")

	if (!localeArgs || localeArgs.includes("all")) {
		return baseLocales
	}

	return localeArgs as unknown as Language[]
}

function filterMappingsByArea(mappings: PathMapping[], areaArgs?: string[]): PathMapping[] {
	if (!areaArgs || areaArgs.includes("all")) {
		return mappings
	}

	return mappings.filter((mapping) => areaArgs.includes(mapping.area))
}

function filterSourceFiles(sourceFiles: string[], fileArgs?: string[]): string[] {
	if (!fileArgs || fileArgs.includes("all")) {
		return sourceFiles
	}

	return sourceFiles.filter((file) => {
		const basename = path.basename(file)
		return fileArgs.includes(basename)
	})
}

function processFileLocale(
	sourceFile: string,
	sourceContent: any,
	mapping: PathMapping,
	locale: Language,
	checksToRun: string[],
	results: Results,
): void {
	const targetFile = resolveTargetPath(sourceFile, mapping.targetTemplate, locale)

	results[mapping.area] = results[mapping.area] || {}
	results[mapping.area][locale] = results[mapping.area][locale] || {}
	results[mapping.area][locale][targetFile] = {
		missing: [],
		extra: [],
	}

	// For missing files, the "key" is the filepath. This should be a single-element array.
	if (!fileExists(targetFile)) {
		results[mapping.area][locale][targetFile].missing = [
			{
				key: [sourceFile], // File path as a single element array
				sourceValue: undefined, // Or perhaps a specific marker like "File missing"
			},
		]
		return
	}

	if (!sourceFile.endsWith(".json")) {
		return
	}

	const targetContent = parseJsonContent(loadFileContent(targetFile), targetFile)
	if (!targetContent) {
		results[mapping.area][locale][targetFile].error = `Failed to load or parse target file: ${targetFile}`
		return
	}

	if (checksToRun.includes("missing") || checksToRun.includes("all")) {
		results[mapping.area][locale][targetFile].missing = checkMissingTranslations(sourceContent, targetContent)
	}

	if (checksToRun.includes("extra") || checksToRun.includes("all")) {
		results[mapping.area][locale][targetFile].extra = checkExtraTranslations(sourceContent, targetContent)
	}
}

function formatResults(results: Results, checkTypes: string[], options: LintOptions, mappings: PathMapping[]): boolean {
	let hasIssues = false

	clearLogs() // Clear buffer at start
	seenErrors.clear() // Clear error tracking
	bufferLog("=== Translation Results ===")

	// Group errors by type for summary
	const errorsByType = new Map<string, string[]>()

	for (const [area, areaResults] of Object.entries(results)) {
		let areaHasIssues = false
		const extraByLocale = new Map<string, Map<string, TranslationIssue[]>>()
		let missingCount = 0
		const missingByFile = new Map<string, Set<string>>()

		for (const [locale, localeResults] of Object.entries(areaResults)) {
			let localeMissingCount = 0
			let localeExtraCount = 0
			let localeErrorCount = 0

			for (const [file, fileResults] of Object.entries(localeResults)) {
				// Group errors by type
				if (fileResults.error) {
					localeErrorCount++
					const errorType = fileResults.error.split(":")[0]
					if (!errorsByType.has(errorType)) {
						errorsByType.set(errorType, [])
					}
					errorsByType.get(errorType)?.push(`${locale} - ${file}`)
					areaHasIssues = true
					continue
				}

				// Group missing translations by file and language
				if (checkTypes.includes("missing") && fileResults.missing.length > 0) {
					localeMissingCount += fileResults.missing.length
					missingCount += fileResults.missing.length
					const missingFileKey = `${file}:${locale}` // Keep this as string for map key
					if (!missingByFile.has(missingFileKey)) {
						missingByFile.set(missingFileKey, new Set())
					}
					// The 'key' in TranslationIssue is now string[]. For the Set, we need a string representation.
					// escapeDotsForDisplay is not ideal here as it's for final display.
					// Let's join with a unique char for internal set storage, or use the pathArray directly if the set supports it (it doesn't directly).
					// For simplicity in the Set, we'll join the pathArray with a known unique separator for storage in missingByFile.
					// This stringified key is only for the purpose of the Set uniqueness.
					fileResults.missing.forEach(({ key: pathArray }) => {
						missingByFile.get(missingFileKey)?.add(pathArray.join("\u0000")) // Store a stringified version
					})
					areaHasIssues = true
				}

				if (checkTypes.includes("extra") && fileResults.extra.length > 0) {
					localeExtraCount += fileResults.extra.length

					// Group extra translations by locale
					if (!extraByLocale.has(locale)) {
						extraByLocale.set(locale, new Map())
					}
					extraByLocale.get(locale)?.set(file, fileResults.extra)

					areaHasIssues = true
				}
			}

			hasIssues ||= localeErrorCount > 0 || localeMissingCount > 0 || localeExtraCount > 0
		}

		if (areaHasIssues) {
			bufferLog(`\n${area.toUpperCase()} Translations:`)

			// Show error summaries
			// Show error summaries by area
			errorsByType.forEach((files, errorType) => {
				const mapping = mappings.find((m) => m.area === area)
				if (!mapping) return

				// For array sources, check if the file matches any of the source paths
				const isSourceFile = (fileName: string) => {
					if (Array.isArray(mapping.source)) {
						return mapping.source.some((src) => fileName === (src.startsWith("/") ? src.slice(1) : src))
					}
					return fileName.startsWith(mapping.source)
				}

				const areaFiles = files.filter((file) => {
					const [, fileName] = file.split(" - ")
					return isSourceFile(fileName)
				})

				if (areaFiles.length > 0) {
					bufferLog(`  ❌ ${errorType}:`)
					bufferLog(`    Affected files: ${areaFiles.length}`)
					if (options?.verbose) {
						areaFiles.forEach((file) => {
							const [locale, fileName] = file.split(" - ")
							const targetPath = mapping.targetTemplate.replace("<lang>", locale)
							const fullPath = path.join(targetPath, fileName)
							bufferLog(`      ${locale} - ${fullPath}`)
						})
					}
				}
			})

			// Show missing translations summary
			if (missingCount > 0) {
				bufferLog(`  📝 Missing translations (${missingCount} total):`)
				const byFile = new Map<string, Map<string, Set<string>>>()

				missingByFile.forEach((keys, fileAndLang) => {
					const [file, lang] = fileAndLang.split(":")
					if (!byFile.has(file)) {
						byFile.set(file, new Map())
					}
					byFile.get(file)?.set(lang, keys)
				})

				// Group by locale first
				const missingFilesByLocale = new Map<string, string[]>()
				const missingKeysByLocale = new Map<string, Map<string, Set<string>>>()

				missingByFile.forEach((keys, fileAndLang) => {
					const [file, lang] = fileAndLang.split(":") // file is source file, lang is locale
					const mapping = mappings.find((m) => m.area === area)
					if (!mapping) return

					const targetPath = resolveTargetPath(file, mapping.targetTemplate, lang) // This is the actual target file path

					// Check if this is a missing file or missing keys
					// A missing file has a single key in its 'missing' array, which is the source file path.
					const fileMissingResult = results[area][lang][targetPath]
					const isCompletelyMissingFile =
						fileMissingResult &&
						fileMissingResult.missing.length === 1 &&
						fileMissingResult.missing[0].key.length === 1 && // pathArray has 1 element
						fileMissingResult.missing[0].key[0] === file // that element is the source file path

					if (isCompletelyMissingFile) {
						if (!missingFilesByLocale.has(lang)) {
							missingFilesByLocale.set(lang, [])
						}
						missingFilesByLocale.get(lang)?.push(targetPath)
					} else {
						// These are missing keys within an existing file
						if (!missingKeysByLocale.has(lang)) {
							missingKeysByLocale.set(lang, new Map())
						}
						if (!missingKeysByLocale.get(lang)?.has(targetPath)) {
							missingKeysByLocale.get(lang)?.set(targetPath, new Set())
						}
						// 'keys' here is a Set of stringified pathArrays (joined by \u0000)
						keys.forEach((stringifiedPathArray) => {
							// We don't need to check for path-like keys here anymore, as compareObjects handles structure.
							missingKeysByLocale.get(lang)?.get(targetPath)?.add(stringifiedPathArray)
						})
					}
				})

				// Report missing files
				missingFilesByLocale.forEach((files, lang) => {
					bufferLog(`    ${lang}: missing ${files.length} files`)
					files.sort().forEach((targetFilePath) => {
						// targetFilePath is the path of the missing translated file
						bufferLog(`      ${targetFilePath}`)

						// Determine the source file corresponding to this missing target file
						let sourceFilePath = targetFilePath
						const mapping = mappings.find((m) => {
							// This logic to find the original source file from target might need refinement
							// For now, assume a simple replacement based on common patterns
							if (targetFilePath.includes(`/${lang}/`)) {
								return targetFilePath.startsWith(m.targetTemplate.replace("<lang>", lang).split("/")[0])
							}
							return targetFilePath.startsWith(m.targetTemplate.replace("<lang>", lang).split(".")[0])
						})

						if (mapping) {
							if (Array.isArray(mapping.source)) {
								// If source is an array, we need to find which source file it corresponds to.
								// This case is tricky if multiple source files map to the same target dir.
								// For now, we'll assume a simple case or that this logic is primarily for single source files.
								// A more robust way would be to trace back from target to source via resolveTargetPath inverse.
								// For now, let's assume the first source file if it's a directory based mapping.
								const baseName = path.basename(targetFilePath)
								const matchedSource = mapping.source.find((s) => path.basename(s) === baseName)
								sourceFilePath = matchedSource || mapping.source[0] // Fallback, might not be accurate
							} else {
								sourceFilePath = mapping.source // e.g. "package.nls.json" or "src/i18n/locales/en"
								// If source is a directory, we need the specific file name from targetPath
								if (!sourceFilePath.endsWith(".json") && targetFilePath.endsWith(".json")) {
									sourceFilePath = path.join(sourceFilePath, path.basename(targetFilePath))
								} else if (mapping.area === "package-nls") {
									sourceFilePath = "package.nls.json"
								}
							}
						}

						if (sourceFilePath.endsWith(".json")) {
							const sourceContent = parseJsonContent(loadFileContent(sourceFilePath), sourceFilePath)
							if (sourceContent) {
								const issues = checkMissingTranslations(sourceContent, {}) // Compare with empty to get all keys
								if (issues.length > 0) {
									bufferLog(`        Missing keys: ALL KEYS (${issues.length} total)`)
									if (options?.verbose) {
										issues
											.sort((a, b) =>
												escapeDotsForDisplay(a.key).localeCompare(escapeDotsForDisplay(b.key)),
											)
											.forEach((issue) => {
												const displayNamespace = mapping?.useFilenameAsNamespace
													? path.basename(sourceFilePath, ".json")
													: mapping?.area || "unknown"
												bufferLog(
													`          - ${displayNamespace}:${escapeDotsForDisplay(issue.key)} - ${JSON.stringify(issue.sourceValue)} [en]`,
												)
											})
									}
								} else {
									bufferLog(`        Missing keys: No keys found in source file ${sourceFilePath}`)
								}
							} else {
								bufferLog(
									`        Missing keys: Unable to load corresponding source file ${sourceFilePath}`,
								)
							}
						} else {
							bufferLog(`        Missing file: ALL CONTENT (entire file)`)
						}
					})
				})

				// Report files with missing keys
				missingKeysByLocale.forEach((fileMap, lang) => {
					const filesWithMissingKeys = Array.from(fileMap.keys()) // These are targetFilePaths
					if (filesWithMissingKeys.length > 0) {
						bufferLog(`    ${lang}: ${filesWithMissingKeys.length} files with missing translations`)
						filesWithMissingKeys.sort().forEach((targetFilePath) => {
							bufferLog(`      ${targetFilePath}`)
							const stringifiedPathArrays = fileMap.get(targetFilePath) // Set of stringified pathArrays
							if (stringifiedPathArrays && stringifiedPathArrays.size > 0) {
								bufferLog(`        Missing keys (${stringifiedPathArrays.size} total):`)

								const missingIssuesInFile = results[area][lang][targetFilePath].missing
								const mapping = mappings.find((m) => m.area === area) // Get current mapping for namespace

								Array.from(stringifiedPathArrays)
									.map((spa) => spa.split("\u0000")) // Convert back to pathArray for sorting/finding
									.sort((a, b) => escapeDotsForDisplay(a).localeCompare(escapeDotsForDisplay(b)))
									.forEach((pathArrayKey) => {
										const issue = missingIssuesInFile.find(
											(iss) => iss.key.join("\u0000") === pathArrayKey.join("\u0000"),
										)
										const englishValue = issue ? issue.sourceValue : undefined
										let displayNamespace = mapping?.area || "unknown"
										if (mapping?.useFilenameAsNamespace) {
											// Determine source file from targetFilePath to get the namespace
											let sourceFileForNamespace = targetFilePath
											if (targetFilePath.includes(`/${lang}/`)) {
												sourceFileForNamespace = targetFilePath.replace(`/${lang}/`, "/en/")
											} else if (targetFilePath.endsWith(`.${lang}.json`)) {
												sourceFileForNamespace = targetFilePath.replace(
													`.${lang}.json`,
													".json",
												)
											}
											displayNamespace = path.basename(sourceFileForNamespace, ".json")
										}

										bufferLog(
											`          - ${displayNamespace}:${escapeDotsForDisplay(pathArrayKey)} - ${JSON.stringify(englishValue)} [en]`,
										)
									})
							}
						})
					}
				})
			}

			// Show extra translations if any
			if (extraByLocale.size > 0) {
				bufferLog(`  ⚠️ Extra translations:`)
				let isFirstLocale = true
				for (const [locale, fileMap] of extraByLocale) {
					// fileMap keys are sourceFile names
					if (!isFirstLocale) {
						bufferLog("")
					}
					isFirstLocale = false
					let isFirstFile = true
					for (const [sourceFileName, extras] of fileMap) {
						// extras is TranslationIssue[]
						if (!isFirstFile) {
							bufferLog("")
						}
						isFirstFile = false
						const mapping = mappings.find((m) => m.area === area)
						if (!mapping) continue

						// Determine the target file path for display
						const targetFilePathDisplay = resolveTargetPath(sourceFileName, mapping.targetTemplate, locale)
						let displayNamespace = mapping.area
						if (mapping.useFilenameAsNamespace) {
							displayNamespace = path.basename(sourceFileName, ".json")
						}

						bufferLog(`    ${locale}: ${targetFilePathDisplay}: ${extras.length} extra translations`)
						extras
							.sort((a, b) => escapeDotsForDisplay(a.key).localeCompare(escapeDotsForDisplay(b.key)))
							.forEach(({ key: pathArray, localeValue }) => {
								bufferLog(
									`        ${displayNamespace}:${escapeDotsForDisplay(pathArray)}: "${localeValue}"`,
								)
							})
					}
				}
			}

			if (!areaHasIssues) {
				bufferLog(`  ✅ No issues found`)
			}
		}
	}

	return hasIssues
}

function formatSummary(results: Results): void {
	bufferLog("\n======= SUMMARY =======")
	let totalMissing = 0
	let totalExtra = 0
	let totalErrors = 0

	for (const [area, areaResults] of Object.entries(results)) {
		let areaMissing = 0
		let areaExtra = 0
		let areaErrors = 0

		for (const [_locale, localeResults] of Object.entries(areaResults)) {
			for (const [_file, fileResults] of Object.entries(localeResults)) {
				if (fileResults.error) {
					areaErrors++
					totalErrors++
				} else {
					areaMissing += fileResults.missing.length
					areaExtra += fileResults.extra.length
				}
			}
		}

		totalMissing += areaMissing
		totalExtra += areaExtra

		bufferLog(`${area.toUpperCase()}: ${areaMissing} missing, ${areaExtra} extra, ${areaErrors} errors`)
	}

	bufferLog(`\nTOTAL: ${totalMissing} missing, ${totalExtra} extra, ${totalErrors} errors`)

	if (totalMissing === 0 && totalExtra === 0 && totalErrors === 0) {
		bufferLog("\n✅ All translations are complete!")
	} else {
		bufferLog("\n⚠️ Some translation issues were found.")

		if (totalMissing > 0) {
			bufferLog("\nFor missing translations:")
			bufferLog("1. For .md files:")
			bufferLog("   Create the missing translation files in the appropriate locale directory")
			bufferLog("   from the English sources in the root of the repository.")
			bufferLog("   Use <new_task> for each file to maintain clear translation context.")
			bufferLog("\n2. For .json files:")
			bufferLog("   Add missing translations using manage-translations.js.")
			bufferLog("\n   Key Path Format:")
			bufferLog("   - Use single dots (.) for nested paths: command.newTask.title")
			bufferLog("   - Use double dots (..) for literal dots: settings..path.name")
			bufferLog("\n   Example adding translations:")
			bufferLog("   # Using here document  for volume changes to one file:")
			bufferLog("   node scripts/manage-translations.js [-v] --stdin relative/path/to/settings.json << EOF")
			bufferLog('   {"command.newTask.title": "Create New Task"}')
			bufferLog('   {"settings..path.name": "Custom Path Setting"}')
			bufferLog("   EOF")
			bufferLog("\n   # Or single key-value pairs:")
			bufferLog(
				'   node scripts/manage-translations.js [-v] relative/path/to/settings.json "command.newTask.title" "Create New Task" [key2 value2 ...]',
			)
		}

		if (totalExtra > 0) {
			bufferLog("\nFor extra translations:")
			bufferLog("Remove translations not present in English (source of truth):")
			bufferLog("\n# Using here document for volume changes:")
			bufferLog(
				"node scripts/manage-translations.js [-v] -d --stdin relative/path/to/settings.json [file2.json ...] << EOF",
			)
			bufferLog('["command.oldTask.title"]')
			bufferLog('["settings..old.path"]')
			bufferLog("EOF")
			bufferLog("\n# Or multiple files with specific keys:")
			bufferLog(
				'node scripts/manage-translations.js [-v] -d file1.json file2.json -- "command.oldTask.title" "settings..old.path"',
			)
		}

		bufferLog("\nNotes:")
		bufferLog("- Always translate from the original English source documents")
		bufferLog("- Use -v flag for verbose output showing each operation")
		bufferLog("- Run manage-translations.js without arguments for full usage details")
	}
}

function printUsage(): void {
	bufferLog("Usage: node lint-translations.js [options]")
	bufferLog("\nDescription:")
	bufferLog("  Lint translation files to find missing or extra translations across different locales.")
	bufferLog("\nOptions:")
	bufferLog("  --help                 Show this help message")
	bufferLog("  --verbose              Enable verbose output with detailed information")
	bufferLog("  --locale=<locales>     Filter by specific locales (comma-separated)")
	bufferLog("                         Example: --locale=fr,de,ja")
	bufferLog("                         Use 'all' for all supported locales")
	bufferLog("  --file=<files>         Filter by specific files (comma-separated)")
	bufferLog("                         Example: --file=settings.json,commands.json")
	bufferLog("                         Use 'all' for all files")
	bufferLog("  --area=<areas>         Filter by specific areas (comma-separated)")
	bufferLog(`                         Valid areas: ${PATH_MAPPINGS.map((m) => m.area).join(", ")}, all`)
	bufferLog("                         Example: --area=docs,core")
	bufferLog("  --check=<checks>       Specify which checks to run (comma-separated)")
	bufferLog("                         Valid checks: missing, extra, all")
	bufferLog("                         Example: --check=missing,extra")
	bufferLog("\nExamples:")
	bufferLog("  # Check all translations in all areas")
	bufferLog("  node lint-translations.js")
	bufferLog("\n  # Check only missing translations for French locale")
	bufferLog("  node lint-translations.js --locale=fr --check=missing")
	bufferLog("\n  # Check only documentation translations for German and Japanese")
	bufferLog("  node lint-translations.js --area=docs --locale=de,ja")
	bufferLog("\n  # Verbose output for specific files in core area")
	bufferLog("  node lint-translations.js --area=core --file=settings.json,commands.json --verbose")
}

function parseArgs(args: string[] = process.argv.slice(2)): LintOptions {
	const options: LintOptions = {
		area: ["all"],
		check: ["all"] as ("missing" | "extra" | "all")[],
		verbose: false,
		help: false,
	}

	// Reset languages to original value at the start
	languages = [...originalLanguages]

	for (const arg of args) {
		if (arg === "--verbose") {
			options.verbose = true
			continue
		}
		if (arg === "--help") {
			options.help = true
			continue
		}

		const match = arg.match(/^--([^=]+)=(.+)$/)
		if (!match) continue

		const [, key, value] = match
		const values = value.split(",")

		switch (key) {
			case "locale":
				options.locale = values
				// Override the global languages array with the provided locales
				// Add 'en' as it's always needed as the source language
				languages = ["en", ...values] as unknown as Language[]
				break
			case "file":
				options.file = values
				break
			case "area": {
				const validAreas = [...PATH_MAPPINGS.map((m) => m.area), "all"]
				for (const area of values) {
					if (!validAreas.includes(area)) {
						throw new Error(`Error: Invalid area '${area}'. Must be one of: ${validAreas.join(", ")}`)
					}
				}
				options.area = values
				break
			}
			case "check": {
				const validChecks = ["missing", "extra", "all"]
				for (const check of values) {
					if (!validChecks.includes(check)) {
						bufferLog(`Error: Invalid check '${check}'. Must be one of: ${validChecks.join(", ")}`)
						process.exit(1)
					}
				}
				options.check = values as ("missing" | "extra" | "all")[]
				break
			}
		}
	}

	return options
}

function lintTranslations(args?: LintOptions): { output: string } {
	clearLogs() // Clear the buffer at the start
	const options = args || parseArgs() || { area: ["all"], check: ["all"] }

	// If help flag is set, print usage and return
	if (options.help) {
		printUsage()
		return { output: printLogs() }
	}

	const checksToRun = options.check?.includes("all") ? ["missing", "extra"] : options.check || ["all"]

	const filteredMappings = filterMappingsByArea(PATH_MAPPINGS, options.area)
	const results: Results = {}

	for (const mapping of filteredMappings) {
		let sourceFiles = enumerateSourceFiles(mapping.source)
		sourceFiles = filterSourceFiles(sourceFiles, options.file)

		if (sourceFiles.length === 0) {
			bufferLog(`No matching files found for area ${mapping.name}`)
			continue
		}

		const locales = getFilteredLocales(options.locale)

		if (locales.length === 0) {
			bufferLog(`No matching locales found for area ${mapping.name}`)
			continue
		}

		for (const sourceFile of sourceFiles) {
			let sourceContent: any = null
			if (sourceFile.endsWith(".json")) {
				const content = loadFileContent(sourceFile)
				if (!content) continue
				sourceContent = parseJsonContent(content, sourceFile)
				if (!sourceContent) continue
			} else {
				sourceContent = loadFileContent(sourceFile)
				if (!sourceContent) continue
			}

			for (const locale of locales) {
				processFileLocale(sourceFile, sourceContent, mapping, locale, checksToRun, results)
			}
		}
	}

	const hasIssues = formatResults(results, checksToRun, options, filteredMappings)
	formatSummary(results)
	if (!hasIssues) {
		bufferLog("\nAll translations are complete")
	}
	const output = printLogs()

	return { output }
}

// Export functions for use in other modules
export {
	enumerateSourceFiles,
	resolveTargetPath,
	loadFileContent,
	parseJsonContent,
	fileExists,
	PATH_MAPPINGS,
	getValueAtPath,
	checkMissingTranslations,
	checkExtraTranslations,
	getFilteredLocales,
	filterMappingsByArea,
	filterSourceFiles,
	lintTranslations,
}

describe("Translation Linting", () => {
	test("Run translation linting", () => {
		// Use the centralized parseArgs function to process Jest arguments
		// Jest passes arguments after -- to the test
		const options = parseArgs(process.argv)

		// If help flag is set, run with help option
		if (options.help) {
			const result = lintTranslations(options)
			console.log(result.output) // Print help directly to console for visibility
			expect(result.output).toContain("Usage: node lint-translations.js [options]")
			return
		}

		// Run with processed options
		const result = lintTranslations(options)

		// MUST FAIL in ANY event where the output does not contain "All translations are complete"
		// This will cause the test to fail for locales with missing or extra translations
		expect(result.output).toContain("All translations are complete")
	})

	test("Filters mappings by area correctly", () => {
		const filteredMappings = filterMappingsByArea(PATH_MAPPINGS, ["docs"])
		expect(filteredMappings).toHaveLength(1)
		expect(filteredMappings[0].area).toBe("docs")
	})

	test("Displays help information when help flag is set", () => {
		const result = lintTranslations({
			help: true,
			area: ["all"],
			check: ["all"],
		})

		// Verify help content
		expect(result.output).toContain("Usage: node lint-translations.js [options]")
		expect(result.output).toContain("Description:")
		expect(result.output).toContain("Options:")
		expect(result.output).toContain("Examples:")

		// Verify it doesn't run the linting process
		expect(result.output).not.toContain("Translation Results")
	})

	test("Checks for missing translations", () => {
		const source = { key1: "value1", key2: "value2" }
		const target = { key1: "value1" }
		const issues = checkMissingTranslations(source, target)
		expect(issues).toHaveLength(1)
		expect(issues[0].key).toEqual(["key2"])
	})

	test("Checks for extra translations", () => {
		const source = { key1: "value1" }
		const target = { key1: "value1", extraKey: "extra" }
		const issues = checkExtraTranslations(source, target)
		expect(issues).toHaveLength(1)
		expect(issues[0].key).toEqual(["extraKey"])
	})
})
