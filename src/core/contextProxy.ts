import * as vscode from "vscode"

import { logger } from "../utils/logging"
import {
	GLOBAL_STATE_KEYS,
	SECRET_KEYS,
	GlobalStateKey,
	SecretKey,
	ConfigurationKey,
	ConfigurationValues,
	isSecretKey,
	isGlobalStateKey,
	isPassThroughStateKey,
} from "../shared/globalState"
import { API_CONFIG_KEYS, ApiConfiguration } from "../shared/api"
import { ContextHolder } from "./contextHolder"

/*
 * This class provides a proxy for the vscode.ExtensionContext.
 * It caches global state and secrets in memory for faster access.
 * It also provides a method to reset all state and secrets.
 */

export interface ContextProxyInstance {
	get isInitialized(): boolean
	get extensionUri(): vscode.Uri
	get extensionPath(): string
	get globalStorageUri(): vscode.Uri
	get logUri(): vscode.Uri
	get extension(): vscode.Extension<any>
	get extensionMode(): vscode.ExtensionMode
	getGlobalState<T>(key: GlobalStateKey): T | undefined
	getGlobalState<T>(key: GlobalStateKey, defaultValue: T): T
	getGlobalState<T>(key: GlobalStateKey, defaultValue?: T): T | undefined
	updateGlobalState<T>(key: GlobalStateKey, value: T): any
	getSecret(key: SecretKey): string | undefined
	storeSecret(key: SecretKey, value?: string): Thenable<void>
	setValue(key: ConfigurationKey, value: any): Thenable<void>
	setValues(values: Partial<ConfigurationValues>): Thenable<void>
	setApiConfiguration(apiConfiguration: ApiConfiguration): Thenable<void>
	resetAllState(): Thenable<void>
}

export class ContextProxy implements ContextProxyInstance {
	private static instance: ContextProxy

	private readonly originalContext: vscode.ExtensionContext

	private stateCache: Map<GlobalStateKey, any>
	private secretCache: Map<SecretKey, string | undefined>
	private _isInitialized = false

	private constructor() {
		this.originalContext = ContextHolder.getInstanceWithoutArgs().getContext()
		this.stateCache = new Map()
		this.secretCache = new Map()
		this.initialize() // Initialize immediately
	}

	public static getInstance(): ContextProxy {
		if (!ContextProxy.instance) {
			ContextProxy.instance = new ContextProxy()
		}
		return ContextProxy.instance
	}

	/**
	 * Initialize the context proxy by loading global state and secrets.
	 * This method is called automatically when the instance is created.
	 */
	private async initialize() {
		if (this._isInitialized) return
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

	public get isInitialized() {
		return this._isInitialized
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

	/**
	 * Retrieve a secret from the cache.
	 * @param key The secret key to retrieve
	 * @returns The cached secret value or undefined if not found
	 */
	getSecret(key: SecretKey) {
		return this.secretCache.get(key)
	}

	/**
	 * Store a secret in the cache and write it to the context.
	 * If the value is undefined, the secret will be deleted from the context.
	 * @param key The secret key to store
	 * @param value The secret value to store
	 * @returns A promise that resolves when the operation completes
	 */
	storeSecret(key: SecretKey, value?: string): Thenable<void> {
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
	setValue(key: ConfigurationKey, value: any): Thenable<void> {
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
	async setValues(values: Partial<ConfigurationValues>) {
		const promises: Thenable<void>[] = []

		for (const [key, value] of Object.entries(values)) {
			promises.push(this.setValue(key as ConfigurationKey, value))
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
			...API_CONFIG_KEYS.filter((key) => !!this.stateCache.get(key)).reduce(
				(acc, key) => ({ ...acc, [key]: undefined }),
				{} as Partial<ConfigurationValues>,
			),
			...apiConfiguration,
		})
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

		this.initialize()
	}
}
