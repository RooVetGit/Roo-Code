const fs = require("fs")
const path = require("path")
import { languages as schemaLanguages } from "../../src/schemas/index"

let logBuffer: string[] = []
const bufferLog = (msg: string) => logBuffer.push(msg)
const printLogs = () => {
	const output = logBuffer.join("\n")
	logBuffer = []
	return output
}

const languages = schemaLanguages
type Language = (typeof languages)[number]

interface PathMapping {
	name: string
	area: "docs" | "core" | "webview" | "package-nls"
	source: string | string[]
	targetTemplate: string
}

interface LintOptions {
	locale?: string[]
	file?: string[]
	area?: string[]
	check?: ("missing" | "extra" | "all")[]
	help?: boolean
	verbose?: boolean
}

interface TranslationIssue {
	key: string
	englishValue?: any
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
	},
	{
		name: "Core UI Components",
		area: "core",
		source: "src/i18n/locales/en",
		targetTemplate: "src/i18n/locales/<lang>/",
	},
	{
		name: "Webview UI Components",
		area: "webview",
		source: "webview-ui/src/i18n/locales/en",
		targetTemplate: "webview-ui/src/i18n/locales/<lang>/",
	},
	{
		name: "Package NLS",
		area: "package-nls",
		source: "package.nls.json",
		targetTemplate: "package.nls.<lang>.json",
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

function loadFileContent(filePath: string): string | null {
	try {
		const fullPath = path.join("./", filePath)
		return fs.readFileSync(fullPath, "utf8")
	} catch (error) {
		return null
	}
}

// Track unique errors to avoid duplication
const seenErrors = new Set<string>()

function parseJsonContent(content: string | null, filePath: string): any | null {
	if (!content) return null

	try {
		return JSON.parse(content)
	} catch (error) {
		// Only log first occurrence of each unique error
		const errorKey = `${filePath}:${(error as Error).message}`
		if (!seenErrors.has(errorKey)) {
			seenErrors.add(errorKey)
			bufferLog(`Error parsing ${path.basename(filePath)}: ${(error as Error).message}`)
		}
		return null
	}
}

function fileExists(filePath: string): boolean {
	return fs.existsSync(path.join("./", filePath))
}

function findKeys(obj: any, parentKey: string = ""): string[] {
	let keys: string[] = []

	for (const [key, value] of Object.entries(obj)) {
		const currentKey = parentKey ? `${parentKey}.${key}` : key

		if (typeof value === "object" && value !== null) {
			keys = [...keys, ...findKeys(value, currentKey)]
		} else {
			keys.push(currentKey)
		}
	}

	return keys
}

function getValueAtPath(obj: any, path: string): any {
	if (obj && typeof obj === "object" && Object.prototype.hasOwnProperty.call(obj, path)) {
		return obj[path]
	}

	const parts = path.split(".")
	let current = obj

	for (const part of parts) {
		if (current === undefined || current === null) {
			return undefined
		}
		current = current[part]
	}

	return current
}

function checkMissingTranslations(sourceContent: any, targetContent: any): TranslationIssue[] {
	if (!sourceContent || !targetContent) return []

	const sourceKeys = findKeys(sourceContent)
	const missingKeys: TranslationIssue[] = []

	for (const key of sourceKeys) {
		const sourceValue = getValueAtPath(sourceContent, key)
		const targetValue = getValueAtPath(targetContent, key)

		if (targetValue === undefined) {
			missingKeys.push({
				key,
				englishValue: sourceValue,
			})
		}
	}

	return missingKeys
}

function checkExtraTranslations(sourceContent: any, targetContent: any): TranslationIssue[] {
	if (!sourceContent || !targetContent) return []

	const sourceKeys = new Set(findKeys(sourceContent))
	const targetKeys = findKeys(targetContent)
	const extraKeys: TranslationIssue[] = []

	for (const key of targetKeys) {
		if (!sourceKeys.has(key)) {
			extraKeys.push({
				key,
				localeValue: getValueAtPath(targetContent, key),
			})
		}
	}

	return extraKeys
}

function getFilteredLocales(localeArgs?: string[]): Language[] {
	const baseLocales = languages.filter((locale) => locale !== "en")

	if (!localeArgs || localeArgs.includes("all")) {
		return baseLocales
	}

	const invalidLocales = localeArgs.filter((locale) => !languages.includes(locale as Language))
	if (invalidLocales.length > 0) {
		throw new Error(`Error: The following locales are not officially supported: ${invalidLocales.join(", ")}`)
	}

	return baseLocales.filter((locale) => localeArgs.includes(locale))
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

	if (!fileExists(targetFile)) {
		results[mapping.area][locale][targetFile].missing = [
			{
				key: sourceFile,
				englishValue: "File missing",
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

	logBuffer = [] // Clear buffer at start
	seenErrors.clear() // Clear error tracking
	bufferLog("=== Translation Results ===")

	// Group errors by type for summary
	const errorsByType = new Map<string, string[]>()
	const missingByFile = new Map<string, Set<string>>()

	for (const [area, areaResults] of Object.entries(results)) {
		let areaHasIssues = false
		const extraByLocale = new Map<string, Map<string, TranslationIssue[]>>()
		let missingCount = 0

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
					const key = `${file}:${locale}`
					if (!missingByFile.has(key)) {
						missingByFile.set(key, new Set())
					}
					fileResults.missing.forEach(({ key }) => missingByFile.get(`${file}:${locale}`)?.add(key))
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
				const byLocale = new Map<string, string[]>()
				missingByFile.forEach((keys, fileAndLang) => {
					const [file, lang] = fileAndLang.split(":")
					if (!byLocale.has(lang)) {
						byLocale.set(lang, [])
					}
					const mapping = mappings.find((m) => m.area === area)
					if (mapping) {
						const targetPath = resolveTargetPath(file, mapping.targetTemplate, lang)
						byLocale.get(lang)?.push(targetPath)
					}
				})

				byLocale.forEach((files, lang) => {
					bufferLog(`    ${lang}: missing ${files.length} files`)
					files.sort().forEach((file) => {
						bufferLog(`      ${file}`)
					})
				})
			}

			// Show extra translations if any
			if (extraByLocale.size > 0) {
				bufferLog(`  ⚠️ Extra translations:`)
				let isFirstLocale = true
				for (const [locale, fileMap] of extraByLocale) {
					if (!isFirstLocale) {
						bufferLog("") // Add blank line between locales
					}
					isFirstLocale = false
					let isFirstFile = true
					for (const [file, extras] of fileMap) {
						if (!isFirstFile) {
							bufferLog("") // Add blank line between files
						}
						isFirstFile = false
						const mapping = mappings.find((m) => m.area === area)
						if (!mapping) continue
						const targetPath = resolveTargetPath(file, mapping.targetTemplate, locale)
						bufferLog(`    ${locale}: ${targetPath}: ${extras.length} extra translations`)
						for (const { key, localeValue } of extras) {
							bufferLog(`        ${key}: "${localeValue}"`)
						}
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
			bufferLog("- For .md files: ")
			bufferLog(
				"    Create the missing translation files in the appropriate locale directory from the English sources in the root of the repository",
			)
			bufferLog(
				"    Use <new_task> for each single file translation to keep translation context absolutely clear",
			)
			bufferLog(
				"- For .json files: Add the missing translations that exist in English but are missing in other locales",
			)
			bufferLog("  Example adding translations (one JSONL/NDJSON record per line):")
			bufferLog("    node scripts/manage-translations.js --stdin relative/path/to/settings.json << EOF")
			bufferLog('    {"some.new.key1.label": "First Value"}')
			bufferLog('    {"some.new.key2.label": "Second Value"}')
			bufferLog("    EOF")
		}

		if (totalExtra > 0) {
			bufferLog(
				"- Remove translations that exist in other locales but not in English (English is the source of truth)",
			)
			bufferLog("  Example removing translations:")
			bufferLog("    node scripts/manage-translations.js -d --stdin relative/path/to/settings.json << EOF")
			bufferLog('    ["the.extra.key1.label"]')
			bufferLog('    ["the.extra.key2.label"]')
			bufferLog("    EOF")
		}

		bufferLog("- Always translate from the original English source documents")
		bufferLog("- Fix the errors based on the instructions above reading this test script")
		bufferLog("- AI NOTICE: You MUST fix the language issues, do not modify the test script")
	}
}

function parseArgs(): LintOptions {
	const options: LintOptions = {
		area: ["all"],
		check: ["all"] as ("missing" | "extra" | "all")[],
		verbose: false,
		help: false,
	}

	for (const arg of process.argv.slice(2)) {
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
	logBuffer = [] // Clear the buffer at the start
	const options = args || parseArgs() || { area: ["all"], check: ["all"] }
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
module.exports = {
	enumerateSourceFiles,
	resolveTargetPath,
	loadFileContent,
	parseJsonContent,
	fileExists,
	PATH_MAPPINGS,
	findKeys,
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
		// Run with default options to check all areas and all checks
		const result = lintTranslations({
			area: ["all"],
			check: ["all"],
			verbose: process.argv.includes("--verbose"),
		})
		expect(result.output).toContain("All translations are complete")
	})

	test("Filters mappings by area correctly", () => {
		const filteredMappings = filterMappingsByArea(PATH_MAPPINGS, ["docs"])
		expect(filteredMappings).toHaveLength(1)
		expect(filteredMappings[0].area).toBe("docs")
	})

	test("Checks for missing translations", () => {
		const source = { key1: "value1", key2: "value2" }
		const target = { key1: "value1" }
		const issues = checkMissingTranslations(source, target)
		expect(issues).toHaveLength(1)
		expect(issues[0].key).toBe("key2")
	})

	test("Checks for extra translations", () => {
		const source = { key1: "value1" }
		const target = { key1: "value1", extraKey: "extra" }
		const issues = checkExtraTranslations(source, target)
		expect(issues).toHaveLength(1)
		expect(issues[0].key).toBe("extraKey")
	})
})
