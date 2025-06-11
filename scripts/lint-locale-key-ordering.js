#!/usr/bin/env node

/**
 * Script to lint locale file key ordering consistency
 *
 * This script ensures that all locale files maintain the same key ordering
 * as their corresponding English locale files. This helps maintain consistency
 * across all committed translations.
 *
 * Usage:
 *   node scripts/lint-locale-key-ordering.js [options]
 *   tsx scripts/lint-locale-key-ordering.js [options]
 *
 * Options:
 *   --locale=<locale>   Only check a specific locale (e.g. --locale=fr)
 *   --file=<file>       Only check a specific file (e.g. --file=chat.json)
 *   --area=<area>       Only check a specific area (core, webview, or both)
 *   --help              Show this help message
 */

const fs = require("fs")
const path = require("path")

// Process command line arguments
const args = process.argv.slice(2).reduce(
	(acc, arg) => {
		if (arg === "--help") {
			acc.help = true
		} else if (arg.startsWith("--locale=")) {
			acc.locale = arg.split("=")[1]
		} else if (arg.startsWith("--file=")) {
			acc.file = arg.split("=")[1]
		} else if (arg.startsWith("--area=")) {
			acc.area = arg.split("=")[1]
			// Validate area value
			if (!["core", "webview", "both"].includes(acc.area)) {
				console.error(`Error: Invalid area '${acc.area}'. Must be 'core', 'webview', or 'both'.`)
				process.exit(1)
			}
		}
		return acc
	},
	{ area: "both" },
)

// Show help if requested
if (args.help) {
	console.log(`
Locale Key Ordering Linter

A utility script to ensure consistent key ordering across all locale files.
Compares the key ordering in non-English locale files to the English reference
to identify any ordering mismatches.

Usage:
  node scripts/lint-locale-key-ordering.js [options]
  tsx scripts/lint-locale-key-ordering.js [options]

Options:
  --locale=<locale>   Only check a specific locale (e.g. --locale=fr)
  --file=<file>       Only check a specific file (e.g. --file=chat.json)
  --area=<area>       Only check a specific area (core, webview, or both)
                      'core' = Backend (src/i18n/locales)
                      'webview' = Frontend UI (webview-ui/src/i18n/locales)
                      'both' = Check both areas (default)
  --help              Show this help message

Exit Codes:
  0 = All key ordering is consistent
  1 = Key ordering inconsistencies found
	`)
	process.exit(0)
}

// Paths to the locales directories
const LOCALES_DIRS = {
	core: path.join(__dirname, "../src/i18n/locales"),
	webview: path.join(__dirname, "../webview-ui/src/i18n/locales"),
}

// Determine which areas to check based on args
const areasToCheck = args.area === "both" ? ["core", "webview"] : [args.area]

/**
 * Extract keys from a JSON object in the order they appear
 * @param {Object} obj - The JSON object
 * @param {string} prefix - The current key prefix for nested objects
 * @returns {string[]} Array of dot-notation keys in order
 */
function extractKeysInOrder(obj, prefix = "") {
	const keys = []

	for (const [key, value] of Object.entries(obj)) {
		const fullKey = prefix ? `${prefix}.${key}` : key

		if (typeof value === "object" && value !== null && !Array.isArray(value)) {
			// For nested objects, add the parent key first, then recursively add child keys
			keys.push(fullKey)
			keys.push(...extractKeysInOrder(value, fullKey))
		} else {
			// For primitive values, just add the key
			keys.push(fullKey)
		}
	}

	return keys
}

/**
 * Compare two arrays of keys and find ordering differences
 * @param {string[]} englishKeys - Keys from English locale
 * @param {string[]} localeKeys - Keys from target locale
 * @returns {Object} Object containing ordering issues
 */
function compareKeyOrdering(englishKeys, localeKeys) {
	const issues = {
		missing: [],
		extra: [],
		outOfOrder: [],
	}

	// Find missing and extra keys
	const englishSet = new Set(englishKeys)
	const localeSet = new Set(localeKeys)

	issues.missing = englishKeys.filter((key) => !localeSet.has(key))
	issues.extra = localeKeys.filter((key) => !englishSet.has(key))

	// Check ordering for common keys
	const commonKeys = englishKeys.filter((key) => localeSet.has(key))
	const localeCommonKeys = localeKeys.filter((key) => englishSet.has(key))

	for (let i = 0; i < commonKeys.length; i++) {
		if (commonKeys[i] !== localeCommonKeys[i]) {
			issues.outOfOrder.push({
				expected: commonKeys[i],
				actual: localeCommonKeys[i],
				position: i,
			})
		}
	}

	return issues
}

/**
 * Check key ordering for a specific area
 * @param {string} area - Area to check ('core' or 'webview')
 * @returns {boolean} True if there are ordering issues
 */
