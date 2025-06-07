import { describe, it, expect, vi, beforeEach } from "vitest"
import { Task } from "../Task"
import { MultiSearchReplaceDiffStrategy } from "../../diff/strategies/multi-search-replace"
import { MultiFileSearchReplaceDiffStrategy } from "../../diff/strategies/multi-file-search-replace"
import { EXPERIMENT_IDS } from "../../../shared/experiments"

describe("Task - Dynamic Strategy Selection", () => {
	let mockProvider: any
	let mockApiConfig: any

	beforeEach(() => {
		vi.clearAllMocks()

		mockApiConfig = {
			apiProvider: "anthropic",
			apiKey: "test-key",
		}

		mockProvider = {
			context: {
				globalStorageUri: { fsPath: "/test/storage" },
			},
			getState: vi.fn(),
		}
	})

	it("should use MultiSearchReplaceDiffStrategy by default", async () => {
		mockProvider.getState.mockResolvedValue({
			experiments: {
				[EXPERIMENT_IDS.MULTI_FILE_APPLY_DIFF]: false,
			},
		})

		const task = new Task({
			provider: mockProvider,
			apiConfiguration: mockApiConfig,
			enableDiff: true,
			task: "test task",
			startTask: false,
		})

		// Initially should be MultiSearchReplaceDiffStrategy
		expect(task.diffStrategy).toBeInstanceOf(MultiSearchReplaceDiffStrategy)
		expect(task.diffStrategy?.getName()).toBe("MultiSearchReplace")
	})

	it("should switch to MultiFileSearchReplaceDiffStrategy when experiment is enabled", async () => {
		mockProvider.getState.mockResolvedValue({
			experiments: {
				[EXPERIMENT_IDS.MULTI_FILE_APPLY_DIFF]: true,
			},
		})

		const task = new Task({
			provider: mockProvider,
			apiConfiguration: mockApiConfig,
			enableDiff: true,
			task: "test task",
			startTask: false,
		})

		// Initially should be MultiSearchReplaceDiffStrategy
		expect(task.diffStrategy).toBeInstanceOf(MultiSearchReplaceDiffStrategy)

		// Wait for async strategy update
		await new Promise((resolve) => setTimeout(resolve, 10))

		// Should have switched to MultiFileSearchReplaceDiffStrategy
		expect(task.diffStrategy).toBeInstanceOf(MultiFileSearchReplaceDiffStrategy)
		expect(task.diffStrategy?.getName()).toBe("MultiFileSearchReplace")
	})

	it("should keep MultiSearchReplaceDiffStrategy when experiments are undefined", async () => {
		mockProvider.getState.mockResolvedValue({})

		const task = new Task({
			provider: mockProvider,
			apiConfiguration: mockApiConfig,
			enableDiff: true,
			task: "test task",
			startTask: false,
		})

		// Initially should be MultiSearchReplaceDiffStrategy
		expect(task.diffStrategy).toBeInstanceOf(MultiSearchReplaceDiffStrategy)

		// Wait for async strategy update
		await new Promise((resolve) => setTimeout(resolve, 10))

		// Should still be MultiSearchReplaceDiffStrategy
		expect(task.diffStrategy).toBeInstanceOf(MultiSearchReplaceDiffStrategy)
		expect(task.diffStrategy?.getName()).toBe("MultiSearchReplace")
	})

	it("should not create diff strategy when enableDiff is false", async () => {
		const task = new Task({
			provider: mockProvider,
			apiConfiguration: mockApiConfig,
			enableDiff: false,
			task: "test task",
			startTask: false,
		})

		expect(task.diffEnabled).toBe(false)
		expect(task.diffStrategy).toBeUndefined()
	})
})
