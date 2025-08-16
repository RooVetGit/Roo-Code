/**
 * Utility to convert multiline terminal commands into single-line equivalents
 * to prevent terminal hanging issues when executing multiline commands.
 *
 * Supports POSIX shells (bash, zsh, fish) and PowerShell.
 */

export interface ConversionResult {
	success: boolean
	command: string
	reason?: string
}

/**
 * Detects if a command contains a Here Document which cannot be converted to single line
 */
function hasHereDocument(command: string): boolean {
	// Check for Here Document patterns: <<EOF, <<-EOF, <<"EOF", <<'EOF'
	const hereDocPattern = /<<-?\s*(['"]?)(\w+)\1/
	return hereDocPattern.test(command)
}

/**
 * Detects if a command contains a multiline string literal
 */
function hasMultilineString(command: string): boolean {
	// First check if the command has line continuations - these are NOT multiline strings
	// Line continuations end with backslash
	if (/\\\s*\n/.test(command)) {
		return false
	}

	// Check for multiline strings in quotes that span multiple lines
	// This is a simplified check - looks for quotes with newlines between them
	const lines = command.split("\n")
	let inString = false
	let stringDelimiter = ""
	let escapeNext = false

	for (const line of lines) {
		for (let i = 0; i < line.length; i++) {
			const char = line[i]

			if (escapeNext) {
				escapeNext = false
				continue
			}

			if (char === "\\") {
				escapeNext = true
				continue
			}

			if ((char === '"' || char === "'") && !inString) {
				inString = true
				stringDelimiter = char
			} else if (char === stringDelimiter && inString) {
				inString = false
				stringDelimiter = ""
			}
		}
		// If we're still in a string after processing a line, it's multiline
		if (inString && lines.indexOf(line) < lines.length - 1) {
			return true
		}
	}

	return false
}

/**
 * Converts multiline strings to single-line with escaped newlines
 */
function convertMultilineStrings(command: string): string {
	// Handle multiline strings by replacing newlines with \n
	const lines = command.split("\n")
	const result: string[] = []
	let inString = false
	let stringDelimiter = ""
	let currentString = ""
	let beforeString = "" // Track text before the string starts
	let escapeNext = false

	for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
		const line = lines[lineIndex]
		let processedLine = ""

		for (let i = 0; i < line.length; i++) {
			const char = line[i]

			if (escapeNext) {
				// We're escaping this character
				if (inString) {
					currentString += "\\" + char
				} else {
					processedLine += "\\" + char
				}
				escapeNext = false
				continue
			}

			if (char === "\\") {
				// This might be an escape character
				const nextChar = i < line.length - 1 ? line[i + 1] : ""
				if (nextChar === '"' || nextChar === "'") {
					// It's escaping a quote
					escapeNext = true
					continue
				} else {
					// It's just a backslash
					if (inString) {
						currentString += char
					} else {
						processedLine += char
					}
				}
			} else if ((char === '"' || char === "'") && !inString) {
				// Starting a string
				inString = true
				stringDelimiter = char
				beforeString = processedLine // Save text before string
				currentString = char
				processedLine = "" // Clear processed line as we're now in a string
			} else if (char === stringDelimiter && inString) {
				// Ending a string
				currentString += char
				processedLine = beforeString + currentString + processedLine
				inString = false
				stringDelimiter = ""
				currentString = ""
				beforeString = ""
			} else if (inString) {
				// Inside a string
				currentString += char
			} else {
				// Outside a string
				processedLine += char
			}
		}

		if (inString && lineIndex < lines.length - 1) {
			// We're in a multiline string, add \n for the newline
			currentString += "\\n"
		} else if (!inString && processedLine) {
			// Not in a string, add the processed line
			result.push(processedLine)
		}
	}

	// If we're still in a string at the end, complete it
	if (inString && currentString) {
		// Close the unclosed string and add it with the text before it
		result.push(beforeString + currentString)
	}

	return result.join("\n")
}

/**
 * Main function to convert multiline commands to single line
 * Uses a simple approach: join lines with semicolons for most cases
 */
export function convertMultilineToSingleLine(command: string): ConversionResult {
	// Check if command is already single line
	if (!command.includes("\n")) {
		return { success: true, command }
	}

	// Check for unconvertible patterns
	if (hasHereDocument(command)) {
		return {
			success: false,
			command,
			reason: "Command contains a Here Document which cannot be converted to single line",
		}
	}

	// Check if command contains multiline strings
	if (hasMultilineString(command)) {
		// Convert multiline strings to single-line with \n
		try {
			const converted = convertMultilineStrings(command)
			// After converting strings, check if there are still multiple lines
			if (!converted.includes("\n")) {
				return { success: true, command: converted }
			}
			// If there are still multiple lines after string conversion,
			// continue with normal processing
			command = converted
		} catch (error) {
			// If string conversion fails, continue with normal processing
			console.log(`[multilineCommandConverter] String conversion failed: ${error.message}`)
		}
	}

	try {
		// Simple approach: handle common patterns
		let result = command

		// Handle line continuations (backslash at end of line)
		result = result.replace(/\\\n\s*/g, " ")

		// Handle line continuations (backtick at end of line for PowerShell)
		result = result.replace(/`\n\s*/g, " ")

		// Split into lines
		const lines = result
			.split("\n")
			.map((line) => line.trim())
			.filter((line) => line)

		// Join lines with appropriate separators
		const joined = lines.join(" ; ")

		// Clean up multiple semicolons and spaces
		result = joined
			.replace(/;\s*;/g, ";")
			.replace(/\s+/g, " ")
			.replace(/\{\s*;/g, "{") // Remove semicolon after opening brace
			.replace(/\(\s*;/g, "(") // Remove semicolon after opening paren
			.replace(/\|\s*;/g, "|") // Remove semicolon after pipe
			.replace(/&&\s*;/g, "&&") // Remove semicolon after &&
			.replace(/\|\|\s*;/g, "||") // Remove semicolon after ||
			.trim()

		return { success: true, command: result }
	} catch (error) {
		// If conversion fails, return original command
		return {
			success: false,
			command,
			reason: `Conversion failed: ${error.message}`,
		}
	}
}

/**
 * Determines if a command should be converted based on configuration
 */
export function shouldConvertCommand(command: string): boolean {
	// Always convert if command has multiple lines
	if (!command.includes("\n")) {
		return false
	}

	// Check for patterns that should not be converted
	if (hasHereDocument(command)) {
		return false
	}

	return true
}