function checkAreaKeyOrdering(area) {
	const LOCALES_DIR = LOCALES_DIRS[area]

	// Get all locale directories (excluding English)
	const allLocales = fs.readdirSync(LOCALES_DIR).filter((item) => {
		const stats = fs.statSync(path.join(LOCALES_DIR, item))
		return stats.isDirectory() && item !== "en"
	})

	// Filter to the specified locale if provided
	const locales = args.locale ? allLocales.filter((locale) => locale === args.locale) : allLocales

	if (args.locale && locales.length === 0) {
		console.error(`Error: Locale '${args.locale}' not found in ${LOCALES_DIR}`)
		process.exit(1)
	}

	console.log(
		`\n${area === "core" ? "BACKEND" : "FRONTEND"} - Checking key ordering for ${locales.length} locale(s): ${locales.join(", ")}`,
	)

	// Get all English JSON files
	const englishDir = path.join(LOCALES_DIR, "en")
	let englishFiles = fs.readdirSync(englishDir).filter((file) => file.endsWith(".json") && !file.startsWith("."))

	// Filter to the specified file if provided
	if (args.file) {
		if (!englishFiles.includes(args.file)) {
			console.error(`Error: File '${args.file}' not found in ${englishDir}`)
			process.exit(1)
		}
		englishFiles = englishFiles.filter((file) => file === args.file)
	}

	console.log(`Checking ${englishFiles.length} file(s): ${englishFiles.join(", ")}`)

	let hasOrderingIssues = false

	// Check each locale
	for (const locale of locales) {
		let localeHasIssues = false
		const localeIssues = []

		for (const fileName of englishFiles) {
			const englishFilePath = path.join(englishDir, fileName)
			const localeFilePath = path.join(LOCALES_DIR, locale, fileName)

			// Check if the locale file exists
			if (!fs.existsSync(localeFilePath)) {
				localeHasIssues = true
				localeIssues.push(`    ⚠️  ${fileName}: File missing in ${locale}`)
				continue
			}

			// Load and parse both files
			let englishContent, localeContent

			try {
				englishContent = JSON.parse(fs.readFileSync(englishFilePath, "utf8"))
				localeContent = JSON.parse(fs.readFileSync(localeFilePath, "utf8"))
			} catch (e) {
				localeHasIssues = true
				localeIssues.push(`    ❌ ${fileName}: JSON parsing error - ${e.message}`)
				continue
			}

			// Extract keys in order
			const englishKeys = extractKeysInOrder(englishContent)
			const localeKeys = extractKeysInOrder(localeContent)

			// Compare ordering
			const issues = compareKeyOrdering(englishKeys, localeKeys)

			if (issues.missing.length > 0 || issues.extra.length > 0 || issues.outOfOrder.length > 0) {
				localeHasIssues = true
				localeIssues.push(`    ❌ ${fileName}: Key ordering issues found`)

				if (issues.missing.length > 0) {
					localeIssues.push(
						`       Missing keys: ${issues.missing.slice(0, 3).join(", ")}${issues.missing.length > 3 ? ` (+${issues.missing.length - 3} more)` : ""}`,
					)
				}

				if (issues.extra.length > 0) {
					localeIssues.push(
						`       Extra keys: ${issues.extra.slice(0, 3).join(", ")}${issues.extra.length > 3 ? ` (+${issues.extra.length - 3} more)` : ""}`,
					)
				}

				if (issues.outOfOrder.length > 0) {
					const firstMismatches = issues.outOfOrder
						.slice(0, 2)
						.map((issue) => `expected '${issue.expected}' but found '${issue.actual}'`)
						.join(", ")
					localeIssues.push(
						`       Order mismatches: ${firstMismatches}${issues.outOfOrder.length > 2 ? ` (+${issues.outOfOrder.length - 2} more)` : ""}`,
					)
				}
			}
		}

		// Only print issues
		if (localeHasIssues) {
			console.log(`\n  📋 Checking locale: ${locale}`)
			localeIssues.forEach((issue) => console.log(issue))
			hasOrderingIssues = true
		}
	}

	return hasOrderingIssues
}

/**
 * Main function to check locale key ordering
 */
function lintLocaleKeyOrdering() {
	try {
		console.log("🔍 Starting locale key ordering check...")

		let anyAreaHasIssues = false

		// Check each requested area
		for (const area of areasToCheck) {
			const hasIssues = checkAreaKeyOrdering(area)
			anyAreaHasIssues = anyAreaHasIssues || hasIssues
		}

		// Summary
		if (!anyAreaHasIssues) {
			console.log("✅ All locale files have consistent key ordering!")
			process.exit(0)
		} else {
			console.log("\n❌ Key ordering inconsistencies detected!")
			console.log("\n💡 To fix ordering issues:")
			console.log("1. Review the files with ordering mismatches")
			console.log("2. Reorder keys to match the English locale files")
			console.log("3. Use MCP sort_i18n_keys tool to fix ordering")
			console.log("4. Run this linter again to verify fixes")
			process.exit(1)
		}
	} catch (error) {
		console.error("Error:", error.message)
		console.error(error.stack)
		process.exit(1)
	}
}

// Run the main function
lintLocaleKeyOrdering()
