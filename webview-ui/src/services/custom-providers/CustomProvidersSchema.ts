import * as fs from "fs/promises"
import type { CustomProviderConfig } from "../../shared/types"
import * as vscode from "vscode"

export class CustomProvidersFileService {
	constructor(
		public readonly providersFilePath: string,
		private readonly secrets: vscode.SecretStorage,
	) {}

	async getProviders(): Promise<Record<string, CustomProviderConfig>> {
		try {
			const content = await fs.readFile(this.providersFilePath, "utf-8")
			const config = JSON.parse(content)
			return config.providers || {}
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code === "ENOENT") {
				// File doesn't exist yet, return empty object
				return {}
			}
			console.error("Error reading providers:", error)
			throw error
		}
	}

	async saveProviders(providers: Record<string, CustomProviderConfig>): Promise<void> {
		try {
			const config = { providers }
			await fs.writeFile(this.providersFilePath, JSON.stringify(config, null, 2))
		} catch (error) {
			console.error("Error writing providers:", error)
			throw error
		}
	}

	async addProvider(provider: CustomProviderConfig): Promise<void> {
		try {
			const providers = await this.getProviders()

			// Store API key in secrets
			if (provider.apiKey) {
				await this.secrets.store(`${provider.name}_API_KEY`, provider.apiKey)
				// Replace actual API key with placeholder in config
				provider = {
					...provider,
					apiKey: `\${${provider.name}_API_KEY}`,
				}
			}

			providers[provider.name] = provider
			await this.saveProviders(providers)
		} catch (error) {
			console.error("Error adding provider:", error)
			throw error
		}
	}

	async deleteProvider(name: string): Promise<void> {
		try {
			const providers = await this.getProviders()
			delete providers[name]

			// Remove API key from secrets
			await this.secrets.delete(`${name}_API_KEY`)

			await this.saveProviders(providers)
		} catch (error) {
			console.error("Error deleting provider:", error)
			throw error
		}
	}
}
