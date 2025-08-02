const fs = require("fs")
const path = require("path")

// Parse command-line arguments
const args = process.argv.slice(2).reduce((acc, arg) => {
	if (arg === "--help") {
		acc.help = true
	} else if (arg.startsWith("--locale=")) {
		acc.locale = arg.split("=")[1]
	} else if (arg.startsWith("--file=")) {
		acc.file = arg.split("=")[1]
	}
	return acc
}, {})

// Display help information
if (args.help) {
	console.log(`
Find missing i18n translations

A useful script to identify whether the i18n keys used in component files exist in all language files.

Usage:
  node scripts/find-missing-i18n-key.js [options]

Options:
  --locale=<locale>   Only check a specific language (e.g., --locale=de)
  --file=<file>       Only check a specific file (e.g., --file=chat.json)
  --help              Display help information

Output:
  - Generate a report of missing translations
  `)
	process.exit(0)
}

// Directories to traverse and their corresponding locales
const DIRS = {
	components: {
		path: path.join(__dirname, "../webview-ui/src/components"),
		localesDir: path.join(__dirname, "../webview-ui/src/i18n/locales"),
	},
	src: {
		path: path.join(__dirname, "../src"),
		localesDir: path.join(__dirname, "../src/i18n/locales"),
	},
}

// Regular expressions to match i18n keys
const i18nPatterns = [
	/{t\("([^"]+)"\)}/g, // Match {t("key")} format
	/i18nKey="([^"]+)"/g, // Match i18nKey="key" format
	/t\("([a-zA-Z][a-zA-Z0-9_]*[:.][a-zA-Z0-9_.]+)"\)/g, // Match t("key") format, where key contains a colon or dot
]

// Get all language directories for a specific locales directory
function getLocaleDirs(localesDir) {
	try {
		const allLocales = fs.readdirSync(localesDir).filter((file) => {
			const stats = fs.statSync(path.join(localesDir, file))
			return stats.isDirectory() // Do not exclude any language directories
		})

		// Filter to a specific language if specified
		return args.locale ? allLocales.filter((locale) => locale === args.locale) : allLocales
	} catch (error) {
		if (error.code === "ENOENT") {
			console.warn(`Warning: Locales directory not found: ${localesDir}`)
			return []
		}
		throw error
	}
}

// Get the value from JSON by path
function getValueByPath(obj, path) {
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

// Check if the key exists in all language files, return a list of missing language files
function checkKeyInLocales(key, localeDirs, localesDir) {
	const missingLocales = []

	// Check if key contains a colon (file:path format)
	if (key.includes(":")) {
		const colonIndex = key.indexOf(":")
		const file = key.substring(0, colonIndex)
		const jsonPath = key.substring(colonIndex + 1)

		localeDirs.forEach((locale) => {
			const filePath = path.join(localesDir, locale, `${file}.json`)
			if (!fs.existsSync(filePath)) {
				missingLocales.push(`${locale}/${file}.json`)
				return
			}

			try {
				const json = JSON.parse(fs.readFileSync(filePath, "utf8"))
				let found = false

				// Check for exact key
				if (getValueByPath(json, jsonPath) !== undefined) {
					found = true
				}

				// Check for pluralization patterns (_one, _other, _zero, _few, _many)
				if (!found) {
					const pluralSuffixes = ["_one", "_other", "_zero", "_few", "_many"]
					for (const suffix of pluralSuffixes) {
						if (getValueByPath(json, jsonPath + suffix) !== undefined) {
							found = true
							break
						}
					}
				}

				if (!found) {
					missingLocales.push(`${locale}/${file}.json`)
				}
			} catch (e) {
				// If we can't parse the file, consider the key missing
				missingLocales.push(`${locale}/${file}.json`)
			}
		})
	} else {
		// Key doesn't contain colon, search in all JSON files
		localeDirs.forEach((locale) => {
			const localeDir = path.join(localesDir, locale)
			let found = false

			// Get all JSON files in the locale directory
			const jsonFiles = fs.readdirSync(localeDir).filter((file) => file.endsWith(".json"))

			for (const jsonFile of jsonFiles) {
				const filePath = path.join(localeDir, jsonFile)
				try {
					const json = JSON.parse(fs.readFileSync(filePath, "utf8"))
					if (getValueByPath(json, key) !== undefined) {
						found = true
						break
					}
				} catch (e) {
					// Skip files that can't be parsed
				}
			}

			if (!found) {
				missingLocales.push(`${locale}/${key}`)
			}
		})
	}

	return missingLocales
}

// Recursively traverse the directory
function findMissingI18nKeys() {
	const results = []

	function walk(dir, baseDir, localeDirs, localesDir) {
		const files = fs.readdirSync(dir)

		for (const file of files) {
			const filePath = path.join(dir, file)
			const stat = fs.statSync(filePath)

			// Exclude test files, __mocks__ directory, and node_modules
			if (filePath.includes(".test.") || filePath.includes("__mocks__") || filePath.includes("node_modules"))
				continue

			if (stat.isDirectory()) {
				walk(filePath, baseDir, localeDirs, localesDir) // Recursively traverse subdirectories
			} else if (stat.isFile() && [".ts", ".tsx", ".js", ".jsx"].includes(path.extname(filePath))) {
				const content = fs.readFileSync(filePath, "utf8")

				// Match all i18n keys
				for (const pattern of i18nPatterns) {
					let match
					while ((match = pattern.exec(content)) !== null) {
						const key = match[1]
						const missingLocales = checkKeyInLocales(key, localeDirs, localesDir)
						if (missingLocales.length > 0) {
							results.push({
								key,
								missingLocales,
								file: path.relative(baseDir, filePath),
							})
						}
					}
				}
			}
		}
	}

	// Walk through all directories
	Object.entries(DIRS).forEach(([name, config]) => {
		const localeDirs = getLocaleDirs(config.localesDir)
		if (localeDirs.length > 0) {
			console.log(`\nChecking ${name} directory with ${localeDirs.length} languages: ${localeDirs.join(", ")}`)
			walk(config.path, config.path, localeDirs, config.localesDir)
		}
	})

	return results
}

// Execute and output the results
function main() {
	try {
		if (args.locale) {
			// Check if the specified locale exists in any of the locales directories
			const localeExists = Object.values(DIRS).some((config) => {
				const localeDirs = getLocaleDirs(config.localesDir)
				return localeDirs.includes(args.locale)
			})

			if (!localeExists) {
				console.error(`Error: Language '${args.locale}' not found in any locales directory`)
				process.exit(1)
			}
		}

		const missingKeys = findMissingI18nKeys()

		if (missingKeys.length === 0) {
			console.log("\n✅ All i18n keys are present!")
			return
		}

		console.log("\nMissing i18n keys:\n")
		missingKeys.forEach(({ key, missingLocales, file }) => {
			console.log(`File: ${file}`)
			console.log(`Key: ${key}`)
			console.log("Missing in:")
			missingLocales.forEach((file) => console.log(`  - ${file}`))
			console.log("-------------------")
		})

		// Exit code 1 indicates missing keys
		process.exit(1)
	} catch (error) {
		console.error("Error:", error.message)
		console.error(error.stack)
		process.exit(1)
	}
}

main()
