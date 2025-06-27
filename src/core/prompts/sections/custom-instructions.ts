import fs from "fs/promises"
import path from "path"
import * as os from "os"
import { Dirent } from "fs"

import { isLanguage } from "@roo-code/types"

import { LANGUAGES } from "../../../shared/language"
import { getRooDirectoriesForCwd, getGlobalRooDirectory } from "../../../services/roo-config"

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

const MAX_DEPTH = 5

/**
 * Recursively resolve directory entries and collect file paths
 */
async function resolveDirectoryEntry(
	entry: Dirent,
	dirPath: string,
	filePaths: string[],
	depth: number,
): Promise<void> {
	// Avoid cyclic symlinks
	if (depth > MAX_DEPTH) {
		return
	}

	const fullPath = path.resolve(entry.parentPath || dirPath, entry.name)
	if (entry.isFile()) {
		// Regular file
		filePaths.push(fullPath)
	} else if (entry.isSymbolicLink()) {
		// Await the resolution of the symbolic link
		await resolveSymLink(fullPath, filePaths, depth + 1)
	}
}

/**
 * Recursively resolve a symbolic link and collect file paths
 */
async function resolveSymLink(fullPath: string, filePaths: string[], depth: number): Promise<void> {
	// Avoid cyclic symlinks
	if (depth > MAX_DEPTH) {
		return
	}
	try {
		// Get the symlink target
		const linkTarget = await fs.readlink(fullPath)
		// Resolve the target path (relative to the symlink location)
		const resolvedTarget = path.resolve(path.dirname(fullPath), linkTarget)

		// Check if the target is a file
		const stats = await fs.stat(resolvedTarget)
		if (stats.isFile()) {
			filePaths.push(resolvedTarget)
		} else if (stats.isDirectory()) {
			const anotherEntries = await fs.readdir(resolvedTarget, { withFileTypes: true, recursive: true })
			// Collect promises for recursive calls within the directory
			const directoryPromises: Promise<void>[] = []
			for (const anotherEntry of anotherEntries) {
				directoryPromises.push(resolveDirectoryEntry(anotherEntry, resolvedTarget, filePaths, depth + 1))
			}
			// Wait for all entries in the resolved directory to be processed
			await Promise.all(directoryPromises)
		} else if (stats.isSymbolicLink()) {
			// Handle nested symlinks by awaiting the recursive call
			await resolveSymLink(resolvedTarget, filePaths, depth + 1)
		}
	} catch (err) {
		// Skip invalid symlinks
	}
}

/**
 * Read all text files from a directory in alphabetical order
 */
async function readTextFilesFromDirectory(dirPath: string): Promise<Array<{ filename: string; content: string }>> {
	try {
		const entries = await fs.readdir(dirPath, { withFileTypes: true, recursive: true })

		// Process all entries - regular files and symlinks that might point to files
		const filePaths: string[] = []
		// Collect promises for the initial resolution calls
		const initialPromises: Promise<void>[] = []

		for (const entry of entries) {
			initialPromises.push(resolveDirectoryEntry(entry, dirPath, filePaths, 0))
		}

		// Wait for all asynchronous operations (including recursive ones) to complete
		await Promise.all(initialPromises)

		const fileContents = await Promise.all(
			filePaths.map(async (file) => {
				try {
					// Check if it's a file (not a directory)
					const stats = await fs.stat(file)
					if (stats.isFile()) {
						const content = await safeReadFile(file)
						return { filename: file, content }
					}
					return null
				} catch (err) {
					return null
				}
			}),
		)

		// Filter out null values (directories or failed reads)
		return fileContents.filter((item): item is { filename: string; content: string } => item !== null)
	} catch (err) {
		return []
	}
}

/**
 * Format content from multiple files with filenames as headers
 */
function formatDirectoryContent(dirPath: string, files: Array<{ filename: string; content: string }>): string {
	if (files.length === 0) return ""

	return files
		.map((file) => {
			return `# Rules from ${file.filename}:\n${file.content}`
		})
		.join("\n\n")
}

/**
 * Load rule files from global and project-local directories
 * Global rules are loaded first, then project-local rules which can override global ones
 */
