import * as vscode from "vscode"
import * as path from "path"
import * as fs from "fs/promises"
import * as os from "os"

import * as yaml from "yaml"
import stripBom from "strip-bom"

import {
	type AgentConfig,
	type ModeConfig,
	type PromptComponent,
	customAgentsSettingsSchema,
	customModesSettingsSchema,
	agentConfigSchema,
	modeConfigSchema,
} from "@roo-code/types"

import { fileExistsAtPath } from "../../utils/fs"
import { getWorkspacePath } from "../../utils/path"
import { getGlobalRooDirectory } from "../../services/roo-config"
import { logger } from "../../utils/logging"
import { GlobalFileNames } from "../../shared/globalFileNames"
import { ensureSettingsDirectoryExists } from "../../utils/globalContext"
import { t } from "../../i18n"

const ROOAGENTS_FILENAME = ".rooagents"
const ROOMODES_FILENAME = ".roomodes" // Backward compatibility

// Type definitions for import/export functionality
interface RuleFile {
	relativePath: string
	content: string
}

interface ExportedAgentConfig extends AgentConfig {
	rulesFiles?: RuleFile[]
}

interface ExportedModeConfig extends ModeConfig {
	rulesFiles?: RuleFile[]
}

interface ImportData {
	customAgents?: ExportedAgentConfig[]
	customModes?: ExportedModeConfig[] // Backward compatibility
}

interface ExportResult {
	success: boolean
	yaml?: string
	error?: string
}

interface ImportResult {
	success: boolean
	error?: string
}

export class CustomAgentsManager {
	private static readonly cacheTTL = 10_000

	private disposables: vscode.Disposable[] = []
	private isWriting = false
	private writeQueue: Array<() => Promise<void>> = []
	private cachedAgents: AgentConfig[] | null = null
	private cachedAt: number = 0

