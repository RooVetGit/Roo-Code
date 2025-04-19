import * as vscode from "vscode"
import * as path from "path"
import * as fs from "fs/promises"
import { customModesSettingsSchema } from "../../schemas"
import { ModeConfig } from "../../shared/modes"
import { fileExistsAtPath, ensureDirectory } from "../../utils/fs"
import { arePathsEqual, getWorkspacePath } from "../../utils/path"
import { logger } from "../../utils/logging"
import { GlobalFileNames, ModeFileLocations } from "../../shared/globalFileNames"
import { readYamlFile, writeYamlFile } from "../../utils/yaml"
import { loadModeFromYaml, loadAllModesFromYaml, saveModeToYaml } from "../../utils/modes"

const ROOMODES_FILENAME = ModeFileLocations.LEGACY_ROOMODES

export class CustomModesManager {
	private disposables: vscode.Disposable[] = []
	private isWriting = false
	private writeQueue: Array<() => Promise<void>> = []

	constructor(
		private readonly context: vscode.ExtensionContext,
		private readonly onUpdate: () => Promise<void>,
	) {
		// TODO: We really shouldn't have async methods in the constructor.
		// First migrate legacy modes to YAML, then watch for changes
		this.migrateToYaml()
			.then(() => {
				this.watchCustomModesFiles()
			})
			.catch((error) => {
				console.error("Failed to migrate modes to YAML:", error)
				// Fall back to standard initialization
				this.watchCustomModesFiles()
			})
	}

	/**
	 * Automatically migrate modes from JSON to YAML format
	 */
	private async migrateToYaml(): Promise<void> {
		// First try to migrate workspace-specific modes
		await this.migrateWorkspaceModes()

		// Then migrate global modes
		await this.migrateGlobalModes()
	}

	/**
	 * Migrate workspace-specific modes from .roomodes to YAML
	 */
	private async migrateWorkspaceModes(): Promise<void> {
		const roomodesPath = await this.getWorkspaceRoomodes()

		// Skip if no .roomodes file exists
		if (!roomodesPath) return

		// Check if we've already migrated (based on a flag in globalState)
		const isMigrated = this.context.globalState.get(`migrated-workspace-${roomodesPath}`, false)
		if (isMigrated) return

		try {
			// Read and parse .roomodes
			const modesJson = await this.loadModesFromFile(roomodesPath)
			if (modesJson.length === 0) return

			// Create .roo/modes directory
			const workspaceRoot = getWorkspacePath()
			const modesDir = path.join(workspaceRoot, ModeFileLocations.MODES_DIRECTORY)
			await ensureDirectory(modesDir)

			let migratedCount = 0

			// Process each mode
			for (const mode of modesJson) {
				// Look for corresponding rules file
				const rulesPath = path.join(workspaceRoot, `.roorules-${mode.slug}`)
				let rules = ""

				if (await fileExistsAtPath(rulesPath)) {
					rules = await fs.readFile(rulesPath, "utf-8")
				}

				// Write YAML file - don't include rules in the YAML file since we're keeping separate rules files
				await saveModeToYaml(mode, this.context.globalStorageUri.fsPath)
				migratedCount++

				// No need to migrate rules since we're keeping them in separate files
			}

			// Set flag to avoid migrating again
			await this.context.globalState.update(`migrated-workspace-${roomodesPath}`, true)

			if (migratedCount > 0) {
				// Notify user (subtle notification)
				vscode.window.showInformationMessage(
					`Successfully migrated ${migratedCount} workspace custom modes to YAML format in .roo/modes/`,
				)
			}
		} catch (error) {
			console.error("Error during workspace mode migration:", error)
			// Don't throw - we'll fall back to legacy formats
		}
	}

