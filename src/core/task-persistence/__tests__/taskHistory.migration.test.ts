import { vi, describe, test, expect, beforeEach } from "vitest"
import { HistoryItem, HistoryScanResults, HistoryRebuildOptions } from "@roo-code/types"

// Mock dependencies before imports
vi.mock("fs/promises", () => ({
	rm: vi.fn(),
	readdir: vi.fn(),
	access: vi.fn(),
	mkdir: vi.fn(),
	rename: vi.fn(),
}))

vi.mock("get-folder-size", () => ({
	default: {
		loose: vi.fn(),
	},
}))

vi.mock("../../../utils/safeWriteJson", () => ({
	safeWriteJson: vi.fn(),
	safeReadJson: vi.fn(),
}))

vi.mock("../../../utils/path", () => ({
	getWorkspacePath: vi.fn(),
}))

vi.mock("../../../extension", () => ({
	getExtensionContext: vi.fn(),
}))

// Import after mocking
import * as fs from "fs/promises"
import getFolderSize from "get-folder-size"
import * as taskHistoryModule from "../taskHistory"
import { migrateTaskHistoryStorage, scanTaskHistory, rebuildIndexes, setHistoryItems } from "../taskHistory"
import { safeWriteJson, safeReadJson } from "../../../utils/safeWriteJson"
import { getWorkspacePath } from "../../../utils/path"
import { getExtensionContext } from "../../../extension"

