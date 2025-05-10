#!/usr/bin/env node

const fs = require("fs")
const path = require("path")

// Export functions for testing
module.exports = {
	getNestedValue,
	setNestedValue,
	deleteNestedValue,
	processStdin,
	addTranslations,
	deleteTranslations,
}

function splitPath(keyPath) {
	// First replace double dots with a placeholder
	const placeholder = "\u0000"
	const escaped = keyPath.replace(/\.\./g, placeholder)

	// Split on single dots
	const parts = escaped.split(".")

	// Restore dots in each part
	return parts.map((part) => part.replace(new RegExp(placeholder, "g"), "."))
}

function unescapeKey(key) {
	return key.replace(/\.\./g, ".")
}

function getNestedValue(obj, keyPath) {
	// Try nested path first
	const nestedValue = splitPath(keyPath).reduce((current, key) => {
		return current && typeof current === "object" ? current[unescapeKey(key)] : undefined
	}, obj)

	// If nested path doesn't exist, check for exact key match
	if (nestedValue === undefined && keyPath in obj) {
		return obj[keyPath]
	}

	return nestedValue
}

function setNestedValue(obj, keyPath, value) {
	const keys = splitPath(keyPath)
	const lastKey = keys.pop()
	const target = keys.reduce((current, key) => {
		const unescapedKey = unescapeKey(key)
		if (!(unescapedKey in current)) {
			current[unescapedKey] = {}
		}
		return current[unescapedKey]
	}, obj)
	target[unescapeKey(lastKey)] = value
}

function deleteNestedValue(obj, keyPath) {
	// First check if the exact key exists
	if (keyPath in obj) {
		delete obj[keyPath]
		return true
	}

	// Then try nested path
	const keys = splitPath(keyPath)
	const lastKey = keys.pop()
	const target = keys.reduce((current, key) => {
		const unescapedKey = unescapeKey(key)
		return current && typeof current === "object" ? current[unescapedKey] : undefined
	}, obj)

	if (target && typeof target === "object") {
		const unescapedLastKey = unescapeKey(lastKey)
		if (unescapedLastKey in target) {
			delete target[unescapedLastKey]
			return true
		}
	}
	return false
}

async function collectStdin() {
	return new Promise((resolve, reject) => {
		let buffer = ""
		process.stdin.setEncoding("utf8")

		process.stdin.on("data", (chunk) => {
			buffer += chunk
		})

		process.stdin.on("end", () => {
			resolve(buffer)
		})

		process.stdin.on("error", reject)
	})
}

function parseInputLines(inputText) {
	const pairs = []
	const lines = inputText.split("\n")

	for (const line of lines) {
		const trimmed = line.trim()
		if (!trimmed) continue

		try {
			const data = JSON.parse(trimmed)
			if (Array.isArray(data)) {
				// In delete mode, allow multiple elements in array
				data.forEach((key) => pairs.push([key]))
			} else if (typeof data === "object" && data !== null) {
				const entries = Object.entries(data)
				if (entries.length !== 1) {
					throw new Error("Each line must contain a single key-value pair")
				}
				pairs.push(entries[0])
			} else {
				throw new Error("Each line must be a JSON object or array")
			}
		} catch (err) {
			if (err.message.startsWith("Each line must")) {
				throw err
			}
			throw new Error(`Invalid JSON on line: ${trimmed}`)
		}
	}

	return pairs
}

async function processStdin() {
	const inputText = await collectStdin()
	return parseInputLines(inputText)
}

async function addTranslations(data, pairs, filePath, verbose = false) {
	let modified = false

	// Create parent directories if they don't exist
	const directory = path.dirname(filePath)
	await fs.promises.mkdir(directory, { recursive: true })

	for (const [keyPath, value] of pairs) {
		const currentValue = getNestedValue(data, keyPath)
		if (currentValue === undefined) {
			setNestedValue(data, keyPath, value)
			if (verbose) {
				console.log(`Created new key path: ${keyPath}`)
				console.log(`Full path: ${filePath}`)
				console.log(`Set value: "${value}"`)
			}
			modified = true
		} else if (verbose) {
			console.log(`Key exists: ${keyPath}`)
			console.log(`Full path: ${filePath}`)
			console.log(`Current value: "${currentValue}"`)
		}
	}
	return modified
}

