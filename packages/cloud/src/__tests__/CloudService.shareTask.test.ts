import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { CloudService } from "../CloudService"
import { ShareService, TaskNotFoundError } from "../ShareService"
import { TelemetryClient } from "../TelemetryClient"
import { AuthService } from "../AuthService"
import { SettingsService } from "../SettingsService"
import type { ClineMessage } from "@roo-code/types"

// Mock the dependencies
vi.mock("../ShareService")
vi.mock("../TelemetryClient")
vi.mock("../AuthService")
vi.mock("../SettingsService")

describe("CloudService.shareTask with ClineMessage retry logic", () => {
	let cloudService: CloudService
	let mockShareService: any
	let mockTelemetryClient: any
	let mockAuthService: any
	let mockSettingsService: any

	beforeEach(async () => {
		// Reset all mocks
		vi.clearAllMocks()

		// Reset CloudService singleton
		CloudService.resetInstance()

		// Create mock instances
		mockShareService = {
			shareTask: vi.fn(),
			canShareTask: vi.fn().mockResolvedValue(true),
		}

		mockTelemetryClient = {
			backfillMessages: vi.fn().mockResolvedValue(undefined),
		}

		mockAuthService = {
			initialize: vi.fn().mockResolvedValue(undefined),
			on: vi.fn(),
			off: vi.fn(),
			isAuthenticated: vi.fn().mockReturnValue(true),
			hasActiveSession: vi.fn().mockReturnValue(true),
			hasOrIsAcquiringActiveSession: vi.fn().mockReturnValue(true),
			getUserInfo: vi.fn().mockReturnValue(null),
			getStoredOrganizationId: vi.fn().mockReturnValue(null),
			getState: vi.fn().mockReturnValue("active"),
		}

		mockSettingsService = {
			initialize: vi.fn(),
			dispose: vi.fn(),
			getAllowList: vi.fn().mockReturnValue({}),
		}

		// Mock the constructors
		vi.mocked(ShareService).mockImplementation(() => mockShareService)
		vi.mocked(TelemetryClient).mockImplementation(() => mockTelemetryClient)
		vi.mocked(AuthService).mockImplementation(() => mockAuthService)
		vi.mocked(SettingsService).mockImplementation(() => mockSettingsService)

		// Create CloudService instance using the factory method
		cloudService = await CloudService.createInstance({} as any, {})
	})

	afterEach(() => {
		CloudService.resetInstance()
	})

	it("should call shareTask without retry when successful", async () => {
		const taskId = "test-task-id"
		const visibility = "organization"
		const clineMessages: ClineMessage[] = [
			{
				ts: Date.now(),
				type: "say",
				say: "text",
				text: "Hello world",
			},
		]

		const expectedResult = { success: true, shareUrl: "https://example.com/share/123" }
		mockShareService.shareTask.mockResolvedValue(expectedResult)

		const result = await cloudService.shareTask(taskId, visibility, clineMessages)

		expect(mockShareService.shareTask).toHaveBeenCalledTimes(1)
		expect(mockShareService.shareTask).toHaveBeenCalledWith(taskId, visibility)
		expect(mockTelemetryClient.backfillMessages).not.toHaveBeenCalled()
		expect(result).toEqual(expectedResult)
	})

	it("should retry with backfill when TaskNotFoundError occurs", async () => {
		const taskId = "test-task-id"
		const visibility = "organization"
		const clineMessages: ClineMessage[] = [
			{
				ts: Date.now(),
				type: "say",
				say: "text",
				text: "Hello world",
			},
		]

		const expectedResult = { success: true, shareUrl: "https://example.com/share/123" }

		// First call throws TaskNotFoundError, second call succeeds
		mockShareService.shareTask
			.mockRejectedValueOnce(new TaskNotFoundError(taskId))
			.mockResolvedValueOnce(expectedResult)

		const result = await cloudService.shareTask(taskId, visibility, clineMessages)

		expect(mockShareService.shareTask).toHaveBeenCalledTimes(2)
		expect(mockShareService.shareTask).toHaveBeenNthCalledWith(1, taskId, visibility)
		expect(mockShareService.shareTask).toHaveBeenNthCalledWith(2, taskId, visibility)
		expect(mockTelemetryClient.backfillMessages).toHaveBeenCalledTimes(1)
		expect(mockTelemetryClient.backfillMessages).toHaveBeenCalledWith(clineMessages, taskId)
		expect(result).toEqual(expectedResult)
	})

	it("should not retry when TaskNotFoundError occurs but no clineMessages provided", async () => {
		const taskId = "test-task-id"
		const visibility = "organization"

		const taskNotFoundError = new TaskNotFoundError(taskId)
		mockShareService.shareTask.mockRejectedValue(taskNotFoundError)

		await expect(cloudService.shareTask(taskId, visibility)).rejects.toThrow(TaskNotFoundError)

		expect(mockShareService.shareTask).toHaveBeenCalledTimes(1)
		expect(mockTelemetryClient.backfillMessages).not.toHaveBeenCalled()
	})

	it("should not retry when non-TaskNotFoundError occurs", async () => {
		const taskId = "test-task-id"
		const visibility = "organization"
		const clineMessages: ClineMessage[] = [
			{
				ts: Date.now(),
				type: "say",
				say: "text",
				text: "Hello world",
			},
		]

		const genericError = new Error("Some other error")
		mockShareService.shareTask.mockRejectedValue(genericError)

		await expect(cloudService.shareTask(taskId, visibility, clineMessages)).rejects.toThrow(genericError)

		expect(mockShareService.shareTask).toHaveBeenCalledTimes(1)
		expect(mockTelemetryClient.backfillMessages).not.toHaveBeenCalled()
	})

	it("should work with default parameters", async () => {
		const taskId = "test-task-id"
		const expectedResult = { success: true, shareUrl: "https://example.com/share/123" }
		mockShareService.shareTask.mockResolvedValue(expectedResult)

		const result = await cloudService.shareTask(taskId)

		expect(mockShareService.shareTask).toHaveBeenCalledTimes(1)
		expect(mockShareService.shareTask).toHaveBeenCalledWith(taskId, "organization")
		expect(result).toEqual(expectedResult)
	})
})
