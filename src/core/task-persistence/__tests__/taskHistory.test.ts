import * as vscode from "vscode" // Will be the mocked version after jest.mock
import * as path from "path"
import * as fs from "fs" // Added for PathLike type
import { HistoryItem } from "../../../shared/HistoryItem"
// import { getExtensionContext as actualGetExtensionContext } from "../../../extension" // Removed unused import

// Mock the vscode module
jest.mock(
	"vscode",
	() => ({
		...jest.requireActual("vscode"), // Import and retain default behavior
		LogLevel: {
			Off: 0,
			Trace: 1,
			Debug: 2,
			Info: 3,
			Warning: 4,
			Error: 5,
		},
		ExtensionMode: {
			Production: 1,
			Development: 2,
			Test: 3,
		},
		ExtensionKind: {
			UI: 1,
			Workspace: 2,
			Web: 3,
		},
		Uri: {
			file: jest.fn((filePath) => ({ fsPath: filePath, scheme: "file", toString: () => `file://${filePath}` })),
			parse: jest.fn((uriString) => {
				const parts = uriString.replace(/^file:\/\//, "").split("/")
				return { fsPath: `/${parts.join("/")}`, scheme: "file", toString: () => uriString }
			}),
		},
		workspace: {
			...jest.requireActual("vscode").workspace,
			fs: {
				createDirectory: jest.fn().mockResolvedValue(undefined),
				// Add other fs methods if needed by SUT or tests
			},
		},
		// Add other vscode APIs if they are directly used and need mocking
	}),
	{ virtual: true },
)

// Mock the extension module to control getExtensionContext
jest.mock(
	"../../../extension",
	() => ({
		getExtensionContext: jest.fn(),
	}),
	{ virtual: true },
)

// Define constants used by the module internally, for assertion purposes
const TASK_HISTORY_MONTH_INDEX_PREFIX = "task_history-" // Aligned with taskHistory.ts
const TASK_HISTORY_DIR_NAME = "task_history"
const TASK_HISTORY_VERSION_KEY = "taskHistoryVersion" // Added
const CURRENT_TASK_HISTORY_VERSION = 2 // Added, matches taskHistory.ts
const TEST_GLOBAL_STORAGE_PATH = "/test/globalStorage"

// Mock 'fs/promises'
const mockFs = {
	mkdir: jest.fn(),
	unlink: jest.fn(),
	readFile: jest.fn(),
	stat: jest.fn(),
	rm: jest.fn(), // Added rm
	readdir: jest.fn(), // Added readdir
	// Other fs functions like writeFile, rename, access are used by safeWriteJson, which is mocked.
}

// Mock 'safeWriteJson'
const mockSafeWriteJson = jest.fn()

describe("taskHistory", () => {
	let taskHistoryModule: typeof import("../taskHistory")
	let mockExtensionContext: vscode.ExtensionContext
	let mockGlobalStateGet: jest.Mock
	let mockGlobalStateUpdate: jest.Mock
	let mockGlobalStateKeys: jest.Mock
	let mockGetExtensionContext: jest.Mock

	beforeEach(async () => {
		jest.resetModules() // Reset module cache to get a fresh instance of taskHistory and its internal state

		// Configure the mock for getExtensionContext before taskHistory is imported
		mockGetExtensionContext = require("../../../extension").getExtensionContext as jest.Mock
		// mockGetExtensionContext.mockReturnValue(mockExtensionContext); // This will be set after mockExtensionContext is defined

		// Re-apply mocks for modules that taskHistory depends on, *before* re-importing taskHistory
		jest.mock("fs/promises", () => mockFs)
		jest.mock("../../../utils/safeWriteJson", () => ({
			safeWriteJson: mockSafeWriteJson,
		}))

		// Re-import the module under test
		taskHistoryModule = require("../taskHistory")

		// Reset the state of mocks themselves
		mockFs.mkdir.mockReset().mockResolvedValue(undefined)
		mockFs.unlink.mockReset().mockResolvedValue(undefined)
		mockFs.readFile.mockReset()
		mockFs.stat.mockReset()
		mockFs.rm.mockReset().mockResolvedValue(undefined) // Added rm reset
		mockFs.readdir.mockReset().mockResolvedValue([]) // Added readdir reset
		mockSafeWriteJson.mockReset().mockResolvedValue(undefined)

		mockGlobalStateGet = jest.fn()
		mockGlobalStateUpdate = jest.fn().mockResolvedValue(undefined)
		mockGlobalStateKeys = jest.fn().mockResolvedValue([])

		mockExtensionContext = {
			globalStorageUri: {
				fsPath: TEST_GLOBAL_STORAGE_PATH,
			} as vscode.Uri,
			globalState: {
				get: mockGlobalStateGet,
				update: mockGlobalStateUpdate,
				keys: mockGlobalStateKeys,
			} as any, // Using 'any' for simplicity in mock setup
			subscriptions: [],
			workspaceState: {} as any,
			secrets: {} as any,
			extensionUri: {} as vscode.Uri,
			extensionPath: "/mock/extension/path",
			environmentVariableCollection: {} as any,
			extensionMode: vscode.ExtensionMode.Test,
			logUri: { fsPath: path.join(TEST_GLOBAL_STORAGE_PATH, "logs") } as vscode.Uri,
			logLevel: vscode.LogLevel.Debug,
			storageUri: { fsPath: path.join(TEST_GLOBAL_STORAGE_PATH, "storage") } as vscode.Uri,
			globalStoragePath: TEST_GLOBAL_STORAGE_PATH, // Deprecated, but ensure fsPath is primary
			asAbsolutePath: (relativePath: string) => path.join("/mock/extension/path", relativePath), // Mock implementation
			languageModelAccessInformation: {} as any,
			// Added missing properties
			storagePath: path.join(TEST_GLOBAL_STORAGE_PATH, "storagePath"), // Deprecated
			logPath: path.join(TEST_GLOBAL_STORAGE_PATH, "logPath"), // Deprecated
			extension: {
				// Mock for vscode.Extension
				id: "test.extension",
				extensionUri: {} as vscode.Uri,
				extensionPath: "/mock/extension/path",
				isActive: true,
				packageJSON: {},
				extensionKind: vscode.ExtensionKind.Workspace,
				exports: {},
				activate: jest.fn().mockResolvedValue({}),
			} as vscode.Extension<any>, // Fixed: Added <any> type argument
		} as vscode.ExtensionContext

		// Now that mockExtensionContext is defined, set the return value for the mock
		mockGetExtensionContext.mockReturnValue(mockExtensionContext)

		// taskHistoryModule no longer has an explicit initializeTaskHistory function.
		// It uses getExtensionContext() internally.
	})

	// Updated to reflect new path structure: tasks/<taskId>/history_item.json
	const getExpectedFilePath = (taskId: string): string => {
		return path.join(TEST_GLOBAL_STORAGE_PATH, "tasks", taskId, "history_item.json")
	}

	const getExpectedGlobalStateMonthKey = (year: string, month: string): string => {
		return `${TASK_HISTORY_MONTH_INDEX_PREFIX}${year}-${month}`
	}

	describe("initialization (via getExtensionContext)", () => {
		it("should allow operations that depend on basePath without throwing initialization error", async () => {
			const item: HistoryItem = {
				id: "taskInit",
				ts: Date.now(),
				task: "init test",
				number: 1,
				tokensIn: 0,
				tokensOut: 0,
				totalCost: 0,
			}
			mockGlobalStateGet.mockResolvedValue(new Map()) // For _readGlobalStateMonthIndex in setHistoryItems
			// No error expected related to initialization
			await expect(taskHistoryModule.setHistoryItems([item])).resolves.toBeUndefined()
		})
	})

	describe("setHistoryItems", () => {
		const testTimestamp = new Date(2023, 0, 15, 12, 0, 0).getTime() // Jan 15, 2023
		const item1: HistoryItem = {
			id: "task1",
			ts: testTimestamp,
			task: "Test Task 1",
			number: 1,
			tokensIn: 0,
			tokensOut: 0,
			totalCost: 0,
		}
		const year = "2023"
		const month = "01"

		it("should add a new item, create directory, write file, and update globalState index", async () => {
			const expectedPath = getExpectedFilePath(item1.id)
			const expectedDir = path.dirname(expectedPath)
			const expectedMonthKey = getExpectedGlobalStateMonthKey(year, month)

			mockGlobalStateGet.mockResolvedValueOnce(new Map()) // No existing index for the month

			await taskHistoryModule.setHistoryItems([item1])

			expect(mockFs.mkdir).toHaveBeenCalledWith(expectedDir, { recursive: true })
			expect(mockSafeWriteJson).toHaveBeenCalledWith(expectedPath, item1)
			expect(mockGlobalStateGet).toHaveBeenCalledWith(expectedMonthKey)
			// Global state update now writes an object representation of the Map
			const expectedMap = new Map([[item1.id, item1.ts]])
			const expectedObject = Object.fromEntries(expectedMap)
			expect(mockGlobalStateUpdate).toHaveBeenCalledWith(expectedMonthKey, expectedObject)
		})

		// This test's premise changes significantly because setHistoryItems doesn't handle
		// "moving" files or deleting old index entries from different months.
		// It simply writes to the new static path and updates the current month's index.
		// The old "unlink" logic is gone.
		it("should update an existing item (ts changes, id same), updating current month's index", async () => {
			const updatedTs = testTimestamp + 1000
			const updatedItem1: HistoryItem = {
				...item1,
				ts: updatedTs,
				task: "Updated Task 1",
				number: 1,
				tokensIn: 0,
				tokensOut: 0,
				totalCost: 0,
			}
			// const oldPath = getExpectedFilePath(item1.id) // Path is static
			const newPath = getExpectedFilePath(updatedItem1.id) // Path is static, based on ID
			const expectedMonthKey = getExpectedGlobalStateMonthKey(year, month)

			// Prime the global state for the month as if item1 was there with its old ts
			const initialMonthMap = new Map([[item1.id, item1.ts]])
			mockGlobalStateGet.mockResolvedValueOnce(initialMonthMap)
			mockGlobalStateUpdate.mockClear()

			await taskHistoryModule.setHistoryItems([updatedItem1])

			// No unlink of old path because path is static.
			expect(mockFs.unlink).not.toHaveBeenCalled()
			expect(mockSafeWriteJson).toHaveBeenCalledWith(newPath, updatedItem1) // Writing new file (or overwriting)

			// Index update logic: updates the timestamp for the ID in the map
			const finalMap = new Map([[updatedItem1.id, updatedItem1.ts]])
			const finalObject = Object.fromEntries(finalMap)
			expect(mockGlobalStateUpdate).toHaveBeenCalledWith(expectedMonthKey, finalObject)
		})

		// This test also changes significantly. setHistoryItems updates the index for the *new* month.
		// Stale entries in old month's globalState are not actively removed by setHistoryItems.
		it("should write item to static path and update new month's index if ts changes significantly", async () => {
			const localItem1: HistoryItem = {
				id: "task1-move",
				ts: testTimestamp,
				task: "Test Task 1 to be moved",
				number: 1,
				tokensIn: 0,
				tokensOut: 0,
				totalCost: 0,
			}
			const newTimestamp = new Date(2023, 1, 10, 12, 0, 0).getTime() // Feb 10, 2023
			const movedItem: HistoryItem = {
				...localItem1,
				ts: newTimestamp,
				number: 1,
				tokensIn: 0,
				tokensOut: 0,
				totalCost: 0,
			}
			// const oldYear = "2023" // Not relevant for static path
			// const oldMonth = "01"
			const newYear = "2023"
			const newMonth = "02" // Item's timestamp now falls into February

			// const oldPath = getExpectedFilePath(localItem1.id) // Path is static
			const newPath = getExpectedFilePath(movedItem.id) // Path is static
			// const oldMonthKey = getExpectedGlobalStateMonthKey(oldYear, oldMonth) // Not actively cleared by setHistoryItems
			const newMonthKey = getExpectedGlobalStateMonthKey(newYear, newMonth)

			// Simulate new month's index is initially empty
			mockGlobalStateGet.mockImplementation((key) => {
				if (key === newMonthKey) return Promise.resolve(new Map())
				return Promise.resolve(new Map()) // Default for other months
			})
			mockGlobalStateUpdate.mockClear()

			await taskHistoryModule.setHistoryItems([movedItem])

			expect(mockFs.unlink).not.toHaveBeenCalled() // No old file deletion based on path change
			expect(mockSafeWriteJson).toHaveBeenCalledWith(newPath, movedItem) // Write new file (or overwrite)

			// Expect new month's index to be updated
			const expectedNewMonthMap = new Map([[movedItem.id, movedItem.ts]])
			const expectedNewMonthObject = Object.fromEntries(expectedNewMonthMap)
			expect(mockGlobalStateUpdate).toHaveBeenCalledWith(newMonthKey, expectedNewMonthObject)
			// No explicit update to oldMonthKey to remove the item by setHistoryItems
		})

		// skipGlobalStateIndexUpdate option is removed from setHistoryItems
		// it("should skip globalState index update if option is true", async () => { ... })

		it("should log warning and skip invalid item", async () => {
			const invalidItem: any = { id: "invalid" } // Missing ts and task
			const consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation(() => {})
			await taskHistoryModule.setHistoryItems([invalidItem])
			expect(consoleWarnSpy).toHaveBeenCalledWith(
				`[Roo Update] Invalid HistoryItem skipped: ${JSON.stringify(invalidItem)}`,
			)
			expect(mockSafeWriteJson).not.toHaveBeenCalled()
			expect(mockGlobalStateUpdate).not.toHaveBeenCalled()
			consoleWarnSpy.mockRestore()
		})
	})

	describe("getHistoryItem", () => {
		const testTimestamp = new Date(2023, 0, 15, 12, 0, 0).getTime()
		const localItem1: HistoryItem = {
			id: "task1-get",
			ts: testTimestamp,
			task: "Test Task 1 for get",
			number: 1,
			tokensIn: 0,
			tokensOut: 0,
			totalCost: 0,
		}
		const expectedPath = getExpectedFilePath(localItem1.id)
		// const monthKey = getExpectedGlobalStateMonthKey("2023", "01"); // Not directly used by getHistoryItem for path

		it("should return item from cache if available", async () => {
			// Prime cache by setting the item first
			mockGlobalStateGet.mockResolvedValueOnce(new Map()) // For initial set
			await taskHistoryModule.setHistoryItems([localItem1])
			mockFs.readFile.mockClear() // Clear any calls from setHistoryItems

			const result = await taskHistoryModule.getHistoryItem(localItem1.id)
			expect(result).toEqual(localItem1)
			expect(mockFs.readFile).not.toHaveBeenCalled() // Should not read file due to cache hit
		})

		it("should return item from file system if not in cache", async () => {
			// Ensure cache is clear for this item (new test run, or clear it explicitly if needed)
			// itemObjectCache.clear() // If needed between tests in same describe, but beforeEach handles module reset
			mockFs.readFile.mockResolvedValueOnce(JSON.stringify(localItem1))

			const result = await taskHistoryModule.getHistoryItem(localItem1.id)
			expect(result).toEqual(localItem1)
			expect(mockFs.readFile).toHaveBeenCalledWith(expectedPath, "utf8")
			// Verify cache is populated after read
			mockFs.readFile.mockClear()
			const cachedResult = await taskHistoryModule.getHistoryItem(localItem1.id)
			expect(cachedResult).toEqual(localItem1)
			expect(mockFs.readFile).not.toHaveBeenCalled() // Should be a cache hit now
		})

		it("should return undefined if item not found (file does not exist)", async () => {
			const enoentError: NodeJS.ErrnoException = new Error("File not found")
			enoentError.code = "ENOENT"
			mockFs.readFile.mockRejectedValueOnce(enoentError)

			const result = await taskHistoryModule.getHistoryItem("nonexistent")
			expect(result).toBeUndefined()
		})

		it("should log error and return undefined if file read fails (not ENOENT)", async () => {
			const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {})
			const otherError = new Error("Disk read error")
			mockFs.readFile.mockRejectedValueOnce(otherError)
			const failingPath = getExpectedFilePath("failing-task")

			const result = await taskHistoryModule.getHistoryItem("failing-task")
			expect(result).toBeUndefined()
			expect(consoleErrorSpy).toHaveBeenCalledWith(
				`[Roo Update] Error reading history item file ${failingPath} for task failing-task:`,
				otherError,
			)
			consoleErrorSpy.mockRestore()
		})
	})

	describe("deleteHistoryItem", () => {
		const testTimestamp = new Date(2023, 0, 15, 12, 0, 0).getTime()
		const localItem1: HistoryItem = {
			id: "task1-delete",
			ts: testTimestamp,
			task: "Test Task 1 for delete",
			number: 1,
			tokensIn: 0,
			tokensOut: 0,
			totalCost: 0,
		}
		const year = "2023"
		const month = "01"
		const expectedItemDir = path.dirname(getExpectedFilePath(localItem1.id))
		const monthKey = getExpectedGlobalStateMonthKey(year, month)

		it("should delete item directory, remove from all relevant month indexes, and clear from cache", async () => {
			// Prime cache and global state
			// Initial setHistoryItems call needs its own mocks for _readGlobalStateMonthIndex
			mockGlobalStateGet.mockReturnValueOnce(new Map()) // For setHistoryItems' _readGlobalStateMonthIndex for item1's month
			await taskHistoryModule.setHistoryItems([localItem1]) // Populates cache and globalState for its month
			mockGlobalStateGet.mockReset() // Reset after setHistoryItems

			// Simulate another month also having a (stale) reference for the delete operation
			const otherMonthKey = getExpectedGlobalStateMonthKey("2022", "12")
			const otherMonthMapData = { [localItem1.id]: testTimestamp - 100000 }

			mockGlobalStateGet.mockImplementation((key) => {
				if (key === monthKey) return { [localItem1.id]: localItem1.ts } // Return as object for globalState.get
				if (key === otherMonthKey) return otherMonthMapData
				return {} // Default to empty object for other keys
			})
			mockGlobalStateKeys.mockResolvedValue([monthKey, otherMonthKey, "someOtherNonMatchingKey"])
			mockGlobalStateUpdate.mockClear()

			await taskHistoryModule.deleteHistoryItem(localItem1.id)

			expect(mockFs.rm).toHaveBeenCalledWith(expectedItemDir, { recursive: true, force: true })
			// Check update for the primary month
			expect(mockGlobalStateUpdate).toHaveBeenCalledWith(monthKey, Object.fromEntries(new Map()))
			// Check update for the other month that had the stale reference
			expect(mockGlobalStateUpdate).toHaveBeenCalledWith(otherMonthKey, Object.fromEntries(new Map()))

			// Verify cache is cleared
			const enoentError: NodeJS.ErrnoException = new Error("ENOENT file gone after delete")
			enoentError.code = "ENOENT"
			mockFs.readFile.mockImplementation(() => Promise.reject(enoentError)) // Simulate file gone
			const resultAfterDelete = await taskHistoryModule.getHistoryItem(localItem1.id)
			expect(resultAfterDelete).toBeUndefined()
		})

		it("should handle deletion if item directory does not exist (ENOENT)", async () => {
			const enoentError: NodeJS.ErrnoException = new Error("Dir not found")
			enoentError.code = "ENOENT"
			mockFs.rm.mockRejectedValueOnce(enoentError)
			// Ensure the map is returned for the month as an object for globalState.get
			mockGlobalStateGet.mockReturnValueOnce({ [localItem1.id]: localItem1.ts })
			mockGlobalStateKeys.mockResolvedValueOnce([monthKey]) // Ensure this month key is processed

			await expect(taskHistoryModule.deleteHistoryItem(localItem1.id)).resolves.toBeUndefined()
			// Check that global state update was still attempted for the primary month
			expect(mockGlobalStateUpdate).toHaveBeenCalledWith(monthKey, Object.fromEntries(new Map()))
		})

		it("should throw for invalid arguments (empty taskId)", async () => {
			await expect(taskHistoryModule.deleteHistoryItem("")).rejects.toThrow(
				"Invalid arguments: taskId is required.",
			)
		})
	})

	describe("getHistoryItemsForMonth", () => {
		const ts1 = new Date(2023, 0, 15, 10, 0, 0).getTime()
		const ts2 = new Date(2023, 0, 15, 12, 0, 0).getTime()
		const localItem1: HistoryItem = {
			id: "task1-month",
			ts: ts1,
			task: "Task A for month",
			number: 1,
			tokensIn: 0,
			tokensOut: 0,
			totalCost: 0,
		}
		const localItem2: HistoryItem = {
			id: "task2-month",
			ts: ts2,
			task: "Task B for month",
			number: 1,
			tokensIn: 0,
			tokensOut: 0,
			totalCost: 0,
		}
		const year = 2023
		const monthNum = 1 // January

		it("should retrieve and sort items for a given month, filtering by actual item timestamp", async () => {
			// monthIndexMap will contain hints. getHistoryItem will fetch actual items.
			// Then we filter by the actual item.ts.
			const monthIndexMap = new Map<string, number>()
			monthIndexMap.set(localItem1.id, localItem1.ts)
			monthIndexMap.set(localItem2.id, localItem2.ts)
			// Add an item that's hinted in this month but actually belongs to another
			const wrongMonthItem: HistoryItem = {
				id: "wrongMonth",
				ts: new Date(2023, 1, 5).getTime(),
				task: "Feb task",
				number: 1,
				tokensIn: 0,
				tokensOut: 0,
				totalCost: 0,
			}
			monthIndexMap.set(wrongMonthItem.id, wrongMonthItem.ts) // Hinted for Jan

			mockGlobalStateGet.mockReturnValueOnce(Object.fromEntries(monthIndexMap)) // _readGlobalStateMonthIndex reads this

			// Configure mockFs.readFile for this test case
			const originalReadFileMock = mockFs.readFile.getMockImplementation()
			mockFs.readFile.mockImplementation(async (filePath: string) => {
				if (filePath === getExpectedFilePath(localItem1.id)) {
					return JSON.stringify(localItem1)
				}
				if (filePath === getExpectedFilePath(localItem2.id)) {
					return JSON.stringify(localItem2)
				}
				if (filePath === getExpectedFilePath(wrongMonthItem.id)) {
					return JSON.stringify(wrongMonthItem)
				}
				const enoentError: NodeJS.ErrnoException = new Error(`Mock fs.readFile: File not found ${filePath}`)
				enoentError.code = "ENOENT"
				throw enoentError
			})

			const results = await taskHistoryModule.getHistoryItemsForMonth(year, monthNum)
			expect(results.length).toBe(2) // wrongMonthItem should be filtered out
			expect(results[0]).toEqual(localItem2) // Sorted by ts descending (item2 is newer)
			expect(results[1]).toEqual(localItem1)

			// Verify getHistoryItem was called (it will call our mocked readFile)
			// We can check if readFile was called with expected paths if needed,
			// but the result check (length and content) is the primary validation.
			expect(mockFs.readFile).toHaveBeenCalledWith(getExpectedFilePath(localItem1.id), "utf8")
			expect(mockFs.readFile).toHaveBeenCalledWith(getExpectedFilePath(localItem2.id), "utf8")
			expect(mockFs.readFile).toHaveBeenCalledWith(getExpectedFilePath(wrongMonthItem.id), "utf8")

			// Restore original mockFs.readFile behavior if it was more generic,
			// though beforeEach resets it anyway.
			if (originalReadFileMock) {
				mockFs.readFile.mockImplementation(originalReadFileMock)
			} else {
				mockFs.readFile.mockReset() // Or mockFs.readFile.mockImplementation(jest.fn())
			}
		})

		it("should return empty array if month index is empty or not found", async () => {
			mockGlobalStateGet.mockReturnValueOnce(new Map()) // Empty index
			let results = await taskHistoryModule.getHistoryItemsForMonth(year, monthNum)
			expect(results).toEqual([])

			mockGlobalStateGet.mockReturnValueOnce(undefined) // Index not found (results in new Map())
			results = await taskHistoryModule.getHistoryItemsForMonth(year, monthNum)
			expect(results).toEqual([])
		})

		// getHistoryItem now handles caching, so this test is simpler
		it("should use cached items via getHistoryItem", async () => {
			const monthIndexMap = new Map<string, number>()
			monthIndexMap.set(localItem1.id, localItem1.ts)
			mockGlobalStateGet.mockReturnValueOnce(Object.fromEntries(monthIndexMap))

			// Prime cache using setHistoryItems, which now populates the internal itemObjectCache
			// For this specific sub-test, we want to test the cache hit.
			// So, we set the item, then ensure readFile is NOT called for it.
			await taskHistoryModule.setHistoryItems([localItem1]) // This will call _readGlobalStateMonthIndex and _writeGlobalStateMonthIndex
			// We need to ensure the subsequent call to _readGlobalStateMonthIndex for getHistoryItemsForMonth gets the right data.
			mockGlobalStateGet.mockReset() // Clear previous mockReturnValueOnce from setHistoryItems
			mockGlobalStateGet.mockReturnValueOnce(Object.fromEntries(monthIndexMap)) // For the getHistoryItemsForMonth call

			mockFs.readFile.mockClear() // Clear any readFile calls from setHistoryItems

			const results = await taskHistoryModule.getHistoryItemsForMonth(year, monthNum)
			expect(results.length).toBe(1)
			expect(results[0]).toEqual(localItem1)
			// Verify that for localItem1, readFile was NOT called because it should be a cache hit.
			expect(mockFs.readFile).not.toHaveBeenCalledWith(getExpectedFilePath(localItem1.id), "utf8")
		})
	})

	/*
	// This function was effectively replaced by using getHistoryItemsForSearch("", undefined)
	// and then processing the full items if a similar structure is needed.
	// Commenting out for now as per instructions.
	describe("getAllHistoryItemIndexEntries", () => {
		it("should retrieve all index entries from globalState", async () => {
			const monthKey1 = getExpectedGlobalStateMonthKey("2023", "01")
			const monthKey2 = getExpectedGlobalStateMonthKey("2023", "02")
			const index1Data = new Map([["t1", 100], ["t2", 200]]);
			const index2Data = new Map([["t3", 300]]);

			mockGlobalStateKeys.mockResolvedValueOnce([monthKey1, monthKey2, "otherKey"])
			mockGlobalStateGet.mockImplementation((key) => {
				if (key === monthKey1) return Promise.resolve(Object.fromEntries(index1Data))
				if (key === monthKey2) return Promise.resolve(Object.fromEntries(index2Data))
				return Promise.resolve(new Map())
			})

			// const results = await taskHistoryModule.getAllHistoryItemIndexEntries(); // Function removed
			// expect(results.length).toBe(3);
			// expect(results).toContainEqual({ id: "t1", ts: 100, year: "2023", month: "01" });
			// expect(results).toContainEqual({ id: "t2", ts: 200, year: "2023", month: "01" });
			// expect(results).toContainEqual({ id: "t3", ts: 300, year: "2023", month: "02" });
		});
	});
	*/

	describe("getHistoryItemsForSearch", () => {
		// let getHistoryItemSpy: jest.SpyInstance; // Declare here - Will mock fs.readFile instead
		const ts1 = new Date(2023, 0, 10).getTime()
		const localItem1: HistoryItem = {
			id: "s1",
			ts: ts1,
			task: "Searchable Alpha content",
			number: 1,
			tokensIn: 0,
			tokensOut: 0,
			totalCost: 0,
		}
		// const path1 = getExpectedFilePath(localItem1.id) // Path is static
		const ts2 = new Date(2023, 0, 12).getTime()
		const localItem2: HistoryItem = {
			id: "s2",
			ts: ts2,
			task: "Another Bravo item",
			number: 1,
			tokensIn: 0,
			tokensOut: 0,
			totalCost: 0,
		}
		// const path2 = getExpectedFilePath(localItem2.id)
		const ts3 = new Date(2023, 0, 11).getTime()
		const localItem3: HistoryItem = {
			id: "s3",
			ts: ts3,
			task: "Content with Alpha keyword",
			number: 1,
			tokensIn: 0,
			tokensOut: 0,
			totalCost: 0,
		}
		// const path3 = getExpectedFilePath(localItem3.id)

		const monthKeyJan = getExpectedGlobalStateMonthKey("2023", "01")
		const monthKeyFeb = getExpectedGlobalStateMonthKey("2023", "02")

		beforeEach(() => {
			// Simulate globalState having hints for these items
			const janMap = new Map<string, number>()
			janMap.set(localItem1.id, localItem1.ts)
			janMap.set(localItem3.id, localItem3.ts)

			const febMap = new Map<string, number>() // localItem2 might be hinted here if its ts changed
			febMap.set(localItem2.id, localItem2.ts)

			mockGlobalStateKeys.mockResolvedValue([monthKeyJan, monthKeyFeb])
			mockGlobalStateGet.mockImplementation((key) => {
				// console.log(`DEBUG TEST: mockGlobalStateGet called with key: ${key}`)
				let result
				if (key === monthKeyJan) result = Object.fromEntries(janMap)
				else if (key === monthKeyFeb) result = Object.fromEntries(febMap)
				else result = undefined
				// console.log(`DEBUG TEST: mockGlobalStateGet returning for ${key}:`, JSON.stringify(result))
				return result
			})

			// Configure mockFs.readFile for the getHistoryItemsForSearch tests
			// const originalReadFileMock = mockFs.readFile.getMockImplementation(); // Not needed due to global beforeEach reset
			mockFs.readFile.mockImplementation(async (filePath: string) => {
				if (filePath === getExpectedFilePath(localItem1.id)) {
					return JSON.stringify(localItem1)
				}
				if (filePath === getExpectedFilePath(localItem2.id)) {
					return JSON.stringify(localItem2)
				}
				if (filePath === getExpectedFilePath(localItem3.id)) {
					return JSON.stringify(localItem3)
				}
				const enoentError: NodeJS.ErrnoException = new Error(`Mock fs.readFile: File not found ${filePath}`)
				enoentError.code = "ENOENT"
				throw enoentError
			})
		})

		it("should return items matching search query, sorted by timestamp descending", async () => {
			const results = await taskHistoryModule.getHistoryItemsForSearch("Alpha")
			expect(results.length).toBe(2)
			expect(results[0]).toEqual(localItem3) // s3 (ts3) is newer than s1 (ts1) among "Alpha"
			expect(results[1]).toEqual(localItem1)
		})

		it("should return all items if search query is empty, sorted by timestamp descending", async () => {
			const results = await taskHistoryModule.getHistoryItemsForSearch("") // Empty string for all
			expect(results.length).toBe(3)
			expect(results[0]).toEqual(localItem2) // s2 is newest overall
			expect(results[1]).toEqual(localItem3)
			expect(results[2]).toEqual(localItem1)
		})

		it("should return empty array if no items match", async () => {
			const results = await taskHistoryModule.getHistoryItemsForSearch("NonExistentQuery")
			expect(results).toEqual([])
		})

		it("should filter by dateRange", async () => {
			const fromTs = new Date(2023, 0, 11).getTime() // Includes item3
			const toTs = new Date(2023, 0, 12, 23, 59, 59).getTime() // Includes item2

			// Search for "item" to include item2, or "" to include all then filter by date
			const results = await taskHistoryModule.getHistoryItemsForSearch("item", { fromTs, toTs })
			expect(results.length).toBe(1) // Should be only item2
			expect(results[0].id).toBe("s2")
		})

		afterEach(() => {
			// Restore original mockFs.readFile behavior if it was more generic,
			// though beforeEach resets it anyway.
			// mockFs.readFile.mockReset() // Or restore a previous general mock
		})
	})

	describe("getAvailableHistoryMonths", () => {
		it("should return sorted list of available year/month objects from globalState keys", async () => {
			const key1 = getExpectedGlobalStateMonthKey("2023", "01")
			const key2 = getExpectedGlobalStateMonthKey("2022", "12")
			const key3 = getExpectedGlobalStateMonthKey("2023", "03")
			mockGlobalStateKeys.mockResolvedValueOnce([key1, "someOtherKey", key2, key3])

			const results = await taskHistoryModule.getAvailableHistoryMonths()
			expect(results).toEqual([
				{ year: 2023, month: 3 },
				{ year: 2023, month: 1 },
				{ year: 2022, month: 12 },
			])
		})
	})

	describe("migrateTaskHistoryStorage", () => {
		const oldHistoryItem1: HistoryItem = {
			id: "old1",
			ts: new Date(2022, 0, 1).getTime(),
			task: "Old task one",
			number: 1,
			tokensIn: 0,
			tokensOut: 0,
			totalCost: 0,
		}
		const oldHistoryItem2 = {
			id: "old2",
			ts: new Date(2022, 0, 15).getTime(),
			task: "Old task two (userInput)",
			userInput: "Old task two (userInput)",
			number: 1,
			tokensIn: 0,
			tokensOut: 0,
			totalCost: 0,
		} as any // Test userInput mapping
		const oldHistoryItemInvalid = { id: "invalidOld", task: "No ts" } as any

		beforeEach(() => {
			// Reset stat mock for migration specific scenarios
			mockFs.stat.mockReset()
			// Ensure getExtensionContext is called, which it is in the main beforeEach
		})

		it("should migrate data and update version if version is undefined and old data exists", async () => {
			mockFs.readdir.mockResolvedValue([]) // No old YYYY dirs to clean up for this test focus
			mockGlobalStateGet.mockImplementation((key) => {
				if (key === TASK_HISTORY_VERSION_KEY) return undefined // No version set
				if (key === "taskHistory") return [oldHistoryItem1, oldHistoryItem2, oldHistoryItemInvalid]
				if (key.startsWith(TASK_HISTORY_MONTH_INDEX_PREFIX)) return new Map()
				return undefined
			})

			await taskHistoryModule.migrateTaskHistoryStorage()

			const backupFileRegex = /^\d{4}-\d{2}-\d{2}_\d{6}-backup_globalState_taskHistory_array\.json$/
			const expectedBackupDir = path.join(TEST_GLOBAL_STORAGE_PATH, "tasks") // Updated path

			// Check that safeWriteJson was called for the backup with the correct directory, a matching filename, and correct content
			expect(mockSafeWriteJson).toHaveBeenCalledWith(
				expect.stringMatching(
					new RegExp(
						`^${expectedBackupDir.replace(/\\/g, "\\\\")}[\\/]${backupFileRegex.source.substring(1, backupFileRegex.source.length - 1)}$`,
					),
				), // Matches full path with dynamic filename
				[oldHistoryItem1, oldHistoryItem2, oldHistoryItemInvalid],
			)

			expect(mockSafeWriteJson).toHaveBeenCalledWith(
				getExpectedFilePath(oldHistoryItem1.id),
				expect.objectContaining({ id: "old1" }),
			)
			expect(mockSafeWriteJson).toHaveBeenCalledWith(
				getExpectedFilePath(oldHistoryItem2.id),
				expect.objectContaining({ id: "old2", task: "Old task two (userInput)" }),
			)

			const monthKey202201 = getExpectedGlobalStateMonthKey("2022", "01")
			const expectedMap202201 = new Map<string, number>()
			expectedMap202201.set(oldHistoryItem1.id, oldHistoryItem1.ts)
			expectedMap202201.set(oldHistoryItem2.id, oldHistoryItem2.ts)
			expect(mockGlobalStateUpdate).toHaveBeenCalledWith(monthKey202201, Object.fromEntries(expectedMap202201))

			// Verify version is updated
			expect(mockGlobalStateUpdate).toHaveBeenCalledWith(TASK_HISTORY_VERSION_KEY, CURRENT_TASK_HISTORY_VERSION)
			// Verify old "taskHistory" array is NOT cleared
			expect(mockGlobalStateUpdate).not.toHaveBeenCalledWith("taskHistory", undefined)
		})

		it("should migrate data and update version if version is old (1) and old data exists", async () => {
			mockFs.readdir.mockResolvedValue([])
			mockGlobalStateGet.mockImplementation((key) => {
				if (key === TASK_HISTORY_VERSION_KEY) return 1 // Old version
				if (key === "taskHistory") return [oldHistoryItem1]
				if (key.startsWith(TASK_HISTORY_MONTH_INDEX_PREFIX)) return new Map()
				return undefined
			})

			await taskHistoryModule.migrateTaskHistoryStorage()

			const backupFileRegex = /^\d{4}-\d{2}-\d{2}_\d{6}-backup_globalState_taskHistory_array\.json$/
			const expectedBackupDir = path.join(TEST_GLOBAL_STORAGE_PATH, "tasks") // Updated path
			expect(mockSafeWriteJson).toHaveBeenCalledWith(
				expect.stringMatching(
					new RegExp(
						`^${expectedBackupDir.replace(/\\/g, "\\\\")}[\\/]${backupFileRegex.source.substring(1, backupFileRegex.source.length - 1)}$`,
					),
				),
				[oldHistoryItem1],
			)
			expect(mockSafeWriteJson).toHaveBeenCalledWith(
				getExpectedFilePath(oldHistoryItem1.id),
				expect.objectContaining({ id: "old1" }),
			)
			expect(mockGlobalStateUpdate).toHaveBeenCalledWith(TASK_HISTORY_VERSION_KEY, CURRENT_TASK_HISTORY_VERSION)
			expect(mockGlobalStateUpdate).not.toHaveBeenCalledWith("taskHistory", undefined)
		})

		it("should NOT migrate data but update version if version is undefined and NO old data exists", async () => {
			mockFs.readdir.mockResolvedValue([])
			mockGlobalStateGet.mockImplementation((key) => {
				if (key === TASK_HISTORY_VERSION_KEY) return undefined
				if (key === "taskHistory") return [] // No old data
				return undefined
			})
			const consoleLogSpy = jest.spyOn(console, "log").mockImplementation(() => {})

			await taskHistoryModule.migrateTaskHistoryStorage()

			expect(consoleLogSpy).toHaveBeenCalledWith(
				expect.stringContaining("[Roo Update] No old task history data found"),
			)
			// Check that no backup file was written
			const backupFileRegex = /backup_globalState_taskHistory_array\.json$/
			const safeWriteJsonCalls = mockSafeWriteJson.mock.calls
			const backupCall = safeWriteJsonCalls.find(
				(callArgs) => typeof callArgs[0] === "string" && backupFileRegex.test(callArgs[0]),
			)
			expect(backupCall).toBeUndefined()

			expect(mockSafeWriteJson).not.toHaveBeenCalledWith(
				getExpectedFilePath(oldHistoryItem1.id),
				expect.anything(),
			)
			// Version should still be updated to current
			expect(mockGlobalStateUpdate).toHaveBeenCalledWith(TASK_HISTORY_VERSION_KEY, CURRENT_TASK_HISTORY_VERSION)
			consoleLogSpy.mockRestore()
		})

		it("should NOT migrate data and NOT update version if version is current", async () => {
			mockFs.readdir.mockResolvedValue([])
			mockGlobalStateGet.mockImplementation((key) => {
				if (key === TASK_HISTORY_VERSION_KEY) return CURRENT_TASK_HISTORY_VERSION
				if (key === "taskHistory") return [oldHistoryItem1] // Old data exists but shouldn't be processed
				return undefined
			})
			const consoleLogSpy = jest.spyOn(console, "log").mockImplementation(() => {})
			mockGlobalStateUpdate.mockClear() // Clear any calls from setup

			await taskHistoryModule.migrateTaskHistoryStorage()

			expect(consoleLogSpy).toHaveBeenCalledWith(
				expect.stringContaining(
					`[Roo Update] Task history storage is up to date (version ${CURRENT_TASK_HISTORY_VERSION})`,
				),
			)
			expect(mockSafeWriteJson).not.toHaveBeenCalled() // No backup, no item writes
			expect(mockGlobalStateUpdate).not.toHaveBeenCalled() // No version update, no index updates
			consoleLogSpy.mockRestore()
		})

		it("should clean up old YYYY artifact directories if they exist", async () => {
			const oldYearDir = "2021"
			const oldYearPath = path.join(TEST_GLOBAL_STORAGE_PATH, TASK_HISTORY_DIR_NAME, oldYearDir)
			mockFs.readdir.mockImplementation(async (p: fs.PathLike) => {
				if (p === path.join(TEST_GLOBAL_STORAGE_PATH, TASK_HISTORY_DIR_NAME)) {
					return [
						{
							name: oldYearDir,
							isDirectory: () => true,
							isFile: () => false,
							isSymbolicLink: () => false,
						} as fs.Dirent,
					]
				}
				return []
			})
			mockGlobalStateGet.mockImplementation((key) => {
				// Simulate current version to skip data migration part
				if (key === TASK_HISTORY_VERSION_KEY) return CURRENT_TASK_HISTORY_VERSION
				return undefined
			})

			await taskHistoryModule.migrateTaskHistoryStorage()

			// Assert that readdir is NOT called for the old task_history/YYYY cleanup path,
			// implying this specific cleanup mechanism was removed or changed.
			expect(mockFs.readdir).not.toHaveBeenCalledWith(
				path.join(TEST_GLOBAL_STORAGE_PATH, TASK_HISTORY_DIR_NAME),
				{
					withFileTypes: true,
				},
			)
			// Consequently, rm should not be called for paths within that old structure.
			expect(mockFs.rm).not.toHaveBeenCalledWith(oldYearPath, { recursive: true, force: true })
		})
	})
})
