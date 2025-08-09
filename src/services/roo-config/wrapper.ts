import * as path from "path"
import {
	getProjectRooDirectoryForCwd as getProjectRooDirectoryBase,
	getGlobalRooDirectory,
	getRooDirectoriesForCwd as getRooDirectoriesBase,
	loadConfiguration as loadConfigurationBase,
} from "./index"

// This will be set by the extension during activation
let vscodeUtils: { findWorkspaceWithRoo: () => any } | undefined

/**
 * Sets the vscode utilities for use in the wrapper
 * This should be called during extension activation
 */
export function setVscodeUtils(utils: { findWorkspaceWithRoo: () => any }) {
	vscodeUtils = utils
}

/**
 * Gets the project-local .roo directory path for a given cwd
 * This wrapper checks for vscode-specific functionality when available
 */
export function getProjectRooDirectoryForCwd(cwd: string): string {
	// Check if .roo is one of the workspace folders in a multi-root workspace
	if (vscodeUtils?.findWorkspaceWithRoo) {
		const workspaceWithRoo = vscodeUtils.findWorkspaceWithRoo()
		if (workspaceWithRoo) {
			return workspaceWithRoo.uri.fsPath
		}
	}

	// Fall back to base implementation
	return getProjectRooDirectoryBase(cwd)
}

/**
 * Gets the ordered list of .roo directories to check (global first, then project-local)
 * This wrapper uses the vscode-aware getProjectRooDirectoryForCwd
 */
export function getRooDirectoriesForCwd(cwd: string): string[] {
	const directories: string[] = []

	// Add global directory first
	directories.push(getGlobalRooDirectory())

	// Add project-local directory second (using wrapper version)
	directories.push(getProjectRooDirectoryForCwd(cwd))

	return directories
}

/**
 * Loads configuration from multiple .roo directories with project overriding global
 * This wrapper uses the vscode-aware getProjectRooDirectoryForCwd
 */
export async function loadConfiguration(
	relativePath: string,
	cwd: string,
): Promise<{
	global: string | null
	project: string | null
	merged: string
}> {
	// Use the wrapper version of getProjectRooDirectoryForCwd
	const globalDir = getGlobalRooDirectory()
	const projectDir = getProjectRooDirectoryForCwd(cwd)

	const globalFilePath = path.join(globalDir, relativePath)
	const projectFilePath = path.join(projectDir, relativePath)

	// Import readFileIfExists from index
	const { readFileIfExists } = await import("./index")

	// Read global configuration
	const globalContent = await readFileIfExists(globalFilePath)

	// Read project-local configuration
	const projectContent = await readFileIfExists(projectFilePath)

	// Merge configurations - project overrides global
	let merged = ""

	if (globalContent) {
		merged += globalContent
	}

	if (projectContent) {
		if (merged) {
			merged += "\n\n# Project-specific rules (override global):\n\n"
		}
		merged += projectContent
	}

	return {
		global: globalContent,
		project: projectContent,
		merged: merged || "",
	}
}
