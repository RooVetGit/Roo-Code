import { describe, it, expect, beforeEach, vi } from "vitest"
import { CodeIndexStateManager } from "../state-manager"
import { CodeIndexOrchestrator } from "../orchestrator"
import { CodeIndexManager } from "../manager"

describe("Code Index Error Recovery", () => {
	let stateManager: CodeIndexStateManager
	let mockConfigManager: any
	let mockVectorStore: any
	let mockScanner: any
	let mockFileWatcher: any
	let mockCacheManager: any

	beforeEach(() => {
		stateManager = new CodeIndexStateManager()
		
		mockConfigManager = {
			isFeatureConfigured: true,
			isFeatureEnabled: true,
		}

		mockVectorStore = {
			initialize: vi.fn().mockResolvedValue(false),
			clearCollection: vi.fn().mockResolvedValue(undefined),
		}

		mockScanner = {
			scanDirectory: vi.fn().mockResolvedValue({
				stats: { totalFiles: 5, processedFiles: 5 }
			}),
		}

		mockFileWatcher = {
			initialize: vi.fn().mockResolvedValue(undefined),
			onDidStartBatchProcessing: vi.fn().mockReturnValue({ dispose: vi.fn() }),
			onBatchProgressUpdate: vi.fn().mockReturnValue({ dispose: vi.fn() }),
			onDidFinishBatchProcessing: vi.fn().mockReturnValue({ dispose: vi.fn() }),
			dispose: vi.fn(),
		}

		mockCacheManager = {
			clearCacheFile: vi.fn().mockResolvedValue(undefined),
		}
	})

	describe("CodeIndexStateManager", () => {
		it("should allow resetting from error state", () => {
			// Set to error state
			stateManager.setSystemState("Error", "Test error")
			expect(stateManager.state).toBe("Error")

			// Reset from error
			stateManager.resetFromError()
			expect(stateManager.state).toBe("Standby")
		})

		it("should not reset if not in error state", () => {
			stateManager.setSystemState("Indexed", "All good")
			stateManager.resetFromError()
			expect(stateManager.state).toBe("Indexed")
		})

		it("should correctly identify when indexing can start", () => {
			// Test all valid states
			stateManager.setSystemState("Standby")
			expect(stateManager.canStartIndexing()).toBe(true)

			stateManager.setSystemState("Error")
			expect(stateManager.canStartIndexing()).toBe(true)

			stateManager.setSystemState("Indexed")
			expect(stateManager.canStartIndexing()).toBe(true)

			// Test invalid state
			stateManager.setSystemState("Indexing")
			expect(stateManager.canStartIndexing()).toBe(false)
		})
	})

	describe("CodeIndexOrchestrator", () => {
		let orchestrator: CodeIndexOrchestrator

		beforeEach(() => {
			orchestrator = new CodeIndexOrchestrator(
				mockConfigManager,
				stateManager,
				"/test/workspace",
				mockCacheManager,
				mockVectorStore,
				mockScanner,
				mockFileWatcher
			)
		})

		it("should recover from error state when starting indexing", async () => {
			// Set to error state
			stateManager.setSystemState("Error", "Previous error")
			expect(stateManager.state).toBe("Error")

			// Start indexing should recover from error
			await orchestrator.startIndexing()

			// Should have reset from error and started indexing
			expect(stateManager.state).toBe("Indexed")
		})

		it("should not start if already processing", async () => {
			// Start indexing once
			const firstStart = orchestrator.startIndexing()

			// Try to start again while processing
			await orchestrator.startIndexing()

			// Wait for first start to complete
			await firstStart

			// Should only have been called once
			expect(mockVectorStore.initialize).toHaveBeenCalledTimes(1)
		})

		it("should handle configuration errors gracefully", async () => {
			mockConfigManager.isFeatureConfigured = false

			await orchestrator.startIndexing()

			expect(stateManager.state).toBe("Standby")
			expect(mockVectorStore.initialize).not.toHaveBeenCalled()
		})
	})

	describe("Integration Test", () => {
		it("should allow restarting indexing after error without workspace reload", async () => {
			const orchestrator = new CodeIndexOrchestrator(
				mockConfigManager,
				stateManager,
				"/test/workspace",
				mockCacheManager,
				mockVectorStore,
				mockScanner,
				mockFileWatcher
			)

			// Simulate an error during indexing
			mockVectorStore.initialize.mockRejectedValueOnce(new Error("Connection failed"))

			// First attempt should fail
			await orchestrator.startIndexing()
			expect(stateManager.state).toBe("Error")

			// Fix the mock to succeed
			mockVectorStore.initialize.mockResolvedValueOnce(false)

			// Second attempt should succeed without requiring workspace reload
			await orchestrator.startIndexing()
			expect(stateManager.state).toBe("Indexed")

			// Should have attempted initialization twice
			expect(mockVectorStore.initialize).toHaveBeenCalledTimes(2)
		})
	})
})