import * as vscode from "vscode"
import { ClineProvider } from "./ClineProvider"
import { WebviewMessage } from "../../shared/WebviewMessage"
import { ExtensionMessage } from "../../shared/ExtensionMessage"
import {
	MarketplaceManager,
	ComponentType,
	MarketplaceItem,
	MarketplaceSource,
	validateSources,
	ValidationError,
} from "../../services/marketplace"
import { DEFAULT_MARKETPLACE_SOURCE } from "../../services/marketplace/constants"
import { GlobalState } from "../../schemas"

/**
 * Handle marketplace-related messages from the webview
 */
export async function handleMarketplaceMessages(
	provider: ClineProvider,
	message: WebviewMessage,
	marketplaceManager: MarketplaceManager,
): Promise<boolean> {
	// Utility function for updating global state
	const updateGlobalState = async <K extends keyof GlobalState>(key: K, value: GlobalState[K]) =>
		await provider.contextProxy.setValue(key, value)

	switch (message.type) {
		case "webviewDidLaunch": {
			// For webviewDidLaunch, we don't do anything - marketplace items will be loaded by explicit fetchMarketplaceItems
			return true
		}
		case "fetchMarketplaceItems": {
			// Prevent multiple simultaneous fetches
			if (marketplaceManager.isFetching) {
				await provider.postMessageToWebview({
					type: "state",
					text: "Fetch already in progress",
				})
				marketplaceManager.isFetching = false
				return true
			}

			// Check if we need to force refresh using type assertion
			const forceRefresh = (message as any).forceRefresh === true
			try {
				marketplaceManager.isFetching = true

				// Wrap the entire initialization in a try-catch block
				try {
					// Initialize default sources if none exist
					let sources =
						((await provider.contextProxy.getValue("marketplaceSources")) as MarketplaceSource[]) || []

					if (!sources || sources.length === 0) {
						sources = [DEFAULT_MARKETPLACE_SOURCE]

						// Save the default sources
						await provider.contextProxy.setValue("marketplaceSources", sources)
					}

					// Add timing information
					const startTime = Date.now()

					// Fetch items from all enabled sources
					const enabledSources = sources.filter((s) => s.enabled)

					if (enabledSources.length === 0) {
						vscode.window.showInformationMessage(
							"No enabled sources configured. Add and enable sources to view items.",
						)
						await provider.postStateToWebview()
						return true
					}

					const result = await marketplaceManager.getMarketplaceItems(enabledSources)

					// If there are errors but also items, show warning
					if (result.errors && result.items.length > 0) {
						vscode.window.showWarningMessage(
							`Some marketplace sources failed to load:\n${result.errors.join("\n")}`,
						)
					}
					// If there are errors and no items, show error
					else if (result.errors && result.items.length === 0) {
						const errorMessage = `Failed to load marketplace sources:\n${result.errors.join("\n")}`
						vscode.window.showErrorMessage(errorMessage)
						await provider.postMessageToWebview({
							type: "state",
							text: errorMessage,
						})
						marketplaceManager.isFetching = false
					}

					const endTime = Date.now()

					// The items are already stored in PackageManagerManager's currentItems
					// No need to store in global state

					// Send state to webview
					await provider.postStateToWebview()
				} catch (initError) {
					const errorMessage = `Marketplace initialization failed: ${initError instanceof Error ? initError.message : String(initError)}`
					console.error("Error in marketplace initialization:", initError)
					vscode.window.showErrorMessage(errorMessage)
					await provider.postMessageToWebview({
						type: "state",
						text: errorMessage,
					})
					// The state will already be updated with empty items by PackageManagerManager
					await provider.postStateToWebview()
					marketplaceManager.isFetching = false
				}
			} catch (error) {
				const errorMessage = `Failed to fetch marketplace items: ${error instanceof Error ? error.message : String(error)}`
				console.error("Failed to fetch marketplace items:", error)
				vscode.window.showErrorMessage(errorMessage)
				await provider.postMessageToWebview({
					type: "state",
					text: errorMessage,
				})
				marketplaceManager.isFetching = false
			}
			return true
		}
		case "marketplaceSources": {
			if (message.sources) {
				// Enforce maximum of 10 sources
				const MAX_SOURCES = 10
				let updatedSources: MarketplaceSource[]

				if (message.sources.length > MAX_SOURCES) {
					// Truncate to maximum allowed and show warning
					updatedSources = message.sources.slice(0, MAX_SOURCES)
					vscode.window.showWarningMessage(
						`Maximum of ${MAX_SOURCES} marketplace sources allowed. Additional sources have been removed.`,
					)
				} else {
					updatedSources = message.sources
				}

				// Validate sources using the validation utility
				const validationErrors = validateSources(updatedSources)

				// Filter out invalid sources
				if (validationErrors.length > 0) {
					// Create a map of invalid indices
					const invalidIndices = new Set<number>()
					validationErrors.forEach((error: ValidationError) => {
						// Extract index from error message (Source #X: ...)
						const match = error.message.match(/Source #(\d+):/)
						if (match && match[1]) {
							const index = parseInt(match[1], 10) - 1 // Convert to 0-based index
							if (index >= 0 && index < updatedSources.length) {
								invalidIndices.add(index)
							}
						}
					})

					// Filter out invalid sources
					updatedSources = updatedSources.filter((_, index) => !invalidIndices.has(index))

					// Show validation errors
					const errorMessage = `Marketplace sources validation failed:\n${validationErrors.map((e: ValidationError) => e.message).join("\n")}`
					console.error(errorMessage)
					vscode.window.showErrorMessage(errorMessage)
				}

				// Update the global state with the validated sources
				await updateGlobalState("marketplaceSources", updatedSources)

				// Clean up cache directories for repositories that are no longer in the sources list
				try {
					await marketplaceManager.cleanupCacheDirectories(updatedSources)
				} catch (error) {
					console.error("Marketplace: Error during cache cleanup:", error)
				}

				// Update the webview with the new state
				await provider.postStateToWebview()
			}
			return true
		}
		case "openExternal": {
			if (message.url) {
				try {
					vscode.env.openExternal(vscode.Uri.parse(message.url))
				} catch (error) {
					console.error(
						`Marketplace: Failed to open URL: ${error instanceof Error ? error.message : String(error)}`,
					)
					vscode.window.showErrorMessage(
						`Failed to open URL: ${error instanceof Error ? error.message : String(error)}`,
					)
				}
			} else {
				console.error("Marketplace: openExternal called without a URL")
			}
			return true
		}

		case "filterMarketplaceItems": {
			if (message.filters) {
				try {
					// Update filtered items and post state
					marketplaceManager.updateWithFilteredItems({
						type: message.filters.type as ComponentType | undefined,
						search: message.filters.search,
						tags: message.filters.tags,
					})
					await provider.postStateToWebview()
				} catch (error) {
					console.error("Marketplace: Error filtering items:", error)
					vscode.window.showErrorMessage("Failed to filter marketplace items")
				}
			}
			return true
		}

		case "installMarketplaceItem": {
			if (message.marketplaceItem) {
				try {
					await marketplaceManager.installMarketplaceItem(message.marketplaceItem)
				} catch (error) {
					vscode.window.showErrorMessage(
						`Failed to open URL: ${error instanceof Error ? error.message : String(error)}`,
					)
				}
			} else {
				console.error("Marketplace: installMarketplaceItem called without `marketplaceItem`")
			}
			return true
		}

		case "refreshMarketplaceSource": {
			if (message.url) {
				try {
					// Get the current sources
					const sources =
						((await provider.contextProxy.getValue("marketplaceSources")) as MarketplaceSource[]) || []

					// Find the source with the matching URL
					const source = sources.find((s) => s.url === message.url)

					if (source) {
						try {
							// Refresh the repository with the source name
							const refreshResult = await marketplaceManager.refreshRepository(message.url, source.name)
							if (refreshResult.error) {
								vscode.window.showErrorMessage(
									`Failed to refresh source: ${source.name || message.url} - ${refreshResult.error}`,
								)
							} else {
								vscode.window.showInformationMessage(
									`Successfully refreshed marketplace source: ${source.name || message.url}`,
								)
							}
							await provider.postStateToWebview()
						} finally {
							// Always notify the webview that the refresh is complete, even if it failed
							await provider.postMessageToWebview({
								type: "repositoryRefreshComplete",
								url: message.url,
							})
						}
					} else {
						console.error(`Marketplace: Source URL not found: ${message.url}`)
						vscode.window.showErrorMessage(`Source URL not found: ${message.url}`)
					}
				} catch (error) {
					console.error(
						`Marketplace: Failed to refresh source: ${error instanceof Error ? error.message : String(error)}`,
					)
					vscode.window.showErrorMessage(
						`Failed to refresh source: ${error instanceof Error ? error.message : String(error)}`,
					)
				}
			}
			return true
		}

		default:
			return false
	}
}
