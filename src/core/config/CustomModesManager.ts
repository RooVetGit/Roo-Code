import * as vscode from "vscode"
import * as path from "path"
import * as fs from "fs/promises"
import * as yaml from "js-yaml"
import { customModesSettingsSchema } from "../../schemas"
import { ModeConfig } from "../../shared/modes"
import { fileExistsAtPath } from "../../utils/fs"
import { arePathsEqual, getWorkspacePath } from "../../utils/path"
import { logger } from "../../utils/logging"
import { GlobalFileNames } from "../../shared/globalFileNames"

const ROOMODES_FILENAME = ".roomodes"
const ROO_DIR = ".roo"
const MODES_DIR = "modes"
const YAML_EXTENSION = ".yaml"

export class CustomModesManager {
	private disposables: vscode.Disposable[] = []
	private isWriting = false
	private writeQueue: Array<() => Promise<void>> = []

	constructor(
		private readonly context: vscode.ExtensionContext,
		private readonly onUpdate: () => Promise<void>,
	) {
		// TODO: We really shouldn't have async methods in the constructor.
		this.watchCustomModesFiles()
	}

	private async queueWrite(operation: () => Promise<void>): Promise<void> {
		this.writeQueue.push(operation)
		if (!this.isWriting) {
			await this.processWriteQueue()
		}
	}

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

	private async getWorkspaceRoomodes(): Promise<string | undefined> {
		const workspaceFolders = vscode.workspace.workspaceFolders
		if (!workspaceFolders || workspaceFolders.length === 0) {
			return undefined
		}
		const workspaceRoot = getWorkspacePath()
		const roomodesPath = path.join(workspaceRoot, ROOMODES_FILENAME)
		const exists = await fileExistsAtPath(roomodesPath)
		return exists ? roomodesPath : undefined
	}

