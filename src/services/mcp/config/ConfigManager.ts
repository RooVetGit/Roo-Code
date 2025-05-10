import * as fs from "fs/promises"
import * as path from "path"
import * as vscode from "vscode"
import * as chokidar from "chokidar"
import { z } from "zod"
import { t } from "../../../i18n"
import { ClineProvider } from "../../../core/webview/ClineProvider"
import { GlobalFileNames } from "../../../shared/globalFileNames"
import { fileExistsAtPath } from "../../../utils/fs"
import { ServerConfig } from "../types"
import { ConfigChangeEvent, ConfigChangeListener } from "./types"
import { safeParseServerConfig } from "./validation"
import { ConfigSource, McpServer } from "../../../shared/mcp"

/**
 * Configuration Manager
 * Responsible for managing global and project-level MCP configurations
 */
export class ConfigManager {
	/** Configuration file watchers */
	private watchers: Record<ConfigSource, chokidar.FSWatcher | null> = {
		global: null,
		project: null,
	}

	/** Configuration change listeners */
	private listeners: ConfigChangeListener[] = []

	/** Configuration file path cache */
	private configPaths: Partial<Record<ConfigSource, string>> = {}

	// Validation schema for MCP settings
	private readonly McpSettingsSchema = z.object({
		mcpServers: z.record(z.any()),
	})

	/**
	 * Get global configuration file path
	 */
	async getGlobalConfigPath(provider: ClineProvider): Promise<string> {
		if (this.configPaths.global) {
			return this.configPaths.global
		}
		const mcpSettingsFilePath = path.join(
			await provider.ensureSettingsDirectoryExists(),
			GlobalFileNames.mcpSettings,
		)
		await this.ensureConfigFile(mcpSettingsFilePath)
		this.configPaths.global = mcpSettingsFilePath
		return mcpSettingsFilePath
	}

	/**
	 * Get project configuration file path
	 */
	async getProjectConfigPath(): Promise<string | null> {
		if (this.configPaths.project) {
			return this.configPaths.project
		}
		const workspaceFolders = vscode.workspace.workspaceFolders
		if (!workspaceFolders || workspaceFolders.length === 0) {
			throw new Error(t("common:errors.no_workspace"))
		}
		const workspaceFolder = workspaceFolders[0]
		const projectMcpDir = path.join(workspaceFolder.uri.fsPath, ".roo")
		const projectMcpPath = path.join(projectMcpDir, "mcp.json")
		try {
			await fs.mkdir(projectMcpDir, { recursive: true })
			await this.ensureConfigFile(projectMcpPath)
			this.configPaths.project = projectMcpPath
			return projectMcpPath
		} catch (error) {
			throw new Error(
				t("common:errors.failed_initialize_project_mcp", {
					error: error instanceof Error ? error.message : `${error}`,
				}),
			)
		}
	}

	/**
	 * Determine the configuration source based on the config path
	 * @param configPath Path to the configuration file
	 * @returns Configuration source (global or project)
	 */
	private getConfigSource(configPath: string): ConfigSource {
		return this.configPaths.project && configPath === this.configPaths.project ? "project" : "global"
	}

	/**
	 * Show error message to user
	 * @param message Error message prefix
	 * @param error Error object
	 */
	private showErrorMessage(message: string, error: unknown): never {
		console.error(`${message}:`, error)
		if (vscode.window && typeof vscode.window.showErrorMessage === "function") {
			vscode.window.showErrorMessage(message)
		}
		throw error
	}

	private async ensureConfigFile(filePath: string, initialContent = { mcpServers: {} }): Promise<void> {
		try {
			const exists = await fileExistsAtPath(filePath)
			if (!exists) {
				await fs.writeFile(filePath, JSON.stringify(initialContent, null, 2))
			}
		} catch (error) {
			throw new Error(
				t("common:errors.create_mcp_json", { error: error instanceof Error ? error.message : `${error}` }),
			)
		}
	}

