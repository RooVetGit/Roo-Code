import * as fs from "fs/promises"
import * as path from "path"
import { ModeConfig } from "../shared/modes"
import { ModeFileLocations } from "../shared/globalFileNames"
import { fileExistsAtPath, ensureDirectory } from "./fs"
import { readYamlFile, writeYamlFile } from "./yaml"
import { getWorkspacePath } from "./path"

/**
 * Get the directory path for storing mode YAML files
 *
 * @param workspace - Whether to use workspace or global directory
 * @returns The path to the modes directory
 */
export async function getModesDirectory(workspace = false, globalStoragePath?: string): Promise<string> {
	if (workspace) {
		const workspaceRoot = getWorkspacePath()
		const modesDir = path.join(workspaceRoot, ModeFileLocations.MODES_DIRECTORY)
		await ensureDirectory(modesDir)
		return modesDir
	} else if (globalStoragePath) {
		const modesDir = path.join(globalStoragePath, "modes")
		await ensureDirectory(modesDir)
		return modesDir
	} else {
		throw new Error("Global storage path is required for global modes directory")
	}
}

/**
 * Get the file path for a specific mode's YAML file
 *
 * @param slug - The slug of the mode
 * @param workspace - Whether to use workspace or global directory
 * @returns The path to the mode YAML file
 */
export async function getModeYamlPath(slug: string, workspace = false, globalStoragePath?: string): Promise<string> {
	const modesDir = await getModesDirectory(workspace, globalStoragePath)
	return path.join(modesDir, `${slug}.yaml`)
}

/**
 * Load a mode from its YAML file
 *
 * @param slug - The slug of the mode to load
 * @param workspace - Whether to load from workspace or global directory
 * @returns The loaded mode or null if not found
 */
export async function loadModeFromYaml(
	slug: string,
	workspace = false,
	globalStoragePath?: string,
): Promise<ModeConfig | null> {
	const yamlPath = await getModeYamlPath(slug, workspace, globalStoragePath)
	try {
		const exists = await fileExistsAtPath(yamlPath)
		if (!exists) return null

		const modeData = await readYamlFile<Omit<ModeConfig, "source">>(yamlPath, {} as Omit<ModeConfig, "source">)
		if (modeData) {
			return {
				...modeData,
				source: workspace ? "project" : "global",
			}
		}
	} catch (error) {
		console.error(`Failed to load mode from YAML: ${yamlPath}`, error)
	}
	return null
}

/**
 * Save a mode to its YAML file
 *
 * @param mode - The mode to save
 * @param globalStoragePath - The path to global storage (required for global modes)
 */
export async function saveModeToYaml(mode: ModeConfig, globalStoragePath?: string): Promise<void> {
	const workspace = mode.source === "project"
	const yamlPath = await getModeYamlPath(mode.slug, workspace, globalStoragePath)

	// Extract source and rules from the mode data
	const { source, ...modeData } = mode

	await writeYamlFile(yamlPath, modeData)
}

/**
 * Load all YAML mode files from a directory
 *
 * @param workspace - Whether to load from workspace or global directory
 * @returns Array of loaded modes
 */
export async function loadAllModesFromYaml(workspace: boolean, globalStoragePath?: string): Promise<ModeConfig[]> {
	const modes: ModeConfig[] = []
	try {
		const modesDir = await getModesDirectory(workspace, globalStoragePath)
		const exists = await fileExistsAtPath(modesDir)

		if (exists) {
			const files = await fs.readdir(modesDir)
			for (const file of files) {
				if (file.endsWith(".yaml") || file.endsWith(".yml")) {
					const slug = path.basename(file, path.extname(file))
					const mode = await loadModeFromYaml(slug, workspace, globalStoragePath)
					if (mode) modes.push(mode)
				}
			}
		}
	} catch (error) {
		console.error(`Error loading YAML modes from ${workspace ? "workspace" : "global"} directory:`, error)
	}

	return modes
}

/**
 * Migrate a mode from JSON to YAML format
 *
 * @param mode - The mode to migrate
 * @param globalStoragePath - The path to global storage (required for global modes)
 */
export async function migrateModeToYaml(mode: ModeConfig, globalStoragePath?: string): Promise<void> {
	// Simply save the mode to YAML format
	await saveModeToYaml(mode, globalStoragePath)
}
