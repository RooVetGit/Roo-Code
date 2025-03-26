import { ConfigManager } from "../ConfigManager"
import { ExtensionContext } from "vscode"
import path from "path"
import fs from "fs"

// Mock class to simulate VSCode extension context
class MockExtensionContext {
	private _globalState: Record<string, any>
	private _secrets: Record<string, any>
	private _storageUri: { fsPath: string }
	private _globalStorageUri: { fsPath: string }

	constructor(initialGlobalState = {}, initialSecrets = {}) {
		this._globalState = initialGlobalState
		this._secrets = initialSecrets
		this._storageUri = { fsPath: path.join(__dirname, "mock-storage") }
		this._globalStorageUri = { fsPath: path.join(__dirname, "mock-global-storage") }
	}

	get globalState() {
		return {
			get: jest.fn().mockImplementation((key) => Promise.resolve(this._globalState[key])),
			update: jest.fn().mockImplementation((key, value) => {
				this._globalState[key] = value
				return Promise.resolve()
			}),
		}
	}

	get secrets() {
		return {
			get: jest.fn().mockImplementation((key) => Promise.resolve(this._secrets[key])),
			store: jest.fn().mockImplementation((key, value) => {
				this._secrets[key] = value
				return Promise.resolve()
			}),
			delete: jest.fn().mockImplementation((key) => {
				delete this._secrets[key]
				return Promise.resolve()
			}),
		}
	}

	get storageUri() {
		return this._storageUri
	}

	get globalStorageUri() {
		return this._globalStorageUri
	}
}

describe("Rate Limit Migration Tests", () => {
	beforeEach(() => {
		jest.clearAllMocks()
	})

	it("should migrate existing global rate limit to all profiles", async () => {
		// Case 1: Test migration with existing global rate limit
		const context1 = new MockExtensionContext(
			{ rateLimitSeconds: 10 }, // Global state with rateLimitSeconds set to 10
			{
				roo_cline_config_api_config: JSON.stringify({
					currentApiConfigName: "default",
					apiConfigs: {
						default: { id: "abc123" },
						profile1: { id: "def456", apiProvider: "anthropic" },
						profile2: { id: "ghi789", apiProvider: "openrouter" },
					},
				}),
			},
		)

		// Use a type assertion to bypass TypeScript's type checking
		const configManager1 = new ConfigManager(context1 as unknown as ExtensionContext)

		// Wait for initialization to complete
		await new Promise((resolve) => setTimeout(resolve, 100))

		// Check if the migration was applied
		const config1 = JSON.parse((await context1.secrets.get("roo_cline_config_api_config")) as string)

		// Verify migrations flag is set
		expect(config1.migrations.rateLimitMigrated).toBeTruthy()

		// Verify rate limits were applied to all profiles
		expect(config1.apiConfigs.default.rateLimitSeconds).toBe(10)
		expect(config1.apiConfigs.profile1.rateLimitSeconds).toBe(10)
		expect(config1.apiConfigs.profile2.rateLimitSeconds).toBe(10)
	})

	it("should use default rate limit when no global rate limit exists", async () => {
		// Case 2: Test migration without global rate limit (should use default value)
		const context2 = new MockExtensionContext(
			{}, // No global state
			{
				roo_cline_config_api_config: JSON.stringify({
					currentApiConfigName: "default",
					apiConfigs: {
						default: { id: "abc123" },
						profile1: { id: "def456", apiProvider: "anthropic" },
					},
				}),
			},
		)

		// Use a type assertion to bypass TypeScript's type checking
		const configManager2 = new ConfigManager(context2 as unknown as ExtensionContext)

		// Wait for initialization to complete
		await new Promise((resolve) => setTimeout(resolve, 100))

		// Check if the migration was applied with default value
		const config2 = JSON.parse((await context2.secrets.get("roo_cline_config_api_config")) as string)

		// Verify migrations flag is set
		expect(config2.migrations.rateLimitMigrated).toBeTruthy()

		// Verify default rate limits were applied
		expect(config2.apiConfigs.default.rateLimitSeconds).toBe(5) // Default is 5
		expect(config2.apiConfigs.profile1.rateLimitSeconds).toBe(5) // Default is 5
	})

	it("should apply rate limit to newly created profiles", async () => {
		// Case 3: Test creating new profile via saveConfig
		const context3 = new MockExtensionContext(
			{ rateLimitSeconds: 15 }, // Global state with rateLimitSeconds set to 15
			{
				roo_cline_config_api_config: JSON.stringify({
					currentApiConfigName: "default",
					apiConfigs: {
						default: { id: "abc123", rateLimitSeconds: 8 },
					},
					migrations: { rateLimitMigrated: true },
				}),
			},
		)

		// Use a type assertion to bypass TypeScript's type checking
		const configManager3 = new ConfigManager(context3 as unknown as ExtensionContext)

		// Wait for initialization to complete
		await new Promise((resolve) => setTimeout(resolve, 100))

		// Save a new profile
		await configManager3.saveConfig("newProfile", { apiProvider: "anthropic" })

		// Check if the new profile got a rate limit from existing profiles
		const config3 = JSON.parse((await context3.secrets.get("roo_cline_config_api_config")) as string)

		// The new profile should inherit rate limit from existing profiles (8s)
		expect(config3.apiConfigs.newProfile.rateLimitSeconds).toBe(8)
		expect(config3.apiConfigs.newProfile.apiProvider).toBe("anthropic")
	})
})
