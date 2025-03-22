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
	migrations?: {
		rateLimitMigrated?: boolean // Flag to track if rate limit migration has been applied
	}
}

export class ConfigManager {
	private readonly defaultConfig: ApiConfigData = {
		currentApiConfigName: "default",
		apiConfigs: {
			default: {
				id: this.generateId(),
				rateLimitSeconds: 0, // Set default rate limit for new installations
			},
		},
		migrations: {
			rateLimitMigrated: true, // Mark as migrated for fresh installs
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
	async initConfig(): Promise<void> {
		try {
			return await this.lock(async () => {
				const config = await this.readConfig()
				if (!config) {
					await this.writeConfig(this.defaultConfig)
					return
				}

				// Initialize migrations tracking object if it doesn't exist
				if (!config.migrations) {
					config.migrations = {}
				}

				let needsMigration = false

				// Migrate: ensure all configs have IDs
				for (const [name, apiConfig] of Object.entries(config.apiConfigs)) {
					if (!apiConfig.id) {
						apiConfig.id = this.generateId()
						needsMigration = true
					}
				}

				// Apply rate limit migration if needed
				if (!config.migrations.rateLimitMigrated) {
					await this.migrateRateLimit(config)
					config.migrations.rateLimitMigrated = true
					needsMigration = true
				}

				if (needsMigration) {
					await this.writeConfig(config)
				}
			})
		} catch (error) {
			throw new Error(`Failed to initialize config: ${error}`)
		}
	}

	/**
	 * Migrate rate limit settings from global state to per-profile configuration
	 */
	private async migrateRateLimit(config: ApiConfigData): Promise<void> {
		try {
			// Get the global rate limit value from extension state
			let rateLimitSeconds: number | undefined

			try {
				// Try to get global state rate limit
				rateLimitSeconds = await this.context.globalState.get<number>("rateLimitSeconds")
				console.log(`[RateLimitMigration] Found global rate limit value: ${rateLimitSeconds}`)
			} catch (error) {
				console.error("[RateLimitMigration] Error getting global rate limit:", error)
			}

			// If no global rate limit, use default value of 5 seconds
			if (rateLimitSeconds === undefined) {
				rateLimitSeconds = 5 // Default value
				console.log(`[RateLimitMigration] Using default rate limit value: ${rateLimitSeconds}`)
			}

			// Apply the rate limit to all API configurations
			for (const [name, apiConfig] of Object.entries(config.apiConfigs)) {
				// Only set if not already configured
				if (apiConfig.rateLimitSeconds === undefined) {
					console.log(`[RateLimitMigration] Applying rate limit ${rateLimitSeconds}s to profile: ${name}`)
					apiConfig.rateLimitSeconds = rateLimitSeconds
				}
			}

			console.log(`[RateLimitMigration] Migration complete`)
		} catch (error) {
			console.error(`[RateLimitMigration] Failed to migrate rate limit settings:`, error)
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

				// If this is a new config or doesn't have rate limit, try to apply the global rate limit
				if (!existingConfig || config.rateLimitSeconds === undefined) {
					// Apply rate limit if not specified explicitly in the config being saved
					if (config.rateLimitSeconds === undefined) {
						let globalRateLimit: number | undefined

						// First check if we have an existing migrated config to copy from
						const anyExistingConfig = Object.values(currentConfig.apiConfigs)[0]
						if (anyExistingConfig?.rateLimitSeconds !== undefined) {
							globalRateLimit = anyExistingConfig.rateLimitSeconds
							console.log(
								`[RateLimitMigration] Using existing profile's rate limit value: ${globalRateLimit}s`,
							)
						} else {
							// Otherwise check global state
							try {
								globalRateLimit = await this.context.globalState.get<number>("rateLimitSeconds")
								console.log(
									`[RateLimitMigration] Using global rate limit for new profile: ${globalRateLimit}s`,
								)
							} catch (error) {
								console.error(
									"[RateLimitMigration] Error getting global rate limit for new profile:",
									error,
								)
							}

							// Use default if not found
							if (globalRateLimit === undefined) {
								globalRateLimit = 5 // Default value
								console.log(
									`[RateLimitMigration] Using default rate limit value for new profile: ${globalRateLimit}s`,
								)
							}
						}

						// Apply the rate limit to the new config
						config.rateLimitSeconds = globalRateLimit
					}
				}

				currentConfig.apiConfigs[name] = {
					...config,
					id: existingConfig?.id || this.generateId(),
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
