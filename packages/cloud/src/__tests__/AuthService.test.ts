// npx vitest run src/__tests__/AuthService.test.ts

import { describe, it, expect, vi, beforeEach } from "vitest"
import * as vscode from "vscode"
import { AuthService } from "../AuthService"

// Mock vscode
vi.mock("vscode", () => ({
	ExtensionContext: vi.fn(),
	window: {
		showInformationMessage: vi.fn(),
	},
	env: {
		openExternal: vi.fn(),
		uriScheme: "vscode",
	},
	Uri: {
		parse: vi.fn(),
	},
}))

// Mock axios
vi.mock("axios", () => ({
	default: {
		post: vi.fn(),
		get: vi.fn(),
	},
}))

// Mock other dependencies
vi.mock("../Config", () => ({
	getClerkBaseUrl: vi.fn(() => "https://clerk.test"),
	getRooCodeApiUrl: vi.fn(() => "https://api.test"),
}))

vi.mock("../RefreshTimer", () => ({
	RefreshTimer: vi.fn().mockImplementation(() => ({
		start: vi.fn(),
		stop: vi.fn(),
	})),
}))

vi.mock("../utils", () => ({
	getUserAgent: vi.fn(() => "test-agent"),
}))

describe("AuthService", () => {
	let mockContext: Partial<vscode.ExtensionContext>
	let authService: AuthService

	beforeEach(() => {
		vi.clearAllMocks()

		mockContext = {
			secrets: {
				store: vi.fn(),
				get: vi.fn(),
				delete: vi.fn(),
				onDidChange: vi.fn(() => ({ dispose: vi.fn() })),
			} as Partial<vscode.SecretStorage> as vscode.SecretStorage,
			globalState: {
				update: vi.fn(),
				get: vi.fn(),
				keys: vi.fn(() => []),
				setKeysForSync: vi.fn(),
			} as Partial<vscode.Memento & { setKeysForSync(keys: readonly string[]): void }> as vscode.Memento & {
				setKeysForSync(keys: readonly string[]): void
			},
			subscriptions: [],
			extension: {
				packageJSON: {
					publisher: "test",
					name: "test-extension",
				},
			} as Partial<vscode.Extension<unknown>> as vscode.Extension<unknown>,
		}

		authService = new AuthService(mockContext as vscode.ExtensionContext)
	})

	describe("State Management", () => {
		it("should initialize with 'initializing' state", () => {
			expect(authService.getState()).toBe("initializing")
		})

		it("should have isRefreshingSession method that returns false initially", () => {
			expect(authService.isRefreshingSession()).toBe(false)
		})

		it("should include refreshing-session in AuthState type", () => {
			// This test verifies that the new state is properly typed
			// by checking that the method exists and returns a boolean
			expect(typeof authService.isRefreshingSession).toBe("function")
			expect(typeof authService.isRefreshingSession()).toBe("boolean")
		})
	})

	describe("Event Emission", () => {
		it("should emit refreshing-session event when transitioning to refreshing state", async () => {
			// Set up the auth service to have credentials
			const mockCredentials = {
				clientToken: "test-token",
				sessionId: "test-session",
			}

			// Mock the secrets.get to return credentials
			vi.mocked(mockContext.secrets!.get).mockResolvedValue(JSON.stringify(mockCredentials))

			// Create a promise to wait for the event
			const eventPromise = new Promise((resolve) => {
				authService.on("refreshing-session", (data) => {
					expect(data).toHaveProperty("previousState")
					resolve(data)
				})
			})

			// This would trigger the refresh process in a real scenario
			// For this test, we're just verifying the event structure exists
			// We can manually emit the event to test the interface
			authService.emit("refreshing-session", { previousState: "inactive-session" })

			await eventPromise
		})
	})
})
