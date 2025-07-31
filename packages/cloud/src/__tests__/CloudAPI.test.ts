/* eslint-disable @typescript-eslint/no-explicit-any */

import type { MockedFunction } from "vitest"

import { CloudAPIError, TaskNotFoundError, AuthenticationError, NetworkError } from "../errors"
import type { AuthService } from "../auth"

import { CloudAPI } from "../CloudAPI"

const mockFetch = vi.fn()
global.fetch = mockFetch as any

vi.mock("../Config", () => ({
	getRooCodeApiUrl: () => "https://app.roocode.com",
}))

vi.mock("../utils", () => ({
	getUserAgent: () => "Roo-Code 1.0.0",
}))

describe("CloudAPI", () => {
	let cloudAPI: CloudAPI
	let mockAuthService: AuthService
	let mockLog: MockedFunction<(...args: unknown[]) => void>

	beforeEach(() => {
		vi.clearAllMocks()
		mockFetch.mockClear()

		mockLog = vi.fn()
		mockAuthService = {
			getSessionToken: vi.fn(),
		} as any

		cloudAPI = new CloudAPI(mockAuthService, mockLog)
	})

	describe("constructor", () => {
		it("should initialize with auth service and logger", () => {
			expect(cloudAPI).toBeDefined()
			expect(mockLog).not.toHaveBeenCalled()
		})

		it("should use console.log when no logger provided", () => {
			const apiWithoutLogger = new CloudAPI(mockAuthService)
			expect(apiWithoutLogger).toBeDefined()
		})
	})

	describe("shareTask", () => {
		it("should successfully share a task with organization visibility", async () => {
			const mockResponse = {
				success: true,
				shareUrl: "https://app.roocode.com/share/abc123",
				isNewShare: true,
			}

			;(mockAuthService.getSessionToken as any).mockReturnValue("session-token")
			mockFetch.mockResolvedValue({
				ok: true,
				json: vi.fn().mockResolvedValue(mockResponse),
			})

			const result = await cloudAPI.shareTask("task-123", "organization")

			expect(result).toEqual(mockResponse)
			expect(mockFetch).toHaveBeenCalledWith("https://app.roocode.com/api/extension/share", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: "Bearer session-token",
					"User-Agent": "Roo-Code 1.0.0",
				},
				body: JSON.stringify({ taskId: "task-123", visibility: "organization" }),
				signal: expect.any(AbortSignal),
			})
			expect(mockLog).toHaveBeenCalledWith("[CloudAPI] Sharing task task-123 with visibility: organization")
			expect(mockLog).toHaveBeenCalledWith("[CloudAPI] Share response:", mockResponse)
		})

		it("should default to organization visibility when not specified", async () => {
			const mockResponse = { success: true }

			;(mockAuthService.getSessionToken as any).mockReturnValue("session-token")
			mockFetch.mockResolvedValue({
				ok: true,
				json: vi.fn().mockResolvedValue(mockResponse),
			})

			await cloudAPI.shareTask("task-123")

			expect(mockFetch).toHaveBeenCalledWith(
				"https://app.roocode.com/api/extension/share",
				expect.objectContaining({
					body: JSON.stringify({ taskId: "task-123", visibility: "organization" }),
				}),
			)
		})

		it("should handle public visibility", async () => {
			const mockResponse = { success: true }

			;(mockAuthService.getSessionToken as any).mockReturnValue("session-token")
			mockFetch.mockResolvedValue({
				ok: true,
				json: vi.fn().mockResolvedValue(mockResponse),
			})

			await cloudAPI.shareTask("task-123", "public")

			expect(mockFetch).toHaveBeenCalledWith(
				"https://app.roocode.com/api/extension/share",
				expect.objectContaining({
					body: JSON.stringify({ taskId: "task-123", visibility: "public" }),
				}),
			)
		})

		it("should throw AuthenticationError when no session token", async () => {
			;(mockAuthService.getSessionToken as any).mockReturnValue(undefined)

			await expect(cloudAPI.shareTask("task-123")).rejects.toThrow(AuthenticationError)
			await expect(cloudAPI.shareTask("task-123")).rejects.toThrow("Authentication required")
		})

		it("should throw TaskNotFoundError for 404 responses", async () => {
			;(mockAuthService.getSessionToken as any).mockReturnValue("session-token")
			mockFetch.mockResolvedValue({
				ok: false,
				status: 404,
				statusText: "Not Found",
				json: vi.fn().mockResolvedValue({ error: "Task not found" }),
			})

			await expect(cloudAPI.shareTask("task-123")).rejects.toThrow(TaskNotFoundError)
			await expect(cloudAPI.shareTask("task-123")).rejects.toThrow("Task not found")
		})

		it("should validate response schema", async () => {
			const invalidResponse = { invalid: "data" }

			;(mockAuthService.getSessionToken as any).mockReturnValue("session-token")
			mockFetch.mockResolvedValue({
				ok: true,
				json: vi.fn().mockResolvedValue(invalidResponse),
			})

			await expect(cloudAPI.shareTask("task-123")).rejects.toThrow()
		})
	})

	describe("registerTaskBridge", () => {
		it("should successfully register task bridge without URL", async () => {
			const mockResponse = {
				success: true,
				bridgeId: "bridge-123",
			}

			;(mockAuthService.getSessionToken as any).mockReturnValue("session-token")
			mockFetch.mockResolvedValue({
				ok: true,
				json: vi.fn().mockResolvedValue(mockResponse),
			})

			const result = await cloudAPI.registerTaskBridge("task-123")

			expect(result).toEqual(mockResponse)
			expect(mockFetch).toHaveBeenCalledWith("https://app.roocode.com/api/extension/task-bridge/register", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: "Bearer session-token",
					"User-Agent": "Roo-Code 1.0.0",
				},
				body: JSON.stringify({ taskId: "task-123" }),
				signal: expect.any(AbortSignal),
			})
			expect(mockLog).toHaveBeenCalledWith("[CloudAPI] Registering task bridge for task-123", "")
			expect(mockLog).toHaveBeenCalledWith("[CloudAPI] Task bridge registration response:", mockResponse)
		})

		it("should successfully register task bridge with URL", async () => {
			const mockResponse = {
				success: true,
				bridgeId: "bridge-123",
			}

			;(mockAuthService.getSessionToken as any).mockReturnValue("session-token")
			mockFetch.mockResolvedValue({
				ok: true,
				json: vi.fn().mockResolvedValue(mockResponse),
			})

			const result = await cloudAPI.registerTaskBridge("task-123", "redis://localhost:6379")

			expect(result).toEqual(mockResponse)
			expect(mockFetch).toHaveBeenCalledWith(
				"https://app.roocode.com/api/extension/task-bridge/register",
				expect.objectContaining({
					body: JSON.stringify({ taskId: "task-123", bridgeUrl: "redis://localhost:6379" }),
				}),
			)
			expect(mockLog).toHaveBeenCalledWith(
				"[CloudAPI] Registering task bridge for task-123",
				"with URL: redis://localhost:6379",
			)
		})

		it("should handle registration failure", async () => {
			const mockResponse = {
				success: false,
				error: "Task already has a bridge",
			}

			;(mockAuthService.getSessionToken as any).mockReturnValue("session-token")
			mockFetch.mockResolvedValue({
				ok: true,
				json: vi.fn().mockResolvedValue(mockResponse),
			})

			const result = await cloudAPI.registerTaskBridge("task-123")

			expect(result).toEqual(mockResponse)
			expect(result.success).toBe(false)
			expect(result.error).toBe("Task already has a bridge")
		})

		it("should throw AuthenticationError when no session token", async () => {
			;(mockAuthService.getSessionToken as any).mockReturnValue(undefined)

			await expect(cloudAPI.registerTaskBridge("task-123")).rejects.toThrow(AuthenticationError)
		})

		it("should validate response schema", async () => {
			const invalidResponse = { invalid: "data" }

			;(mockAuthService.getSessionToken as any).mockReturnValue("session-token")
			mockFetch.mockResolvedValue({
				ok: true,
				json: vi.fn().mockResolvedValue(invalidResponse),
			})

			await expect(cloudAPI.registerTaskBridge("task-123")).rejects.toThrow()
		})
	})

	describe("error handling", () => {
		it("should handle 401 authentication errors", async () => {
			;(mockAuthService.getSessionToken as any).mockReturnValue("session-token")
			mockFetch.mockResolvedValue({
				ok: false,
				status: 401,
				statusText: "Unauthorized",
				json: vi.fn().mockResolvedValue({ error: "Invalid token" }),
			})

			await expect(cloudAPI.shareTask("task-123")).rejects.toThrow(AuthenticationError)
		})

		it("should handle generic HTTP errors", async () => {
			;(mockAuthService.getSessionToken as any).mockReturnValue("session-token")
			mockFetch.mockResolvedValue({
				ok: false,
				status: 500,
				statusText: "Internal Server Error",
				json: vi.fn().mockResolvedValue({ error: "Server error" }),
			})

			await expect(cloudAPI.shareTask("task-123")).rejects.toThrow(CloudAPIError)
			await expect(cloudAPI.shareTask("task-123")).rejects.toThrow("HTTP 500: Internal Server Error")
		})

		it("should handle network errors", async () => {
			;(mockAuthService.getSessionToken as any).mockReturnValue("session-token")
			mockFetch.mockRejectedValue(new TypeError("Failed to fetch"))

			await expect(cloudAPI.shareTask("task-123")).rejects.toThrow(NetworkError)
			await expect(cloudAPI.shareTask("task-123")).rejects.toThrow(
				"Network error while calling /api/extension/share",
			)
		})

		it("should handle timeout errors", async () => {
			;(mockAuthService.getSessionToken as any).mockReturnValue("session-token")
			const timeoutError = new Error("AbortError")
			timeoutError.name = "AbortError"
			mockFetch.mockRejectedValue(timeoutError)

			await expect(cloudAPI.shareTask("task-123")).rejects.toThrow(CloudAPIError)
			await expect(cloudAPI.shareTask("task-123")).rejects.toThrow("Request to /api/extension/share timed out")
		})

		it("should handle unexpected errors", async () => {
			;(mockAuthService.getSessionToken as any).mockReturnValue("session-token")
			mockFetch.mockRejectedValue(new Error("Unexpected error"))

			await expect(cloudAPI.shareTask("task-123")).rejects.toThrow(CloudAPIError)
			await expect(cloudAPI.shareTask("task-123")).rejects.toThrow(
				"Unexpected error while calling /api/extension/share: Unexpected error",
			)
		})

		it("should handle non-JSON error responses", async () => {
			;(mockAuthService.getSessionToken as any).mockReturnValue("session-token")
			mockFetch.mockResolvedValue({
				ok: false,
				status: 500,
				statusText: "Internal Server Error",
				json: vi.fn().mockRejectedValue(new Error("Invalid JSON")),
				text: vi.fn().mockResolvedValue("Plain text error"),
			})

			await expect(cloudAPI.shareTask("task-123")).rejects.toThrow(CloudAPIError)
		})
	})

	describe("custom error classes", () => {
		it("should create CloudAPIError with correct properties", () => {
			const error = new CloudAPIError("Test error", 500, { details: "test" })
			expect(error).toBeInstanceOf(Error)
			expect(error.name).toBe("CloudAPIError")
			expect(error.message).toBe("Test error")
			expect(error.statusCode).toBe(500)
			expect(error.responseBody).toEqual({ details: "test" })
		})

		it("should create TaskNotFoundError with correct properties", () => {
			const error = new TaskNotFoundError("task-123")
			expect(error).toBeInstanceOf(CloudAPIError)
			expect(error).toBeInstanceOf(Error)
			expect(error.name).toBe("TaskNotFoundError")
			expect(error.message).toBe("Task 'task-123' not found")
			expect(error.statusCode).toBe(404)
		})

		it("should create TaskNotFoundError without taskId", () => {
			const error = new TaskNotFoundError()
			expect(error.message).toBe("Task not found")
		})

		it("should create AuthenticationError with correct properties", () => {
			const error = new AuthenticationError("Custom auth error")
			expect(error).toBeInstanceOf(CloudAPIError)
			expect(error).toBeInstanceOf(Error)
			expect(error.name).toBe("AuthenticationError")
			expect(error.message).toBe("Custom auth error")
			expect(error.statusCode).toBe(401)
		})

		it("should create NetworkError with correct properties", () => {
			const error = new NetworkError("Network failed")
			expect(error).toBeInstanceOf(CloudAPIError)
			expect(error).toBeInstanceOf(Error)
			expect(error.name).toBe("NetworkError")
			expect(error.message).toBe("Network failed")
			expect(error.statusCode).toBeUndefined()
		})
	})
})