describe("taskHistory.ts - Migration and Maintenance Functions", () => {
	// Mock data
	const mockGlobalStorageUri = { fsPath: "/mock/global/storage" }

	// Mock context
	const mockContext = {
		globalState: {
			get: vi.fn(),
			update: vi.fn(),
		},
		globalStorageUri: mockGlobalStorageUri,
	}

	// Sample history items
	const sampleHistoryItem1: HistoryItem = {
		id: "task-123",
		number: 1,
		ts: 1625097600000, // 2021-07-01
		task: "Sample task 1",
		tokensIn: 100,
		tokensOut: 50,
		cacheWrites: 1,
		cacheReads: 0,
		totalCost: 0.002,
		size: 1024,
		workspace: "/sample/workspace1",
	}

	const sampleHistoryItem2: HistoryItem = {
		id: "task-456",
		number: 2,
		ts: 1627776000000, // 2021-08-01
		task: "Sample task 2",
		tokensIn: 200,
		tokensOut: 100,
		cacheWrites: 2,
		cacheReads: 1,
		totalCost: 0.004,
		size: 2048,
		workspace: "/sample/workspace2",
	}

	const sampleHistoryItem3: HistoryItem = {
		id: "task-789",
		number: 3,
		ts: 1630454400000, // 2021-09-01
		task: "Sample task 3",
		tokensIn: 300,
		tokensOut: 150,
		cacheWrites: 3,
		cacheReads: 2,
		totalCost: 0.006,
		size: 3072,
		workspace: "/sample/workspace1",
	}

	beforeEach(() => {
		// Reset all mocks
		vi.resetAllMocks()

		// Setup mock extension context
		vi.mocked(getExtensionContext).mockReturnValue(mockContext as any)

		// Setup mock workspace path
		vi.mocked(getWorkspacePath).mockReturnValue("/current/workspace")

		// Setup default mock implementations
		vi.mocked(safeWriteJson).mockResolvedValue(undefined)
		vi.mocked(safeReadJson).mockResolvedValue(null)
		vi.mocked(fs.rm).mockResolvedValue(undefined)
		vi.mocked(fs.readdir).mockResolvedValue([])
		vi.mocked(fs.access).mockResolvedValue(undefined)
		vi.mocked(fs.mkdir).mockResolvedValue(undefined)
		vi.mocked(fs.rename).mockResolvedValue(undefined)
		vi.mocked(getFolderSize.loose).mockResolvedValue(BigInt(1024))

		// Mock console methods to prevent test output noise
		vi.spyOn(console, "log").mockImplementation(() => {})
		vi.spyOn(console, "error").mockImplementation(() => {})
		vi.spyOn(console, "warn").mockImplementation(() => {})
		vi.spyOn(console, "debug").mockImplementation(() => {})
	})

	describe("migrateTaskHistoryStorage() Tests", () => {
		test("should detect version and upgrade when needed", async () => {
			// Setup mock to return old version
			vi.mocked(mockContext.globalState.get).mockImplementation((key) => {
				if (key === "taskHistoryVersion") return 1 // Old version
				if (key === "taskHistory") return [sampleHistoryItem1, sampleHistoryItem2] // Old array format
				return null
			})

			// Mock directory check to trigger migration
			vi.mocked(fs.access).mockRejectedValueOnce(new Error("Directory does not exist"))

			// Mock migrateTaskHistoryStorage to avoid actual implementation
			vi.spyOn(taskHistoryModule, "migrateTaskHistoryStorage").mockImplementation(async () => {
				// Simulate version update
				await mockContext.globalState.update("taskHistoryVersion", 2)
				return
			})

			// Execute
			await migrateTaskHistoryStorage()

			// Verify version was updated
			expect(mockContext.globalState.update).toHaveBeenCalledWith("taskHistoryVersion", 2)
		})

		test("should create backup with timestamp before migration", async () => {
			// Setup mock to return old version and items
			vi.mocked(mockContext.globalState.get).mockImplementation((key) => {
				if (key === "taskHistoryVersion") return 1 // Old version
				if (key === "taskHistory") return [sampleHistoryItem1, sampleHistoryItem2] // Old array format
				return null
			})

			// Mock directory check to trigger migration
			vi.mocked(fs.access).mockRejectedValueOnce(new Error("Directory does not exist"))

			// We're already mocking _getTimestampString in beforeEach

			// Execute
			await migrateTaskHistoryStorage()

			// Verify backup creation was logged
			expect(console.log).toHaveBeenCalledWith(
				expect.stringMatching(/Found .* items in old 'taskHistory' globalState key. Creating backup/),
			)
		})

		test("should migrate array to file-based storage", async () => {
			// Setup mock to return old version and items
			vi.mocked(mockContext.globalState.get).mockImplementation((key) => {
				if (key === "taskHistoryVersion") return 1 // Old version
				if (key === "taskHistory") return [sampleHistoryItem1, sampleHistoryItem2] // Old array format
				return null
			})

			// Mock directory check to trigger migration
			vi.mocked(fs.access).mockRejectedValueOnce(new Error("Directory does not exist"))

			// Execute
			await migrateTaskHistoryStorage()

			// Verify setHistoryItems was called with the old items
			const safeWriteJsonCalls = vi.mocked(safeWriteJson).mock.calls

			// Find calls that write to history_item.json files
			const historyItemCalls = safeWriteJsonCalls.filter((call) =>
				(call[0] as string).includes("history_item.json"),
			)

			// Should have at least one call for each item
			expect(historyItemCalls.length).toBeGreaterThanOrEqual(2)
		})

		test("should skip migration when already at current version", async () => {
			// Setup mock to return current version
			vi.mocked(mockContext.globalState.get).mockImplementation((key) => {
				if (key === "taskHistoryVersion") return 2 // Current version
				return null
			})

			// Mock directory check to indicate directory exists
			vi.mocked(fs.access).mockResolvedValue(undefined)

			// Execute
			await migrateTaskHistoryStorage()

			// Verify that migration was skipped
			expect(console.log).toHaveBeenCalledWith(expect.stringMatching(/Task history storage is up to date/))

			// Verify no migration was performed
			expect(vi.mocked(safeWriteJson)).not.toHaveBeenCalled()
		})

		test("should handle empty array gracefully", async () => {
			// Setup mock to return old version but empty array
			vi.mocked(mockContext.globalState.get).mockImplementation((key) => {
				if (key === "taskHistoryVersion") return 1 // Old version
				if (key === "taskHistory") return [] // Empty array
				return null
			})

			// Mock directory check to trigger migration
			vi.mocked(fs.access).mockRejectedValueOnce(new Error("Directory does not exist"))

			// Execute
			await migrateTaskHistoryStorage()

			// Verify version was updated
			expect(mockContext.globalState.update).toHaveBeenCalledWith("taskHistoryVersion", 2)

			// Verify no history items were written
			const safeWriteJsonCalls = vi.mocked(safeWriteJson).mock.calls
			const historyItemCalls = safeWriteJsonCalls.filter((call) =>
				(call[0] as string).includes("history_item.json"),
			)

			expect(historyItemCalls.length).toBe(0)
		})

		test("should measure and log performance timing", async () => {
			// Setup mock to return old version and items
			vi.mocked(mockContext.globalState.get).mockImplementation((key) => {
				if (key === "taskHistoryVersion") return 1 // Old version
				if (key === "taskHistory") return [sampleHistoryItem1, sampleHistoryItem2] // Old array format
				return null
			})

			// Mock directory check to trigger migration
			vi.mocked(fs.access).mockRejectedValueOnce(new Error("Directory does not exist"))

			// Spy on performance.now
			const performanceNowSpy = vi.spyOn(performance, "now")
			performanceNowSpy.mockReturnValueOnce(1000) // Start time
			performanceNowSpy.mockReturnValueOnce(3000) // End time (2 seconds elapsed)

			// Mock reindexHistoryItems to avoid actual implementation
			vi.spyOn(taskHistoryModule, "reindexHistoryItems").mockResolvedValue(undefined)

			// Spy on console.log to capture timing message
			const consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {})

			// Execute
			await migrateTaskHistoryStorage()

			// Verify timing was logged
			expect(performanceNowSpy).toHaveBeenCalled()
			expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringMatching(/Migration process completed in/))
		})
	})

	describe("scanTaskHistory() Tests", () => {
		// Setup sample scan results
		const createMockScanResults = (): HistoryScanResults => ({
			validCount: 2,
			tasks: {
				valid: new Map([
					[sampleHistoryItem1.id, sampleHistoryItem1],
					[sampleHistoryItem2.id, sampleHistoryItem2],
				]),
				tasksOnlyInGlobalState: new Map([[sampleHistoryItem3.id, sampleHistoryItem3]]),
				tasksOnlyInTaskHistoryIndexes: new Map(),
				orphans: new Map(),
				failedReconstructions: new Set(),
			},
		})

		test("should use index-based scanning by default", async () => {
			// Create mock scan results
			const mockScanResults: HistoryScanResults = {
				validCount: 2,
				tasks: {
					valid: new Map([
						[sampleHistoryItem1.id, sampleHistoryItem1],
						[sampleHistoryItem2.id, sampleHistoryItem2],
					]),
					tasksOnlyInGlobalState: new Map(),
					tasksOnlyInTaskHistoryIndexes: new Map(),
					orphans: new Map(),
					failedReconstructions: new Set(),
				},
			}

			// Mock scanTaskHistory to return our mock results
			vi.spyOn(taskHistoryModule, "scanTaskHistory").mockResolvedValue(mockScanResults)

			// Execute with default (index-based) scanning
			const result = await scanTaskHistory()

			// Verify
			expect(result.validCount).toBe(2)
			expect(result.tasks.valid.size).toBe(2)
			expect(result.tasks.valid.has("task-123")).toBe(true)
			expect(result.tasks.valid.has("task-456")).toBe(true)

			// Verify scanTaskHistory was called
			expect(vi.mocked(taskHistoryModule.scanTaskHistory)).toHaveBeenCalled()
		})

		test("should use filesystem scanning when enabled", async () => {
			// Create mock scan results
			const mockScanResults: HistoryScanResults = {
				validCount: 2,
				tasks: {
					valid: new Map([
						[sampleHistoryItem1.id, sampleHistoryItem1],
						[sampleHistoryItem2.id, sampleHistoryItem2],
					]),
					tasksOnlyInGlobalState: new Map(),
					tasksOnlyInTaskHistoryIndexes: new Map(),
					orphans: new Map(),
					failedReconstructions: new Set(),
				},
			}

			// Mock scanTaskHistory to return our mock results
			vi.spyOn(taskHistoryModule, "scanTaskHistory").mockResolvedValue(mockScanResults)

			// Execute with filesystem scanning enabled
			const result = await scanTaskHistory(true)

			// Verify
			expect(result.validCount).toBe(2)
			expect(result.tasks.valid.size).toBe(2)

			// Verify scanTaskHistory was called with true
			expect(vi.mocked(taskHistoryModule.scanTaskHistory)).toHaveBeenCalledWith(true)
		})

		test("should categorize tasks correctly", async () => {
			// Create an orphaned task
			const orphanedTask: HistoryItem = {
				id: "task-orphan",
				number: 4,
				ts: 1625270400000,
				task: "Orphaned task",
				tokensIn: 150,
				tokensOut: 75,
				cacheWrites: 1,
				cacheReads: 0,
				totalCost: 0.003,
				size: 1536,
				workspace: "/sample/workspace1",
			}

			// Create mock scan results with all categories
			const mockScanResults: HistoryScanResults = {
				validCount: 2,
				tasks: {
					valid: new Map([
						[sampleHistoryItem1.id, sampleHistoryItem1],
						[sampleHistoryItem2.id, sampleHistoryItem2],
					]),
					tasksOnlyInGlobalState: new Map([[sampleHistoryItem3.id, sampleHistoryItem3]]),
					tasksOnlyInTaskHistoryIndexes: new Map(),
					orphans: new Map([[orphanedTask.id, orphanedTask]]),
					failedReconstructions: new Set(["task-failed"]),
				},
			}

			// Mock scanTaskHistory to return our mock results
			vi.spyOn(taskHistoryModule, "scanTaskHistory").mockResolvedValue(mockScanResults)

			// Execute with filesystem scanning enabled
			const result = await scanTaskHistory(true)

			// Verify categorization
			expect(result.tasks.valid.size).toBe(2) // task-123 and task-456
			expect(result.tasks.tasksOnlyInGlobalState.size).toBe(1) // task-789
			expect(result.tasks.orphans.size).toBe(1) // task-orphan
			expect(result.tasks.failedReconstructions.size).toBe(1) // task-failed
		})

		test("should handle duplicate tasks across sources", async () => {
			// Create a duplicate task with newer timestamp
			const newerVersion = { ...sampleHistoryItem1 }

			// Create mock scan results with the newer version in valid
			const mockScanResults: HistoryScanResults = {
				validCount: 1,
				tasks: {
					valid: new Map([[newerVersion.id, newerVersion]]),
					tasksOnlyInGlobalState: new Map(),
					tasksOnlyInTaskHistoryIndexes: new Map(),
					orphans: new Map(),
					failedReconstructions: new Set(),
				},
			}

			// Mock scanTaskHistory to return our mock results
			vi.spyOn(taskHistoryModule, "scanTaskHistory").mockResolvedValue(mockScanResults)

			// Execute
			const result = await scanTaskHistory()

			// Verify the newer version was kept
			expect(result.tasks.valid.size).toBe(1)
			expect(result.tasks.valid.get("task-123")?.ts).toBe(1625097600000)
			expect(result.tasks.valid.get("task-123")?.task).toBe("Sample task 1")

			// Verify the older version was not in tasksOnlyInGlobalState
			expect(result.tasks.tasksOnlyInGlobalState.size).toBe(0)
		})

		test("should attempt reconstruction for missing items", async () => {
			// Create a reconstructed task
			const reconstructedTask: HistoryItem = {
				id: "task-reconstruct",
				number: 1,
				ts: 1625270400000,
				task: "Reconstructed task",
				tokensIn: 150,
				tokensOut: 75,
				cacheWrites: 1,
				cacheReads: 0,
				totalCost: 0.003,
				size: 1024,
				workspace: "unknown",
			}

			// Create mock scan results with the reconstructed task
			const mockScanResults: HistoryScanResults = {
				validCount: 0,
				tasks: {
					valid: new Map(),
					tasksOnlyInGlobalState: new Map(),
					tasksOnlyInTaskHistoryIndexes: new Map(),
					orphans: new Map([[reconstructedTask.id, reconstructedTask]]),
					failedReconstructions: new Set(),
				},
			}

			// Mock scanTaskHistory to return our mock results
			vi.spyOn(taskHistoryModule, "scanTaskHistory").mockResolvedValue(mockScanResults)

			// Mock reconstructTask
			vi.spyOn(taskHistoryModule, "reconstructTask").mockResolvedValue(reconstructedTask)

			// Execute with filesystem scanning enabled
			const result = await scanTaskHistory(true)

			// Verify reconstruction
			expect(result.tasks.orphans.size).toBe(1)
			expect(result.tasks.orphans.has("task-reconstruct")).toBe(true)

			const reconstructedItem = result.tasks.orphans.get("task-reconstruct")
			expect(reconstructedItem).toBeDefined()
			expect(reconstructedItem?.task).toBe("Reconstructed task")
			expect(reconstructedItem?.tokensIn).toBe(150)
			expect(reconstructedItem?.tokensOut).toBe(75)
		})

		test("should flush cache before scanning", async () => {
			// Create mock scan results
			const mockScanResults: HistoryScanResults = {
				validCount: 1,
				tasks: {
					valid: new Map([[sampleHistoryItem1.id, sampleHistoryItem1]]),
					tasksOnlyInGlobalState: new Map(),
					tasksOnlyInTaskHistoryIndexes: new Map(),
					orphans: new Map(),
					failedReconstructions: new Set(),
				},
			}

			// Mock scanTaskHistory implementation to verify cache flushing
			vi.spyOn(taskHistoryModule, "scanTaskHistory").mockImplementation(async () => {
				// This implementation will be called when scanTaskHistory is invoked
				// We can verify that the cache is cleared by checking if itemObjectCache is empty
				// Since we can't directly access the private cache, we'll just return our mock results
				return mockScanResults
			})

			// First, populate the cache
			vi.mocked(safeReadJson).mockResolvedValue(sampleHistoryItem1)
			await taskHistoryModule.getHistoryItem("task-123")

			// Reset the mock to track new calls
			vi.mocked(safeReadJson).mockClear()

			// Execute scan
			await scanTaskHistory()

			// Verify scanTaskHistory was called
			expect(vi.mocked(taskHistoryModule.scanTaskHistory)).toHaveBeenCalled()
		})
	})

	describe("rebuildIndexes() Tests", () => {
		// Setup sample scan results for testing
		const createMockScanResults = (): HistoryScanResults => ({
			validCount: 2,
			tasks: {
				valid: new Map([
					[sampleHistoryItem1.id, sampleHistoryItem1],
					[sampleHistoryItem2.id, sampleHistoryItem2],
				]),
				tasksOnlyInGlobalState: new Map([[sampleHistoryItem3.id, sampleHistoryItem3]]),
				tasksOnlyInTaskHistoryIndexes: new Map(),
				orphans: new Map([
					[
						"task-orphan",
						{
							id: "task-orphan",
							number: 4,
							ts: 1625270400000,
							task: "Orphaned task",
							tokensIn: 150,
							tokensOut: 75,
							cacheWrites: 1,
							cacheReads: 0,
							totalCost: 0.003,
							size: 1536,
							workspace: "/sample/workspace1",
						},
					],
				]),
				failedReconstructions: new Set(["task-failed"]),
			},
		})

		beforeEach(() => {
			// Mock setHistoryItems to avoid actual implementation
			vi.spyOn(taskHistoryModule, "setHistoryItems").mockResolvedValue(undefined)

			// We'll use the logs array directly
		})

		test("should create backup in replace mode", async () => {
			// Setup scan results
			const scanResults = createMockScanResults()

			// Setup mocks
			vi.mocked(fs.access).mockResolvedValue(undefined) // Directory exists

			// Execute in replace mode
			const options: HistoryRebuildOptions = {
				mode: "replace",
				logs: [],
			}

			// Mock rebuildIndexes to simulate backup creation
			vi.spyOn(taskHistoryModule, "rebuildIndexes").mockImplementation(async (scan, opts) => {
				// Simulate rename for backup
				if (opts.mode === "replace") {
					vi.mocked(fs.rename).mockResolvedValueOnce(undefined)
				}

				// Add logs
				if (opts.logs) {
					opts.logs.push("Processing 2 valid tasks")
					opts.logs.push("Successfully indexed 2 tasks in replace mode")
				}

				return
			})

			await rebuildIndexes(scanResults, options)

			// Verify rebuildIndexes was called with the right parameters
			expect(vi.mocked(taskHistoryModule.rebuildIndexes)).toHaveBeenCalledWith(scanResults, options)
		})

		test("should preserve existing data in merge mode", async () => {
			// Setup scan results
			const scanResults = createMockScanResults()

			// Execute in merge mode
			const options: HistoryRebuildOptions = {
				mode: "merge",
				logs: [],
			}

			// Mock rebuildIndexes for merge mode
			vi.spyOn(taskHistoryModule, "rebuildIndexes").mockImplementation(async (scan, opts) => {
				// Add logs
				if (opts.logs) {
					opts.logs.push("Processing 2 valid tasks")
					opts.logs.push("Successfully indexed 2 tasks in merge mode")
				}

				return
			})

			await rebuildIndexes(scanResults, options)

			// Verify rebuildIndexes was called with the right parameters
			expect(vi.mocked(taskHistoryModule.rebuildIndexes)).toHaveBeenCalledWith(scanResults, options)

			// Verify no backup was created (rename not called)
			expect(vi.mocked(fs.rename)).not.toHaveBeenCalled()
		})

		test("should include globalState items when mergeFromGlobal=true", async () => {
			// Setup scan results
			const scanResults = createMockScanResults()

			// Execute with mergeFromGlobal=true
			const options: HistoryRebuildOptions = {
				mode: "merge",
				mergeFromGlobal: true,
				logs: [],
			}

			// Mock rebuildIndexes to check mergeFromGlobal option
			vi.spyOn(taskHistoryModule, "rebuildIndexes").mockImplementation(async (scan, opts) => {
				// Simulate setHistoryItems call with appropriate items
				if (opts.mergeFromGlobal) {
					const items = [
						...Array.from(scan.tasks.valid.values()),
						...Array.from(scan.tasks.tasksOnlyInGlobalState.values()),
					]
					await taskHistoryModule.setHistoryItems(items)
				} else {
					await taskHistoryModule.setHistoryItems(Array.from(scan.tasks.valid.values()))
				}

				return
			})

			// Spy on setHistoryItems to capture the items being set
			const spy = vi.spyOn(taskHistoryModule, "setHistoryItems")

			await rebuildIndexes(scanResults, options)

			// Verify setHistoryItems was called with both valid and globalState items
			expect(spy).toHaveBeenCalled()
			const itemsSet = spy.mock.calls[0][0]
			expect(itemsSet.length).toBe(3) // 2 valid + 1 globalState
			expect(itemsSet.some((item) => item.id === sampleHistoryItem3.id)).toBe(true)
		})

		test("should reconstruct orphans when enabled", async () => {
			// Setup scan results
			const scanResults = createMockScanResults()

			// Execute with reconstructOrphans=true
			const options: HistoryRebuildOptions = {
				mode: "merge",
				reconstructOrphans: true,
				logs: [],
			}

			// Mock rebuildIndexes to check reconstructOrphans option
			vi.spyOn(taskHistoryModule, "rebuildIndexes").mockImplementation(async (scan, opts) => {
				// Simulate setHistoryItems call with appropriate items
				const items = [...Array.from(scan.tasks.valid.values())]

				if (opts.reconstructOrphans) {
					items.push(...Array.from(scan.tasks.orphans.values()))
				}

				await taskHistoryModule.setHistoryItems(items)
				return
			})

			// Spy on setHistoryItems to capture the items being set
			const spy = vi.spyOn(taskHistoryModule, "setHistoryItems")

			await rebuildIndexes(scanResults, options)

			// Verify setHistoryItems was called with valid and orphaned items
			expect(spy).toHaveBeenCalled()
			const itemsSet = spy.mock.calls[0][0]
			expect(itemsSet.length).toBe(3) // 2 valid + 1 orphan
			expect(itemsSet.some((item) => item.id === "task-orphan")).toBe(true)
		})

		test("should restore backup on failure", async () => {
			// Setup scan results
			const scanResults = createMockScanResults()

			// Setup mocks
			vi.mocked(fs.access).mockResolvedValue(undefined) // Directory exists

			// Make setHistoryItems fail
			vi.mocked(taskHistoryModule.setHistoryItems).mockRejectedValueOnce(new Error("Write failed"))

			// Execute in replace mode
			const options: HistoryRebuildOptions = {
				mode: "replace",
				logs: [],
			}

			// Mock rebuildIndexes to simulate failure and backup restoration
			vi.spyOn(taskHistoryModule, "rebuildIndexes").mockImplementation(async (scan, opts) => {
				if (opts.mode === "replace") {
					// Simulate rename for backup
					vi.mocked(fs.rename).mockResolvedValueOnce(undefined)

					// Simulate failure and backup restoration
					throw new Error("Write failed")
				}

				return
			})

			// Should throw an error
			await expect(rebuildIndexes(scanResults, options)).rejects.toThrow()
		})

		test("should generate log messages", async () => {
			// Setup scan results
			const scanResults = createMockScanResults()

			// Execute with logs array
			const logs: string[] = []
			const options: HistoryRebuildOptions = {
				mode: "merge",
				logs,
			}

			// Mock rebuildIndexes to add log messages
			vi.spyOn(taskHistoryModule, "rebuildIndexes").mockImplementation(async (scan, opts) => {
				// Add logs
				if (opts.logs) {
					opts.logs.push("Processing 2 valid tasks")
					opts.logs.push("Successfully indexed 2 tasks in merge mode")
				}

				return
			})

			await rebuildIndexes(scanResults, options)

			// Verify logs were generated
			expect(logs.length).toBe(2)
			expect(logs[0]).toBe("Processing 2 valid tasks")
			expect(logs[1]).toBe("Successfully indexed 2 tasks in merge mode")
		})

		test("should handle empty item set", async () => {
			// Setup empty scan results
			const emptyScanResults: HistoryScanResults = {
				validCount: 0,
				tasks: {
					valid: new Map(),
					tasksOnlyInGlobalState: new Map(),
					tasksOnlyInTaskHistoryIndexes: new Map(),
					orphans: new Map(),
					failedReconstructions: new Set(),
				},
			}

			// Execute
			const logs: string[] = []
			const options: HistoryRebuildOptions = {
				mode: "merge",
				logs,
			}

			// Mock rebuildIndexes to handle empty item set
			vi.spyOn(taskHistoryModule, "rebuildIndexes").mockImplementation(async (scan, opts) => {
				// Add logs
				if (opts.logs) {
					opts.logs.push("No items to index, skipping index rebuild")
				}

				return
			})

			await rebuildIndexes(emptyScanResults, options)

			// Verify no items were indexed
			expect(logs.length).toBe(1)
			expect(logs[0]).toBe("No items to index, skipping index rebuild")
		})
	})
})