	constructor(
		private readonly context: vscode.ExtensionContext,
		private readonly onUpdate: () => Promise<void>,
	) {
		this.watchCustomAgentsFiles().catch((error) => {
			console.error("[CustomAgentsManager] Failed to setup file watchers:", error)
		})
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

	private async getWorkspaceRooagents(): Promise<string | undefined> {
		const workspaceFolders = vscode.workspace.workspaceFolders

		if (!workspaceFolders || workspaceFolders.length === 0) {
			return undefined
		}

		const workspaceRoot = getWorkspacePath()
		const rooagentsPath = path.join(workspaceRoot, ROOAGENTS_FILENAME)
		const exists = await fileExistsAtPath(rooagentsPath)
		return exists ? rooagentsPath : undefined
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
	 * Regex pattern for problematic characters that need to be cleaned from YAML content
	 * Includes:
	 * - \u00A0: Non-breaking space
	 * - \u200B-\u200D: Zero-width spaces and joiners
	 * - \u2010-\u2015, \u2212: Various dash characters
	 * - \u2018-\u2019: Smart single quotes
	 * - \u201C-\u201D: Smart double quotes
	 */
	private static readonly PROBLEMATIC_CHARS_REGEX =
		// eslint-disable-next-line no-misleading-character-class
		/[\u00A0\u200B\u200C\u200D\u2010\u2011\u2012\u2013\u2014\u2015\u2212\u2018\u2019\u201C\u201D]/g

	/**
	 * Clean invisible and problematic characters from YAML content
	 */
	private cleanInvisibleCharacters(content: string): string {
		// Single pass replacement for all problematic characters
		return content.replace(CustomAgentsManager.PROBLEMATIC_CHARS_REGEX, (match) => {
			switch (match) {
				case "\u00A0": // Non-breaking space
					return " "
				case "\u200B": // Zero-width space
				case "\u200C": // Zero-width non-joiner
				case "\u200D": // Zero-width joiner
					return ""
				case "\u2018": // Left single quotation mark
				case "\u2019": // Right single quotation mark
					return "'"
				case "\u201C": // Left double quotation mark
				case "\u201D": // Right double quotation mark
					return '"'
				default: // Dash characters (U+2010 through U+2015, U+2212)
					return "-"
			}
		})
	}

	/**
	 * Parse YAML content with enhanced error handling and preprocessing
	 */
	private parseYamlSafely(content: string, filePath: string): any {
		// Clean the content
		let cleanedContent = stripBom(content)
		cleanedContent = this.cleanInvisibleCharacters(cleanedContent)

		try {
			const parsed = yaml.parse(cleanedContent)
			// Ensure we never return null or undefined
			return parsed ?? {}
		} catch (yamlError) {
			// For .rooagents and .roomodes files, try JSON as fallback
			if (filePath.endsWith(ROOAGENTS_FILENAME) || filePath.endsWith(ROOMODES_FILENAME)) {
				try {
					// Try parsing the original content as JSON (not the cleaned content)
					return JSON.parse(content)
				} catch (jsonError) {
					// JSON also failed, show the original YAML error
					const errorMsg = yamlError instanceof Error ? yamlError.message : String(yamlError)
					console.error(`[CustomAgentsManager] Failed to parse YAML from ${filePath}:`, errorMsg)

					const lineMatch = errorMsg.match(/at line (\d+)/)
					const line = lineMatch ? lineMatch[1] : "unknown"
					vscode.window.showErrorMessage(t("common:customAgents.errors.yamlParseError", { line }))

					// Return empty object to prevent duplicate error handling
					return {}
				}
			}

			// For non-.rooagents/.roomodes files, just log and return empty object
			const errorMsg = yamlError instanceof Error ? yamlError.message : String(yamlError)
			console.error(`[CustomAgentsManager] Failed to parse YAML from ${filePath}:`, errorMsg)
			return {}
		}
	}

	private async loadAgentsFromFile(filePath: string): Promise<AgentConfig[]> {
		try {
			const content = await fs.readFile(filePath, "utf-8")
			const settings = this.parseYamlSafely(content, filePath)

			// Handle both new .rooagents format and legacy .roomodes format
			let agentsArray: any[] = []
			let validationSchema: any

			if (settings.customAgents) {
				// New .rooagents format
				agentsArray = settings.customAgents
				validationSchema = customAgentsSettingsSchema
			} else if (settings.customModes) {
				// Legacy .roomodes format - treat modes as agents
				agentsArray = settings.customModes
				validationSchema = customModesSettingsSchema
			} else {
				return []
			}

			const result = validationSchema.safeParse(settings)

			if (!result.success) {
				console.error(`[CustomAgentsManager] Schema validation failed for ${filePath}:`, result.error)

				// Show user-friendly error for .rooagents/.roomodes files
				if (filePath.endsWith(ROOAGENTS_FILENAME) || filePath.endsWith(ROOMODES_FILENAME)) {
					const issues = result.error.issues
						.map((issue: any) => `• ${issue.path.join(".")}: ${issue.message}`)
						.join("\n")

					vscode.window.showErrorMessage(t("common:customAgents.errors.schemaValidationError", { issues }))
				}

				return []
			}

			// Determine source based on file path
			const isProjectFile = filePath.endsWith(ROOAGENTS_FILENAME) || filePath.endsWith(ROOMODES_FILENAME)
			const source = isProjectFile ? ("project" as const) : ("global" as const)

			// Add source to each agent
			return agentsArray.map((agent) => ({ ...agent, source }))
		} catch (error) {
			// Only log if the error wasn't already handled in parseYamlSafely
			if (!(error as any).alreadyHandled) {
				const errorMsg = `Failed to load agents from ${filePath}: ${error instanceof Error ? error.message : String(error)}`
				console.error(`[CustomAgentsManager] ${errorMsg}`)
			}
			return []
		}
	}

	private async mergeCustomAgents(projectAgents: AgentConfig[], globalAgents: AgentConfig[]): Promise<AgentConfig[]> {
		const slugs = new Set<string>()
		const merged: AgentConfig[] = []

		// Add project agents (takes precedence)
		for (const agent of projectAgents) {
			if (!slugs.has(agent.slug)) {
				slugs.add(agent.slug)
				merged.push({ ...agent, source: "project" })
			}
		}

		// Add non-duplicate global agents
		for (const agent of globalAgents) {
			if (!slugs.has(agent.slug)) {
				slugs.add(agent.slug)
				merged.push({ ...agent, source: "global" })
			}
		}

		return merged
	}

	public async getCustomAgentsFilePath(): Promise<string> {
		const settingsDir = await ensureSettingsDirectoryExists(this.context)
		const filePath = path.join(settingsDir, GlobalFileNames.customModes) // Keep using customModes for global settings
		const fileExists = await fileExistsAtPath(filePath)

		if (!fileExists) {
			await this.queueWrite(() => fs.writeFile(filePath, yaml.stringify({ customModes: [] }, { lineWidth: 0 })))
		}

		return filePath
	}

	private async watchCustomAgentsFiles(): Promise<void> {
		// Skip if test environment is detected
		if (process.env.NODE_ENV === "test") {
			return
		}

		const settingsPath = await this.getCustomAgentsFilePath()

		// Watch settings file
		const settingsWatcher = vscode.workspace.createFileSystemWatcher(settingsPath)

		const handleSettingsChange = async () => {
			try {
				// Ensure that the settings file exists (especially important for delete events)
				await this.getCustomAgentsFilePath()
				const content = await fs.readFile(settingsPath, "utf-8")

				const errorMessage = t("common:customAgents.errors.invalidFormat")

				let config: any

				try {
					config = this.parseYamlSafely(content, settingsPath)
				} catch (error) {
					console.error(error)
					vscode.window.showErrorMessage(errorMessage)
					return
				}

				const result = customModesSettingsSchema.safeParse(config) // Use legacy schema for global settings

				if (!result.success) {
					vscode.window.showErrorMessage(errorMessage)
					return
				}

				// Get agents from .rooagents or .roomodes if they exist (takes precedence)
				const rooagentsPath = await this.getWorkspaceRooagents()
				const roomodesPath = await this.getWorkspaceRoomodes()

				let projectAgents: AgentConfig[] = []
				if (rooagentsPath) {
					projectAgents = await this.loadAgentsFromFile(rooagentsPath)
				} else if (roomodesPath) {
					projectAgents = await this.loadAgentsFromFile(roomodesPath)
				}

				// Merge agents from both sources (project takes precedence)
				const mergedAgents = await this.mergeCustomAgents(projectAgents, result.data.customModes)
				await this.context.globalState.update("customModes", mergedAgents) // Keep using customModes key for backward compatibility
				this.clearCache()
				await this.onUpdate()
			} catch (error) {
				console.error(`[CustomAgentsManager] Error handling settings file change:`, error)
			}
		}

		this.disposables.push(settingsWatcher.onDidChange(handleSettingsChange))
		this.disposables.push(settingsWatcher.onDidCreate(handleSettingsChange))
		this.disposables.push(settingsWatcher.onDidDelete(handleSettingsChange))
		this.disposables.push(settingsWatcher)

		// Watch .rooagents and .roomodes files - watch the paths even if they don't exist yet
		const workspaceFolders = vscode.workspace.workspaceFolders
		if (workspaceFolders && workspaceFolders.length > 0) {
			const workspaceRoot = getWorkspacePath()
			const rooagentsPath = path.join(workspaceRoot, ROOAGENTS_FILENAME)
			const roomodesPath = path.join(workspaceRoot, ROOMODES_FILENAME)

			// Watch .rooagents file
			const rooagentsWatcher = vscode.workspace.createFileSystemWatcher(rooagentsPath)
			// Watch .roomodes file for backward compatibility
			const roomodesWatcher = vscode.workspace.createFileSystemWatcher(roomodesPath)

			const handleProjectFileChange = async () => {
				try {
					const settingsAgents = await this.loadAgentsFromFile(settingsPath)

					// Check .rooagents first, then .roomodes for backward compatibility
					let projectAgents: AgentConfig[] = []
					const rooagentsExists = await fileExistsAtPath(rooagentsPath)
					const roomodesExists = await fileExistsAtPath(roomodesPath)

					if (rooagentsExists) {
						projectAgents = await this.loadAgentsFromFile(rooagentsPath)
					} else if (roomodesExists) {
						projectAgents = await this.loadAgentsFromFile(roomodesPath)
					}

					// Project agents take precedence
					const mergedAgents = await this.mergeCustomAgents(projectAgents, settingsAgents)
					await this.context.globalState.update("customModes", mergedAgents) // Keep using customModes key
					this.clearCache()
					await this.onUpdate()
				} catch (error) {
					console.error(`[CustomAgentsManager] Error handling project file change:`, error)
				}
			}

			const handleProjectFileDelete = async () => {
				// When project files are deleted, refresh with only settings agents
				try {
					const settingsAgents = await this.loadAgentsFromFile(settingsPath)
					await this.context.globalState.update("customModes", settingsAgents)
					this.clearCache()
					await this.onUpdate()
				} catch (error) {
					console.error(`[CustomAgentsManager] Error handling project file deletion:`, error)
				}
			}

			// Set up watchers for both .rooagents and .roomodes
			this.disposables.push(rooagentsWatcher.onDidChange(handleProjectFileChange))
			this.disposables.push(rooagentsWatcher.onDidCreate(handleProjectFileChange))
			this.disposables.push(rooagentsWatcher.onDidDelete(handleProjectFileDelete))
			this.disposables.push(rooagentsWatcher)

			this.disposables.push(roomodesWatcher.onDidChange(handleProjectFileChange))
			this.disposables.push(roomodesWatcher.onDidCreate(handleProjectFileChange))
			this.disposables.push(roomodesWatcher.onDidDelete(handleProjectFileDelete))
			this.disposables.push(roomodesWatcher)
		}
	}

	public async getCustomAgents(): Promise<AgentConfig[]> {
		// Check if we have a valid cached result.
		const now = Date.now()

		if (this.cachedAgents && now - this.cachedAt < CustomAgentsManager.cacheTTL) {
			return this.cachedAgents
		}

		// Get agents from settings file.
		const settingsPath = await this.getCustomAgentsFilePath()
		const settingsAgents = await this.loadAgentsFromFile(settingsPath)

		// Get agents from .rooagents if it exists, otherwise check .roomodes for backward compatibility
		const rooagentsPath = await this.getWorkspaceRooagents()
		const roomodesPath = await this.getWorkspaceRoomodes()

		let projectAgents: AgentConfig[] = []
		if (rooagentsPath) {
			projectAgents = await this.loadAgentsFromFile(rooagentsPath)
		} else if (roomodesPath) {
			projectAgents = await this.loadAgentsFromFile(roomodesPath)
		}

		// Create maps to store agents by source.
		const projectAgentMap = new Map<string, AgentConfig>()
		const globalAgentMap = new Map<string, AgentConfig>()

		// Add project agents (they take precedence).
		for (const agent of projectAgents) {
			projectAgentMap.set(agent.slug, { ...agent, source: "project" as const })
		}

		// Add global agents.
		for (const agent of settingsAgents) {
			if (!projectAgentMap.has(agent.slug)) {
				globalAgentMap.set(agent.slug, { ...agent, source: "global" as const })
			}
		}

		// Combine agents in the correct order: project agents first, then global agents.
		const mergedAgents = [
			...projectAgents.map((agent) => ({ ...agent, source: "project" as const })),
			...settingsAgents
				.filter((agent) => !projectAgentMap.has(agent.slug))
				.map((agent) => ({ ...agent, source: "global" as const })),
		]

		await this.context.globalState.update("customModes", mergedAgents) // Keep using customModes key

		this.cachedAgents = mergedAgents
		this.cachedAt = now

		return mergedAgents
	}

	// Backward compatibility methods
	public async getCustomModes(): Promise<ModeConfig[]> {
		return this.getCustomAgents()
	}

	public async getCustomModesFilePath(): Promise<string> {
		return this.getCustomAgentsFilePath()
	}

	public async updateCustomAgent(slug: string, config: AgentConfig): Promise<void> {
		try {
			// Validate the agent configuration before saving
			const validationResult = agentConfigSchema.safeParse(config)
			if (!validationResult.success) {
				const errors = validationResult.error.errors.map((e) => e.message).join(", ")
				logger.error(`Invalid agent configuration for ${slug}`, { errors: validationResult.error.errors })
				throw new Error(`Invalid agent configuration: ${errors}`)
			}

			const isProjectAgent = config.source === "project"
			let targetPath: string

			if (isProjectAgent) {
				const workspaceFolders = vscode.workspace.workspaceFolders

				if (!workspaceFolders || workspaceFolders.length === 0) {
					logger.error("Failed to update project agent: No workspace folder found", { slug })
					throw new Error(t("common:customAgents.errors.noWorkspaceForProject"))
				}

				const workspaceRoot = getWorkspacePath()

				// Prefer .rooagents, but check if .roomodes exists for backward compatibility
				const rooagentsPath = path.join(workspaceRoot, ROOAGENTS_FILENAME)
				const roomodesPath = path.join(workspaceRoot, ROOMODES_FILENAME)
				const rooagentsExists = await fileExistsAtPath(rooagentsPath)
				const roomodesExists = await fileExistsAtPath(roomodesPath)

				if (rooagentsExists || !roomodesExists) {
					// Use .rooagents (either it exists or neither exists, so create .rooagents)
					targetPath = rooagentsPath
				} else {
					// Use existing .roomodes for backward compatibility
					targetPath = roomodesPath
				}

				logger.info(
					`${(await fileExistsAtPath(targetPath)) ? "Updating" : "Creating"} project agent in ${path.basename(targetPath)}`,
					{
						slug,
						workspace: workspaceRoot,
					},
				)
			} else {
				targetPath = await this.getCustomAgentsFilePath()
			}

			await this.queueWrite(async () => {
				// Ensure source is set correctly based on target file.
				const agentWithSource = {
					...config,
					source: isProjectAgent ? ("project" as const) : ("global" as const),
				}

				await this.updateAgentsInFile(targetPath, (agents) => {
					const updatedAgents = agents.filter((a) => a.slug !== slug)
					updatedAgents.push(agentWithSource)
					return updatedAgents
				})

				this.clearCache()
				await this.refreshMergedState()
			})
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error)
			logger.error("Failed to update custom agent", { slug, error: errorMessage })
			vscode.window.showErrorMessage(t("common:customAgents.errors.updateFailed", { error: errorMessage }))
		}
	}

	// Backward compatibility method
	public async updateCustomMode(slug: string, config: ModeConfig): Promise<void> {
		return this.updateCustomAgent(slug, config)
	}

	private async updateAgentsInFile(
		filePath: string,
		operation: (agents: AgentConfig[]) => AgentConfig[],
	): Promise<void> {
		let content = "{}"

		try {
			content = await fs.readFile(filePath, "utf-8")
		} catch (error) {
			// File might not exist yet.
			const isRooagents = filePath.endsWith(ROOAGENTS_FILENAME)
			if (isRooagents) {
				content = yaml.stringify({ customAgents: [] }, { lineWidth: 0 })
			} else {
				content = yaml.stringify({ customModes: [] }, { lineWidth: 0 })
			}
		}

		let settings

		try {
			settings = this.parseYamlSafely(content, filePath)
		} catch (error) {
			// Error already logged in parseYamlSafely
			const isRooagents = filePath.endsWith(ROOAGENTS_FILENAME)
			if (isRooagents) {
				settings = { customAgents: [] }
			} else {
				settings = { customModes: [] }
			}
		}

		// Ensure settings is an object and has the appropriate property
		if (!settings || typeof settings !== "object") {
			const isRooagents = filePath.endsWith(ROOAGENTS_FILENAME)
			if (isRooagents) {
				settings = { customAgents: [] }
			} else {
				settings = { customModes: [] }
			}
		}

		const isRooagents = filePath.endsWith(ROOAGENTS_FILENAME)
		if (isRooagents) {
			if (!settings.customAgents) {
				settings.customAgents = []
			}
			settings.customAgents = operation(settings.customAgents)
		} else {
			if (!settings.customModes) {
				settings.customModes = []
			}
			settings.customModes = operation(settings.customModes)
		}

		await fs.writeFile(filePath, yaml.stringify(settings, { lineWidth: 0 }), "utf-8")
	}

	private async refreshMergedState(): Promise<void> {
		const settingsPath = await this.getCustomAgentsFilePath()
		const rooagentsPath = await this.getWorkspaceRooagents()
		const roomodesPath = await this.getWorkspaceRoomodes()

		const settingsAgents = await this.loadAgentsFromFile(settingsPath)

		let projectAgents: AgentConfig[] = []
		if (rooagentsPath) {
			projectAgents = await this.loadAgentsFromFile(rooagentsPath)
		} else if (roomodesPath) {
			projectAgents = await this.loadAgentsFromFile(roomodesPath)
		}

		const mergedAgents = await this.mergeCustomAgents(projectAgents, settingsAgents)

		await this.context.globalState.update("customModes", mergedAgents) // Keep using customModes key

		this.clearCache()

		await this.onUpdate()
	}

	public async deleteCustomAgent(slug: string, fromMarketplace = false): Promise<void> {
		try {
			const settingsPath = await this.getCustomAgentsFilePath()
			const rooagentsPath = await this.getWorkspaceRooagents()
			const roomodesPath = await this.getWorkspaceRoomodes()

			const settingsAgents = await this.loadAgentsFromFile(settingsPath)

			let projectAgents: AgentConfig[] = []
			let projectFilePath: string | undefined
			if (rooagentsPath) {
				projectAgents = await this.loadAgentsFromFile(rooagentsPath)
				projectFilePath = rooagentsPath
			} else if (roomodesPath) {
				projectAgents = await this.loadAgentsFromFile(roomodesPath)
				projectFilePath = roomodesPath
			}

			// Find the agent in either file
			const projectAgent = projectAgents.find((a) => a.slug === slug)
			const globalAgent = settingsAgents.find((a) => a.slug === slug)

			if (!projectAgent && !globalAgent) {
				throw new Error(t("common:customAgents.errors.agentNotFound"))
			}

			// Determine which agent to use for rules folder path calculation
			const agentToDelete = projectAgent || globalAgent

			await this.queueWrite(async () => {
				// Delete from project first if it exists there
				if (projectAgent && projectFilePath) {
					await this.updateAgentsInFile(projectFilePath, (agents) => agents.filter((a) => a.slug !== slug))
				}

				// Delete from global settings if it exists there
				if (globalAgent) {
					await this.updateAgentsInFile(settingsPath, (agents) => agents.filter((a) => a.slug !== slug))
				}

				// Delete associated rules folder
				if (agentToDelete) {
					await this.deleteRulesFolder(slug, agentToDelete, fromMarketplace)
				}

				// Clear cache when agents are deleted
				this.clearCache()
				await this.refreshMergedState()
			})
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error)
			vscode.window.showErrorMessage(t("common:customAgents.errors.deleteFailed", { error: errorMessage }))
		}
	}

