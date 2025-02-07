import * as vscode from "vscode"
import * as fs from "fs/promises"
import * as path from "path"
import { ClineProvidersConfig, CustomProviderConfig } from "../../shared/api"
import { GlobalFileNames } from "../../core/webview/ClineProvider"
import { customProviderConfigSchema } from "./CustomProvidersSchema"

export class CustomProvidersFileService {
	public readonly providersFilePath: string
	private readonly secrets: vscode.SecretStorage

	constructor(storagePath: string, secrets: vscode.SecretStorage) {
		this.providersFilePath = path.join(storagePath, GlobalFileNames.customProviders)
		this.secrets = secrets
	}

	/**
	 * Add a new custom provider with validation
	 */
	public async addProvider(provider: CustomProviderConfig): Promise<void> {
		try {
			const secretKey = `${provider.name}_API_KEY`

			// Store API key in secrets
			if (!provider.apiKey) {
				throw new Error("API key is required")
			}

			console.log(`Storing API key for provider ${provider.name}`)
			await this.secrets.store(secretKey, provider.apiKey)

			// Verify the key was stored
			const storedKey = await this.secrets.get(secretKey)
			if (!storedKey) {
				throw new Error(`Failed to store API key for provider ${provider.name}`)
			}

			// Save provider config without the actual API key
			const providerConfig = {
				...provider,
				apiKey: `\${${secretKey}}`, // Store placeholder
				request: {
					...provider.request,
					headers: {
						...provider.request.headers,
						Authorization: `Bearer \${${secretKey}}`,
					},
				},
			}

			const providers = await this.readProviders()
			providers[provider.name] = providerConfig
			await this.writeProviders(providers)
		} catch (error) {
			console.error("Error adding provider:", error)
			throw error
		}
	}

	/**
	 * Delete a custom provider and its associated API key
	 */
	public async deleteProvider(name: string): Promise<void> {
		try {
			const providers = await this.readProviders()
			delete providers[name]
			await this.secrets.delete(`${name}_API_KEY`)
			await this.writeProviders(providers)
		} catch (error) {
			console.error("Error deleting provider:", error)
			throw new Error(`Failed to delete provider: ${error instanceof Error ? error.message : String(error)}`)
		}
	}

	/**
	 * Get all providers with their API keys from secrets storage
	 */
	public async getProviders(): Promise<Record<string, CustomProviderConfig>> {
		try {
			const providers = await this.readProviders()
			const providersWithKeys: Record<string, CustomProviderConfig> = {}

			for (const [name, provider] of Object.entries(providers)) {
				const secretKey = `${name}_API_KEY`
				const apiKey = await this.secrets.get(secretKey)

				if (!apiKey) {
					console.warn(`No API key found in secrets for provider: ${name}`)
					continue // Skip providers without API keys
				}

				providersWithKeys[name] = {
					...provider,
					apiKey,
					request: {
						...provider.request,
						headers: {
							...provider.request.headers,
							Authorization: `Bearer ${apiKey}`,
						},
					},
				}
			}

			return providersWithKeys
		} catch (error) {
			console.error("Error getting providers:", error)
			throw error
		}
	}

	/**
	 * Read providers from the configuration file
	 */
	public async readProviders(): Promise<Record<string, CustomProviderConfig>> {
		try {
			const content = await fs.readFile(this.providersFilePath, "utf-8")
			const config: ClineProvidersConfig = JSON.parse(content)
			return config.providers
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code === "ENOENT") {
				return {}
			}
			console.error("Error reading providers:", error)
			throw new Error(`Failed to read providers: ${error instanceof Error ? error.message : String(error)}`)
		}
	}

	/**
	 * Write providers to the configuration file
	 */
	public async writeProviders(providers: Record<string, CustomProviderConfig>): Promise<void> {
		try {
			const config: ClineProvidersConfig = { providers }
			const content = JSON.stringify(config, null, 2)
			console.log(`Writing providers to file: ${this.providersFilePath}`) // Added log
			console.log(`Content: ${content}`) // Added log
			await fs.writeFile(this.providersFilePath, content, "utf-8")
			console.log("Providers written successfully.") // Added log
		} catch (error) {
			console.error("Error writing providers:", error)
			throw new Error(`Failed to write providers: ${error instanceof Error ? error.message : String(error)}`)
		}
	}
}
