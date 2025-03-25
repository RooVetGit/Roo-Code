import * as vscode from "vscode"
import * as fs from "fs/promises"
import * as path from "path"

import { logger } from "../utils/logging"
import {
	GLOBAL_STATE_KEYS,
	SECRET_KEYS,
	GlobalStateKey,
	SecretKey,
	isSecretKey,
	isGlobalStateKey,
	isPassThroughStateKey,
	globalConfigurationSchema,
} from "../shared/globalState"
import { API_CONFIG_KEYS, ApiConfiguration, ApiHandlerOptionsKey, apiHandlerOptionsSchema } from "../shared/api"

const globalStateSchema = globalConfigurationSchema.merge(apiHandlerOptionsSchema)

const NON_EXPORTABLE_GLOBAL_CONFIGURATION: GlobalStateKey[] = [
	"taskHistory",
	"listApiConfigMeta",
	"currentApiConfigName",
]

const NON_EXPORTABLE_API_CONFIGURATION: ApiHandlerOptionsKey[] = [
	"glamaModelInfo",
	"openRouterModelInfo",
	"unboundModelInfo",
	"requestyModelInfo",
]

export class ContextProxy {
	private readonly originalContext: vscode.ExtensionContext

	private stateCache: Map<GlobalStateKey, any>
	private secretCache: Map<SecretKey, string | undefined>
	private _isInitialized = false

	constructor(context: vscode.ExtensionContext) {
		this.originalContext = context
		this.stateCache = new Map()
		this.secretCache = new Map()
		this._isInitialized = false
	}

	public get isInitialized() {
		return this._isInitialized
	}

	public async initialize() {
		for (const key of GLOBAL_STATE_KEYS) {
			try {
				this.stateCache.set(key, this.originalContext.globalState.get(key))
			} catch (error) {
				logger.error(`Error loading global ${key}: ${error instanceof Error ? error.message : String(error)}`)
			}
		}

		const promises = SECRET_KEYS.map(async (key) => {
			try {
				this.secretCache.set(key, await this.originalContext.secrets.get(key))
			} catch (error) {
				logger.error(`Error loading secret ${key}: ${error instanceof Error ? error.message : String(error)}`)
			}
		})

		await Promise.all(promises)

		this._isInitialized = true
	}

	get extensionUri() {
		return this.originalContext.extensionUri
	}

	get extensionPath() {
		return this.originalContext.extensionPath
	}

	get globalStorageUri() {
		return this.originalContext.globalStorageUri
	}

	get logUri() {
		return this.originalContext.logUri
	}

	get extension() {
		return this.originalContext.extension
	}

	get extensionMode() {
		return this.originalContext.extensionMode
	}

	getGlobalState<T>(key: GlobalStateKey): T | undefined
	getGlobalState<T>(key: GlobalStateKey, defaultValue: T): T
	getGlobalState<T>(key: GlobalStateKey, defaultValue?: T): T | undefined {
		if (isPassThroughStateKey(key)) {
			const value = this.originalContext.globalState.get(key)
			return value === undefined || value === null ? defaultValue : (value as T)
		}
		const value = this.stateCache.get(key) as T | undefined
		return value !== undefined ? value : (defaultValue as T | undefined)
	}

	updateGlobalState<T>(key: GlobalStateKey, value: T) {
		if (isPassThroughStateKey(key)) {
			return this.originalContext.globalState.update(key, value)
		}
		this.stateCache.set(key, value)
		return this.originalContext.globalState.update(key, value)
	}

	getSecret(key: SecretKey) {
		return this.secretCache.get(key)
	}

	storeSecret(key: SecretKey, value?: string) {
		// Update cache.
		this.secretCache.set(key, value)

		// Write directly to context.
		return value === undefined
			? this.originalContext.secrets.delete(key)
			: this.originalContext.secrets.store(key, value)
	}

	/**
	 * Set a value in either secrets or global state based on key type.
	 * If the key is in SECRET_KEYS, it will be stored as a secret.
	 * If the key is in GLOBAL_STATE_KEYS or unknown, it will be stored in global state.
	 * @param key The key to set
	 * @param value The value to set
	 * @returns A promise that resolves when the operation completes
	 */
	setValue(key: GlobalStateKey | SecretKey, value: any) {
		if (isSecretKey(key)) {
			return this.storeSecret(key, value)
		}

		if (isGlobalStateKey(key)) {
			return this.updateGlobalState(key, value)
		}

		logger.warn(`Unknown key: ${key}. Storing as global state.`)
		return this.updateGlobalState(key, value)
	}

	/**
	 * Set multiple values at once. Each key will be routed to either
	 * secrets or global state based on its type.
	 * @param values An object containing key-value pairs to set
	 * @returns A promise that resolves when all operations complete
	 */
	async setValues(values: Partial<Record<GlobalStateKey | SecretKey, any>>) {
		const promises: Thenable<void>[] = []

		for (const [key, value] of Object.entries(values)) {
			promises.push(this.setValue(key as GlobalStateKey | SecretKey, value))
		}

		await Promise.all(promises)
	}

