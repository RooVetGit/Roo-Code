import axios from "axios"
import * as yaml from "yaml"
import * as fs from "fs/promises"
import * as path from "path"
import { z } from "zod"
import { getRooCodeApiUrl } from "@roo-code/cloud"
import type { MarketplaceItem, MarketplaceItemType } from "@roo-code/types"
import { modeMarketplaceItemSchema, mcpMarketplaceItemSchema } from "@roo-code/types"

// Response schemas for YAML API responses
const modeMarketplaceResponse = z.object({
	items: z.array(modeMarketplaceItemSchema),
})

const mcpMarketplaceResponse = z.object({
	items: z.array(mcpMarketplaceItemSchema),
})

export class RemoteConfigLoader {
	private apiBaseUrl: string
	private cache: Map<string, { data: MarketplaceItem[]; timestamp: number }> = new Map()
	private cacheDuration = 5 * 60 * 1000 // 5 minutes

	constructor() {
		this.apiBaseUrl = getRooCodeApiUrl()
	}

	async loadAllItems(): Promise<MarketplaceItem[]> {
		const items: MarketplaceItem[] = []

		const [modes, mcps] = await Promise.all([this.fetchModes(), this.fetchMcps()])

		items.push(...modes, ...mcps)
		return items
	}

	private async fetchModes(): Promise<MarketplaceItem[]> {
		const cacheKey = "modes"
		const cached = this.getFromCache(cacheKey)
		if (cached) return cached

		try {
			const data = await this.fetchWithRetry<string>(`${this.apiBaseUrl}/api/marketplace/modes`)

			// Parse and validate YAML response
			const yamlData = yaml.parse(data)
			const validated = modeMarketplaceResponse.parse(yamlData)

			const items: MarketplaceItem[] = validated.items.map((item) => ({
				type: "mode" as const,
				...item,
			}))

			this.setCache(cacheKey, items)
			return items
		} catch (error) {
			console.warn("Failed to fetch modes from remote API, trying local fallback:", error)
			return this.fetchLocalModes()
		}
	}

	private async fetchMcps(): Promise<MarketplaceItem[]> {
		const cacheKey = "mcps"
		const cached = this.getFromCache(cacheKey)
		if (cached) return cached

		try {
			const data = await this.fetchWithRetry<string>(`${this.apiBaseUrl}/api/marketplace/mcps`)

			// Parse and validate YAML response
			const yamlData = yaml.parse(data)
			const validated = mcpMarketplaceResponse.parse(yamlData)

			const items: MarketplaceItem[] = validated.items.map((item) => ({
				type: "mcp" as const,
				...item,
			}))

			this.setCache(cacheKey, items)
			return items
		} catch (error) {
			console.warn("Failed to fetch MCPs from remote API, trying local fallback:", error)
			return this.fetchLocalMcps()
		}
	}

	private async fetchWithRetry<T>(url: string, maxRetries = 3): Promise<T> {
		let lastError: Error

		for (let i = 0; i < maxRetries; i++) {
			try {
				const response = await axios.get(url, {
					timeout: 10000, // 10 second timeout
					headers: {
						Accept: "application/json",
						"Content-Type": "application/json",
					},
				})
				return response.data as T
			} catch (error) {
				lastError = error as Error
				if (i < maxRetries - 1) {
					// Exponential backoff: 1s, 2s, 4s
					const delay = Math.pow(2, i) * 1000
					await new Promise((resolve) => setTimeout(resolve, delay))
				}
			}
		}

		throw lastError!
	}

	async getItem(id: string, type: MarketplaceItemType): Promise<MarketplaceItem | null> {
		const items = await this.loadAllItems()
		return items.find((item) => item.id === id && item.type === type) || null
	}

	private getFromCache(key: string): MarketplaceItem[] | null {
		const cached = this.cache.get(key)
		if (!cached) return null

		const now = Date.now()
		if (now - cached.timestamp > this.cacheDuration) {
			this.cache.delete(key)
			return null
		}

		return cached.data
	}

	private setCache(key: string, data: MarketplaceItem[]): void {
		this.cache.set(key, {
			data,
			timestamp: Date.now(),
		})
	}

	clearCache(): void {
		this.cache.clear()
	}

	/**
	 * Fallback method to load MCPs from local marketplace data file
	 */
	private async fetchLocalMcps(): Promise<MarketplaceItem[]> {
		try {
			// Try to load from local marketplace-data directory
			// Look for marketplace-data in current directory, parent directories, or relative to __dirname
			const possiblePaths = [
				path.join(process.cwd(), "marketplace-data", "mcps.yaml"),
				path.join(process.cwd(), "..", "marketplace-data", "mcps.yaml"),
				path.join(process.cwd(), "..", "..", "marketplace-data", "mcps.yaml"),
				path.join(process.cwd(), "..", "..", "..", "marketplace-data", "mcps.yaml"),
				path.join(__dirname, "..", "..", "..", "marketplace-data", "mcps.yaml"),
			]

			let data: string | null = null
			let usedPath: string | null = null

			for (const localMcpPath of possiblePaths) {
				try {
					data = await fs.readFile(localMcpPath, "utf-8")
					usedPath = localMcpPath
					break
				} catch (error) {
					// Continue to next path
					continue
				}
			}

			if (!data) {
				throw new Error("Could not find mcps.yaml in any expected location")
			}

			// Parse and validate YAML response
			const yamlData = yaml.parse(data)
			const validated = mcpMarketplaceResponse.parse(yamlData)

			const items: MarketplaceItem[] = validated.items.map((item) => ({
				type: "mcp" as const,
				...item,
			}))

			console.log(`Loaded ${items.length} MCP items from local marketplace data at ${usedPath}`)
			return items
		} catch (error) {
			console.warn("Failed to load local MCP data:", error)
			return []
		}
	}

	/**
	 * Fallback method to load modes from local marketplace data file
	 */
	private async fetchLocalModes(): Promise<MarketplaceItem[]> {
		try {
			// Try to load from local marketplace-data directory
			// Look for marketplace-data in current directory, parent directories, or relative to __dirname
			const possiblePaths = [
				path.join(process.cwd(), "marketplace-data", "modes.yaml"),
				path.join(process.cwd(), "..", "marketplace-data", "modes.yaml"),
				path.join(process.cwd(), "..", "..", "marketplace-data", "modes.yaml"),
				path.join(process.cwd(), "..", "..", "..", "marketplace-data", "modes.yaml"),
				path.join(__dirname, "..", "..", "..", "marketplace-data", "modes.yaml"),
			]

			let data: string | null = null
			let usedPath: string | null = null

			for (const localModePath of possiblePaths) {
				try {
					data = await fs.readFile(localModePath, "utf-8")
					usedPath = localModePath
					break
				} catch (error) {
					// Continue to next path
					continue
				}
			}

			if (!data) {
				throw new Error("Could not find modes.yaml in any expected location")
			}

			// Parse and validate YAML response
			const yamlData = yaml.parse(data)
			const validated = modeMarketplaceResponse.parse(yamlData)

			const items: MarketplaceItem[] = validated.items.map((item) => ({
				type: "mode" as const,
				...item,
			}))

			console.log(`Loaded ${items.length} mode items from local marketplace data at ${usedPath}`)
			return items
		} catch (error) {
			console.warn("Failed to load local mode data:", error)
			return []
		}
	}
}
