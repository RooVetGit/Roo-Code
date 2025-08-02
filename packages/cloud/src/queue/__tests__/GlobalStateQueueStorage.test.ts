import { describe, it, expect, beforeEach, vi } from "vitest"
import * as vscode from "vscode"
import { GlobalStateQueueStorage } from "../GlobalStateQueueStorage"
import { QueuedTelemetryEvent, MultiInstanceConfig } from "../types"
import { TelemetryEventName } from "@roo-code/types"

// Mock VS Code extension context
const createMockContext = () => {
	const storage = new Map<string, unknown>()

	return {
		globalState: {
			get: vi.fn((key: string) => storage.get(key)),
			update: vi.fn(async (key: string, value: unknown) => {
				storage.set(key, value)
			}),
			keys: vi.fn(() => Array.from(storage.keys())),
			setKeysForSync: vi.fn(),
		},
		subscriptions: [],
		extensionPath: "/test/path",
		extensionUri: {
			fsPath: "/test/path",
			scheme: "file",
			authority: "",
			path: "/test/path",
			query: "",
			fragment: "",
		},
		environmentVariableCollection: {} as vscode.EnvironmentVariableCollection,
		storageUri: {
			fsPath: "/test/storage",
			scheme: "file",
			authority: "",
			path: "/test/storage",
			query: "",
			fragment: "",
		},
		globalStorageUri: {
			fsPath: "/test/global-storage",
			scheme: "file",
			authority: "",
			path: "/test/global-storage",
			query: "",
			fragment: "",
		},
		logUri: { fsPath: "/test/logs", scheme: "file", authority: "", path: "/test/logs", query: "", fragment: "" },
		extensionMode: 2, // ExtensionMode.Test
		extension: {} as vscode.Extension<unknown>,
		asAbsolutePath: vi.fn((path: string) => path),
		storagePath: "/test/storage",
		globalStoragePath: "/test/global-storage",
		logPath: "/test/logs",
		workspaceState: {} as vscode.Memento,
		secrets: {} as vscode.SecretStorage,
	} as unknown as vscode.ExtensionContext
}