	/**
	 * Validate server configuration
	 * @param config Configuration object to validate
	 * @param serverName Optional server name for error messages
	 * @returns Validated server configuration
	 */
	public validateServerConfig(config: unknown, _serverName?: string): ServerConfig {
		try {
			const configCopy = { ...(config as Record<string, unknown>) }
			const result = safeParseServerConfig(configCopy)
			if (!result.success) {
				const errors = result.error.errors.map((err) => `${err.path.join(".")}: ${err.message}`).join(", ")
				throw new Error(t("common:errors.invalid_mcp_settings_validation", { errorMessages: errors }))
			}

			return result.data
		} catch (error) {
			return this.showErrorMessage(t("common:errors.invalid_mcp_config"), error)
		}
	}

	/**
	 * Read configuration from file
	 * @param pathStr Path to the configuration file
	 * @returns Record of server configurations
	 */
	public async readConfig(pathStr: string): Promise<Record<string, ServerConfig>> {
		try {
			const content = await fs.readFile(pathStr, "utf-8")
			let config: Record<string, unknown>

			try {
				config = JSON.parse(content)
			} catch (parseError) {
				throw new Error(t("common:errors.invalid_mcp_settings_syntax"))
			}

			const result = this.McpSettingsSchema.safeParse(config)
			if (!result.success) {
				const errors = result.error.errors.map((err) => `${err.path.join(".")}: ${err.message}`).join("\n")
				throw new Error(t("common:errors.invalid_mcp_settings_validation", { errorMessages: errors }))
			}

			return result.data.mcpServers || {}
		} catch (error) {
			if (error instanceof Error && error.message.includes("ENOENT")) {
				throw new Error(t("common:errors.cannot_access_path", { path: pathStr, error: error.message }))
			}
			throw error
		}
	}

	/**
	 * Update server configuration
	 * @param configPath Path to the configuration file
	 * @param serverName Name of the server to update
	 * @param updates Configuration updates to apply
	 * @returns Promise that resolves when the update is complete
	 */
	async updateServerConfig(configPath: string, serverName: string, updates: Partial<ServerConfig>): Promise<void> {
		try {
			const config = await this.readConfig(configPath)
			const serverConfig = { ...(config[serverName] || {}), ...updates }

			this.validateServerConfig(serverConfig, serverName)
			config[serverName] = serverConfig

			await fs.writeFile(configPath, JSON.stringify({ mcpServers: config }, null, 2))
			await this.notifyConfigChange(this.getConfigSource(configPath), config)
		} catch (error) {
			throw new Error(
				t("common:errors.failed_update_project_mcp", {
					error: error instanceof Error ? error.message : `${error}`,
				}),
			)
		}
	}

	/**
	 * Delete server configuration
	 * @param configPath Path to the configuration file
	 * @param serverName Name of the server to delete
	 * @returns Promise that resolves when the deletion is complete
	 */
	async deleteServerConfig(configPath: string, serverName: string): Promise<void> {
		try {
			const config = await this.readConfig(configPath)
			if (!config[serverName]) {
				throw new Error(t("common:info.mcp_server_not_found", { serverName }))
			}

			delete config[serverName]
			await fs.writeFile(configPath, JSON.stringify({ mcpServers: config }, null, 2))
			await this.notifyConfigChange(this.getConfigSource(configPath), config)

			vscode.window.showInformationMessage(t("common:info.mcp_server_deleted", { serverName }))
		} catch (error) {
			throw new Error(
				t("common:errors.failed_delete_repo", { error: error instanceof Error ? error.message : `${error}` }),
			)
		}
	}

	/**
	 * Get all server configurations
	 * @param provider ClineProvider instance
	 * @returns Promise that resolves with an array of McpServer objects
	 */
	async getAllServersFromConfig(provider: ClineProvider): Promise<McpServer[]> {
		try {
			const globalConfigs = await this.readConfig(await this.getGlobalConfigPath(provider))
			const globalServers = this.mapConfigsToServers(globalConfigs, "global")

			const projectConfigPath = await this.getProjectConfigPath()
			const projectServers = projectConfigPath
				? this.mapConfigsToServers(await this.readConfig(projectConfigPath), "project")
				: []

			return [...globalServers, ...projectServers]
		} catch (error) {
			console.error("Failed to get all server configurations:", error)
			return []
		}
	}

