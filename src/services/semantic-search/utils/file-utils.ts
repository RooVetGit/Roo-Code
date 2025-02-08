import * as vscode from "vscode"

// Configurable parameters
const TEXT_VALIDATION_SAMPLE_SIZE = 4096 // Check first 4KB for binary indicators
const VALID_BYTE_RATIO = 0.95 // Reduced from 0.99 to 0.95
const CONTROL_CHAR_THRESHOLD = 0.05 // Increased from 0.01 to 0.05

const BINARY_SIGNATURES = new Map([
	// Images
	[[0xff, 0xd8, 0xff], "image/jpeg"], // JPEG
	[[0x89, 0x50, 0x4e, 0x47], "image/png"], // PNG
	[[0x47, 0x49, 0x46], "image/gif"], // GIF
	// Archives
	[[0x50, 0x4b, 0x03, 0x04], "application/zip"], // ZIP
	[[0x52, 0x61, 0x72, 0x21], "application/rar"], // RAR
	// PDFs
	[[0x25, 0x50, 0x44, 0x46], "application/pdf"], // PDF
	// Office documents
	[[0x50, 0x4b, 0x03, 0x04], "application/msoffice"], // Office files (DOCX, XLSX, etc.)
	// Executables
	[[0x4d, 0x5a], "application/exe"], // EXE
	[[0x7f, 0x45, 0x4c, 0x46], "application/elf"], // ELF
])

export async function isTextFile(filePath: string, maxSize: number): Promise<boolean> {
	const stats = await vscode.workspace.fs.stat(vscode.Uri.file(filePath))
	if (stats.type === vscode.FileType.Directory) return false
	if (stats.size === 0) return false
	if (stats.size > maxSize) return false

	const fileContent = await vscode.workspace.fs.readFile(vscode.Uri.file(filePath))
	const buffer = Buffer.from(fileContent)

	// 1. Check for binary file signatures
	if (hasBinarySignature(buffer)) {
		console.log(`File ${filePath} rejected: matches binary signature`)
		return false
	}

	// 2. Validate UTF-8 encoding
	if (!isValidUtf8(buffer)) {
		console.log(`File ${filePath} rejected: invalid UTF-8`)
		return false
	}

	// 3. Check for excessive control characters
	const { controlCount, validCount, totalSampled } = analyzeBytes(buffer)
	const controlRatio = controlCount / totalSampled
	const validRatio = validCount / totalSampled

	console.log(`File ${filePath} metrics:`, {
		controlRatio: controlRatio.toFixed(4),
		validRatio: validRatio.toFixed(4),
		threshold: {
			maxControl: CONTROL_CHAR_THRESHOLD,
			minValid: VALID_BYTE_RATIO,
		},
	})

	const isValid = validRatio >= VALID_BYTE_RATIO && controlRatio <= CONTROL_CHAR_THRESHOLD
	if (!isValid) {
		console.log(`File ${filePath} rejected: failed character ratio checks`)
	}
	return isValid
}

function hasBinarySignature(buffer: Buffer): boolean {
	if (buffer.length < 2) return false

	for (const [signature, _] of BINARY_SIGNATURES) {
		if (signature.length > buffer.length) continue

		let matches = true
		for (let i = 0; i < signature.length; i++) {
			if (buffer[i] !== signature[i]) {
				matches = false
				break
			}
		}
		if (matches) return true
	}
	return false
}

function analyzeBytes(buffer: Buffer): { controlCount: number; validCount: number; totalSampled: number } {
	let controlCount = 0
	let validCount = 0

	// Only check first 4KB for performance
	const sample = buffer.subarray(0, TEXT_VALIDATION_SAMPLE_SIZE)

	if (sample.length === 0) {
		return { controlCount: 0, validCount: 0, totalSampled: 0 }
	}

	for (const byte of sample) {
		if (byte === 0) {
			// Null byte
			controlCount++
			continue
		}

		if (byte < 32 && ![9, 10, 13].includes(byte)) {
			// Control chars
			controlCount++
		}

		if (
			byte === 0x09 || // Tab
			byte === 0x0a || // LF
			byte === 0x0d || // CR
			(byte >= 0x20 && byte <= 0x7e) // Printable ASCII
		) {
			validCount++
		}
	}

	return {
		controlCount: controlCount,
		validCount: validCount,
		totalSampled: sample.length,
	}
}

function isValidUtf8(buffer: Buffer): boolean {
	try {
		// Use Node.js built-in validation
		new TextDecoder("utf-8", { fatal: true }).decode(buffer)
		return true
	} catch {
		return false
	}
}

export async function isCodeFile(filePath: string): Promise<boolean> {
	// 1. Check using VS Code's language detection
	const language = await getVSCodeLanguage(filePath)

    // If VS Code detects a non-code language, trust it.
    if (language && !isProgrammingLanguage(language)) {
        return false;
    }

    // If VS Code detects a code language, trust it.
    if (language && isProgrammingLanguage(language)) {
        return true;
    }

	// 2. If VS Code language detection is inconclusive, check for code patterns.
    //    Be more strict in this check.
	const content = await readFileSample(filePath, 1024); // Increased sample size
	return hasStrongCodePatterns(content); // Use a stricter check
}

async function getVSCodeLanguage(filePath: string): Promise<string | undefined> {
	try {
		const doc = await vscode.workspace.openTextDocument(filePath)
		return doc.languageId
	} catch (error) {
		if (error instanceof Error && error.message.includes("binary")) {
			console.log(`Skipping binary file: ${filePath}`)
			return undefined
		}
		console.error(`Error opening document ${filePath}:`, error)
		return undefined
	}
}

function isProgrammingLanguage(langId: string): boolean {
	// Exclude markup and documentation formats
	const NON_CODE_LANGUAGES = new Set([
		"plaintext",
		"markdown",
		"html",
		"css",
		"scss",
		"json",
		"xml",
		"yaml",
		"text",
		"log",
	])
	return !NON_CODE_LANGUAGES.has(langId.toLowerCase())
}

async function readFileSample(filePath: string, bytes: number): Promise<string> {
	try {
		const content = await vscode.workspace.fs.readFile(vscode.Uri.file(filePath))
		return new TextDecoder().decode(content.slice(0, bytes))
	} catch {
		return ""
	}
}

// Stricter code pattern check
function hasStrongCodePatterns(content: string): boolean {
  // More specific patterns, requiring more context.
  const CODE_PATTERNS = [
    // Function/class declarations with brackets
    /\b(function|class|interface|def|fn)\s+[a-zA-Z_]\w*\s*[\(\{]/,
    // Import statements with specific formats
    /(import\s+.+?\s+from\s+['"][a-zA-Z0-9@_/.-]+['"]|from\s+['"][a-zA-Z0-9@_/.-]+['"]\s+import\s+.+?|require\s*\(\s*['"][a-zA-Z0-9@_/.-]+['"]\s*\))/,
    // Common multi-line comment blocks
    /\/\*[\s\S]*?\*\//,
    // Shebang lines (for scripts)
    /^#! ?.*\//,
  ];

  // Require at least two different patterns to match
  let matchCount = 0;
  for (const pattern of CODE_PATTERNS) {
    if (pattern.test(content)) {
      matchCount++;
    }
    if (matchCount >= 2) {
      return true; // More confident it's code
    }
  }
  return false;
}