	async setApiConfiguration(apiConfiguration: ApiConfiguration) {
		// Explicitly clear out any old API configuration values before that
		// might not be present in the new configuration.
		// If a value is not present in the new configuration, then it is assumed
		// that the setting's value should be `undefined` and therefore we
		// need to remove it from the state cache if it exists.
		await this.setValues({
			...API_CONFIG_KEYS.filter((key) => isGlobalStateKey(key))
				.filter((key) => !!this.stateCache.get(key))
				.reduce(
					(acc, key) => ({ ...acc, [key]: undefined }),
					{} as Partial<Record<GlobalStateKey | SecretKey, any>>,
				),
			...apiConfiguration,
		})
	}

	private getAllGlobalStateValues() {
		const values: Partial<Record<GlobalStateKey, any>> = {}

		for (const key of GLOBAL_STATE_KEYS) {
			const value = this.getGlobalState(key)

			if (value !== undefined) {
				values[key] = value
			}
		}

		return values
	}

	private getAllSecretValues() {
		const values: Partial<Record<SecretKey, string>> = {}

		for (const key of SECRET_KEYS) {
			const value = this.getSecret(key)

			if (value !== undefined) {
				values[key] = value
			}
		}

		return values
	}

	async exportGlobalConfiguration(filePath: string) {
		try {
			const values = this.getAllGlobalStateValues()
			const configuration = globalStateSchema.parse(values)
			const omit = new Set<string>([...API_CONFIG_KEYS, ...NON_EXPORTABLE_GLOBAL_CONFIGURATION])
			const entries = Object.entries(configuration).filter(([key]) => !omit.has(key))

			if (entries.length === 0) {
				throw new Error("No configuration values to export.")
			}

			const globalConfiguration = Object.fromEntries(entries)

			const dirname = path.dirname(filePath)
			await fs.mkdir(dirname, { recursive: true })
			await fs.writeFile(filePath, JSON.stringify(globalConfiguration, null, 2), "utf-8")
			return globalConfiguration
		} catch (error) {
			console.log(error.message)
			logger.error(
				`Error exporting global configuration to ${filePath}: ${error instanceof Error ? error.message : String(error)}`,
			)
			return undefined
		}
	}

	async importGlobalConfiguration(filePath: string) {
		try {
			const configuration = globalStateSchema.parse(JSON.parse(await fs.readFile(filePath, "utf-8")))
			const omit = new Set<string>([...API_CONFIG_KEYS, ...NON_EXPORTABLE_GLOBAL_CONFIGURATION])
			const entries = Object.entries(configuration).filter(([key]) => !omit.has(key))

			if (entries.length === 0) {
				throw new Error("No configuration values to import.")
			}

			const globalConfiguration = Object.fromEntries(entries)
			await this.setValues(globalConfiguration)
			return globalConfiguration
		} catch (error) {
			logger.error(
				`Error importing global configuration from ${filePath}: ${error instanceof Error ? error.message : String(error)}`,
			)
			return undefined
		}
	}

	async exportApiConfiguration(filePath: string) {
		try {
			const apiConfiguration = apiHandlerOptionsSchema
				.omit(NON_EXPORTABLE_API_CONFIGURATION.reduce((acc, key) => ({ ...acc, [key]: true }), {}))
				.parse({
					...this.getAllGlobalStateValues(),
					...this.getAllSecretValues(),
				})

			const dirname = path.dirname(filePath)
			await fs.mkdir(dirname, { recursive: true })
			await fs.writeFile(filePath, JSON.stringify(apiConfiguration, null, 2), "utf-8")
			return apiConfiguration
		} catch (error) {
			logger.error(
				`Error exporting API configuration to ${filePath}: ${error instanceof Error ? error.message : String(error)}`,
			)
			return undefined
		}
	}

	async importApiConfiguration(filePath: string) {
		try {
			const apiConfiguration = apiHandlerOptionsSchema
				.omit(NON_EXPORTABLE_API_CONFIGURATION.reduce((acc, key) => ({ ...acc, [key]: true }), {}))
				.parse(JSON.parse(await fs.readFile(filePath, "utf-8")))

			await this.setApiConfiguration(apiConfiguration)
			return apiConfiguration
		} catch (error) {
			logger.error(
				`Error importing API configuration from ${filePath}: ${error instanceof Error ? error.message : String(error)}`,
			)
			return undefined
		}
	}

	/**
	 * Resets all global state, secrets, and in-memory caches.
	 * This clears all data from both the in-memory caches and the VSCode storage.
	 * @returns A promise that resolves when all reset operations are complete
	 */
	async resetAllState() {
		// Clear in-memory caches
		this.stateCache.clear()
		this.secretCache.clear()

		// Reset all global state values to undefined.
		const stateResetPromises = GLOBAL_STATE_KEYS.map((key) =>
			this.originalContext.globalState.update(key, undefined),
		)

		// Delete all secrets.
		const secretResetPromises = SECRET_KEYS.map((key) => this.originalContext.secrets.delete(key))

		// Wait for all reset operations to complete.
		await Promise.all([...stateResetPromises, ...secretResetPromises])

		await this.initialize()
	}
}
