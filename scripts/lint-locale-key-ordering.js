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

if (args.help) {
	console.log(`
Locale Key Ordering Linter - Ensures consistent key ordering across locale files

Usage: tsx scripts/lint-locale-key-ordering.js [options]

Options:
  --locale=<locale>   Check specific locale (e.g. --locale=fr)
  --file=<file>       Check specific file (e.g. --file=chat.json)
  --area=<area>       Check area: core, webview, or both (default)
  --help              Show this help

Exit: 0=consistent, 1=issues found
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

// Extract keys from JSON object recursively in dot notation
function extractKeysInOrder(obj, prefix = "") {
	const keys = []
	for (const [key, value] of Object.entries(obj)) {
		const fullKey = prefix ? `${prefix}.${key}` : key
		keys.push(fullKey)
		if (typeof value === "object" && value !== null && !Array.isArray(value)) {
			keys.push(...extractKeysInOrder(value, fullKey))
		}
	}
	return keys
}

// Compare key ordering and find differences
function compareKeyOrdering(englishKeys, localeKeys) {
	const englishSet = new Set(englishKeys)
	const localeSet = new Set(localeKeys)
	const missing = englishKeys.filter((key) => !localeSet.has(key))
	const extra = localeKeys.filter((key) => !englishSet.has(key))

	const commonKeys = englishKeys.filter((key) => localeSet.has(key))
	const localeCommonKeys = localeKeys.filter((key) => englishSet.has(key))
	const outOfOrder = []

	for (let i = 0; i < commonKeys.length; i++) {
		if (commonKeys[i] !== localeCommonKeys[i]) {
			outOfOrder.push({
				expected: commonKeys[i],
				actual: localeCommonKeys[i],
			})
		}
	}

	return { missing, extra, outOfOrder }
}

function checkAreaKeyOrdering(area) {
	const LOCALES_DIR = LOCALES_DIRS[area]
	const allLocales = fs.readdirSync(LOCALES_DIR).filter((item) => {
		return fs.statSync(path.join(LOCALES_DIR, item)).isDirectory() && item !== "en"
	})

	const locales = args.locale ? allLocales.filter((locale) => locale === args.locale) : allLocales
	if (args.locale && locales.length === 0) {
		console.error(`Error: Locale '${args.locale}' not found in ${LOCALES_DIR}`)
		process.exit(1)
	}

	console.log(`\n${area} - Checking key ordering for ${locales.length} locale(s): ${locales.join(", ")}`)

	const englishDir = path.join(LOCALES_DIR, "en")
	let englishFiles = fs.readdirSync(englishDir).filter((file) => file.endsWith(".json") && !file.startsWith("."))

	if (args.file) {
		if (!englishFiles.includes(args.file)) {
			console.error(`Error: File '${args.file}' not found in ${englishDir}`)
			process.exit(1)
		}
		englishFiles = [args.file]
	}

	console.log(`Checking ${englishFiles.length} file(s): ${englishFiles.join(", ")}`)
	let hasOrderingIssues = false

	for (const locale of locales) {
		const localeIssues = []

		for (const fileName of englishFiles) {
			const englishFilePath = path.join(englishDir, fileName)
			const localeFilePath = path.join(LOCALES_DIR, locale, fileName)

			if (!fs.existsSync(localeFilePath)) {
				localeIssues.push(`    ⚠️  ${fileName}: File missing`)
				continue
			}

			try {
				const englishContent = JSON.parse(fs.readFileSync(englishFilePath, "utf8"))
				const localeContent = JSON.parse(fs.readFileSync(localeFilePath, "utf8"))
				const issues = compareKeyOrdering(extractKeysInOrder(englishContent), extractKeysInOrder(localeContent))

				if (issues.missing.length + issues.extra.length + issues.outOfOrder.length > 0) {
					localeIssues.push(`    ❌ ${fileName}: Key ordering issues`)

					if (issues.missing.length > 0) {
						const preview = issues.missing.slice(0, 3).join(", ")
						localeIssues.push(
							`       Missing: ${preview}${issues.missing.length > 3 ? ` (+${issues.missing.length - 3} more)` : ""}`,
						)
					}
					if (issues.extra.length > 0) {
						const preview = issues.extra.slice(0, 3).join(", ")
						localeIssues.push(
							`       Extra: ${preview}${issues.extra.length > 3 ? ` (+${issues.extra.length - 3} more)` : ""}`,
						)
					}
					if (issues.outOfOrder.length > 0) {
						const preview = issues.outOfOrder
							.slice(0, 2)
							.map((issue) => `expected '${issue.expected}' but found '${issue.actual}'`)
							.join(", ")
						localeIssues.push(
							`       Order: ${preview}${issues.outOfOrder.length > 2 ? ` (+${issues.outOfOrder.length - 2} more)` : ""}`,
						)
					}
				}
			} catch (e) {
				localeIssues.push(`    ❌ ${fileName}: JSON error - ${e.message}`)
			}
		}

		if (localeIssues.length > 0) {
			console.log(`\n  📋 Checking locale: ${locale}`)
			localeIssues.forEach((issue) => console.log(issue))
			hasOrderingIssues = true
		}
	}

	return hasOrderingIssues
}

function lintLocaleKeyOrdering() {
	try {
		console.log("🔍 Starting locale key ordering check...")
		const anyAreaHasIssues = areasToCheck.some((area) => checkAreaKeyOrdering(area))

		if (!anyAreaHasIssues) {
			console.log("✅ All locale files have consistent key ordering!")
			process.exit(0)
		} else {
			console.log("\n❌ Key ordering inconsistencies detected!")
			console.log("\n💡 To fix: Use MCP sort_i18n_keys tool or manually reorder keys to match English files")
			process.exit(1)
		}
	} catch (error) {
		console.error("Error:", error.message)
		process.exit(1)
	}
}

lintLocaleKeyOrdering()