export async function loadRuleFiles(cwd: string): Promise<string> {
	const rules: string[] = []
	const rooDirectories = getRooDirectoriesForCwd(cwd)

	// Check for .roo/rules/ directories in order (global first, then project-local)
	for (const rooDir of rooDirectories) {
		const rulesDir = path.join(rooDir, "rules")
		if (await directoryExists(rulesDir)) {
			const files = await readTextFilesFromDirectory(rulesDir)
			if (files.length > 0) {
				const content = formatDirectoryContent(rulesDir, files)
				rules.push(content)
			}
		}
	}

	// If we found rules in .roo/rules/ directories, return them
	if (rules.length > 0) {
		return "\n" + rules.join("\n\n")
	}

	// Fall back to existing behavior for legacy .roorules/.clinerules files
	const ruleFiles = [".roorules", ".clinerules"]

	for (const file of ruleFiles) {
		const filePath = path.join(cwd, file)
		const content = await safeReadFile(filePath)
		if (content) {
			return `\n# Rules from ${file}:\n${content}\n`
		}
	}

	return ""
}

async function addSingleCustomInstructions(cwd: string, mode: string): Promise<string> {
	const rulesFromCwd = []

	// Load mode-specific rules if mode is provided
	let modeRuleContent = ""
	let usedRuleFile = ""

	if (mode) {
		const modeRules: string[] = []
		const rooDirectories = getRooDirectoriesForCwd(cwd)

		// Check for .roo/rules-${mode}/ directories in order (global first, then project-local)
		for (const rooDir of rooDirectories) {
			const modeRulesDir = path.join(rooDir, `rules-${mode}`)
			if (await directoryExists(modeRulesDir)) {
				const files = await readTextFilesFromDirectory(modeRulesDir)
				if (files.length > 0) {
					const content = formatDirectoryContent(modeRulesDir, files)
					modeRules.push(content)
				}
			}
		}

		// If we found mode-specific rules in .roo/rules-${mode}/ directories, use them
		if (modeRules.length > 0) {
			modeRuleContent = "\n" + modeRules.join("\n\n")
			usedRuleFile = `rules-${mode} directories`
		} else {
			// Fall back to existing behavior for legacy files
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

	if (modeRuleContent.trim()) {
		// If modeRuleContent came from formatDirectoryContent, it's already fully formatted.
		// If it came from a single file, we need to add the header.
		// Also, if usedRuleFile points to a directory, the content is already formatted.
		if (
			usedRuleFile &&
			!modeRuleContent.startsWith("# Rules from") &&
			!usedRuleFile.includes(path.join(".roo", `rules-${mode}`))
		) {
			rulesFromCwd.push(`# Rules from ${usedRuleFile}:\n${modeRuleContent.trim()}`)
		} else {
			rulesFromCwd.push(modeRuleContent.trim())
		}
	}

	// Add generic rules
	const genericRuleContent = await loadRuleFiles(cwd) // loadRuleFiles already formats its content
	if (genericRuleContent && genericRuleContent.trim()) {
		rulesFromCwd.push(genericRuleContent.trim())
	}

	return rulesFromCwd.join("\n\n")
}

export async function addCustomInstructions(
	modeCustomInstructions: string,
	globalCustomInstructions: string,
	cwd: string,
	mode: string,
	options: { language?: string; rooIgnoreInstructions?: string } = {},
): Promise<string> {
	const rules = []
	let currentCwd = path.resolve(cwd)
	const rootDir = path.parse(currentCwd).root

	// Get parentRulesMaxDepth from global state
	let maxDepth = 1
	try {
		const { ContextProxy } = await import("../../../core/config/ContextProxy")
		maxDepth = ContextProxy.instance?.getValue("parentRulesMaxDepth") ?? 1
	} catch (error) {
		// In test environments, ContextProxy might not be initialized
		// Fall back to default value of 1
	}

	let currentDepth = 0

	// Loop from initialCwd up to root or until max depth is reached
	while (currentDepth < maxDepth) {
		const rulesFromLevel = await addSingleCustomInstructions(currentCwd, mode)
		if (rulesFromLevel.trim()) {
			rules.unshift(rulesFromLevel.trim()) // Prepend to get parent rules first
		}

		// Stop if we've reached the root directory
		if (currentCwd === rootDir) {
			break
		}
		const parentCwd = path.resolve(currentCwd, "..")

		// Safety break if path.resolve doesn't change currentCwd (e.g., already at root)
		if (parentCwd === currentCwd) {
			break
		}
		currentCwd = parentCwd
		currentDepth++
	}

	const sections = []

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
	if (options.rooIgnoreInstructions && options.rooIgnoreInstructions.trim()) {
		rules.push(options.rooIgnoreInstructions.trim())
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
