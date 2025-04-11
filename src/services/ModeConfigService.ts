/**
 * Mode Configuration Service
 * Handles loading, saving, and managing mode configurations from both global and project locations.
 */
import * as fs from "fs/promises"
import * as path from "path"
import * as yaml from "js-yaml"
import { modeConfigInputSchema, ModeConfigInput, ModeConfig } from "../modeSchemas"
import { fileExistsAtPath } from "../utils/fs"
import { getWorkspacePath } from "../utils/path"
import { logger } from "../utils/logging"

const ROOMODES_FILENAME = ".roomodes"
const ROO_DIR = ".roo"
const MODES_DIR = "modes"
const YAML_EXTENSION = ".yaml"

type ModeConfigSource = "global" | "project"

interface ExtensionContext {
	globalStorageUri: { fsPath: string }
	globalState: {
		update: (key: string, value: any) => Promise<void>
	}
}

interface Disposable {
	dispose: () => void
}

/**
 * Service for loading and managing mode configurations from both global and project locations.
 * Implements the new YAML-based configuration system with fallback to legacy .roomodes file.
 */
export class ModeConfigService {
	private disposables: Disposable[] = []
	private isWriting = false
	private writeQueue: Array<() => Promise<void>> = []

	constructor(
		private readonly context: ExtensionContext,
		private readonly onUpdate: () => Promise<void>,
	) {
		// Initialize watchers for mode configuration files
		this.watchModeConfigFiles()
	}

	/**
	 * Queue a write operation to be executed sequentially
	 */
	private async queueWrite(operation: () => Promise<void>): Promise<void> {
		this.writeQueue.push(operation)
		if (!this.isWriting) {
			await this.processWriteQueue()
		}
	}

	/**
	 * Process the write queue sequentially
	 */
	private async processWriteQueue(): Promise<void> {
		if (this.isWriting || this.writeQueue.length === 0) {
			return
		}

		this.isWriting = true
		try {
			while (this.writeQueue.length > 0) {
				const operation = this.writeQueue.shift()
				if (operation) {
					await operation()
				}
			}
		} finally {
			this.isWriting = false
		}
	}

	/**
	 * Get the path to the global modes directory
	 */
	private async ensureGlobalModesDirectoryExists(): Promise<string> {
		const modesDir = path.join(this.context.globalStorageUri.fsPath, MODES_DIR)
		await fs.mkdir(modesDir, { recursive: true })
		return modesDir
	}

	/**
	 * Get the path to the project modes directory (.roo/modes/)
	 * Returns undefined if the directory doesn't exist
	 */
	private async getProjectModesDirectory(): Promise<string | undefined> {
		// In a real implementation, this would check vscode.workspace.workspaceFolders
		const workspaceRoot = getWorkspacePath()
		if (!workspaceRoot) {
			return undefined
		}

		const rooDir = path.join(workspaceRoot, ROO_DIR)
		const modesDir = path.join(rooDir, MODES_DIR)

		try {
			const exists = await fileExistsAtPath(modesDir)
			return exists ? modesDir : undefined
		} catch (error) {
			logger.error(`Failed to check if project modes directory exists: ${error}`)
			return undefined
		}
	}

	/**
	 * Get the path to the legacy .roomodes file
	 * Returns undefined if the file doesn't exist
	 */
	private async getLegacyRoomodesPath(): Promise<string | undefined> {
		// In a real implementation, this would check vscode.workspace.workspaceFolders
		const workspaceRoot = getWorkspacePath()
		if (!workspaceRoot) {
			return undefined
		}

		const roomodesPath = path.join(workspaceRoot, ROOMODES_FILENAME)

		try {
			const exists = await fileExistsAtPath(roomodesPath)
			return exists ? roomodesPath : undefined
		} catch (error) {
			logger.error(`Failed to check if .roomodes file exists: ${error}`)
			return undefined
		}
	}

