import fs from "fs/promises"
import path from "path"

import { LANGUAGES, isLanguage } from "../../../shared/language"
import { CustomInstructionsPathsConfig } from "../../../schemas"

/**
 * Safely read a file and return its trimmed content
 */
async function safeReadFile(filePath: string): Promise<string> {
	try {
		const content = await fs.readFile(filePath, "utf-8")
		return content.trim()
	} catch (err) {
		const errorCode = (err as NodeJS.ErrnoException).code
		if (!errorCode || !["ENOENT", "EISDIR"].includes(errorCode)) {
			throw err
		}
		return ""
	}
}

/**
 * Check if a directory exists
 */
async function directoryExists(dirPath: string): Promise<boolean> {
	try {
		const stats = await fs.stat(dirPath)
		return stats.isDirectory()
	} catch (err) {
		return false
	}
}

/**
 * Read all text files from a directory in alphabetical order
 */
async function readTextFilesFromDirectory(dirPath: string): Promise<Array<{ fullPath: string; content: string }>> {
	try {
		const files = await fs
			.readdir(dirPath, { withFileTypes: true, recursive: true })
			.then((files) => files.filter((file) => file.isFile()))
			.then((files) => files.map((file) => path.join(file.parentPath, file.name)))

		const fileContents = await Promise.all(
			files.map(async (file) => {
				try {
					const content = await safeReadFile(file)
					return { fullPath: file, content }
				} catch (err) {
					return null
				}
			}),
		)

		// Filter out null values (directories or failed reads)
		return fileContents.filter((item) => item !== null)
	} catch (err) {
		return []
	}
}

/**
 * Format content from multiple files with filenames as headers
 */
function formatDirectoryContent(dirPath: string, files: Array<{ fullPath: string; content: string }>): string {
	if (files.length === 0) return ""

	return (
		"\n\n" +
		files
			.map((file) => {
				return `# Rules from ${file.fullPath}:\n${file.content}:`
			})
			.join("\n\n")
	)
}

/**
 * Load rule files from the specified directory
 */
export async function loadRuleFiles(cwd: string): Promise<string> {
	// Check for .roo/rules/ directory
	const rooRulesDir = path.join(cwd, ".roo", "rules")
	if (await directoryExists(rooRulesDir)) {
		const files = await readTextFilesFromDirectory(rooRulesDir)
		if (files.length > 0) {
			return formatDirectoryContent(rooRulesDir, files)
		}
	}

	// Fall back to existing behavior
	const ruleFiles = [".roorules", ".clinerules"]

	for (const file of ruleFiles) {
		const content = await safeReadFile(path.join(cwd, file))
		if (content) {
			return `\n# Rules from ${file}:\n${content}\n`
		}
	}

	return ""
}

/**
 * Load rules from a directory or file.
 * If the path is a directory, it will read all files in that directory recursively.
 * If the path is a file, it will read that file.
 * @param fullPath - The full path to the directory or file.
 * @returns An array of rules, each representing the content of a rule file.
 */
export async function loadRulesInPath(fullPath: string): Promise<string[]> {
	const rules: string[] = []
	const stats = await fs.lstat(fullPath)
	if (stats.isDirectory()) {
		const ruleFiles = await readTextFilesFromDirectory(fullPath)
		if (ruleFiles.length > 0) {
			rules.push(...ruleFiles.map((ruleFile) => `# Rules from ${ruleFile.fullPath}:\n${ruleFile.content}`))
		}
	} else {
		const content = await safeReadFile(fullPath)
		if (content) {
			rules.push(`# Rules from ${fullPath}:\n${content}`)
		}
	}
	return rules
}

export async function addCustomInstructions(
	modeCustomInstructions: string,
	globalCustomInstructions: string,
	cwd: string,
	mode: string,
	options: {
		language?: string
		rooIgnoreInstructions?: string
		customInstructionsPaths?: CustomInstructionsPathsConfig[]
	} = {},
): Promise<string> {
	const sections = []

	// Load mode-specific rules if mode is provided
	let modeRuleContent = ""
	let usedRuleFile = ""

	if (mode) {
		// Check for .roo/rules-${mode}/ directory
		const modeRulesDir = path.join(cwd, ".roo", `rules-${mode}`)
		if (await directoryExists(modeRulesDir)) {
			const files = await readTextFilesFromDirectory(modeRulesDir)
			if (files.length > 0) {
				modeRuleContent = formatDirectoryContent(modeRulesDir, files)
				usedRuleFile = modeRulesDir
			}
		}

		// If no directory exists, fall back to existing behavior
		if (!modeRuleContent) {
			const rooModeRuleFile = `.roorules-${mode}`
			modeRuleContent = await safeReadFile(path.join(cwd, rooModeRuleFile))
			if (modeRuleContent) {
				usedRuleFile = rooModeRuleFile
			} else {
				const clineModeRuleFile = `.clinerules-${mode}`
				modeRuleContent = await safeReadFile(path.join(cwd, clineModeRuleFile))
				if (modeRuleContent) {
					usedRuleFile = clineModeRuleFile
				}
			}
		}
	}

	// Add language preference if provided
	if (options.language) {
		const languageName = isLanguage(options.language) ? LANGUAGES[options.language] : options.language
		sections.push(
			`Language Preference:\nYou should always speak and think in the "${languageName}" (${options.language}) language unless the user gives you instructions below to do otherwise.`,
		)
	}

	// Add global instructions first
	if (typeof globalCustomInstructions === "string" && globalCustomInstructions.trim()) {
		sections.push(`Global Instructions:\n${globalCustomInstructions.trim()}`)
	}

	// Add mode-specific instructions after
	if (typeof modeCustomInstructions === "string" && modeCustomInstructions.trim()) {
		sections.push(`Mode-specific Instructions:\n${modeCustomInstructions.trim()}`)
	}

	// Add rules - include both mode-specific and generic rules if they exist
	const rules = []

	// Add mode-specific rules first if they exist
	if (modeRuleContent && modeRuleContent.trim()) {
		if (usedRuleFile.includes(path.join(".roo", `rules-${mode}`))) {
			rules.push(modeRuleContent.trim())
		} else {
			rules.push(`# Rules from ${usedRuleFile}:\n${modeRuleContent}`)
		}
	}

	// Load custom instructions from paths if provided
	if (options.customInstructionsPaths) {
		const customInstructionsFullPaths = options.customInstructionsPaths.map((customPath) => {
			return typeof customPath === "string"
				? path.isAbsolute(customPath)
					? customPath
					: path.join(cwd, customPath)
				: customPath.isAbsolute || path.isAbsolute(customPath.path)
					? customPath.path
					: path.join(cwd, customPath.path)
		})
		// TODO: Consider to use glob pattern
		for (const customInstructionsFullPath of customInstructionsFullPaths) {
			const loadedRules = await loadRulesInPath(customInstructionsFullPath)
			rules.push(...loadedRules)
		}
	}

	if (options.rooIgnoreInstructions) {
		rules.push(options.rooIgnoreInstructions)
	}

	// Add generic rules
	const genericRuleContent = await loadRuleFiles(cwd)
	if (genericRuleContent) {
		rules.push(genericRuleContent)
	}

	if (rules.length > 0) {
		sections.push(`Rules:\n\n${rules.join("\n\n")}`)
	}

	const joinedSections = sections.join("\n\n")

	return joinedSections
		? `
====

USER'S CUSTOM INSTRUCTIONS

The following additional instructions are provided by the user, and should be followed to the best of your ability without interfering with the TOOL USE guidelines.

${joinedSections}`
		: ""
}
