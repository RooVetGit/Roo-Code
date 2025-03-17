import { ExtensionContext } from "vscode"
import { ApiConfiguration } from "../../shared/api"
import { Mode } from "../../shared/modes"
import { ApiConfigMeta } from "../../shared/ExtensionMessage"

export interface ApiConfigData {
	currentApiConfigName: string
	apiConfigs: {
		[key: string]: ApiConfiguration
	}
	modeApiConfigs?: Partial<Record<Mode, string>>
}

export class ConfigManager {
	private readonly defaultConfig: ApiConfigData = {
		currentApiConfigName: "default",
		apiConfigs: {
			default: {
				id: this.generateId(),
				rateLimitSeconds: 0, // Default rate limit is 0 seconds
			},
		},
	}

	private readonly SCOPE_PREFIX = "roo_cline_config_"
	private readonly context: ExtensionContext

	constructor(context: ExtensionContext) {
		this.context = context
		this.initConfig().catch(console.error)
	}

	private generateId(): string {
		return Math.random().toString(36).substring(2, 15)
	}

	// Synchronize readConfig/writeConfig operations to avoid data loss.
	private _lock = Promise.resolve()
	private lock<T>(cb: () => Promise<T>) {
		const next = this._lock.then(cb)
		this._lock = next.catch(() => {}) as Promise<void>
		return next
	}
	/**
	 * Initialize config if it doesn't exist
	 */
	/**
	 * Migrate rate limit from global state to profile-specific setting
	 */
	async migrateRateLimitToProfiles(): Promise<void> {
		try {
			return await this.lock(async () => {
				// Get the current global rate limit value
				const globalRateLimit = this.context.globalState
					? (await this.context.globalState.get<number>("rateLimitSeconds")) || 0
					: 0

				// Get all configurations
				const config = await this.readConfig()

				// Update each configuration with the global rate limit
				for (const apiConfig of Object.values(config.apiConfigs)) {
					apiConfig.rateLimitSeconds = globalRateLimit
				}

				// Save the updated configurations
				await this.writeConfig(config)

				// Remove the global rate limit setting
				if (this.context.globalState) {
					await this.context.globalState.update("rateLimitSeconds", undefined)
				}

				console.log(`[ConfigManager] Migrated global rate limit (${globalRateLimit}s) to all profiles`)
			})
		} catch (error) {
			throw new Error(`Failed to migrate rate limit settings: ${error}`)
		}
	}

	async initConfig(): Promise<void> {
		try {
			return await this.lock(async () => {
				const config = await this.readConfig()
				if (!config) {
					await this.writeConfig(this.defaultConfig)
					return
				}

				// Check if migration is needed for IDs
				let needsIdMigration = false
				for (const [name, apiConfig] of Object.entries(config.apiConfigs)) {
					if (!apiConfig.id) {
						apiConfig.id = this.generateId()
						needsIdMigration = true
					}
				}

				if (needsIdMigration) {
					await this.writeConfig(config)
				}

				// Check if rate limit migration is needed
				if (this.context.globalState) {
					const hasGlobalRateLimit =
						(await this.context.globalState.get<number>("rateLimitSeconds")) !== undefined
					if (hasGlobalRateLimit) {
						await this.migrateRateLimitToProfiles()
					}
				}
			})
		} catch (error) {
			throw new Error(`Failed to initialize config: ${error}`)
		}
	}

	/**
	 * List all available configs with metadata
	 */
	async listConfig(): Promise<ApiConfigMeta[]> {
		try {
			return await this.lock(async () => {
				const config = await this.readConfig()
				return Object.entries(config.apiConfigs).map(([name, apiConfig]) => ({
					name,
					id: apiConfig.id || "",
					apiProvider: apiConfig.apiProvider,
				}))
			})
		} catch (error) {
			throw new Error(`Failed to list configs: ${error}`)
		}
	}

	/**
	 * Save a config with the given name
	 */
	async saveConfig(name: string, config: ApiConfiguration): Promise<void> {
		try {
			return await this.lock(async () => {
				const currentConfig = await this.readConfig()
				const existingConfig = currentConfig.apiConfigs[name]
				currentConfig.apiConfigs[name] = {
					...config,
					id: existingConfig?.id || this.generateId(),
					// Preserve rateLimitSeconds if not explicitly set in the new config
					rateLimitSeconds:
						config.rateLimitSeconds !== undefined
							? config.rateLimitSeconds
							: existingConfig?.rateLimitSeconds || 0,
				}
				await this.writeConfig(currentConfig)
			})
		} catch (error) {
			throw new Error(`Failed to save config: ${error}`)
		}
	}

