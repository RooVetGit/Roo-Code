import { describe, it, expect, beforeEach, vi } from "vitest"
import { TelemetryEventName } from "@roo-code/types"
import { TelemetryClient } from "../TelemetryClient"
import { AuthService } from "../AuthService"
import { SettingsService } from "../SettingsService"

// Mock dependencies
vi.mock("../AuthService")
vi.mock("../SettingsService")

// Mock fetch globally
global.fetch = vi.fn()

// Mock getRooCodeApiUrl
vi.mock("../Config", () => ({
	getRooCodeApiUrl: () => "https://api.test.com",
}))

const mockAuthService = {
	isAuthenticated: vi.fn(),
	getSessionToken: vi.fn(),
} as any

const mockSettingsService = {
	getSettings: vi.fn(),
} as any

const mockFetch = fetch as any

describe("TelemetryClient", () => {
	let client: TelemetryClient

	beforeEach(() => {
		vi.clearAllMocks()
		client = new TelemetryClient(mockAuthService, mockSettingsService, true)

		mockAuthService.isAuthenticated.mockReturnValue(true)
		mockAuthService.getSessionToken.mockReturnValue("test-token")
		mockSettingsService.getSettings.mockReturnValue({
			cloudSettings: { recordTaskMessages: false },
		})
	})

	describe("cloud telemetry client identification", () => {
		it("should identify itself as a cloud telemetry client", () => {
			// Access protected method for testing
			const isCloudClient = (client as any).isCloudTelemetryClient()
			expect(isCloudClient).toBe(true)
		})
	})

	describe("cloud telemetry properties", () => {
		it("should use cloud telemetry properties when provider supports them", async () => {
			const mockProvider = {
				getTelemetryProperties: vi.fn().mockResolvedValue({
					appName: "test-app",
					appVersion: "1.0.0",
					mode: "code",
				}),
				getCloudTelemetryProperties: vi.fn().mockResolvedValue({
					appName: "test-app",
					appVersion: "1.0.0",
					mode: "code",
					repositoryUrl: "https://github.com/user/repo.git",
					repositoryName: "user/repo",
					defaultBranch: "main",
				}),
			}

			client.setProvider(mockProvider)

			mockFetch.mockResolvedValue({
				ok: true,
			} as Response)

			await client.capture({
				event: TelemetryEventName.TASK_CREATED,
				properties: { taskId: "test-123" },
			})

			// Should call getCloudTelemetryProperties instead of getTelemetryProperties
			expect(mockProvider.getCloudTelemetryProperties).toHaveBeenCalled()
			expect(mockProvider.getTelemetryProperties).not.toHaveBeenCalled()

			// Verify the request was made with git properties
			expect(mockFetch).toHaveBeenCalledWith(
				"https://api.test.com/api/events",
				expect.objectContaining({
					method: "POST",
					body: expect.stringContaining("repositoryUrl"),
				}),
			)

			const callBody = JSON.parse(mockFetch.mock.calls[0][1]?.body as string)
			expect(callBody.properties).toEqual(
				expect.objectContaining({
					appName: "test-app",
					appVersion: "1.0.0",
					mode: "code",
					repositoryUrl: "https://github.com/user/repo.git",
					repositoryName: "user/repo",
					defaultBranch: "main",
					taskId: "test-123",
				}),
			)
		})

		it("should fallback to regular telemetry properties when cloud properties are not available", async () => {
			const mockProvider = {
				getTelemetryProperties: vi.fn().mockResolvedValue({
					appName: "test-app",
					appVersion: "1.0.0",
					mode: "code",
				}),
				// No getCloudTelemetryProperties method
			}

			client.setProvider(mockProvider)

			mockFetch.mockResolvedValue({
				ok: true,
			} as Response)

			await client.capture({
				event: TelemetryEventName.TASK_CREATED,
				properties: { taskId: "test-123" },
			})

			// Should call regular getTelemetryProperties
			expect(mockProvider.getTelemetryProperties).toHaveBeenCalled()

			// Verify the request was made without git properties
			const callBody = JSON.parse(mockFetch.mock.calls[0][1]?.body as string)
			expect(callBody.properties).toEqual(
				expect.objectContaining({
					appName: "test-app",
					appVersion: "1.0.0",
					mode: "code",
					taskId: "test-123",
				}),
			)
			expect(callBody.properties.repositoryUrl).toBeUndefined()
		})

		it("should handle errors when getting cloud telemetry properties", async () => {
			const mockProvider = {
				getTelemetryProperties: vi.fn().mockResolvedValue({
					appName: "test-app",
					appVersion: "1.0.0",
					mode: "code",
				}),
				getCloudTelemetryProperties: vi.fn().mockRejectedValue(new Error("Git error")),
			}

			// Mock console.error to avoid noise in tests
			const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})

			client.setProvider(mockProvider)

			mockFetch.mockResolvedValue({
				ok: true,
			} as Response)

			await client.capture({
				event: TelemetryEventName.TASK_CREATED,
				properties: { taskId: "test-123" },
			})

			// Should still send the event with event properties only
			expect(mockFetch).toHaveBeenCalled()
			expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("Error getting telemetry properties"))

			const callBody = JSON.parse(mockFetch.mock.calls[0][1]?.body as string)
			expect(callBody.properties).toEqual({ taskId: "test-123" })

			consoleSpy.mockRestore()
		})
	})
})