	/**
	 * Get the path to the project modes directory (.roo/modes/)
	 * Returns undefined if the directory doesn't exist
	 */
	private async getProjectModesDirectory(): Promise<string | undefined> {
		const workspaceFolders = vscode.workspace.workspaceFolders
		if (!workspaceFolders || workspaceFolders.length === 0) {
			return undefined
		}

		const workspaceRoot = getWorkspacePath()
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
	 * Load a mode configuration from a YAML file
	 *
	 * @param filePath - Path to the YAML file
	 * @returns The mode configuration or null if invalid
	 */
	private async loadModeFromYamlFile(filePath: string): Promise<ModeConfig | null> {
		try {
			// Read and parse the YAML file
			const content = await fs.readFile(filePath, "utf-8")
			const data = yaml.load(content) as unknown

			// Validate the loaded data against the schema
			const result = customModesSettingsSchema.safeParse({ customModes: [data] })
			if (!result.success) {
				logger.error(`Invalid mode configuration in ${filePath}: ${result.error.message}`)
				return null
			}

			// Extract and validate the slug from the filename
			const fileName = path.basename(filePath, YAML_EXTENSION)
			if (!/^[a-zA-Z0-9-]+$/.test(fileName)) {
				logger.error(
					`Invalid mode slug in filename: ${fileName}. Slugs must contain only alphanumeric characters and hyphens.`,
				)
				return null
			}

			// Create the complete mode config with slug and source
			const modeConfig: ModeConfig = {
				...result.data.customModes[0],
				slug: fileName,
				source: "project" as const,
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
	 *
	 * @param dirPath - Path to the directory containing mode YAML files
	 * @returns Array of valid mode configurations
	 */
	private async loadModesFromYamlDirectory(dirPath: string): Promise<ModeConfig[]> {
		try {
			const files = await fs.readdir(dirPath)
			const yamlFiles = files.filter((file) => file.endsWith(YAML_EXTENSION))

			const modePromises = yamlFiles.map(async (file) => {
				const filePath = path.join(dirPath, file)
				return await this.loadModeFromYamlFile(filePath)
			})

			const modes = await Promise.all(modePromises)
			return modes.filter((mode): mode is ModeConfig => mode !== null)
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error)
			logger.error(`Failed to load modes from directory ${dirPath}`, { error: errorMessage })
			return []
		}
	}

	private async loadModesFromFile(filePath: string): Promise<ModeConfig[]> {
		try {
			const content = await fs.readFile(filePath, "utf-8")
			const settings = JSON.parse(content)
			const result = customModesSettingsSchema.safeParse(settings)
			if (!result.success) {
				return []
			}

			// Determine source based on file path
			const isRoomodes = filePath.endsWith(ROOMODES_FILENAME)
			const source = isRoomodes ? ("project" as const) : ("global" as const)

			// Add source to each mode
			return result.data.customModes.map((mode) => ({
				...mode,
				source,
			}))
		} catch (error) {
			const errorMsg = `Failed to load modes from ${filePath}: ${error instanceof Error ? error.message : String(error)}`
			console.error(`[CustomModesManager] ${errorMsg}`)
			return []
		}
	}

	private async mergeCustomModes(projectModes: ModeConfig[], globalModes: ModeConfig[]): Promise<ModeConfig[]> {
		const slugs = new Set<string>()
		const merged: ModeConfig[] = []

		// Add project mode (takes precedence)
		for (const mode of projectModes) {
			if (!slugs.has(mode.slug)) {
				slugs.add(mode.slug)
				merged.push({
					...mode,
					source: "project",
				})
			}
		}

		// Add non-duplicate global modes
		for (const mode of globalModes) {
			if (!slugs.has(mode.slug)) {
				slugs.add(mode.slug)
				merged.push({
					...mode,
					source: "global",
				})
			}
		}

		return merged
	}

	async getCustomModesFilePath(): Promise<string> {
		const settingsDir = await this.ensureSettingsDirectoryExists()
		const filePath = path.join(settingsDir, GlobalFileNames.customModes)
		const fileExists = await fileExistsAtPath(filePath)
		if (!fileExists) {
			await this.queueWrite(async () => {
				await fs.writeFile(filePath, JSON.stringify({ customModes: [] }, null, 2))
			})
		}
		return filePath
	}

	private async watchCustomModesFiles(): Promise<void> {
		const settingsPath = await this.getCustomModesFilePath()

		// Watch settings file
		this.disposables.push(
			vscode.workspace.onDidSaveTextDocument(async (document) => {
				if (arePathsEqual(document.uri.fsPath, settingsPath)) {
					const content = await fs.readFile(settingsPath, "utf-8")
					const errorMessage =
						"Invalid custom modes format. Please ensure your settings follow the correct JSON format."

					let config: any
					try {
						config = JSON.parse(content)
					} catch (error) {
						console.error(error)
						vscode.window.showErrorMessage(errorMessage)
						return
					}

					const result = customModesSettingsSchema.safeParse(config)

					if (!result.success) {
						vscode.window.showErrorMessage(errorMessage)
						return
					}

					await this.refreshMergedState()
				}
			}),
		)

		// Watch .roomodes file if it exists
		const roomodesPath = await this.getWorkspaceRoomodes()
		if (roomodesPath) {
			this.disposables.push(
				vscode.workspace.onDidSaveTextDocument(async (document) => {
					if (arePathsEqual(document.uri.fsPath, roomodesPath)) {
						await this.refreshMergedState()
					}
				}),
			)
		}

		// Watch .roo/modes/*.yaml files if the directory exists
		const projectModesDir = await this.getProjectModesDirectory()
		if (projectModesDir) {
			this.disposables.push(
				vscode.workspace.onDidSaveTextDocument(async (document) => {
					const filePath = document.uri.fsPath
					if (filePath.startsWith(projectModesDir) && filePath.endsWith(YAML_EXTENSION)) {
						await this.refreshMergedState()
					}
				}),
			)
		}
	}

	async getCustomModes(): Promise<ModeConfig[]> {
		// Get modes from settings file (global modes)
		const settingsPath = await this.getCustomModesFilePath()
		const settingsModes = await this.loadModesFromFile(settingsPath)

		// Get project modes - first check if .roomodes exists
		const roomodesPath = await this.getWorkspaceRoomodes()
		let projectModes: ModeConfig[] = []

		if (roomodesPath) {
			// If .roomodes exists, load modes from there
			projectModes = await this.loadModesFromFile(roomodesPath)
			projectModes = projectModes.map((mode) => ({ ...mode, source: "project" as const }))
		} else {
			// If .roomodes doesn't exist, check for .roo/modes/ directory
			const projectModesDir = await this.getProjectModesDirectory()
			if (projectModesDir) {
				// If .roo/modes/ exists, load modes from YAML files
				projectModes = await this.loadModesFromYamlDirectory(projectModesDir)
			}
		}

		// Create maps to store modes by source
		const projectModesMap = new Map<string, ModeConfig>()
		const globalModesMap = new Map<string, ModeConfig>()

		// Add project modes (they take precedence)
		for (const mode of projectModes) {
			projectModesMap.set(mode.slug, { ...mode, source: "project" as const })
		}

		// Add global modes
		for (const mode of settingsModes) {
			if (!projectModesMap.has(mode.slug)) {
				globalModesMap.set(mode.slug, { ...mode, source: "global" as const })
			}
		}

		// Combine modes in the correct order: project modes first, then global modes
		const mergedModes = [
			...projectModes.map((mode) => ({ ...mode, source: "project" as const })),
			...settingsModes
				.filter((mode) => !projectModesMap.has(mode.slug))
				.map((mode) => ({ ...mode, source: "global" as const })),
		]

		await this.context.globalState.update("customModes", mergedModes)
		return mergedModes
	}
	async updateCustomMode(slug: string, config: ModeConfig): Promise<void> {
		try {
			const isProjectMode = config.source === "project"

			if (isProjectMode) {
				const workspaceFolders = vscode.workspace.workspaceFolders
				if (!workspaceFolders || workspaceFolders.length === 0) {
					logger.error("Failed to update project mode: No workspace folder found", { slug })
					throw new Error("No workspace folder found for project-specific mode")
				}

				const workspaceRoot = getWorkspacePath()

				// First check if .roomodes exists
				const roomodesPath = path.join(workspaceRoot, ROOMODES_FILENAME)
				const roomodesExists = await fileExistsAtPath(roomodesPath)

				if (roomodesExists) {
					// If .roomodes exists, use it
					logger.info(`${roomodesExists ? "Updating" : "Creating"} project mode in ${ROOMODES_FILENAME}`, {
						slug,
						workspace: workspaceRoot,
					})

					await this.queueWrite(async () => {
						// Ensure source is set correctly
						const modeWithSource = {
							...config,
							source: "project" as const,
						}

						await this.updateModesInFile(roomodesPath, (modes) => {
							const updatedModes = modes.filter((m) => m.slug !== slug)
							updatedModes.push(modeWithSource)
							return updatedModes
						})

						await this.refreshMergedState()
					})
				} else {
					// If .roomodes doesn't exist, use .roo/modes/${slug}.yaml
					const rooDir = path.join(workspaceRoot, ROO_DIR)
					const modesDir = path.join(rooDir, MODES_DIR)

					// Ensure the .roo/modes directory exists
					await fs.mkdir(modesDir, { recursive: true })

					const yamlPath = path.join(modesDir, `${slug}${YAML_EXTENSION}`)

					logger.info(`Saving project mode to ${yamlPath}`, {
						slug,
						workspace: workspaceRoot,
					})

					await this.queueWrite(async () => {
						// Remove slug and source from the config for YAML file
						const { slug: _, source: __, ...modeData } = config

						// Convert to YAML and write to file
						const yamlContent = yaml.dump(modeData, { lineWidth: -1 })
						await fs.writeFile(yamlPath, yamlContent, "utf-8")

						await this.refreshMergedState()
					})
				}
			} else {
				// Global mode - save to global settings file
				const targetPath = await this.getCustomModesFilePath()

				await this.queueWrite(async () => {
					// Ensure source is set correctly
					const modeWithSource = {
						...config,
						source: "global" as const,
					}

					await this.updateModesInFile(targetPath, (modes) => {
						const updatedModes = modes.filter((m) => m.slug !== slug)
						updatedModes.push(modeWithSource)
						return updatedModes
					})

					await this.refreshMergedState()
				})
			}
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error)
			logger.error("Failed to update custom mode", { slug, error: errorMessage })
			vscode.window.showErrorMessage(`Failed to update custom mode: ${errorMessage}`)
		}
	}
	private async updateModesInFile(filePath: string, operation: (modes: ModeConfig[]) => ModeConfig[]): Promise<void> {
		let content = "{}"
		try {
			content = await fs.readFile(filePath, "utf-8")
		} catch (error) {
			// File might not exist yet
			content = JSON.stringify({ customModes: [] })
		}

		let settings
		try {
			settings = JSON.parse(content)
		} catch (error) {
			console.error(`[CustomModesManager] Failed to parse JSON from ${filePath}:`, error)
			settings = { customModes: [] }
		}
		settings.customModes = operation(settings.customModes || [])
		await fs.writeFile(filePath, JSON.stringify(settings, null, 2), "utf-8")
	}

	private async refreshMergedState(): Promise<void> {
		const settingsPath = await this.getCustomModesFilePath()
		const roomodesPath = await this.getWorkspaceRoomodes()
		const projectModesDir = await this.getProjectModesDirectory()

		const settingsModes = await this.loadModesFromFile(settingsPath)
		let projectModes: ModeConfig[] = []

		if (roomodesPath) {
			// If .roomodes exists, load modes from there
			projectModes = await this.loadModesFromFile(roomodesPath)
		} else if (projectModesDir) {
			// If .roomodes doesn't exist but .roo/modes/ does, load modes from YAML files
			projectModes = await this.loadModesFromYamlDirectory(projectModesDir)
		}

		const mergedModes = await this.mergeCustomModes(projectModes, settingsModes)

		await this.context.globalState.update("customModes", mergedModes)
		await this.onUpdate()
	}

	async deleteCustomMode(slug: string): Promise<void> {
		try {
			const settingsPath = await this.getCustomModesFilePath()
			const roomodesPath = await this.getWorkspaceRoomodes()
			const projectModesDir = await this.getProjectModesDirectory()

			const settingsModes = await this.loadModesFromFile(settingsPath)
			const roomodesModes = roomodesPath ? await this.loadModesFromFile(roomodesPath) : []

			// Check if the mode exists in .roo/modes directory
			let yamlModeExists = false
			let yamlModePath: string | undefined

			if (projectModesDir) {
				yamlModePath = path.join(projectModesDir, `${slug}${YAML_EXTENSION}`)
				yamlModeExists = await fileExistsAtPath(yamlModePath)
			}

			// Find the mode in either file
			const roomodesMode = roomodesModes.find((m) => m.slug === slug)
			const globalMode = settingsModes.find((m) => m.slug === slug)

			if (!roomodesMode && !globalMode && !yamlModeExists) {
				throw new Error("Write error: Mode not found")
			}

			await this.queueWrite(async () => {
				// Delete from .roomodes if it exists there
				if (roomodesMode && roomodesPath) {
					await this.updateModesInFile(roomodesPath, (modes) => modes.filter((m) => m.slug !== slug))
				}

				// Delete from .roo/modes if it exists there
				if (yamlModeExists && yamlModePath) {
					await fs.unlink(yamlModePath)
				}

				// Delete from global settings if it exists there
				if (globalMode) {
					await this.updateModesInFile(settingsPath, (modes) => modes.filter((m) => m.slug !== slug))
				}

				await this.refreshMergedState()
			})
		} catch (error) {
			vscode.window.showErrorMessage(
				`Failed to delete custom mode: ${error instanceof Error ? error.message : String(error)}`,
			)
		}
	}

	private async ensureSettingsDirectoryExists(): Promise<string> {
		const settingsDir = path.join(this.context.globalStorageUri.fsPath, "settings")
		await fs.mkdir(settingsDir, { recursive: true })
		return settingsDir
	}

	async resetCustomModes(): Promise<void> {
		try {
			const filePath = await this.getCustomModesFilePath()
			await fs.writeFile(filePath, JSON.stringify({ customModes: [] }, null, 2))
			await this.context.globalState.update("customModes", [])
			await this.onUpdate()
		} catch (error) {
			vscode.window.showErrorMessage(
				`Failed to reset custom modes: ${error instanceof Error ? error.message : String(error)}`,
			)
		}
	}

	dispose(): void {
		for (const disposable of this.disposables) {
			disposable.dispose()
		}
		this.disposables = []
	}
}