	/**
	 * Load a config by name
	 */
	async loadConfig(name: string): Promise<ApiConfiguration> {
		try {
			return await this.lock(async () => {
				const config = await this.readConfig()
				const apiConfig = config.apiConfigs[name]

				if (!apiConfig) {
					throw new Error(`Config '${name}' not found`)
				}

				config.currentApiConfigName = name
				await this.writeConfig(config)

				return apiConfig
			})
		} catch (error) {
			throw new Error(`Failed to load config: ${error}`)
		}
	}

	/**
	 * Delete a config by name
	 */
	async deleteConfig(name: string): Promise<void> {
		try {
			return await this.lock(async () => {
				const currentConfig = await this.readConfig()
				if (!currentConfig.apiConfigs[name]) {
					throw new Error(`Config '${name}' not found`)
				}

				// Don't allow deleting the default config
				if (Object.keys(currentConfig.apiConfigs).length === 1) {
					throw new Error(`Cannot delete the last remaining configuration.`)
				}

				delete currentConfig.apiConfigs[name]
				await this.writeConfig(currentConfig)
			})
		} catch (error) {
			throw new Error(`Failed to delete config: ${error}`)
		}
	}

	/**
	 * Set the current active API configuration
	 */
	async setCurrentConfig(name: string): Promise<void> {
		try {
			return await this.lock(async () => {
				const currentConfig = await this.readConfig()
				if (!currentConfig.apiConfigs[name]) {
					throw new Error(`Config '${name}' not found`)
				}

				currentConfig.currentApiConfigName = name
				await this.writeConfig(currentConfig)
			})
		} catch (error) {
			throw new Error(`Failed to set current config: ${error}`)
		}
	}

	/**
	 * Check if a config exists by name
	 */
	async hasConfig(name: string): Promise<boolean> {
		try {
			return await this.lock(async () => {
				const config = await this.readConfig()
				return name in config.apiConfigs
			})
		} catch (error) {
			throw new Error(`Failed to check config existence: ${error}`)
		}
	}

	/**
	 * Set the API config for a specific mode
	 */
	async setModeConfig(mode: Mode, configId: string): Promise<void> {
		try {
			return await this.lock(async () => {
				const currentConfig = await this.readConfig()
				if (!currentConfig.modeApiConfigs) {
					currentConfig.modeApiConfigs = {}
				}
				currentConfig.modeApiConfigs[mode] = configId
				await this.writeConfig(currentConfig)
			})
		} catch (error) {
			throw new Error(`Failed to set mode config: ${error}`)
		}
	}

	/**
	 * Get the API config ID for a specific mode
	 */
	async getModeConfigId(mode: Mode): Promise<string | undefined> {
		try {
			return await this.lock(async () => {
				const config = await this.readConfig()
				return config.modeApiConfigs?.[mode]
			})
		} catch (error) {
			throw new Error(`Failed to get mode config: ${error}`)
		}
	}

	/**
	 * Get the key used for storing config in secrets
	 */
	private getConfigKey(): string {
		return `${this.SCOPE_PREFIX}api_config`
	}

	/**
	 * Reset all configuration by deleting the stored config from secrets
	 */
	public async resetAllConfigs(): Promise<void> {
		return await this.lock(async () => {
			await this.context.secrets.delete(this.getConfigKey())
		})
	}

	private async readConfig(): Promise<ApiConfigData> {
		try {
			const content = await this.context.secrets.get(this.getConfigKey())

			if (!content) {
				return this.defaultConfig
			}

			return JSON.parse(content)
		} catch (error) {
			throw new Error(`Failed to read config from secrets: ${error}`)
		}
	}

	private async writeConfig(config: ApiConfigData): Promise<void> {
		try {
			const content = JSON.stringify(config, null, 2)
			await this.context.secrets.store(this.getConfigKey(), content)
		} catch (error) {
			throw new Error(`Failed to write config to secrets: ${error}`)
		}
	}
}
