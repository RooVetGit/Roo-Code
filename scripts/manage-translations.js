#!/usr/bin/env node

const fs = require("fs")
const path = require("path")

function getNestedValue(obj, keyPath) {
	return keyPath.split(".").reduce((current, key) => {
		return current && typeof current === "object" ? current[key] : undefined
	}, obj)
}

function setNestedValue(obj, keyPath, value) {
	const keys = keyPath.split(".")
	const lastKey = keys.pop()
	const target = keys.reduce((current, key) => {
		if (!(key in current)) {
			current[key] = {}
		}
		return current[key]
	}, obj)
	target[lastKey] = value
}

function deleteNestedValue(obj, keyPath) {
	const keys = keyPath.split(".")
	const lastKey = keys.pop()
	const target = keys.reduce((current, key) => {
		return current && typeof current === "object" ? current[key] : undefined
	}, obj)

	if (target && typeof target === "object" && lastKey in target) {
		delete target[lastKey]
		return true
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
		console.log("Line-by-Line JSON Mode (--stdin):")
		console.log("  Each line must be a complete, single JSON object/array")
		console.log("  Multi-line or combined JSON is not supported")
		console.log("")
		console.log("  Add/update translations:")
		console.log("    node scripts/manage-translations.js [-v] --stdin TRANSLATION_FILE")
		console.log("    Format: One object per line with exactly one key-value pair:")
		console.log('      {"key.path": "value"}')
		console.log("")
		console.log("  Delete translations:")
		console.log("    node scripts/manage-translations.js [-v] -d --stdin TRANSLATION_FILE")
		console.log("    Format: One array per line with exactly one key:")
		console.log('      ["key.path"]')
		console.log("")
		console.log("Options:")
		console.log("  -v        Enable verbose output (shows operations)")
		console.log("  -d        Delete mode - remove keys instead of setting them")
		console.log("  --stdin   Read line-by-line JSON from stdin")
		console.log("")
		console.log("Examples:")
		console.log("  # Add via command line:")
		console.log('  node scripts/manage-translations.js settings.json providers.key.label "Value"')
		console.log("")
		console.log("  # Add multiple translations (one JSON object per line):")
		console.log("  translations.txt:")
		console.log('    {"providers.key1.label": "First Value"}')
		console.log('    {"providers.key2.label": "Second Value"}')
		console.log("    node scripts/manage-translations.js --stdin settings.json < translations.txt")
		console.log("")
		console.log("  # Delete multiple keys (one JSON array per line):")
		console.log("  delete_keys.txt:")
		console.log('    ["providers.key1.label"]')
		console.log('    ["providers.key2.label"]')
		console.log("    node scripts/manage-translations.js -d --stdin settings.json < delete_keys.txt")
		console.log("")
		console.log("  # Using here document for batching:")
		console.log("  node scripts/manage-translations.js --stdin settings.json << EOF")
		console.log('    {"providers.key1.label": "First Value"}')
		console.log('    {"providers.key2.label": "Second Value"}')
		console.log("  EOF")
		console.log("")
		console.log("  # Delete using here document:")
		console.log("  node scripts/manage-translations.js -d --stdin settings.json << EOF")
		console.log('    ["providers.key1.label"]')
		console.log('    ["providers.key2.label"]')
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
		} else if (stdinMode) {
			const pairs = await processStdin()
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
		} else if (deleteMode) {
			// Process keys to delete
			for (let i = 1; i < args.length; i++) {
				const keyPath = args[i]
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
		} else if (args.length >= 3 && args.length % 2 === 1) {
			// Process key-value pairs from command line
			for (let i = 1; i < args.length; i += 2) {
				const keyPath = args[i]
				const value = args[i + 1]
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
			console.error("Error: Invalid JSON in translation file")
		} else if (err.code !== "ENOENT") {
			// ENOENT is handled above
			console.error("Error:", err.message)
		}
		process.exit(1)
	}
}

main().catch((err) => {
	console.error("Unexpected error:", err)
	process.exit(1)
})
