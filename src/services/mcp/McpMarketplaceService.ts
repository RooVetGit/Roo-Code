import axios from "axios"
import * as vscode from "vscode"
import { DIFF_VIEW_URI_SCHEME } from "../../integrations/editor/DiffViewProvider"
import { McpMarketplaceCatalog, McpServer, McpDownloadResponse } from "../../shared/mcp"
import { McpHub } from "./McpHub"
import { ClineProvider } from "../../core/webview/ClineProvider"

export class McpMarketplaceService {
	constructor(private provider: ClineProvider) {}

	private async fetchMcpMarketplaceFromApi(silent: boolean = false): Promise<McpMarketplaceCatalog | undefined> {
		try {
			const response = await axios.get("https://api.cline.bot/v1/mcp/marketplace", {
				headers: {
					"Content-Type": "application/json",
				},
			})

			if (!response.data) {
				throw new Error("Invalid response from MCP marketplace API")
			}

			const catalog: McpMarketplaceCatalog = {
				items: (response.data || []).map((item: any) => ({
					...item,
					githubStars: item.githubStars ?? 0,
					downloadCount: item.downloadCount ?? 0,
					tags: item.tags ?? [],
				})),
			}

			// Store in global state
			await this.provider.updateGlobalState("mcpMarketplaceCatalog", catalog)
			return catalog
		} catch (error) {
			console.error("Failed to fetch MCP marketplace:", error)
			if (!silent) {
				const errorMessage = error instanceof Error ? error.message : "Failed to fetch MCP marketplace"
				await this.provider.postMessageToWebview({
					type: "mcpMarketplaceCatalog",
					error: errorMessage,
				})
				vscode.window.showErrorMessage(errorMessage)
			}
			return undefined
		}
	}

	async prefetchMcpMarketplace() {
		try {
			await this.fetchMcpMarketplaceFromApi(true)
		} catch (error) {
			console.error("Failed to prefetch MCP marketplace:", error)
		}
	}

	async silentlyRefreshMcpMarketplace() {
		try {
			const catalog = await this.fetchMcpMarketplaceFromApi(true)
			if (catalog) {
				await this.provider.postMessageToWebview({
					type: "mcpMarketplaceCatalog",
					mcpMarketplaceCatalog: catalog,
				})
			}
		} catch (error) {
			console.error("Failed to silently refresh MCP marketplace:", error)
		}
	}

	async fetchMcpMarketplace(forceRefresh: boolean = false) {
		try {
			// Check if we have cached data
			const cachedCatalog = (await this.provider.getGlobalState("mcpMarketplaceCatalog")) as
				| McpMarketplaceCatalog
				| undefined
			if (!forceRefresh && cachedCatalog?.items) {
				await this.provider.postMessageToWebview({
					type: "mcpMarketplaceCatalog",
					mcpMarketplaceCatalog: cachedCatalog,
				})
				return
			}

			const catalog = await this.fetchMcpMarketplaceFromApi(false)
			if (catalog) {
				await this.provider.postMessageToWebview({
					type: "mcpMarketplaceCatalog",
					mcpMarketplaceCatalog: catalog,
				})
			}
		} catch (error) {
			console.error("Failed to handle cached MCP marketplace:", error)
			const errorMessage = error instanceof Error ? error.message : "Failed to handle cached MCP marketplace"
			await this.provider.postMessageToWebview({
				type: "mcpMarketplaceCatalog",
				error: errorMessage,
			})
			vscode.window.showErrorMessage(errorMessage)
		}
	}

	async downloadMcp(mcpHub: McpHub | undefined, mcpId: string) {
		try {
			// First check if we already have this MCP server installed
			const servers = mcpHub?.getServers() || []
			const isInstalled = servers.some((server: McpServer) => server.name === mcpId)

			if (isInstalled) {
				throw new Error("This MCP server is already installed")
			}

			// Fetch server details from marketplace
			const response = await axios.post<McpDownloadResponse>(
				"https://api.cline.bot/v1/mcp/download",
				{ mcpId },
				{
					headers: { "Content-Type": "application/json" },
					timeout: 10000,
				},
			)

			if (!response.data) {
				throw new Error("Invalid response from MCP marketplace API")
			}

			console.log("[downloadMcp] Response from download API", { response })

			const mcpDetails = response.data

			// Validate required fields
			if (!mcpDetails.githubUrl) {
				throw new Error("Missing GitHub URL in MCP download response")
			}
			if (!mcpDetails.readmeContent) {
				throw new Error("Missing README content in MCP download response")
			}

			// Send details to webview
			await this.provider.postMessageToWebview({
				type: "mcpDownloadDetails",
				mcpDownloadDetails: mcpDetails,
			})

			// Create task with context from README
			const task = `Set up the MCP server from ${mcpDetails.githubUrl}. Use "${mcpDetails.mcpId}" as the server name in cline_mcp_settings.json. Here is the project's README to help you get started:\n\n${mcpDetails.readmeContent}\n${mcpDetails.llmsInstallationContent}`

			// Initialize task and show chat view
			await this.provider.initClineWithTask(task)
			await this.provider.postMessageToWebview({
				type: "action",
				action: "chatButtonClicked",
			})
		} catch (error) {
			console.error("Failed to download MCP:", error)
			let errorMessage = "Failed to download MCP"

			if (axios.isAxiosError(error)) {
				if (error.code === "ECONNABORTED") {
					errorMessage = "Request timed out. Please try again."
				} else if (error.response?.status === 404) {
					errorMessage = "MCP server not found in marketplace."
				} else if (error.response?.status === 500) {
					errorMessage = "Internal server error. Please try again later."
				} else if (!error.response && error.request) {
					errorMessage = "Network error. Please check your internet connection."
				}
			} else if (error instanceof Error) {
				errorMessage = error.message
			}

			// Show error in both notification and marketplace UI
			vscode.window.showErrorMessage(errorMessage)
			await this.provider.postMessageToWebview({
				type: "mcpDownloadDetails",
				error: errorMessage,
			})
		}
	}

	async openMcpMarketplaceServerDetails(mcpId: string) {
		const response = await fetch(`https://api.cline.bot/v1/mcp/marketplace/item?mcpId=${mcpId}`)
		const details: McpDownloadResponse = await response.json()

		if (details.readmeContent) {
			// Disable markdown preview markers
			const config = vscode.workspace.getConfiguration("markdown")
			await config.update("preview.markEditorSelection", false, true)

			// Create URI with base64 encoded markdown content
			const uri = vscode.Uri.parse(
				`${DIFF_VIEW_URI_SCHEME}:${details.name} README?${Buffer.from(details.readmeContent).toString("base64")}`,
			)

			// close existing
			const tabs = vscode.window.tabGroups.all
				.flatMap((tg) => tg.tabs)
				.filter((tab) => tab.label && tab.label.includes("README") && tab.label.includes("Preview"))
			for (const tab of tabs) {
				await vscode.window.tabGroups.close(tab)
			}

			// Show only the preview
			await vscode.commands.executeCommand("markdown.showPreview", uri, {
				sideBySide: true,
				preserveFocus: true,
			})
		}
	}
}
