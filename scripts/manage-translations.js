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
	// Split on unescaped dots, preserving escaped dots
	const parts = []
	let current = ""
	let escaped = false

	for (let i = 0; i < keyPath.length; i++) {
		if (keyPath[i] === "\\" && !escaped) {
			escaped = true
		} else if (keyPath[i] === "." && !escaped) {
			parts.push(current)
			current = ""
			escaped = false
		} else {
			current += keyPath[i]
			escaped = false
		}
	}
	parts.push(current)
	return parts
}

function unescapeKey(key) {
	return key.replace(/\\\./g, ".")
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

async function processStdin() {
	return new Promise((resolve, reject) => {
		const pairs = []
		let buffer = ""

		process.stdin.setEncoding("utf8")

		process.stdin.on("data", (chunk) => {
			buffer += chunk
			const lines = buffer.split("\n")
			buffer = lines.pop() || "" // Keep incomplete line in buffer

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
							reject(new Error("Each line must contain a single key-value pair"))
							return
						}
						pairs.push(entries[0])
					} else {
						reject(new Error("Each line must be a JSON object or array"))
						return
					}
				} catch (err) {
					reject(new Error(`Invalid JSON on line: ${trimmed}`))
					return
				}
			}
		})

		process.stdin.on("end", () => {
			if (buffer.trim()) {
				try {
					const data = JSON.parse(buffer.trim())
					if (Array.isArray(data)) {
						// In delete mode, allow multiple elements in array
						data.forEach((key) => pairs.push([key]))
					} else if (typeof data === "object" && data !== null) {
						const entries = Object.entries(data)
						if (entries.length !== 1) {
							reject(new Error("Each line must contain a single key-value pair"))
							return
						}
						pairs.push(entries[0])
					} else {
						reject(new Error("Each line must be a JSON object or array"))
						return
					}
				} catch (err) {
					reject(new Error(`Invalid JSON on line: ${buffer.trim()}`))
					return
				}
			}
			resolve(pairs)
		})

		process.stdin.on("error", reject)
	})
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
		console.log("    node scripts/manage-translations.js [-v] -d TRANSLATION_FILE KEY_PATH [KEY_PATH...]")
		console.log("")
		console.log("Key Path Format:")
		console.log("  - Use dots (.) to specify nested paths: 'command.newTask.title'")
		console.log("  - To include a literal dot in a key name, escape it with backslash: '\\'")
		console.log("    'settings\\.customStoragePath\\.description'")
		console.log("  - To include a literal backslash, escape it with another backslash: '\\\\'")
		console.log("    'settings\\\\path\\\\description'")
		console.log("  Examples:")
		console.log("    'command.newTask.title'         -> { command: { newTask: { title: 'value' } } }")
		console.log(
			"    'settings\\.customStoragePath\\.description' -> { 'settings.customStoragePath.description': 'value' }",
		)
		console.log("    'path\\\\to\\\\file'           -> { 'path\\to\\file': 'value' }")
		console.log("")
		console.log("Line-by-Line JSON Mode (--stdin):")
		console.log("  Each line must be a complete, single JSON object/array")
		console.log("  Multi-line or combined JSON is not supported")
		console.log("")
		console.log("  Add/update translations:")
		console.log("    node scripts/manage-translations.js [-v] --stdin TRANSLATION_FILE")
		console.log("    Format: One object per line with exactly one key-value pair:")
		console.log('      {"command.newTask.title": "New Task"}')
		console.log('      {"settings\\.customStoragePath\\.description": "Custom storage path"}')
		console.log('      {"path\\\\to\\\\file": "File path with backslashes"}')
		console.log("")
		console.log("  Delete translations:")
		console.log("    node scripts/manage-translations.js [-v] -d --stdin TRANSLATION_FILE")
		console.log("    Format: One array per line with exactly one key:")
		console.log('      ["command.newTask.title"]')
		console.log('      ["settings\\.customStoragePath\\.description"]')
		console.log('      ["path\\\\to\\\\file"]')
		console.log("")
		console.log("Options:")
		console.log("  -v        Enable verbose output (shows operations)")
		console.log("  -d        Delete mode - remove keys instead of setting them")
		console.log("  --stdin   Read line-by-line JSON from stdin")
		console.log("")
		console.log("Examples:")
		console.log("  # Add via command line:")
		console.log('  node scripts/manage-translations.js package.nls.json command.newTask.title "New Task"')
		console.log(
			'  node scripts/manage-translations.js package.nls.json settings\\.vsCodeLmModelSelector\\.vendor\\.description "The vendor of the language model"',
		)
		console.log("")
		console.log("  # Add multiple translations (one JSON object per line):")
		console.log("  translations.txt:")
		console.log('    {"command.newTask.title": "New Task"}')
		console.log(
			'    {"settings\\.vsCodeLmModelSelector\\.vendor\\.description": "The vendor of the language model"}',
		)
		console.log("    node scripts/manage-translations.js --stdin package.nls.json < translations.txt")
		console.log("")
		console.log("  # Delete multiple keys (one JSON array per line):")
		console.log("  delete_keys.txt:")
		console.log('    ["command.newTask.title"]')
		console.log('    ["settings\\.vsCodeLmModelSelector\\.vendor\\.description"]')
		console.log("    node scripts/manage-translations.js -d --stdin package.nls.json < delete_keys.txt")
		console.log("")
		console.log("  # Using here document for batching:")
		console.log("  node scripts/manage-translations.js --stdin package.nls.json << EOF")
		console.log('    {"command.newTask.title": "New Task"}')
		console.log(
			'    {"settings\\.vsCodeLmModelSelector\\.vendor\\.description": "The vendor of the language model"}',
		)
		console.log("  EOF")
		console.log("")
		console.log("  # Delete using here document:")
		console.log("  node scripts/manage-translations.js -d --stdin package.nls.json << EOF")
		console.log('    ["command.newTask.title"]')
		console.log('    ["settings\\.vsCodeLmModelSelector\\.vendor\\.description"]')
		console.log("  EOF")
		process.exit(1)
	}

	const filePath = args[0]
	let modified = false

	try {
		let data = {}
		try {
			data = JSON.parse(await fs.promises.readFile(filePath, "utf8"))
		} catch (err) {
			if (err.code === "ENOENT") {
				if (verbose) {
					console.log(`File not found: ${filePath}`)
					console.log("Creating new file")
				}
				// Create parent directories if they don't exist
				const directory = path.dirname(filePath)
				await fs.promises.mkdir(directory, { recursive: true })
			} else {
				throw err
			}
		}

		if (stdinMode && deleteMode) {
			const input = await processStdin()
			const keys = input.map(([key]) => key)
			modified = await deleteTranslations(data, keys, filePath, verbose)
		} else if (stdinMode) {
			const pairs = await processStdin()
			modified = await addTranslations(data, pairs, filePath, verbose)
		} else if (deleteMode) {
			// Process keys to delete from command line
			const keys = args.slice(1)
			modified = await deleteTranslations(data, keys, filePath, verbose)
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
	processStdin,
	addTranslations,
	deleteTranslations,
	main,
}
