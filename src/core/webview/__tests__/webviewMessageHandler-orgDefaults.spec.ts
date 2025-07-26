import { describe, it, expect, vi, beforeEach } from "vitest"
import * as vscode from "vscode"
import { CloudService } from "@roo-code/cloud"
import { webviewMessageHandler } from "../webviewMessageHandler"
import { ClineProvider } from "../ClineProvider"
import { ProviderSettings } from "@roo-code/types"

// Mock CloudService
vi.mock("@roo-code/cloud", () => ({
	CloudService: {
		instance: {
			getOrganizationSettings: vi.fn(),
		},
	},
}))

describe("webviewMessageHandler - Organization Defaults", () => {
	let mockProvider: any
	let mockMarketplaceManager: any

	beforeEach(() => {
		// Reset mocks
		vi.clearAllMocks()

		// Create mock provider
		mockProvider = {
			log: vi.fn(),
			upsertProviderProfile: vi.fn(),
			postMessageToWebview: vi.fn(),
			getState: vi.fn().mockResolvedValue({
				apiConfiguration: {},
				currentApiConfigName: "test-config",
			}),
		}

		// Create mock marketplace manager
		mockMarketplaceManager = {}
	})

	it("should apply organization default settings when creating a new profile", async () => {
		// Mock organization settings with defaults
		const orgDefaults = {
			anthropic: {
				apiProvider: "anthropic" as const,
				anthropicApiKey: "org-default-key",
				apiModelId: "claude-3-opus-20240229",
				temperature: 0.7,
			},
		}

		vi.mocked(CloudService.instance.getOrganizationSettings).mockResolvedValue({
			version: 1,
			defaultSettings: {},
			allowList: { allowAll: true, providers: {} },
			defaultProviderSettings: orgDefaults,
		})

		// Send upsertApiConfiguration message
		const message = {
			type: "upsertApiConfiguration" as const,
			text: "new-profile",
			apiConfiguration: {
				apiProvider: "anthropic",
				anthropicApiKey: "user-key", // User-provided key should take precedence
				// temperature is not provided, so org default should be used
			} as ProviderSettings,
		}

		await webviewMessageHandler(mockProvider, message, mockMarketplaceManager)

		// Verify that upsertProviderProfile was called with merged settings
		expect(mockProvider.upsertProviderProfile).toHaveBeenCalledWith("new-profile", {
			apiProvider: "anthropic",
			anthropicApiKey: "user-key", // User value takes precedence
			apiModelId: "claude-3-opus-20240229", // From org defaults
			temperature: 0.7, // From org defaults
		})
	})

	it("should handle missing organization settings gracefully", async () => {
		// Mock CloudService to throw an error
		vi.mocked(CloudService.instance.getOrganizationSettings).mockRejectedValue(new Error("Not authenticated"))

		// Send upsertApiConfiguration message
		const message = {
			type: "upsertApiConfiguration" as const,
			text: "new-profile",
			apiConfiguration: {
				apiProvider: "anthropic",
				anthropicApiKey: "user-key",
			} as ProviderSettings,
		}

		await webviewMessageHandler(mockProvider, message, mockMarketplaceManager)

		// Verify that error was logged
		expect(mockProvider.log).toHaveBeenCalledWith(expect.stringContaining("Failed to get organization defaults"))

		// Verify that upsertProviderProfile was still called with original settings
		expect(mockProvider.upsertProviderProfile).toHaveBeenCalledWith("new-profile", {
			apiProvider: "anthropic",
			anthropicApiKey: "user-key",
		})
	})

	it("should not apply defaults for a different provider", async () => {
		// Mock organization settings with defaults for anthropic
		const orgDefaults = {
			anthropic: {
				apiProvider: "anthropic" as const,
				anthropicApiKey: "org-default-key",
				apiModelId: "claude-3-opus-20240229",
			},
		}

		vi.mocked(CloudService.instance.getOrganizationSettings).mockResolvedValue({
			version: 1,
			defaultSettings: {},
			allowList: { allowAll: true, providers: {} },
			defaultProviderSettings: orgDefaults,
		})

		// Send upsertApiConfiguration message for openai provider
		const message = {
			type: "upsertApiConfiguration" as const,
			text: "new-profile",
			apiConfiguration: {
				apiProvider: "openai",
				openAiApiKey: "user-key",
			} as ProviderSettings,
		}

		await webviewMessageHandler(mockProvider, message, mockMarketplaceManager)

		// Verify that only the user-provided settings were used
		expect(mockProvider.upsertProviderProfile).toHaveBeenCalledWith("new-profile", {
			apiProvider: "openai",
			openAiApiKey: "user-key",
		})
	})
})