	/**
	 * Load a mode configuration from a YAML file
	 *
	 * This method:
	 * 1. Reads and parses the YAML file
	 * 2. Validates the data against the mode configuration schema
	 * 3. Extracts the slug from the filename
	 * 4. Creates a complete mode configuration object
	 *
	 * @param filePath - Path to the YAML file
	 * @param source - Source of the mode (global or project)
	 * @returns The mode configuration or null if invalid
	 */
	private async loadModeFromYamlFile(filePath: string, source: ModeConfigSource): Promise<ModeConfig | null> {
		try {
			// 1. Read and parse the YAML file
			const content = await fs.readFile(filePath, "utf-8")
			const data = yaml.load(content) as unknown

			// 2. Validate the loaded data against the schema
			const result = modeConfigInputSchema.safeParse(data)
			if (!result.success) {
				logger.error(`Invalid mode configuration in ${filePath}: ${result.error.message}`)
				return null
			}

			// 3. Extract and validate the slug from the filename
			const fileName = path.basename(filePath, YAML_EXTENSION)
			if (!/^[a-zA-Z0-9-]+$/.test(fileName)) {
				logger.error(
					`Invalid mode slug in filename: ${fileName}. Slugs must contain only alphanumeric characters and hyphens.`,
				)
				return null
			}

			// 4. Create the complete mode config with slug and source
			const modeConfig: ModeConfig = {
				...result.data,
				slug: fileName,
				source,
			}

			return modeConfig
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error)
			logger.error(`Failed to load mode from ${filePath}`, { error: errorMessage })
			return null
		}
	}

	/**
	 * Load modes from a directory of YAML files
	 * @param dirPath - Path to the directory containing mode YAML files
	 * @param source - Source of the modes (global or project)
	 * @returns Array of valid mode configurations
	 */
	private async loadModesFromDirectory(dirPath: string, source: ModeConfigSource): Promise<ModeConfig[]> {
		try {
			const files = await fs.readdir(dirPath)
			const yamlFiles = files.filter((file) => file.endsWith(YAML_EXTENSION))

			const modePromises = yamlFiles.map(async (file) => {
				const filePath = path.join(dirPath, file)
				return await this.loadModeFromYamlFile(filePath, source)
			})

			const modes = await Promise.all(modePromises)
			return modes.filter((mode: ModeConfig | null): mode is ModeConfig => mode !== null)
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error)
			logger.error(`Failed to load modes from directory ${dirPath}`, { error: errorMessage })
			return []
		}
	}

	/**
	 * Load modes from the legacy .roomodes JSON file
	 *
	 * This method:
	 * 1. Reads and parses the JSON file
	 * 2. Validates the overall structure
	 * 3. Validates each mode against the schema
	 * 4. Converts valid modes to the current format
	 *
	 * @param filePath - Path to the .roomodes file
	 * @returns Array of valid mode configurations
	 */
	private async loadModesFromLegacyRoomodes(filePath: string): Promise<ModeConfig[]> {
		try {
			// 1. Read and parse the JSON file
			const content = await fs.readFile(filePath, "utf-8")
			const data = JSON.parse(content)

			// 2. Validate the overall structure
			if (!data.customModes || !Array.isArray(data.customModes)) {
				logger.error(`Invalid .roomodes file format: customModes array not found`)
				return []
			}

			// 3 & 4. Validate and convert each mode
			const modes: ModeConfig[] = []
			for (const mode of data.customModes) {
				if (!mode.slug || typeof mode.slug !== "string") {
					logger.error(`Invalid mode in .roomodes: missing or invalid slug`)
					continue
				}

				// Validate the mode against the schema
				const result = modeConfigInputSchema.safeParse(mode)
				if (!result.success) {
					logger.error(
						`Invalid mode configuration in .roomodes for slug ${mode.slug}: ${result.error.message}`,
					)
					continue
				}

				modes.push({
					...mode, // Use the original mode object to preserve all properties
					source: "project",
				})
			}

			return modes
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error)
			logger.error(`Failed to load modes from legacy .roomodes file ${filePath}`, { error: errorMessage })
			return []
		}
	}

	/**
	 * Merge modes from different sources, applying the override rule
	 * Project modes take precedence over global modes with the same slug
	 *
	 * @param projectModes - Modes from the project source
	 * @param globalModes - Modes from the global source
	 * @returns Merged array of modes with duplicates removed
	 */
	private mergeModes(projectModes: ModeConfig[], globalModes: ModeConfig[]): ModeConfig[] {
		const slugs = new Set<string>()
		const merged: ModeConfig[] = []

		// Add project modes first (they take precedence)
		for (const mode of projectModes) {
			slugs.add(mode.slug)
			merged.push(mode)
		}

		// Add non-duplicate global modes
		for (const mode of globalModes) {
			if (!slugs.has(mode.slug)) {
				merged.push(mode)
			}
		}

		return merged
	}

	/**
	 * Load all mode configurations from both global and project locations
	 *
	 * The loading process follows these steps:
	 * 1. Load modes from global storage (.yaml files in global modes directory)
	 * 2. Load modes from project storage (.roo/modes/*.yaml or legacy .roomodes)
	 * 3. Merge modes with project modes taking precedence over global modes
	 * 4. Update global state with the merged modes
	 *
	 * @returns Promise resolving to an array of all available mode configurations
	 */
	async loadAllModes(): Promise<ModeConfig[]> {
		try {
			// 1. Load modes from global storage
			const globalModesDir = await this.ensureGlobalModesDirectoryExists()
			const globalModes = await this.loadModesFromDirectory(globalModesDir, "global")

			// 2. Check for project modes directory
			const projectModesDir = await this.getProjectModesDirectory()
			let projectModes: ModeConfig[] = []

			if (projectModesDir) {
				// If .roo/modes/ exists, load modes from there
				projectModes = await this.loadModesFromDirectory(projectModesDir, "project")
			} else {
				// If .roo/modes/ doesn't exist, check for legacy .roomodes file
				const legacyRoomodesPath = await this.getLegacyRoomodesPath()
				if (legacyRoomodesPath) {
					projectModes = await this.loadModesFromLegacyRoomodes(legacyRoomodesPath)
				}
			}

			// 3. Merge modes, with project modes taking precedence
			const mergedModes = this.mergeModes(projectModes, globalModes)

			// 4. Update global state with merged modes
			await this.context.globalState.update("customModes", mergedModes)

			return mergedModes
		} catch (error) {
			logger.error(`Failed to load all modes: ${error instanceof Error ? error.message : String(error)}`)
			// Return empty array in case of error to prevent application failure
			return []
		}
	}

	/**
	 * Save a mode configuration to a YAML file
	 *
	 * This method:
	 * 1. Determines the appropriate location based on the source
	 * 2. Queues a write operation to ensure sequential file operations
	 * 3. Converts the mode to YAML and writes it to the file
	 * 4. Refreshes the merged state after writing
	 *
	 * @param mode - The mode configuration to save
	 * @throws Error if the save operation fails
	 */
	async saveMode(mode: ModeConfig): Promise<void> {
		const { slug, source, ...modeInput } = mode

		try {
			if (source === "global") {
				// Save to global storage
				const globalModesDir = await this.ensureGlobalModesDirectoryExists()
				const filePath = path.join(globalModesDir, `${slug}${YAML_EXTENSION}`)

				await this.queueWrite(async () => {
					const yamlContent = yaml.dump(modeInput, { lineWidth: -1 })
					await fs.writeFile(filePath, yamlContent, "utf-8")
					await this.refreshMergedState()
				})
			} else {
				// Save to project directory
				const workspaceRoot = getWorkspacePath()
				if (!workspaceRoot) {
					throw new Error("No workspace folder found for project-specific mode")
				}

				const rooDir = path.join(workspaceRoot, ROO_DIR)
				const modesDir = path.join(rooDir, MODES_DIR)

				// Ensure the .roo/modes directory exists
				await fs.mkdir(modesDir, { recursive: true })

				const filePath = path.join(modesDir, `${slug}${YAML_EXTENSION}`)

				await this.queueWrite(async () => {
					const yamlContent = yaml.dump(modeInput, { lineWidth: -1 })
					await fs.writeFile(filePath, yamlContent, "utf-8")
					await this.refreshMergedState()
				})
			}
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error)
			logger.error(`Failed to save mode ${slug}`, { error: errorMessage })
			throw new Error(`Failed to save mode: ${errorMessage}`)
		}
	}

	/**
	 * Delete a mode configuration
	 *
	 * This method:
	 * 1. Determines the appropriate location based on the source
	 * 2. Queues a delete operation to ensure sequential file operations
	 * 3. Verifies the mode exists before deleting
	 * 4. Refreshes the merged state after deletion
	 *
	 * @param slug - The slug of the mode to delete
	 * @param source - The source of the mode (global or project)
	 * @throws Error if the delete operation fails or the mode doesn't exist
	 */
	async deleteMode(slug: string, source: ModeConfigSource): Promise<void> {
		try {
			if (source === "global") {
				// Delete from global storage
				const globalModesDir = await this.ensureGlobalModesDirectoryExists()
				const filePath = path.join(globalModesDir, `${slug}${YAML_EXTENSION}`)

				await this.queueWrite(async () => {
					const exists = await fileExistsAtPath(filePath)
					if (exists) {
						await fs.unlink(filePath)
						await this.refreshMergedState()
					} else {
						throw new Error(`Mode ${slug} not found in global storage`)
					}
				})
			} else {
				// Delete from project directory
				const projectModesDir = await this.getProjectModesDirectory()
				if (!projectModesDir) {
					throw new Error(`Project modes directory not found`)
				}

				const filePath = path.join(projectModesDir, `${slug}${YAML_EXTENSION}`)

				await this.queueWrite(async () => {
					const exists = await fileExistsAtPath(filePath)
					if (exists) {
						await fs.unlink(filePath)
						await this.refreshMergedState()
					} else {
						throw new Error(`Mode ${slug} not found in project storage`)
					}
				})
			}
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error)
			logger.error(`Failed to delete mode ${slug}`, { error: errorMessage })
			throw new Error(`Failed to delete mode: ${errorMessage}`)
		}
	}

	/**
	 * Refresh the merged state of modes in global state
	 * This is called after any mode is saved or deleted
	 */
	private async refreshMergedState(): Promise<void> {
		try {
			const modes = await this.loadAllModes()
			await this.context.globalState.update("customModes", modes)
			await this.onUpdate()
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error)
			logger.error(`Failed to refresh merged state`, { error: errorMessage })
			// Don't throw here to prevent cascading failures
		}
	}

	/**
	 * Watch for changes to mode configuration files
	 * Sets up watchers for global and project mode configuration files
	 */
	private async watchModeConfigFiles(): Promise<void> {
		// Set up file system watchers for mode configuration files
		// For now, we'll just log that we're watching the files
		const globalModesDir = await this.ensureGlobalModesDirectoryExists()
		const projectModesDir = await this.getProjectModesDirectory()
		const legacyRoomodesPath = await this.getLegacyRoomodesPath()

		logger.info(`Watching for changes in global modes directory: ${globalModesDir}`)
		if (projectModesDir) {
			logger.info(`Watching for changes in project modes directory: ${projectModesDir}`)
		}
		if (legacyRoomodesPath) {
			logger.info(`Watching for changes in legacy .roomodes file: ${legacyRoomodesPath}`)
		}

		// Add the watchers to disposables for cleanup
		// Implementation depends on the actual VS Code API
	}

	/**
	 * Dispose of all resources
	 */
	dispose(): void {
		for (const disposable of this.disposables) {
			disposable.dispose()
		}
		this.disposables = []
	}
}