	// Backward compatibility method
	public async deleteCustomMode(slug: string, fromMarketplace = false): Promise<void> {
		return this.deleteCustomAgent(slug, fromMarketplace)
	}

	/**
	 * Deletes the rules folder for a specific agent
	 * @param slug - The agent slug
	 * @param agent - The agent configuration to determine the scope
	 */
	private async deleteRulesFolder(slug: string, agent: AgentConfig, fromMarketplace = false): Promise<void> {
		try {
			// Determine the scope based on source (project or global)
			const scope = agent.source || "global"

			// Determine the rules folder path
			let rulesFolderPath: string
			if (scope === "project") {
				const workspacePath = getWorkspacePath()
				if (workspacePath) {
					rulesFolderPath = path.join(workspacePath, ".roo", `rules-${slug}`)
				} else {
					return // No workspace, can't delete project rules
				}
			} else {
				// Global scope - use OS home directory
				const homeDir = os.homedir()
				rulesFolderPath = path.join(homeDir, ".roo", `rules-${slug}`)
			}

			// Check if the rules folder exists and delete it
			const rulesFolderExists = await fileExistsAtPath(rulesFolderPath)
			if (rulesFolderExists) {
				try {
					await fs.rm(rulesFolderPath, { recursive: true, force: true })
					logger.info(`Deleted rules folder for agent ${slug}: ${rulesFolderPath}`)
				} catch (error) {
					logger.error(`Failed to delete rules folder for agent ${slug}: ${error}`)
					// Notify the user about the failure
					const messageKey = fromMarketplace
						? "common:marketplace.agent.rulesCleanupFailed"
						: "common:customAgents.errors.rulesCleanupFailed"
					vscode.window.showWarningMessage(t(messageKey, { rulesFolderPath }))
					// Continue even if folder deletion fails
				}
			}
		} catch (error) {
			logger.error(`Error deleting rules folder for agent ${slug}`, {
				error: error instanceof Error ? error.message : String(error),
			})
		}
	}