	/**
	 * Map configuration objects to McpServer objects
	 * @param configs Record of server configurations
	 * @param source Configuration source
	 * @returns Array of McpServer objects
	 */
	private mapConfigsToServers(configs: Record<string, ServerConfig>, source: ConfigSource): McpServer[] {
		return Object.entries(configs).map(([name, config]) => ({
			name,
			config: JSON.stringify(config),
			status: "disconnected",
			disabled: config.disabled,
			source,
			tools: (config as any).tools,
			resources: (config as any).resources,
			resourceTemplates: (config as any).resourceTemplates,
			projectPath: undefined,
		}))
	}

	/**
	 * Start monitoring configuration file changes
	 * @param provider ClineProvider instance
	 * @returns Promise that resolves when watchers are set up
	 */
	async watchConfigFiles(provider: ClineProvider): Promise<void> {
		// Skip in test environment
		if (process.env.NODE_ENV === "test" || process.env.JEST_WORKER_ID !== undefined) {
			return
		}

		// Monitor global configuration
		const globalConfigPath = await this.getGlobalConfigPath(provider)
		await this.setupConfigWatcher("global", globalConfigPath)

		// Monitor project configuration if available
		const projectConfigPath = await this.getProjectConfigPath()
		if (projectConfigPath) {
			await this.setupConfigWatcher("project", projectConfigPath)
		}
	}

	/**
	 * Set up a file watcher for a configuration file
	 * @param source Configuration source
	 * @param configPath Path to the configuration file
	 */
	private async setupConfigWatcher(source: ConfigSource, configPath: string): Promise<void> {
		this.watchers[source]?.close()

		this.watchers[source] = chokidar.watch(configPath, { ignoreInitial: true }).on("change", async () => {
			try {
				const configs = await this.readConfig(configPath)
				const allValid = Object.entries(configs).every(([name, config]) => {
					try {
						this.validateServerConfig(config, name)
						return true
					} catch {
						return false
					}
				})

				if (allValid) {
					await this.notifyConfigChange(source, configs)
				}
			} catch (error) {
				if (
					!(
						error instanceof Error &&
						(error.message.includes(t("common:errors.invalid_mcp_settings_syntax")) ||
							error.message.includes(t("common:errors.invalid_mcp_settings_validation")))
					)
				) {
					vscode.window.showErrorMessage(
						t("common:errors.failed_update_project_mcp", {
							error: error instanceof Error ? error.message : `${error}`,
						}),
					)
				}
			}
		})
	}

	/**
	 * Notify configuration change to all registered listeners
	 * @param source Configuration source
	 * @param configs Updated configurations
	 * @returns Promise that resolves when all listeners have been notified
	 */
	private async notifyConfigChange(source: ConfigSource, configs: Record<string, ServerConfig>): Promise<void> {
		const event: ConfigChangeEvent = { source, configs }
		for (const listener of this.listeners) {
			try {
				await Promise.resolve(listener(event))
			} catch (error) {
				console.error("Error in config change listener:", error)
			}
		}
	}

	/**
	 * Register a configuration change listener
	 * @param listener Function to be called when configuration changes
	 * @returns Disposable object that can be used to unregister the listener
	 */
	onConfigChange(listener: ConfigChangeListener): vscode.Disposable {
		this.listeners.push(listener)
		return {
			dispose: () => {
				const index = this.listeners.indexOf(listener)
				if (index !== -1) {
					this.listeners.splice(index, 1)
				}
			},
		}
	}

	/**
	 * Release all resources held by this instance
	 * Closes all file watchers and clears all listeners
	 */
	dispose(): void {
		// Close all watchers
		Object.values(this.watchers).forEach((watcher) => watcher?.close())
		// Clear all listeners
		this.listeners = []
	}
}