async function deleteTranslations(data, keys, filePath, verbose = false) {
	let modified = false
	for (const keyPath of keys) {
		if (deleteNestedValue(data, keyPath)) {
			if (verbose) {
				console.log(`Deleted key: ${keyPath}`)
				console.log(`From file: ${filePath}`)
			}
			modified = true
		} else if (verbose) {
			console.log(`Key not found: ${keyPath}`)
			console.log(`In file: ${filePath}`)
		}
	}
	return modified
}

async function main() {
	const args = process.argv.slice(2)
	const verbose = args.includes("-v")
	const deleteMode = args.includes("-d")
	const stdinMode = args.includes("--stdin")

	if (verbose) args.splice(args.indexOf("-v"), 1)
	if (deleteMode) args.splice(args.indexOf("-d"), 1)
	if (stdinMode) args.splice(args.indexOf("--stdin"), 1)

	if (args.length < 1) {
		console.log("Usage:")
		console.log("Command Line Mode:")
		console.log("  Add/update translations:")
		console.log("    node scripts/manage-translations.js [-v] TRANSLATION_FILE KEY_PATH VALUE [KEY_PATH VALUE...]")
		console.log("  Delete translations:")
		console.log(
			"    node scripts/manage-translations.js [-v] -d TRANSLATION_FILE1 [TRANSLATION_FILE2 ...] [ -- KEY1 ...]",
		)
		console.log("")
		console.log("Key Path Format:")
		console.log("  - Use single dot (.) for nested paths: 'command.newTask.title'")
		console.log("  - Use double dots (..) to include a literal dot in key names (like SMTP byte stuffing):")
		console.log("    'settings..path' -> { 'settings.path': 'value' }")
		console.log("")
		console.log("  Examples:")
		console.log("    'command.newTask.title'     -> { command: { newTask: { title: 'value' } } }")
		console.log("    'settings..path'            -> { 'settings.path': 'value' }")
		console.log("    'nested.key..with..dots'    -> { nested: { 'key.with.dots': 'value' } }")
		console.log("")
		console.log("Line-by-Line JSON Mode (--stdin):")
		console.log("  Each line must be a complete, single JSON object/array")
		console.log("  Multi-line or combined JSON is not supported")
		console.log("")
		console.log("  Add/update translations:")
		console.log("    node scripts/manage-translations.js [-v] --stdin TRANSLATION_FILE")
		console.log("    Format: One object per line with exactly one key-value pair:")
		console.log('      {"command.newTask.title": "New Task"}')
		console.log('      {"settings..path": "Custom Path"}')
		console.log('      {"nested.key..with..dots": "Value with dots in key"}')
		console.log("")
		console.log("  Delete translations:")
		console.log("    node scripts/manage-translations.js [-v] -d --stdin TRANSLATION_FILE")
		console.log("    Format: One array per line with exactly one key:")
		console.log('      ["command.newTask.title"]')
		console.log('      ["settings..path"]')
		console.log('      ["nested.key..with..dots"]')
		console.log("")
		console.log("Options:")
		console.log("  -v        Enable verbose output (shows operations)")
		console.log("  -d        Delete mode - remove keys instead of setting them")
		console.log("  --stdin   Read line-by-line JSON from stdin")
		console.log("")
		console.log("Examples:")
		console.log("  # Add via command line:")
		console.log('  node scripts/manage-translations.js package.nls.json command.newTask.title "New Task"')
		console.log('  node scripts/manage-translations.js package.nls.json settings..path "Custom Path"')
		console.log('  node scripts/manage-translations.js package.nls.json nested.key..with..dots "Value with dots"')
		console.log("")
		console.log("  # Add multiple translations (one JSON object per line):")
		console.log("  translations.txt:")
		console.log('    {"command.newTask.title": "New Task"}')
		console.log('    {"settings..path": "Custom Path"}')
		console.log("    node scripts/manage-translations.js --stdin package.nls.json < translations.txt")
		console.log("")
		console.log("  # Delete multiple keys (one JSON array per line):")
		console.log("  delete_keys.txt:")
		console.log('    ["command.newTask.title"]')
		console.log('    ["settings..path"]')
		console.log('    ["nested.key..with..dots"]')
		console.log("    node scripts/manage-translations.js -d --stdin package.nls.json < delete_keys.txt")
		console.log("")
		console.log("  # Using here document for batching:")
		console.log("  node scripts/manage-translations.js --stdin package.nls.json << EOF")
		console.log('    {"command.newTask.title": "New Task"}')
		console.log('    {"settings..path": "Custom Path"}')
		console.log("  EOF")
		console.log("")
		console.log("  # Delete using here document:")
		console.log("  node scripts/manage-translations.js -d --stdin package.nls.json << EOF")
		console.log('    ["command.newTask.title"]')
		console.log('    ["settings..path"]')
		console.log('    ["nested.key..with..dots"]')
		console.log("  EOF")
		process.exit(1)
	}

	let modified = false

	try {
		if (stdinMode && deleteMode) {
			const files = args
			// Check if all files exist first
			for (const filePath of files) {
				try {
					await fs.promises.access(filePath)
				} catch (err) {
					if (err.code === "ENOENT") {
						throw new Error(`File not found: ${filePath}`)
					}
					throw err
				}
			}

			const input = await processStdin()
			const keys = input.map(([key]) => key)

			// Process each file
			for (const filePath of files) {
				const data = JSON.parse(await fs.promises.readFile(filePath, "utf8"))
				if (await deleteTranslations(data, keys, filePath, verbose)) {
					await fs.promises.writeFile(filePath, JSON.stringify(data, null, "\t") + "\n")
					modified = true
				}
			}
			return
		} else if (deleteMode) {
			const separatorIndex = args.indexOf("--")
			const files = separatorIndex === -1 ? args : args.slice(0, separatorIndex)
			const keys = separatorIndex === -1 ? [] : args.slice(separatorIndex + 1)

			// Check if all files exist first
			for (const filePath of files) {
				try {
					await fs.promises.access(filePath)
				} catch (err) {
					if (err.code === "ENOENT") {
						throw new Error(`File not found: ${filePath}`)
					}
					throw err
				}
			}

			// Process each file
			for (const filePath of files) {
				const data = JSON.parse(await fs.promises.readFile(filePath, "utf8"))
				if (await deleteTranslations(data, keys, filePath, verbose)) {
					await fs.promises.writeFile(filePath, JSON.stringify(data, null, "\t") + "\n")
					modified = true
				}
			}
			return
		}

		// Original non-delete mode code
		const filePath = args[0]
		let data = {}
		try {
			data = JSON.parse(await fs.promises.readFile(filePath, "utf8"))
		} catch (err) {
			if (err.code === "ENOENT") {
				if (verbose) {
					console.log(`File not found: ${filePath}`)
					console.log("Creating new file")
				}
				const directory = path.dirname(filePath)
				await fs.promises.mkdir(directory, { recursive: true })
			} else {
				throw err
			}
		}

		if (stdinMode) {
			const pairs = await processStdin()
			modified = await addTranslations(data, pairs, filePath, verbose)
		} else if (args.length >= 3 && args.length % 2 === 1) {
			// Process key-value pairs from command line
			const pairs = []
			for (let i = 1; i < args.length; i += 2) {
				pairs.push([args[i], args[i + 1]])
			}
			modified = await addTranslations(data, pairs, filePath, verbose)
		} else {
			console.log("Invalid number of arguments")
			process.exit(1)
		}

		// Write back if modified
		if (modified) {
			await fs.promises.writeFile(filePath, JSON.stringify(data, null, "\t") + "\n")
			if (verbose) {
				console.log("File updated successfully")
			}
		}
	} catch (err) {
		if (err instanceof SyntaxError) {
			throw new Error("Invalid JSON in translation file")
		} else if (err.code !== "ENOENT") {
			// ENOENT is handled above
			throw err
		}
	}
}

// Only run main when called directly
if (require.main === module) {
	main().catch((err) => {
		console.error("Error:", err.message)
		process.exit(1)
	})
}

// Export functions for testing
module.exports = {
	getNestedValue,
	setNestedValue,
	deleteNestedValue,
	parseInputLines,
	collectStdin,
	processStdin,
	addTranslations,
	deleteTranslations,
	main,
}