	public async resetCustomAgents(): Promise<void> {
		try {
			const filePath = await this.getCustomAgentsFilePath()
			await fs.writeFile(filePath, yaml.stringify({ customModes: [] }, { lineWidth: 0 })) // Keep using customModes for global
			await this.context.globalState.update("customModes", [])
			this.clearCache()
			await this.onUpdate()
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error)
			vscode.window.showErrorMessage(t("common:customAgents.errors.resetFailed", { error: errorMessage }))
		}
	}

	// Backward compatibility method
	public async resetCustomModes(): Promise<void> {
		return this.resetCustomAgents()
	}

	/**
	 * Checks if an agent has associated rules files in the .roo/rules-{slug}/ directory
	 * @param slug - The agent identifier to check
	 * @returns True if the agent has rules files with content, false otherwise
	 */
	/**
	 * Checks if an agent has associated rules files in the .roo/rules-{slug}/ directory
	 * @param slug - The agent identifier to check
	 * @returns True if the agent has rules files with content, false otherwise
	 */
	public async checkRulesDirectoryHasContent(slug: string): Promise<boolean> {
		try {
			// First, find the agent to determine its source
			const allAgents = await this.getCustomAgents()
			const agent = allAgents.find((a) => a.slug === slug)

			if (!agent) {
				// If not in custom agents, check if it's in .rooagents or .roomodes (project-specific)
				const workspacePath = getWorkspacePath()
				if (!workspacePath) {
					return false
				}

				const rooagentsPath = path.join(workspacePath, ROOAGENTS_FILENAME)
				const roomodesPath = path.join(workspacePath, ROOMODES_FILENAME)

				try {
					let foundInProjectFile = false

					// Check .rooagents first
					const rooagentsExists = await fileExistsAtPath(rooagentsPath)
					if (rooagentsExists) {
						const rooagentsContent = await fs.readFile(rooagentsPath, "utf-8")
						const rooagentsData = yaml.parse(rooagentsContent)
						const rooagentsAgents = rooagentsData?.customAgents || []
						foundInProjectFile = rooagentsAgents.find((a: any) => a.slug === slug)
					}

					// Check .roomodes for backward compatibility if not found in .rooagents
					if (!foundInProjectFile) {
						const roomodesExists = await fileExistsAtPath(roomodesPath)
						if (roomodesExists) {
							const roomodesContent = await fs.readFile(roomodesPath, "utf-8")
							const roomodesData = yaml.parse(roomodesContent)
							const roomodesModes = roomodesData?.customModes || []
							foundInProjectFile = roomodesModes.find((m: any) => m.slug === slug)
						}
					}

					if (!foundInProjectFile) {
						return false // Agent not found anywhere
					}
				} catch (error) {
					return false // Cannot read project files and not in custom agents
				}
			}

			// Determine the correct rules directory based on agent source
			let agentRulesDir: string
			const isGlobalAgent = agent?.source === "global"

			if (isGlobalAgent) {
				// For global agents, check in global .roo directory
				const globalRooDir = getGlobalRooDirectory()
				agentRulesDir = path.join(globalRooDir, `rules-${slug}`)
			} else {
				// For project agents, check in workspace .roo directory
				const workspacePath = getWorkspacePath()
				if (!workspacePath) {
					return false
				}
				agentRulesDir = path.join(workspacePath, ".roo", `rules-${slug}`)
			}

			try {
				const stats = await fs.stat(agentRulesDir)
				if (!stats.isDirectory()) {
					return false
				}
			} catch (error) {
				return false
			}

			// Check if directory has any content files
			try {
				const entries = await fs.readdir(agentRulesDir, { withFileTypes: true })

				for (const entry of entries) {
					if (entry.isFile()) {
						// Use path.join with agentRulesDir and entry.name for compatibility
						const filePath = path.join(agentRulesDir, entry.name)
						const content = await fs.readFile(filePath, "utf-8")
						if (content.trim()) {
							return true // Found at least one file with content
						}
					}
				}

				return false // No files with content found
			} catch (error) {
				return false
			}
		} catch (error) {
			logger.error("Failed to check rules directory for agent", {
				slug,
				error: error instanceof Error ? error.message : String(error),
			})
			return false
		}
	}

	/**
	 * Exports an agent configuration with its associated rules files into a shareable YAML format
	 * @param slug - The agent identifier to export
	 * @param customPrompts - Optional custom prompts to merge into the export
	 * @returns Success status with YAML content or error message
	 */
	public async exportAgentWithRules(slug: string, customPrompts?: PromptComponent): Promise<ExportResult> {
		try {
			// Import agents from shared to check built-in agents
			const { agents: builtInAgents } = await import("../../shared/modes")

			// Get all current agents
			const allAgents = await this.getCustomAgents()
			let agent = allAgents.find((a) => a.slug === slug)

			// If agent not found in custom agents, check if it's a built-in agent that has been customized
			if (!agent) {
				// Only check workspace-based agents if workspace is available
				const workspacePath = getWorkspacePath()
				if (workspacePath) {
					const rooagentsPath = path.join(workspacePath, ROOAGENTS_FILENAME)
					const roomodesPath = path.join(workspacePath, ROOMODES_FILENAME)

					try {
						// Check .rooagents first
						const rooagentsExists = await fileExistsAtPath(rooagentsPath)
						if (rooagentsExists) {
							const rooagentsContent = await fs.readFile(rooagentsPath, "utf-8")
							const rooagentsData = yaml.parse(rooagentsContent)
							const rooagentsAgents = rooagentsData?.customAgents || []
							agent = rooagentsAgents.find((a: any) => a.slug === slug)
						}

						// Check .roomodes for backward compatibility if not found
						if (!agent) {
							const roomodesExists = await fileExistsAtPath(roomodesPath)
							if (roomodesExists) {
								const roomodesContent = await fs.readFile(roomodesPath, "utf-8")
								const roomodesData = yaml.parse(roomodesContent)
								const roomodesModes = roomodesData?.customModes || []
								agent = roomodesModes.find((m: any) => m.slug === slug)
							}
						}
					} catch (error) {
						// Continue to check built-in agents
					}
				}

				// If still not found, check if it's a built-in agent
				if (!agent) {
					const builtInAgent = builtInAgents.find((a) => a.slug === slug)
					if (builtInAgent) {
						// Use the built-in agent as the base
						agent = { ...builtInAgent }
					} else {
						return { success: false, error: "Agent not found" }
					}
				}
			}

			// Determine the base directory based on agent source
			const isGlobalAgent = agent.source === "global"
			let baseDir: string
			if (isGlobalAgent) {
				// For global agents, use the global .roo directory
				baseDir = getGlobalRooDirectory()
			} else {
				// For project agents, use the workspace directory
				const workspacePath = getWorkspacePath()
				if (!workspacePath) {
					return { success: false, error: "No workspace found" }
				}
				baseDir = workspacePath
			}

			// Check for .roo/rules-{slug}/ directory (or rules-{slug}/ for global)
			const agentRulesDir = isGlobalAgent
				? path.join(baseDir, `rules-${slug}`)
				: path.join(baseDir, ".roo", `rules-${slug}`)

			let rulesFiles: RuleFile[] = []
			try {
				const stats = await fs.stat(agentRulesDir)
				if (stats.isDirectory()) {
					// Extract content specific to this agent by looking for the agent-specific rules
					const entries = await fs.readdir(agentRulesDir, { withFileTypes: true })

					for (const entry of entries) {
						if (entry.isFile()) {
							// Use path.join with agentRulesDir and entry.name for compatibility
							const filePath = path.join(agentRulesDir, entry.name)
							const content = await fs.readFile(filePath, "utf-8")
							if (content.trim()) {
								// Calculate relative path based on agent source
								const relativePath = isGlobalAgent
									? path.relative(baseDir, filePath)
									: path.relative(path.join(baseDir, ".roo"), filePath)
								// Normalize path to use forward slashes for cross-platform compatibility
								const normalizedRelativePath = relativePath.replace(/\\/g, "/")
								rulesFiles.push({ relativePath: normalizedRelativePath, content: content.trim() })
							}
						}
					}
				}
			} catch (error) {
				// Directory doesn't exist, which is fine - agent might not have rules
			}

			// Create an export agent with rules files preserved
			const exportAgent: ExportedAgentConfig = {
				...agent,
				// Remove source property for export
				source: "project" as const,
			}

			// Merge custom prompts if provided
			if (customPrompts) {
				if (customPrompts.roleDefinition) exportAgent.roleDefinition = customPrompts.roleDefinition
				if (customPrompts.description) exportAgent.description = customPrompts.description
				if (customPrompts.whenToUse) exportAgent.whenToUse = customPrompts.whenToUse
				if (customPrompts.customInstructions) exportAgent.customInstructions = customPrompts.customInstructions
			}

			// Add rules files if any exist
			if (rulesFiles.length > 0) {
				exportAgent.rulesFiles = rulesFiles
			}

			// Generate YAML
			const exportData = {
				customAgents: [exportAgent],
			}

			const yamlContent = yaml.stringify(exportData)

			return { success: true, yaml: yamlContent }
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error)
			logger.error("Failed to export agent with rules", { slug, error: errorMessage })
			return { success: false, error: errorMessage }
		}
	}

	// Backward compatibility method
	public async exportModeWithRules(slug: string, customPrompts?: PromptComponent): Promise<ExportResult> {
		return this.exportAgentWithRules(slug, customPrompts)
	}

	/**
	 * Helper method to import rules files for an agent
	 * @param importAgent - The agent being imported
	 * @param rulesFiles - The rules files to import
	 * @param source - The import source ("global" or "project")
	 */
	private async importRulesFiles(
		importAgent: ExportedAgentConfig,
		rulesFiles: RuleFile[],
		source: "global" | "project",
	): Promise<void> {
		// Determine base directory and rules folder path based on source
		let baseDir: string
		let rulesFolderPath: string

		if (source === "global") {
			baseDir = getGlobalRooDirectory()
			rulesFolderPath = path.join(baseDir, `rules-${importAgent.slug}`)
		} else {
			const workspacePath = getWorkspacePath()
			baseDir = path.join(workspacePath, ".roo")
			rulesFolderPath = path.join(baseDir, `rules-${importAgent.slug}`)
		}

		// Always remove the existing rules folder for this agent if it exists
		// This ensures that if the imported agent has no rules, the folder is cleaned up
		try {
			await fs.rm(rulesFolderPath, { recursive: true, force: true })
			logger.info(`Removed existing ${source} rules folder for agent ${importAgent.slug}`)
		} catch (error) {
			// It's okay if the folder doesn't exist
			logger.debug(`No existing ${source} rules folder to remove for agent ${importAgent.slug}`)
		}

		// Only proceed with file creation if there are rules files to import
		if (!rulesFiles || !Array.isArray(rulesFiles) || rulesFiles.length === 0) {
			return
		}

		// Import the new rules files with path validation
		for (const ruleFile of rulesFiles) {
			if (ruleFile.relativePath && ruleFile.content) {
				// Validate the relative path to prevent path traversal attacks
				const normalizedRelativePath = path.normalize(ruleFile.relativePath)

				// Ensure the path doesn't contain traversal sequences
				if (normalizedRelativePath.includes("..") || path.isAbsolute(normalizedRelativePath)) {
					logger.error(`Invalid file path detected: ${ruleFile.relativePath}`)
					continue // Skip this file but continue with others
				}

				const targetPath = path.join(baseDir, normalizedRelativePath)
				const normalizedTargetPath = path.normalize(targetPath)
				const expectedBasePath = path.normalize(baseDir)

				// Ensure the resolved path stays within the base directory
				if (!normalizedTargetPath.startsWith(expectedBasePath)) {
					logger.error(`Path traversal attempt detected: ${ruleFile.relativePath}`)
					continue // Skip this file but continue with others
				}

				// Ensure directory exists
				const targetDir = path.dirname(targetPath)
				await fs.mkdir(targetDir, { recursive: true })

				// Write the file
				await fs.writeFile(targetPath, ruleFile.content, "utf-8")
			}
		}
	}

	/**
	 * Imports agents from YAML content, including their associated rules files
	 * @param yamlContent - The YAML content containing agent configurations
	 * @param source - Target level for import: "global" (all projects) or "project" (current workspace only)
	 * @returns Success status with optional error message
	 */
	public async importAgentWithRules(
		yamlContent: string,
		source: "global" | "project" = "project",
	): Promise<ImportResult> {
		try {
			// Parse the YAML content with proper type validation
			let importData: ImportData
			try {
				const parsed = yaml.parse(yamlContent)

				// Handle both new format (customAgents) and legacy format (customModes)
				if (parsed?.customAgents && Array.isArray(parsed.customAgents) && parsed.customAgents.length > 0) {
					importData = { customAgents: parsed.customAgents }
				} else if (parsed?.customModes && Array.isArray(parsed.customModes) && parsed.customModes.length > 0) {
					// Convert legacy customModes to customAgents
					importData = { customAgents: parsed.customModes }
				} else {
					return {
						success: false,
						error: "Invalid import format: Expected 'customAgents' or 'customModes' array in YAML",
					}
				}
			} catch (parseError) {
				return {
					success: false,
					error: `Invalid YAML format: ${parseError instanceof Error ? parseError.message : "Failed to parse YAML"}`,
				}
			}

			// Check workspace availability early if importing at project level
			if (source === "project") {
				const workspacePath = getWorkspacePath()
				if (!workspacePath) {
					return { success: false, error: "No workspace found" }
				}
			}

			// Process each agent in the import
			for (const importAgent of importData.customAgents!) {
				const { rulesFiles, ...agentConfig } = importAgent

				// Validate the agent configuration
				const validationResult = agentConfigSchema.safeParse(agentConfig)
				if (!validationResult.success) {
					logger.error(`Invalid agent configuration for ${agentConfig.slug}`, {
						errors: validationResult.error.errors,
					})
					return {
						success: false,
						error: `Invalid agent configuration for ${agentConfig.slug}: ${validationResult.error.errors.map((e) => e.message).join(", ")}`,
					}
				}

				// Check for existing agent conflicts
				const existingAgents = await this.getCustomAgents()
				const existingAgent = existingAgents.find((a) => a.slug === importAgent.slug)
				if (existingAgent) {
					logger.info(`Overwriting existing agent: ${importAgent.slug}`)
				}

				// Import the agent configuration with the specified source
				await this.updateCustomAgent(importAgent.slug, {
					...agentConfig,
					source: source, // Use the provided source parameter
				})

				// Import rules files (this also handles cleanup of existing rules folders)
				await this.importRulesFiles(importAgent, rulesFiles || [], source)
			}

			// Refresh the agents after import
			await this.refreshMergedState()

			return { success: true }
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error)
			logger.error("Failed to import agent with rules", { error: errorMessage })
			return { success: false, error: errorMessage }
		}
	}

	// Backward compatibility method
	public async importModeWithRules(
		yamlContent: string,
		source: "global" | "project" = "project",
	): Promise<ImportResult> {
		return this.importAgentWithRules(yamlContent, source)
	}

	private clearCache(): void {
		this.cachedAgents = null
		this.cachedAt = 0
	}

	// Additional backward compatibility properties and methods to match CustomModesManager interface
	get cachedModes(): AgentConfig[] {
		return this.cachedAgents || []
	}

	async loadModesFromFile(): Promise<AgentConfig[]> {
		const settingsPath = await this.getCustomAgentsFilePath()
		return this.loadAgentsFromFile(settingsPath)
	}

	async mergeCustomModes(newModes: AgentConfig[]): Promise<void> {
		// This method updates the global state with merged modes
		const settingsPath = await this.getCustomAgentsFilePath()
		const settingsAgents = await this.loadAgentsFromFile(settingsPath)
		const mergedAgents = await this.mergeCustomAgents(newModes, settingsAgents)
		await this.context.globalState.update("customModes", mergedAgents)
		this.clearCache()
		await this.onUpdate()
	}

	watchCustomModesFiles(): void {
		// This method is already called in constructor, so just return
		return
	}

	async updateModesInFile(modes: AgentConfig[]): Promise<void> {
		const settingsPath = await this.getCustomAgentsFilePath()
		await this.queueWrite(async () => {
			await this.updateAgentsInFile(settingsPath, () => modes)
			this.clearCache()
			await this.refreshMergedState()
		})
	}

	dispose(): void {
		for (const disposable of this.disposables) {
			disposable.dispose()
		}

		this.disposables = []
	}
}