	/**
	 * Migrate global modes from JSON settings to YAML
	 */
	private async migrateGlobalModes(): Promise<void> {
		// Check if we've already migrated global modes
		const isMigrated = this.context.globalState.get("migrated-global-modes", false)
		if (isMigrated) return

		try {
			// Get the global JSON modes file
			const settingsPath = await this.getCustomModesFilePath()
			const globalModes = await this.loadModesFromFile(settingsPath)

			if (globalModes.length === 0) return

			// Create global modes directory
			const globalModesDir = path.join(this.context.globalStorageUri.fsPath, "modes")
			await ensureDirectory(globalModesDir)

			let migratedCount = 0

			// Process each mode
			for (const mode of globalModes) {
				// Skip if already in project mode
				if (mode.source === "project") continue

				// Write YAML file
				await saveModeToYaml(mode, this.context.globalStorageUri.fsPath)
				migratedCount++
			}

			// Set flag to avoid migrating again
			await this.context.globalState.update("migrated-global-modes", true)

			if (migratedCount > 0) {
				// Notify user (subtle notification)
				vscode.window.showInformationMessage(
					`Successfully migrated ${migratedCount} global custom modes to YAML format`,
				)
			}
		} catch (error) {
			console.error("Error during global mode migration:", error)
			// Don't throw - we'll fall back to legacy formats
		}
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

					// Get modes from .roomodes if it exists (takes precedence)
					const roomodesPath = await this.getWorkspaceRoomodes()
					const roomodesModes = roomodesPath ? await this.loadModesFromFile(roomodesPath) : []

					// Merge modes from both sources (.roomodes takes precedence)
					const mergedModes = await this.mergeCustomModes(roomodesModes, result.data.customModes)
					await this.context.globalState.update("customModes", mergedModes)
					await this.onUpdate()
				}
			}),
		)

		// Watch .roomodes file if it exists
		const roomodesPath = await this.getWorkspaceRoomodes()
		if (roomodesPath) {
			this.disposables.push(
				vscode.workspace.onDidSaveTextDocument(async (document) => {
					if (arePathsEqual(document.uri.fsPath, roomodesPath)) {
						const settingsModes = await this.loadModesFromFile(settingsPath)
						const roomodesModes = await this.loadModesFromFile(roomodesPath)
						// .roomodes takes precedence
						const mergedModes = await this.mergeCustomModes(roomodesModes, settingsModes)
						await this.context.globalState.update("customModes", mergedModes)
						await this.onUpdate()
					}
				}),
			)
		}
	}

	async getCustomModes(): Promise<ModeConfig[]> {
		// First check for modes in YAML format
		const yamlProjectModes = await loadAllModesFromYaml(true) // Workspace YAML modes
		const yamlGlobalModes = await loadAllModesFromYaml(false, this.context.globalStorageUri.fsPath) // Global YAML modes

		// Then check legacy formats
		const settingsPath = await this.getCustomModesFilePath()
		const settingsModes = await this.loadModesFromFile(settingsPath)

		const roomodesPath = await this.getWorkspaceRoomodes()
		const roomodesModes = roomodesPath ? await this.loadModesFromFile(roomodesPath) : []

		// Create a map to merge modes with correct precedence
		// Order of precedence: YAML project > JSON project > YAML global > JSON global
		const slugsMap = new Map<string, ModeConfig>()

		// Add in reverse order of precedence
		for (const mode of settingsModes) {
			slugsMap.set(mode.slug, { ...mode, source: "global" })
		}

		for (const mode of yamlGlobalModes) {
			slugsMap.set(mode.slug, mode)
		}

		for (const mode of roomodesModes) {
			slugsMap.set(mode.slug, { ...mode, source: "project" })
		}

		for (const mode of yamlProjectModes) {
			slugsMap.set(mode.slug, mode)
		}

		// Convert map back to array
		const mergedModes = Array.from(slugsMap.values())

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
			}

			// Ensure source is set correctly
			const modeWithSource = {
				...config,
				source: isProjectMode ? ("project" as const) : ("global" as const),
			}

			await this.queueWrite(async () => {
				// Save to YAML format
				await saveModeToYaml(modeWithSource, this.context.globalStorageUri.fsPath)

				// Also update the legacy format for backward compatibility
				let targetPath: string

				if (isProjectMode) {
					const workspaceRoot = getWorkspacePath()
					targetPath = path.join(workspaceRoot, ROOMODES_FILENAME)
					logger.info(`Updating ${slug} in both YAML and legacy JSON formats`, {
						slug,
						workspace: workspaceRoot,
					})
				} else {
					targetPath = await this.getCustomModesFilePath()
				}

				await this.updateModesInFile(targetPath, (modes) => {
					const updatedModes = modes.filter((m) => m.slug !== slug)
					updatedModes.push(modeWithSource)
					return updatedModes
				})

				await this.refreshMergedState()
			})
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
		// Get all modes from both formats
		const yamlProjectModes = await loadAllModesFromYaml(true) // Workspace YAML modes
		const yamlGlobalModes = await loadAllModesFromYaml(false, this.context.globalStorageUri.fsPath) // Global YAML modes

		// Legacy JSON formats
		const settingsPath = await this.getCustomModesFilePath()
		const settingsModes = await this.loadModesFromFile(settingsPath)

		const roomodesPath = await this.getWorkspaceRoomodes()
		const roomodesModes = roomodesPath ? await this.loadModesFromFile(roomodesPath) : []

		// Use the same merging logic as in getCustomModes
		const slugsMap = new Map<string, ModeConfig>()

		// Add in reverse order of precedence
		for (const mode of settingsModes) {
			slugsMap.set(mode.slug, { ...mode, source: "global" })
		}

		for (const mode of yamlGlobalModes) {
			slugsMap.set(mode.slug, mode)
		}

		for (const mode of roomodesModes) {
			slugsMap.set(mode.slug, { ...mode, source: "project" })
		}

		for (const mode of yamlProjectModes) {
			slugsMap.set(mode.slug, mode)
		}

		// Convert map back to array
		const mergedModes = Array.from(slugsMap.values())

		await this.context.globalState.update("customModes", mergedModes)
		await this.onUpdate()
	}

	async deleteCustomMode(slug: string): Promise<void> {
		try {
			// Check legacy JSON formats
			const settingsPath = await this.getCustomModesFilePath()
			const roomodesPath = await this.getWorkspaceRoomodes()

			const settingsModes = await this.loadModesFromFile(settingsPath)
			const roomodesModes = roomodesPath ? await this.loadModesFromFile(roomodesPath) : []

			// Find the mode in either JSON file
			const projectMode = roomodesModes.find((m) => m.slug === slug)
			const globalMode = settingsModes.find((m) => m.slug === slug)

			// Also check YAML formats
			const workspaceRoot = getWorkspacePath()
			const projectYamlPath = path.join(workspaceRoot, ModeFileLocations.MODES_DIRECTORY, `${slug}.yaml`)
			const globalYamlPath = path.join(this.context.globalStorageUri.fsPath, "modes", `${slug}.yaml`)

			const projectYamlExists = await fileExistsAtPath(projectYamlPath)
			const globalYamlExists = await fileExistsAtPath(globalYamlPath)

			if (!projectMode && !globalMode && !projectYamlExists && !globalYamlExists) {
				throw new Error("Write error: Mode not found in any format")
			}

			await this.queueWrite(async () => {
				// Delete from YAML formats first
				if (projectYamlExists) {
					await fs.unlink(projectYamlPath)
					logger.info(`Deleted YAML mode file: ${projectYamlPath}`)
				}

				if (globalYamlExists) {
					await fs.unlink(globalYamlPath)
					logger.info(`Deleted YAML mode file: ${globalYamlPath}`)
				}

				// Delete from legacy JSON formats for backward compatibility
				if (projectMode && roomodesPath) {
					await this.updateModesInFile(roomodesPath, (modes) => modes.filter((m) => m.slug !== slug))
				}

				if (globalMode) {
					await this.updateModesInFile(settingsPath, (modes) => modes.filter((m) => m.slug !== slug))
				}

				await this.refreshMergedState()
			})
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error)
			logger.error("Failed to delete custom mode", { slug, error: errorMessage })
			vscode.window.showErrorMessage(`Failed to delete custom mode: ${errorMessage}`)
		}
	}

	private async ensureSettingsDirectoryExists(): Promise<string> {
		const settingsDir = path.join(this.context.globalStorageUri.fsPath, "settings")
		await fs.mkdir(settingsDir, { recursive: true })
		return settingsDir
	}

	async resetCustomModes(): Promise<void> {
		try {
			// Clear legacy JSON format
			const filePath = await this.getCustomModesFilePath()
			await fs.writeFile(filePath, JSON.stringify({ customModes: [] }, null, 2))

			// Clear global YAML modes
			try {
				const globalModesDir = path.join(this.context.globalStorageUri.fsPath, "modes")
				if (await fileExistsAtPath(globalModesDir)) {
					const files = await fs.readdir(globalModesDir)
					for (const file of files) {
						if (file.endsWith(".yaml") || file.endsWith(".yml")) {
							await fs.unlink(path.join(globalModesDir, file))
							logger.info(`Deleted global YAML mode: ${file}`)
						}
					}
				}
			} catch (yamlError) {
				console.error("Error clearing global YAML modes:", yamlError)
			}

			// Clear workspace YAML modes
			try {
				const workspaceRoot = getWorkspacePath()
				const workspaceModesDir = path.join(workspaceRoot, ModeFileLocations.MODES_DIRECTORY)
				if (await fileExistsAtPath(workspaceModesDir)) {
					const files = await fs.readdir(workspaceModesDir)
					for (const file of files) {
						if (file.endsWith(".yaml") || file.endsWith(".yml")) {
							await fs.unlink(path.join(workspaceModesDir, file))
							logger.info(`Deleted workspace YAML mode: ${file}`)
						}
					}
				}
			} catch (yamlError) {
				console.error("Error clearing workspace YAML modes:", yamlError)
			}

			// Update global state
			await this.context.globalState.update("customModes", [])
			await this.onUpdate()
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error)
			logger.error("Failed to reset custom modes", { error: errorMessage })
			vscode.window.showErrorMessage(`Failed to reset custom modes: ${errorMessage}`)
		}
	}

	dispose(): void {
		for (const disposable of this.disposables) {
			disposable.dispose()
		}
		this.disposables = []
	}
}