describe("GlobalStateQueueStorage", () => {
	let context: vscode.ExtensionContext
	let storage: GlobalStateQueueStorage

	beforeEach(() => {
		context = createMockContext()
		storage = new GlobalStateQueueStorage(context)
	})

	describe("add", () => {
		it("should add events to storage", async () => {
			const event: QueuedTelemetryEvent = {
				id: "evt_123_abc",
				timestamp: Date.now(),
				event: {
					event: TelemetryEventName.TASK_CREATED,
					properties: { taskId: "test-123" },
				},
				retryCount: 0,
			}

			await storage.add(event)

			const events = await storage.getAll()
			expect(events).toHaveLength(1)
			expect(events[0]).toEqual(event)
		})

		it("should maintain FIFO order", async () => {
			const events: QueuedTelemetryEvent[] = []
			const baseTime = Date.now()

			for (let i = 0; i < 5; i++) {
				events.push({
					id: `evt_${i}`,
					timestamp: baseTime + i * 1000,
					event: {
						event: TelemetryEventName.TASK_CREATED,
						properties: { taskId: `test-${i}` },
					},
					retryCount: 0,
				})
			}

			// Add events in random order
			await storage.add(events[2])
			await storage.add(events[0])
			await storage.add(events[4])
			await storage.add(events[1])
			await storage.add(events[3])

			const storedEvents = await storage.getAll()
			expect(storedEvents).toHaveLength(5)

			// Should be sorted by timestamp
			for (let i = 0; i < 5; i++) {
				expect(storedEvents[i].id).toBe(`evt_${i}`)
			}
		})

		it("should enforce 1MB storage limit by removing oldest events", async () => {
			// Create a large event (approximately 100KB)
			const largeData = "x".repeat(100000)
			const events: QueuedTelemetryEvent[] = []

			// Create 15 events, each ~100KB (total ~1.5MB)
			for (let i = 0; i < 15; i++) {
				events.push({
					id: `evt_${i}`,
					timestamp: Date.now() + i,
					event: {
						event: TelemetryEventName.TASK_CREATED,
						properties: {
							taskId: `test-${i}`,
							data: largeData,
						},
					},
					retryCount: 0,
				})
			}

			// Add all events
			for (const event of events) {
				await storage.add(event)
			}

			// Check that oldest events were removed to stay under 1MB
			const storedEvents = await storage.getAll()
			const size = await storage.getSize()

			expect(size).toBeLessThanOrEqual(1048576) // 1MB
			expect(storedEvents.length).toBeLessThan(15) // Some events should have been removed
			expect(storedEvents[0].id).not.toBe("evt_0") // Oldest events should be gone
		})

		it("should throw error if single event exceeds storage limit", async () => {
			// Create an event larger than 1MB
			const hugeData = "x".repeat(1100000) // ~1.1MB
			const event: QueuedTelemetryEvent = {
				id: "evt_huge",
				timestamp: Date.now(),
				event: {
					event: TelemetryEventName.TASK_CREATED,
					properties: {
						taskId: "test-huge",
						data: hugeData,
					},
				},
				retryCount: 0,
			}

			await expect(storage.add(event)).rejects.toThrow("Event too large to store in queue")
		})
	})

	describe("remove", () => {
		it("should remove event by id", async () => {
			const event1: QueuedTelemetryEvent = {
				id: "evt_1",
				timestamp: Date.now(),
				event: {
					event: TelemetryEventName.TASK_CREATED,
					properties: { taskId: "test-1" },
				},
				retryCount: 0,
			}

			const event2: QueuedTelemetryEvent = {
				id: "evt_2",
				timestamp: Date.now() + 1000,
				event: {
					event: TelemetryEventName.TASK_COMPLETED,
					properties: { taskId: "test-2" },
				},
				retryCount: 0,
			}

			await storage.add(event1)
			await storage.add(event2)

			const removed = await storage.remove("evt_1")
			expect(removed).toBe(true)

			const events = await storage.getAll()
			expect(events).toHaveLength(1)
			expect(events[0].id).toBe("evt_2")
		})

		it("should return false if event not found", async () => {
			const removed = await storage.remove("non-existent")
			expect(removed).toBe(false)
		})
	})

	describe("update", () => {
		it("should update existing event", async () => {
			const event: QueuedTelemetryEvent = {
				id: "evt_1",
				timestamp: Date.now(),
				event: {
					event: TelemetryEventName.TASK_CREATED,
					properties: { taskId: "test-1" },
				},
				retryCount: 0,
			}

			await storage.add(event)

			// Update the event
			event.retryCount = 1
			event.lastAttemptTimestamp = Date.now()
			event.lastError = "Network error"

			const updated = await storage.update(event)
			expect(updated).toBe(true)

			const events = await storage.getAll()
			expect(events[0].retryCount).toBe(1)
			expect(events[0].lastAttemptTimestamp).toBeDefined()
			expect(events[0].lastError).toBe("Network error")
		})

		it("should return false if event not found", async () => {
			const event: QueuedTelemetryEvent = {
				id: "non-existent",
				timestamp: Date.now(),
				event: {
					event: TelemetryEventName.TASK_CREATED,
					properties: { taskId: "test-1" },
				},
				retryCount: 0,
			}

			const updated = await storage.update(event)
			expect(updated).toBe(false)
		})

		it("should reject update if it would exceed storage limit", async () => {
			// Create a small event first
			const event: QueuedTelemetryEvent = {
				id: "evt_1",
				timestamp: Date.now(),
				event: {
					event: TelemetryEventName.TASK_CREATED,
					properties: { taskId: "test-1" },
				},
				retryCount: 0,
			}

			await storage.add(event)

			// Try to update with huge data
			event.event.properties = {
				taskId: "test-1",
				data: "x".repeat(1100000), // ~1.1MB
			}

			const updated = await storage.update(event)
			expect(updated).toBe(false)
		})
	})

	describe("getStorageStats", () => {
		it("should return correct storage statistics", async () => {
			const baseTime = Date.now() - 60000 // 1 minute ago

			const events: QueuedTelemetryEvent[] = [
				{
					id: "evt_1",
					timestamp: baseTime,
					event: {
						event: TelemetryEventName.TASK_CREATED,
						properties: { taskId: "test-1" },
					},
					retryCount: 0,
				},
				{
					id: "evt_2",
					timestamp: baseTime + 30000,
					event: {
						event: TelemetryEventName.TASK_COMPLETED,
						properties: { taskId: "test-2" },
					},
					retryCount: 0,
				},
			]

			for (const event of events) {
				await storage.add(event)
			}

			const stats = await storage.getStorageStats()

			expect(stats.eventCount).toBe(2)
			expect(stats.sizeInBytes).toBeGreaterThan(0)
			expect(stats.sizeInMB).toBe(stats.sizeInBytes / 1024 / 1024)
			expect(stats.utilizationPercent).toBe((stats.sizeInBytes / 1048576) * 100)
			expect(stats.oldestEventAge).toBeGreaterThan(50000) // More than 50 seconds
		})
	})

	describe("clear", () => {
		it("should remove all events", async () => {
			const events: QueuedTelemetryEvent[] = [
				{
					id: "evt_1",
					timestamp: Date.now(),
					event: {
						event: TelemetryEventName.TASK_CREATED,
						properties: { taskId: "test-1" },
					},
					retryCount: 0,
				},
				{
					id: "evt_2",
					timestamp: Date.now() + 1000,
					event: {
						event: TelemetryEventName.TASK_COMPLETED,
						properties: { taskId: "test-2" },
					},
					retryCount: 0,
				},
			]

			for (const event of events) {
				await storage.add(event)
			}

			await storage.clear()

			const remainingEvents = await storage.getAll()
			expect(remainingEvents).toHaveLength(0)

			const count = await storage.getCount()
			expect(count).toBe(0)

			const size = await storage.getSize()
			expect(size).toBe(2) // Empty array "[]"
		})
	})

	describe("multi-instance support", () => {
		let storage1: GlobalStateQueueStorage
		let storage2: GlobalStateQueueStorage
		let multiInstanceConfig: MultiInstanceConfig

		beforeEach(() => {
			multiInstanceConfig = {
				enabled: true,
				lockDurationMs: 1000, // 1 second for faster tests
				lockCheckIntervalMs: 100,
				lockAcquireTimeoutMs: 2000,
				mode: "compete",
			}

			// Create two storage instances sharing the same context (simulating two VS Code instances)
			storage1 = new GlobalStateQueueStorage(context, undefined, multiInstanceConfig)
			storage2 = new GlobalStateQueueStorage(context, undefined, multiInstanceConfig)
		})

		describe("lock acquisition", () => {
			it("should allow only one instance to acquire lock", async () => {
				// Set a shorter timeout for this test
				const testConfig: MultiInstanceConfig = {
					enabled: true,
					lockDurationMs: 1000,
					lockCheckIntervalMs: 50,
					lockAcquireTimeoutMs: 200, // Short timeout
					mode: "compete",
				}

				const testStorage1 = new GlobalStateQueueStorage(context, undefined, testConfig)
				const testStorage2 = new GlobalStateQueueStorage(context, undefined, testConfig)

				const lock1 = await testStorage1.acquireLock()
				expect(lock1).toBe(true)

				const lock2 = await testStorage2.acquireLock()
				expect(lock2).toBe(false)

				// Release lock from instance 1
				await testStorage1.releaseLock()

				// Now instance 2 should be able to acquire
				const lock2Retry = await testStorage2.acquireLock()
				expect(lock2Retry).toBe(true)
			})

			it("should respect lock expiration", async () => {
				// Acquire lock with instance 1
				const lock1 = await storage1.acquireLock()
				expect(lock1).toBe(true)

				// Wait for lock to expire
				await new Promise((resolve) => setTimeout(resolve, 1100))

				// Instance 2 should now be able to acquire
				const lock2 = await storage2.acquireLock()
				expect(lock2).toBe(true)
			})

			it("should handle concurrent lock attempts", async () => {
				// Create a more realistic concurrent scenario
				const testConfig: MultiInstanceConfig = {
					enabled: true,
					lockDurationMs: 1000,
					lockCheckIntervalMs: 50,
					lockAcquireTimeoutMs: 100, // Very short timeout to ensure one fails
					mode: "compete",
				}

				const testStorage1 = new GlobalStateQueueStorage(context, undefined, testConfig)
				const testStorage2 = new GlobalStateQueueStorage(context, undefined, testConfig)

				// Acquire lock with first instance
				const lock1 = await testStorage1.acquireLock()
				expect(lock1).toBe(true)

				// Second instance should fail due to short timeout
				const lock2 = await testStorage2.acquireLock()
				expect(lock2).toBe(false)
			})

			it("should return true when multi-instance is disabled", async () => {
				const disabledConfig: MultiInstanceConfig = {
					enabled: false,
				}

				const storage3 = new GlobalStateQueueStorage(context, undefined, disabledConfig)
				const storage4 = new GlobalStateQueueStorage(context, undefined, disabledConfig)

				// Both should be able to "acquire" lock
				const lock3 = await storage3.acquireLock()
				const lock4 = await storage4.acquireLock()

				expect(lock3).toBe(true)
				expect(lock4).toBe(true)
			})
		})

		describe("holdsLock", () => {
			it("should correctly identify lock holder", async () => {
				await storage1.acquireLock()

				expect(await storage1.holdsLock()).toBe(true)
				expect(await storage2.holdsLock()).toBe(false)
			})

			it("should return false for expired lock", async () => {
				await storage1.acquireLock()
				expect(await storage1.holdsLock()).toBe(true)

				// Wait for lock to expire
				await new Promise((resolve) => setTimeout(resolve, 1100))

				expect(await storage1.holdsLock()).toBe(false)
			})
		})

		describe("atomic operations", () => {
			it("should handle sequential adds from different instances", async () => {
				const event1: QueuedTelemetryEvent = {
					id: "evt_1",
					timestamp: Date.now(),
					event: {
						event: TelemetryEventName.TASK_CREATED,
						properties: { taskId: "test-1" },
					},
					retryCount: 0,
				}

				const event2: QueuedTelemetryEvent = {
					id: "evt_2",
					timestamp: Date.now() + 1,
					event: {
						event: TelemetryEventName.TASK_CREATED,
						properties: { taskId: "test-2" },
					},
					retryCount: 0,
				}

				// Add events sequentially to avoid race conditions in the mock
				await storage1.add(event1)
				await storage2.add(event2)

				// Both events should be in storage
				const events = await storage1.getAll()
				expect(events).toHaveLength(2)
				expect(events.map((e) => e.id).sort()).toEqual(["evt_1", "evt_2"])

				// Verify both instances see the same data
				const events2 = await storage2.getAll()
				expect(events2).toHaveLength(2)
				expect(events2.map((e) => e.id).sort()).toEqual(["evt_1", "evt_2"])
			})

			it("should retry operations on failure", async () => {
				// Mock a temporary failure
				let failCount = 0
				const originalUpdate = context.globalState.update
				context.globalState.update = vi.fn(async (key: string, value: unknown) => {
					if (failCount < 2) {
						failCount++
						throw new Error("Temporary failure")
					}
					return originalUpdate.call(context.globalState, key, value)
				})

				const event: QueuedTelemetryEvent = {
					id: "evt_retry",
					timestamp: Date.now(),
					event: {
						event: TelemetryEventName.TASK_CREATED,
						properties: { taskId: "test-retry" },
					},
					retryCount: 0,
				}

				// Should succeed after retries
				await storage1.add(event)

				const events = await storage1.getAll()
				expect(events).toHaveLength(1)
				expect(events[0].id).toBe("evt_retry")
			})
		})

		describe("getLockStats", () => {
			it("should return correct lock statistics", async () => {
				// No lock initially
				let stats = await storage1.getLockStats()
				expect(stats.hasLock).toBe(false)

				// Acquire lock
				await storage1.acquireLock()

				stats = await storage1.getLockStats()
				expect(stats.hasLock).toBe(true)
				expect(stats.lockHolder).toContain(storage1.getInstanceInfo().instanceId)
				expect(stats.lockAge).toBeGreaterThanOrEqual(0)
				expect(stats.isExpired).toBe(false)

				// Wait for expiration
				await new Promise((resolve) => setTimeout(resolve, 1100))

				stats = await storage1.getLockStats()
				expect(stats.hasLock).toBe(true)
				expect(stats.isExpired).toBe(true)
			})
		})

		describe("instance identification", () => {
			it("should generate unique instance IDs", () => {
				const info1 = storage1.getInstanceInfo()
				const info2 = storage2.getInstanceInfo()

				expect(info1.instanceId).toBeDefined()
				expect(info2.instanceId).toBeDefined()
				expect(info1.instanceId).not.toBe(info2.instanceId)
				expect(info1.hostname).toBeDefined()
				expect(info2.hostname).toBeDefined()
			})
		})
	})
})
