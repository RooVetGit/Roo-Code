import * as fs from "fs"
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
	area: "docs" | "core" | "webview" | "package-nls" // Remains for grouping/filtering
	source: string | string[]
	targetTemplate: string
	useFilenameAsNamespace?: boolean // For areas like 'core', 'webview'
	displayNamespace?: string // Explicit namespace for display, e.g., "nls" for package-nls
	reportFileLevelOnly?: boolean // True for 'docs', false for JSON-based areas
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
	sizeWarning?: string // Added for file size issues
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
		reportFileLevelOnly: true, // Key change: Only report missing/extra files
		// useFilenameAsNamespace and displayNamespace are omitted (or false/undefined)
	},
	{
		name: "Core UI Components",
		area: "core", // Internal grouping
		source: "src/i18n/locales/en", // Directory
		targetTemplate: "src/i18n/locales/<lang>/",
		useFilenameAsNamespace: true, // e.g., "common", "tools"
		reportFileLevelOnly: false, // Key change: report keys
		// displayNamespace is omitted
	},
	{
		name: "Webview UI Components",
		area: "webview", // Internal grouping
		source: "webview-ui/src/i18n/locales/en", // Directory
		targetTemplate: "webview-ui/src/i18n/locales/<lang>/",
		useFilenameAsNamespace: true, // e.g., "chat", "settings"
		reportFileLevelOnly: false, // Key change: report keys
		// displayNamespace is omitted
	},
	{
		name: "Package NLS",
		area: "package-nls", // Internal grouping
		source: "package.nls.json", // File
		targetTemplate: "package.nls.<lang>.json",
		displayNamespace: "nls", // Key change: Explicit display namespace
		reportFileLevelOnly: false, // Key change: report keys
		// useFilenameAsNamespace is omitted (or false/undefined)
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

	// Missing Keys Loop (Iterate sourceObj keys)
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

	// Extra Keys Loop (Iterate targetObj keys)
	for (const key in targetObj) {
		if (Object.prototype.hasOwnProperty.call(targetObj, key)) {
			const newPath = [...currentPath, key]
			if (!Object.prototype.hasOwnProperty.call(sourceObj, key)) {
				// Crucially: If typeof targetObj[key] === "object" && targetObj[key] !== null
				// (i.e., the value of the extra key is an object), then do not add it to the extra list.
				if (!(typeof targetObj[key] === "object" && targetObj[key] !== null)) {
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
	const { missing } = compareObjects(sourceContent, targetContent)
	return missing
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
	const { extra } = compareObjects(sourceContent, targetContent)
	return extra
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

function checkIfFileMissing(targetFilePath: string): boolean {
	return !fileExists(targetFilePath)
}

function checkFileSizeDifference(sourceFilePath: string, targetFilePath: string): { warning?: string; error?: string } {
	try {
		const sourceStats = fs.statSync(sourceFilePath)
		const targetStats = fs.statSync(targetFilePath)
		const sourceSize = sourceStats.size
		const targetSize = targetStats.size

		if (targetSize > sourceSize * 2) {
			return {
				warning: `Target file ${targetFilePath} is more than 2x larger than source ${sourceFilePath}. It may require retranslation to be within +/- 20% of the source file size.`,
			}
		}
		return {} // No warning, no error from this function's core logic
	} catch (e: any) {
		return { error: `Error getting file stats for size comparison: ${e.message}` }
	}
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

	const reportFileLevelOnly = mapping.reportFileLevelOnly === true

	if (reportFileLevelOnly) {
		// Handle file-level checks (e.g., for "docs")
		if (checkIfFileMissing(targetFile)) {
			results[mapping.area][locale][targetFile].missing = [
				{
					key: [sourceFile], // Source filename as the key
					sourceValue: undefined,
				},
			]
			return // No further processing for this file
		}

		// Target file exists, perform size check
		const sizeCheckResult = checkFileSizeDifference(sourceFile, targetFile)
		if (sizeCheckResult.warning) {
			results[mapping.area][locale][targetFile].sizeWarning = sizeCheckResult.warning
		}
		if (sizeCheckResult.error) {
			results[mapping.area][locale][targetFile].error = sizeCheckResult.error
		}
		// Do NOT attempt to load/parse content as JSON or call key-based checks
		return
	} else {
		// Handle key-based checks (e.g., for JSON files)
		if (checkIfFileMissing(targetFile)) {
			results[mapping.area][locale][targetFile].missing = [
				{
					key: [sourceFile], // File path as a single element array
					sourceValue: undefined, // Or perhaps a specific marker like "File missing"
				},
			]
			return
		}

		// Ensure sourceContent is parsed if it's a JSON file (already handled before calling this function for JSONs)
		// The main check here is for targetContent and proceeding with key comparisons.
		if (!sourceFile.endsWith(".json")) {
			// This case should ideally not be hit if reportFileLevelOnly is false,
			// as non-JSONs would typically have reportFileLevelOnly = true.
			// However, keeping a safeguard.
			// If source is not JSON, but we are in this branch, it implies a configuration mismatch
			// or that sourceContent might be raw text content for a non-JSON file that somehow
			// needs key-based comparison (which is unlikely with current setup).
			// For now, if it's not JSON, we can't do key-based comparison.
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
}

interface ExtraFileIssue {
	extraFilePath: string
	key: string[] // Typically ["EXTRA_FILE_MARKER"]
	localeValue: string // The path of the extra file itself
}

function identifyExtraFiles(
	mapping: PathMapping,
	locale: Language,
	allSourceFileBasenamesForMapping: Set<string>, // A Set of basenames like {"common.json", "tools.json"} or {"README.md"}
): ExtraFileIssue[] {
	const targetDir = mapping.targetTemplate.replace("<lang>", locale)
	const foundExtraFiles: ExtraFileIssue[] = []

	if (!fs.existsSync(targetDir)) {
		return foundExtraFiles // No target directory, so no extra files to check
	}

	let actualTargetFilesDirents: fs.Dirent[]
	try {
		actualTargetFilesDirents = fs.readdirSync(targetDir, { withFileTypes: true })
	} catch (e: any) {
		// This case should be rare if existsSync passed, but good to handle
		bufferLog(`Error reading target directory ${targetDir} for locale ${locale}: ${e.message}`)
		return foundExtraFiles // Return empty or perhaps an issue indicating directory read error
	}

	for (const actualTargetFileDirent of actualTargetFilesDirents) {
		if (actualTargetFileDirent.isFile()) {
			const actualTargetFilename = actualTargetFileDirent.name
			let derivedSourceBasename: string

			// Derive Corresponding Source Basename
			if (mapping.targetTemplate.endsWith(".<lang>.json")) {
				derivedSourceBasename = actualTargetFilename.replace(`.${locale}.json`, ".json")
			} else if (mapping.targetTemplate.endsWith("/")) {
				derivedSourceBasename = actualTargetFilename
			} else {
				const langPattern = `.${locale}.`
				if (actualTargetFilename.includes(langPattern)) {
					derivedSourceBasename = actualTargetFilename.replace(langPattern, ".")
				} else {
					derivedSourceBasename = actualTargetFilename
				}
			}

			if (!allSourceFileBasenamesForMapping.has(derivedSourceBasename)) {
				const fullPathToActualTargetFile = path.join(targetDir, actualTargetFilename)
				foundExtraFiles.push({
					extraFilePath: fullPathToActualTargetFile,
					key: ["EXTRA_FILE_MARKER"], // Standardized marker
					localeValue: fullPathToActualTargetFile, // The path of the extra file itself
				})
			}
		}
	}
	return foundExtraFiles
}

function formatResults(results: Results, checkTypes: string[], options: LintOptions, mappings: PathMapping[]): boolean {
	let hasIssues = false

	clearLogs() // Clear buffer at start
	seenErrors.clear() // Clear error tracking
	bufferLog("=== Translation Results ===")

	// Group errors by type for summary (excluding size warnings initially)
	const errorsByType = new Map<string, string[]>()

	for (const [area, areaResults] of Object.entries(results)) {
		let areaHasIssues = false
		const extraByLocale = new Map<string, Map<string, { issues: TranslationIssue[]; sourceFile: string }>>()
		let missingCount = 0
		// missingByFile: key is targetFilePath:locale, value is { keys: Set<string>, sourceFile: string }
		// No, missingByFile is `sourceFile:locale` -> Set<stringified_keys>
		// We need to adjust how missingKeysByLocale and missingFilesByLocale are built or used.
		const missingByFile = new Map<string, Set<string>>() // Stores sourceFile:locale -> Set of stringified keys

		for (const [locale, localeResults] of Object.entries(areaResults)) {
			let localeMissingCount = 0
			let localeExtraCount = 0
			let localeErrorCount = 0

			for (const [targetFilePath, fileResult] of Object.entries(localeResults)) {
				// file is targetFilePath
				if (fileResult.error) {
					localeErrorCount++
					const errorType = fileResult.error.split(":")[0] // Basic error type
					if (!errorsByType.has(errorType)) errorsByType.set(errorType, [])
					errorsByType.get(errorType)?.push(`${locale} - ${targetFilePath} (Error: ${fileResult.error})`)
					areaHasIssues = true
				}

				if (fileResult.sizeWarning) {
					areaHasIssues = true // Ensure area is reported if there's a size warning
				}

				if (fileResult.error && !fileResult.sizeWarning) {
					continue
				}

				if (checkTypes.includes("missing") && fileResult.missing.length > 0) {
					localeMissingCount += fileResult.missing.length
					missingCount += fileResult.missing.length
					areaHasIssues = true

					// Populate missingByFile (sourceFile:locale -> keys)
					// This requires knowing the sourceFile for this targetFilePath.
					// This information should ideally be in fileResult if we modify it.
					// For now, we'll build missingFilesByLocale and missingKeysByLocale more directly later.
					const missingFileKey = `${targetFilePath}:${locale}` // Using targetFilePath for now, will refine
					if (!missingByFile.has(missingFileKey)) {
						missingByFile.set(missingFileKey, new Set())
					}
					fileResult.missing.forEach(({ key: pathArray }) => {
						missingByFile.get(missingFileKey)?.add(pathArray.join("\u0000"))
					})
				}

				if (checkTypes.includes("extra") && fileResult.extra.length > 0) {
					localeExtraCount += fileResult.extra.length
					areaHasIssues = true
					// Populate extraByLocale (locale -> targetFilePath -> {issues, sourceFile})
					// Requires sourceFile for targetFilePath.
					// Assuming fileResult.sourceFilePath exists (hypothetical change)
					// const sourceFileForExtra = (fileResult as any).sourceFilePath || "unknown_source_for_extra";
					// For now, we'll handle sourceFile derivation during display.
					if (!extraByLocale.has(locale)) {
						extraByLocale.set(locale, new Map())
					}
					// Storing raw extras for now, sourceFile to be derived in display loop
					extraByLocale
						.get(locale)
						?.set(targetFilePath, { issues: fileResult.extra, sourceFile: "DERIVE_LATER" })
				}
			}
			hasIssues ||= localeErrorCount > 0 || localeMissingCount > 0 || localeExtraCount > 0 || areaHasIssues
		}

		if (areaHasIssues) {
			bufferLog(`\n${area.toUpperCase()} Translations:`)
			const mappingForArea = mappings.find((m) => m.area === area)
			if (!mappingForArea) continue

			// Show error summaries (excluding size warnings)
			errorsByType.forEach((files, errorType) => {
				if (errorType === "SizeWarning") return // Skip size warnings here

				const areaFiles = files.filter((fileEntry) => {
					// fileEntry is "locale - targetFilePath (Error: message)"
					// Check if targetFilePath belongs to the current area's mapping
					const targetFileFromEntry = fileEntry.split(" - ")[1]?.split(" (Error:")[0]
					if (!targetFileFromEntry) return false

					// A simple check: does the targetFileFromEntry look like it came from this mapping?
					// This is hard without knowing the source file.
					// For now, assume if the error was logged under this area, it belongs.
					return true // Simplified, as errors are already grouped by area in `results`
				})

				if (areaFiles.length > 0) {
					bufferLog(`  ❌ ${errorType}:`)
					bufferLog(`    Affected files: ${areaFiles.length}`)
					if (options?.verbose) {
						areaFiles.forEach((file) => bufferLog(`      ${file}`))
					}
				}
			})
			errorsByType.clear() // Clear after processing for an area to avoid carry-over

			// Display Size Warnings for the area
			const sizeWarningMessages: string[] = []
			for (const [_locale, localeResults] of Object.entries(areaResults)) {
				for (const [targetFilePath, fileRes] of Object.entries(localeResults)) {
					if (fileRes.sizeWarning) {
						sizeWarningMessages.push(`  ⚠️ Size Warning for ${targetFilePath}: ${fileRes.sizeWarning}`)
					}
				}
			}
			if (sizeWarningMessages.length > 0) {
				sizeWarningMessages.sort().forEach((msg) => bufferLog(msg))
			}

			// Show missing translations summary
			if (missingCount > 0 && (checkTypes.includes("missing") || checkTypes.includes("all"))) {
				bufferLog(`  📝 Missing translations (${missingCount} total):`)

				const missingFilesByLocaleDisplay = new Map<string, string[]>() // lang -> [targetFilePath]
				const missingKeysByLocaleDisplay = new Map<
					string,
					Map<string, { keys: Set<string>; sourceFile: string }>
				>() // lang -> targetFilePath -> {keys, sourceFile}

				// Re-iterate results to correctly categorize and get sourceFile
				for (const [locale, localeResults] of Object.entries(areaResults)) {
					for (const [targetFilePath, fileRes] of Object.entries(localeResults)) {
						if (fileRes.missing && fileRes.missing.length > 0) {
							// Try to find the original source file for this targetFilePath
							// This is the challenging part without direct storage.
							// Attempt to find sourceFile based on how results are populated by processFileLocale
							let sourceFileAssociatedWithTarget = "unknown_source.file" // Default
							// Heuristic: iterate all source files for this mapping, resolve their target, and see if it matches.
							const currentMapping = mappings.find((m) => m.area === area)
							if (currentMapping) {
								const allSourcesForMapping = enumerateSourceFiles(currentMapping.source)
								for (const sf of allSourcesForMapping) {
									if (
										resolveTargetPath(sf, currentMapping.targetTemplate, locale) === targetFilePath
									) {
										sourceFileAssociatedWithTarget = sf
										break
									}
								}
								// If still unknown, and missing[0].key[0] looks like a source file (common for full file missing)
								if (
									sourceFileAssociatedWithTarget === "unknown_source.file" &&
									fileRes.missing[0]?.key?.length === 1
								) {
									// This key is often the source file path when the entire file is missing
									sourceFileAssociatedWithTarget = fileRes.missing[0].key[0]
								}
							}

							const isCompletelyMissingFile =
								fileRes.missing.length === 1 &&
								fileRes.missing[0].key.length === 1 &&
								fileRes.missing[0].key[0] === sourceFileAssociatedWithTarget // Check against derived/found source

							if (isCompletelyMissingFile) {
								if (!missingFilesByLocaleDisplay.has(locale))
									missingFilesByLocaleDisplay.set(locale, [])
								missingFilesByLocaleDisplay.get(locale)?.push(targetFilePath)
							} else {
								if (!missingKeysByLocaleDisplay.has(locale))
									missingKeysByLocaleDisplay.set(locale, new Map())
								if (!missingKeysByLocaleDisplay.get(locale)?.has(targetFilePath)) {
									missingKeysByLocaleDisplay.get(locale)?.set(targetFilePath, {
										keys: new Set(),
										sourceFile: sourceFileAssociatedWithTarget,
									})
								}
								fileRes.missing.forEach((issue) => {
									missingKeysByLocaleDisplay
										.get(locale)
										?.get(targetFilePath)
										?.keys.add(issue.key.join("\u0000"))
								})
							}
						}
					}
				}

				// Report missing files
				missingFilesByLocaleDisplay.forEach((files, lang) => {
					bufferLog(`    ${lang}: missing ${files.length} files`)
					files.sort().forEach((targetFilePath) => {
						bufferLog(`      ${targetFilePath}`)
						const mapping = mappingForArea // Use mappingForArea

						// Find the source file that this targetFilePath corresponds to
						let sourceFileForMissing = "unknown_source.file"
						const fileResultForMissing = results[area][lang][targetFilePath]
						if (
							fileResultForMissing &&
							fileResultForMissing.missing.length === 1 &&
							fileResultForMissing.missing[0].key.length === 1
						) {
							sourceFileForMissing = fileResultForMissing.missing[0].key[0]
						} else {
							// Fallback if not easily found (should be available for completely missing files)
							const allSourcesForMapping = enumerateSourceFiles(mapping.source)
							for (const sf of allSourcesForMapping) {
								if (resolveTargetPath(sf, mapping.targetTemplate, lang) === targetFilePath) {
									sourceFileForMissing = sf
									break
								}
							}
						}

						if (mapping.reportFileLevelOnly === true) {
							bufferLog(`        Missing file: ALL CONTENT (entire file)`)
						} else {
							// JSON files
							const sourceContent = parseJsonContent(
								loadFileContent(sourceFileForMissing),
								sourceFileForMissing,
							)
							if (sourceContent) {
								const issues = checkMissingTranslations(sourceContent, {}) // Get all keys
								bufferLog(`        Missing keys: ALL KEYS (${issues.length} total)`)
								if (options?.verbose && issues.length > 0) {
									let displayKeyPrefix = ""
									if (mapping.displayNamespace) {
										displayKeyPrefix = mapping.displayNamespace + ":"
									} else if (mapping.useFilenameAsNamespace) {
										displayKeyPrefix = path.basename(sourceFileForMissing, ".json") + ":"
									}
									issues
										.sort((a, b) =>
											escapeDotsForDisplay(a.key).localeCompare(escapeDotsForDisplay(b.key)),
										)
										.forEach((issue) => {
											bufferLog(
												`          - ${displayKeyPrefix}${escapeDotsForDisplay(issue.key)} - ${JSON.stringify(issue.sourceValue)} [en]`,
											)
										})
								}
							} else {
								bufferLog(
									`        Missing keys: Unable to load corresponding source file ${sourceFileForMissing}`,
								)
							}
						}
					})
				})

				// Report files with missing keys
				missingKeysByLocaleDisplay.forEach((fileMap, lang) => {
					const filesWithMissingKeys = Array.from(fileMap.keys())
					if (filesWithMissingKeys.length > 0) {
						bufferLog(`    ${lang}: ${filesWithMissingKeys.length} files with missing translations`)
						filesWithMissingKeys.sort().forEach((targetFilePath) => {
							bufferLog(`      ${targetFilePath}`)
							const fileData = fileMap.get(targetFilePath)
							if (fileData && fileData.keys.size > 0) {
								bufferLog(`        Missing keys (${fileData.keys.size} total):`)
								const mapping = mappingForArea
								const originalSourceFileName = fileData.sourceFile // Use stored sourceFile

								const missingIssuesInFile = results[area][lang][targetFilePath].missing
								Array.from(fileData.keys)
									.map((spa) => spa.split("\u0000")) // pathArrayKey
									.sort((a, b) => escapeDotsForDisplay(a).localeCompare(escapeDotsForDisplay(b)))
									.forEach((pathArrayKey) => {
										const issue = missingIssuesInFile.find(
											(iss) => iss.key.join("\u0000") === pathArrayKey.join("\u0000"),
										)
										const englishValue = issue ? issue.sourceValue : undefined

										let displayKeyPrefix = ""
										if (mapping.displayNamespace) {
											displayKeyPrefix = mapping.displayNamespace + ":"
										} else if (
											mapping.useFilenameAsNamespace &&
											originalSourceFileName !== "unknown_source.file"
										) {
											displayKeyPrefix = path.basename(originalSourceFileName, ".json") + ":"
										}

										if (mapping.reportFileLevelOnly === true) {
											// Should not be reached if logic is correct, keys are not reported for fileLevelOnly
											bufferLog(
												`          - ${escapeDotsForDisplay(pathArrayKey)} - ${JSON.stringify(englishValue)} [en]`,
											) // Fallback
										} else {
											bufferLog(
												`          - ${displayKeyPrefix}${escapeDotsForDisplay(pathArrayKey)} - ${JSON.stringify(englishValue)} [en]`,
											)
										}
									})
							}
						})
					}
				})
			}

			// Show extra translations if any
			if (extraByLocale.size > 0 && (checkTypes.includes("extra") || checkTypes.includes("all"))) {
				bufferLog(`  ⚠️ Extra translations:`)
				extraByLocale.forEach((fileMap, locale) => {
					// locale -> targetFilePath -> {issues, sourceFile (DERIVE_LATER)}
					fileMap.forEach(({ issues: extras, sourceFile: derivedSourceFile }, targetFilePath) => {
						const mapping = mappingForArea
						if (!mapping) return

						// Attempt to derive sourceFile if it's "DERIVE_LATER"
						let actualSourceFile = derivedSourceFile
						if (actualSourceFile === "DERIVE_LATER") {
							const allSourcesForMapping = enumerateSourceFiles(mapping.source)
							for (const sf of allSourcesForMapping) {
								if (resolveTargetPath(sf, mapping.targetTemplate, locale) === targetFilePath) {
									actualSourceFile = sf
									break
								}
							}
							if (actualSourceFile === "DERIVE_LATER") actualSourceFile = "unknown_source.file"
						}

						const extraFileMarkers = extras.filter(
							(ex) => ex.key.length === 1 && ex.key[0] === "EXTRA_FILE_MARKER",
						)
						const extraJsonKeys = extras.filter(
							(ex) => !(ex.key.length === 1 && ex.key[0] === "EXTRA_FILE_MARKER"),
						)

						extraFileMarkers.forEach((issue) => {
							const extraFilePathDisplay = issue.localeValue as string // Full path to extra file
							bufferLog(`    ${locale}: ${extraFilePathDisplay} (Extra File)`)
						})

						if (extraJsonKeys.length > 0) {
							let displayKeyPrefix = ""
							if (mapping.displayNamespace) {
								displayKeyPrefix = mapping.displayNamespace + ":"
							} else if (mapping.useFilenameAsNamespace && actualSourceFile !== "unknown_source.file") {
								displayKeyPrefix = path.basename(actualSourceFile, ".json") + ":"
							}

							bufferLog(`    ${locale}: ${targetFilePath}: ${extraJsonKeys.length} extra translations`)
							extraJsonKeys
								.sort((a, b) => escapeDotsForDisplay(a.key).localeCompare(escapeDotsForDisplay(b.key)))
								.forEach((issue) => {
									bufferLog(
										`        ${displayKeyPrefix}${escapeDotsForDisplay(issue.key)}: "${issue.localeValue}"`,
									)
								})
						}
					})
				})
			}

			// if (!areaHasIssues) { // This check might be misleading now with how hasIssues is set
			// bufferLog(`  ✅ No issues found`);
			// }
		}
	}
	// Final check for overall issues to determine return value
	let overallHasIssues = false
	for (const areaRes of Object.values(results)) {
		for (const localeRes of Object.values(areaRes)) {
			for (const fileRes of Object.values(localeRes)) {
				if (
					fileRes.error ||
					fileRes.sizeWarning ||
					(fileRes.missing && fileRes.missing.length > 0) ||
					(fileRes.extra && fileRes.extra.length > 0)
				) {
					overallHasIssues = true
					break
				}
			}
			if (overallHasIssues) break
		}
		if (overallHasIssues) break
	}
	return overallHasIssues
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
		let enumeratedSourceFilesFullPaths = enumerateSourceFiles(mapping.source)
		enumeratedSourceFilesFullPaths = filterSourceFiles(enumeratedSourceFilesFullPaths, options.file)

		if (enumeratedSourceFilesFullPaths.length === 0) {
			bufferLog(`No matching files found for area ${mapping.name} with current filters.`)
			continue
		}

		const allSourceFileBasenamesForMapping = new Set(enumeratedSourceFilesFullPaths.map((sf) => path.basename(sf)))

		const locales = getFilteredLocales(options.locale)

		if (locales.length === 0) {
			bufferLog(`No matching locales found for area ${mapping.name} with current filters.`)
			continue
		}

		// Process each source file against each locale
		for (const sourceFile of enumeratedSourceFilesFullPaths) {
			let sourceContent: any = null
			// Load and parse source content once per source file
			if (sourceFile.endsWith(".json")) {
				const content = loadFileContent(sourceFile)
				if (!content) {
					// Log error or handle missing source file appropriately
					// This might already be handled by enumerateSourceFiles or loadFileContent
					bufferLog(`Warning: Could not load source file: ${sourceFile}`)
					continue
				}
				sourceContent = parseJsonContent(content, sourceFile)
				if (!sourceContent) {
					bufferLog(`Warning: Could not parse source JSON file: ${sourceFile}`)
					continue
				}
			} else {
				// For non-JSON files (like .md), sourceContent is the raw text
				sourceContent = loadFileContent(sourceFile) // Assuming loadFileContent returns string or null
				if (sourceContent === null || sourceContent === undefined) {
					// Check for null or undefined explicitly
					bufferLog(`Warning: Could not load source file content: ${sourceFile}`)
					continue
				}
			}

			for (const locale of locales) {
				processFileLocale(sourceFile, sourceContent, mapping, locale, checksToRun, results)
			}
		}

		// After processing all source files for a mapping, check for extra files in target directories
		if (checksToRun.includes("extra") || checksToRun.includes("all")) {
			for (const locale of locales) {
				const extraFileIssues = identifyExtraFiles(mapping, locale, allSourceFileBasenamesForMapping)
				for (const issue of extraFileIssues) {
					results[mapping.area] = results[mapping.area] || {}
					results[mapping.area][locale] = results[mapping.area][locale] || {}
					results[mapping.area][locale][issue.extraFilePath] = results[mapping.area][locale][
						issue.extraFilePath
					] || {
						missing: [],
						extra: [],
						error: undefined,
						sizeWarning: undefined,
					}
					results[mapping.area][locale][issue.extraFilePath].extra.push({
						key: issue.key,
						localeValue: issue.localeValue,
					})
				}
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
