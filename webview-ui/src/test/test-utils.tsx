import React from "react"
import { render } from "@testing-library/react"
import { TranslationProvider } from "@/i18n/TranslationContext"
import { ExtensionStateContext } from "@/context/ExtensionStateContext"
import i18next from "i18next"
import { initReactI18next } from "react-i18next"

// Mock vscode API
;(global as any).acquireVsCodeApi = () => ({
	postMessage: jest.fn(),
})

// Initialize i18next for tests
i18next.use(initReactI18next).init({
	lng: "en",
	fallbackLng: "en",
	interpolation: {
		escapeValue: false,
	},
	resources: {
		en: {
			marketplace: {
				title: "Marketplace",
				tabs: {
					browse: "Browse",
					sources: "Sources",
				},
				filters: {
					search: {
						placeholder: "Search marketplace items...",
					},
					type: {
						label: "Filter by type:",
						all: "All types",
						package: "Package",
						mode: "Mode",
						mcp: "MCP Server",
						prompt: "Prompt",
					},
					sort: {
						label: "Sort by:",
						name: "Name",
						author: "Author",
						lastUpdated: "Last Updated",
					},
					tags: {
						label: "Filter by tags:",
						available: "{{count}} available",
						clear: "Clear tags ({{count}})",
						placeholder: "Type to search and select tags...",
						noResults: "No matching tags found",
						selected: "Showing items with any of the selected tags ({{count}} selected)",
						clickToFilter: "Click tags to filter items",
					},
				},
				items: {
					empty: {
						noItems: "No marketplace items found",
						withFilters: "Try adjusting your filters",
						noSources: "Try adding a source in the Sources tab",
					},
					count: "{{count}} items found",
					components: "{{count}} components",
					refresh: {
						button: "Refresh",
						refreshing: "Refreshing...",
					},
					card: {
						by: "by {{author}}",
						from: "from {{source}}",
						viewSource: "View",
						viewOnSource: "View on {{source}}",
						actionsMenuLabel: "Actions",
					},
				},
				"type-group": {
					mcps: "MCP Servers",
					modes: "Modes",
					prompts: "Prompts",
					packages: "Packages",
					match: "Match",
					"generic-type": "{{type}}s",
				},
			},
		},
	},
})

// Minimal mock state
const mockExtensionState = {
	language: "en",
	marketplaceSources: [{ url: "test-url", enabled: true }],
	setMarketplaceSources: jest.fn(),
	experiments: {
		search_and_replace: false,
		insert_content: false,
		powerSteering: false,
	},
}

export const renderWithProviders = (ui: React.ReactElement) => {
	return render(
		<ExtensionStateContext.Provider value={mockExtensionState as any}>
			<TranslationProvider>{ui}</TranslationProvider>
		</ExtensionStateContext.Provider>,
	)
}
