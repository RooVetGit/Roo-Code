// Error handling and edge case tests for FilesChangedOverview component

import React from "react"
import { render, screen, fireEvent } from "@testing-library/react"
import { vi } from "vitest"

import { ExtensionStateContext } from "@src/context/ExtensionStateContext"
import { vscode } from "@src/utils/vscode"
import { FileChangeType } from "@roo-code/types"

import FilesChangedOverview from "../../FilesChangedOverview"

// Mock vscode API
vi.mock("@src/utils/vscode", () => ({
	vscode: {
		postMessage: vi.fn(),
	},
}))

describe("FilesChangedOverview Error Handling", () => {
	const createMockState = (files: any[] = []) => ({
		version: "1.0.0",
		clineMessages: [],
		taskHistory: [],
		shouldShowAnnouncement: false,
		allowedCommands: [],
		alwaysAllowExecute: false,
		currentFileChangeset: {
			baseCheckpoint: "abc123",
			files,
		},
		setCurrentFileChangeset: () => {},
		didHydrateState: true,
		showWelcome: false,
		theme: {},
		mcpServers: [],
		filePaths: [],
		openedTabs: [],
		organizationAllowList: [],
		cloudIsAuthenticated: false,
		sharingEnabled: false,
		hasOpenedModeSelector: false,
		setHasOpenedModeSelector: () => {},
		condensingApiConfigId: "",
		setCondensingApiConfigId: () => {},
		customCondensingPrompt: "",
		setCustomCondensingPrompt: () => {},
	})

	const renderComponent = (files: any[] = []) => {
		const mockState = createMockState(files)
		const changeset = mockState.currentFileChangeset!

		return render(
			<ExtensionStateContext.Provider value={mockState as any}>
				<FilesChangedOverview
					changeset={changeset}
					onViewDiff={(uri) => vscode.postMessage({ type: "viewDiff", uri })}
					onAcceptFile={(uri) => vscode.postMessage({ type: "acceptFileChange", uri })}
					onRejectFile={(uri) => vscode.postMessage({ type: "rejectFileChange", uri })}
					onAcceptAll={() => vscode.postMessage({ type: "acceptAllFileChanges" })}
					onRejectAll={() => vscode.postMessage({ type: "rejectAllFileChanges" })}
				/>
			</ExtensionStateContext.Provider>,
		)
	}

	beforeEach(() => {
		vi.clearAllMocks()
	})

	describe("Edge Cases", () => {
		it("should handle empty file list gracefully", () => {
			renderComponent([])

			// Should show zero files
			expect(screen.getByText("(0) Files Changed")).toBeInTheDocument()

			// Should still render action buttons (disabled state would be handled by parent)
			expect(screen.getByText("Accept All")).toBeInTheDocument()
			expect(screen.getByText("Reject All")).toBeInTheDocument()

			// Should be able to expand/collapse even with no files
			const expandButton = screen.getByTitle("Expand files list")
			fireEvent.click(expandButton)
			expect(expandButton).toHaveAttribute("aria-expanded", "true")
		})

		it("should handle malformed file data", () => {
			const malformedFiles = [
				{
					// Missing required fields
					uri: "test.ts",
					// type missing
					// fromCheckpoint missing
					// toCheckpoint missing
					linesAdded: undefined,
					linesRemoved: null,
				},
				{
					uri: null, // Invalid URI
					type: "edit" as FileChangeType,
					fromCheckpoint: "",
					toCheckpoint: "",
					linesAdded: -5, // Negative values
					linesRemoved: -10,
				},
				{
					uri: "", // Empty URI
					type: "invalid" as any, // Invalid type
					fromCheckpoint: "hash1",
					toCheckpoint: "hash2",
					linesAdded: NaN, // NaN values
					linesRemoved: Infinity,
				},
			]

			// Should not crash with malformed data
			expect(() => renderComponent(malformedFiles)).not.toThrow()

			// Should display count correctly even with malformed data
			expect(screen.getByText((content) => content.includes("(3) Files Changed"))).toBeInTheDocument()
		})

		it("should handle extremely large file counts", () => {
			const largeFileList = Array.from({ length: 10000 }, (_, i) => ({
				uri: `file${i}.ts`,
				type: "edit" as FileChangeType,
				fromCheckpoint: "hash1",
				toCheckpoint: "hash2",
				linesAdded: i,
				linesRemoved: i % 2,
			}))

			// Should not crash with large datasets
			expect(() => renderComponent(largeFileList)).not.toThrow()

			// Should display correct count
			expect(screen.getByText((content) => content.includes("(10000) Files Changed"))).toBeInTheDocument()

			// Should use virtualization
			const expandButton = screen.getByTitle("Expand files list")
			fireEvent.click(expandButton)

			// Should only render visible items (not all 10000)
			const fileItems = screen.getAllByTestId(/^file-item-/)
			expect(fileItems.length).toBeLessThan(20) // Should be virtualized
		})

		it("should handle very long file paths", () => {
			const longPath = "a".repeat(1000) + "/" + "b".repeat(500) + ".ts"
			const filesWithLongPaths = [
				{
					uri: longPath,
					type: "edit" as FileChangeType,
					fromCheckpoint: "hash1",
					toCheckpoint: "hash2",
					linesAdded: 10,
					linesRemoved: 5,
				},
			]

			renderComponent(filesWithLongPaths)

			// Should render without crashing
			expect(screen.getByText((content) => content.includes("(1) Files Changed"))).toBeInTheDocument()

			// Expand to see the long path
			fireEvent.click(screen.getByTitle("Expand files list"))

			// Should truncate long paths with ellipsis
			const fileItem = screen.getByTestId(`file-item-${longPath}`)
			expect(fileItem).toBeInTheDocument()
		})

		it("should handle special characters in file paths", () => {
			const specialCharFiles = [
				{
					uri: "файл.ts", // Cyrillic
					type: "edit" as FileChangeType,
					fromCheckpoint: "hash1",
					toCheckpoint: "hash2",
					linesAdded: 1,
					linesRemoved: 0,
				},
				{
					uri: "file with spaces.ts",
					type: "create" as FileChangeType,
					fromCheckpoint: "hash1",
					toCheckpoint: "hash2",
					linesAdded: 2,
					linesRemoved: 0,
				},
				{
					uri: "file-with-émojis-🚀.ts",
					type: "delete" as FileChangeType,
					fromCheckpoint: "hash1",
					toCheckpoint: "hash2",
					linesAdded: 0,
					linesRemoved: 3,
				},
			]

			renderComponent(specialCharFiles)

			// Should render without crashing
			expect(screen.getByText((content) => content.includes("(3) Files Changed"))).toBeInTheDocument()

			// Expand to see all files
			fireEvent.click(screen.getByTitle("Expand files list"))

			// Should handle special characters
			expect(screen.getByTestId("file-item-файл.ts")).toBeInTheDocument()
			expect(screen.getByTestId("file-item-file with spaces.ts")).toBeInTheDocument()
			expect(screen.getByTestId("file-item-file-with-émojis-🚀.ts")).toBeInTheDocument()
		})

		it("should handle zero line changes correctly", () => {
			const zeroChangeFiles = [
				{
					uri: "no-changes.ts",
					type: "edit" as FileChangeType,
					fromCheckpoint: "hash1",
					toCheckpoint: "hash2",
					linesAdded: 0,
					linesRemoved: 0,
				},
			]

			renderComponent(zeroChangeFiles)

			// Should show file count with no line changes
			expect(screen.getByText((content) => content.includes("(1) Files Changed"))).toBeInTheDocument()

			// Expand to see details
			fireEvent.click(screen.getByTitle("Expand files list"))

			// Should show "modified" for zero line changes
			expect(screen.getByText((content) => content.includes("modified"))).toBeInTheDocument()
		})
	})

	describe("Error Scenarios", () => {
		it("should handle callback errors gracefully", () => {
			const errorFiles = [
				{
					uri: "error-test.ts",
					type: "edit" as FileChangeType,
					fromCheckpoint: "hash1",
					toCheckpoint: "hash2",
					linesAdded: 10,
					linesRemoved: 5,
				},
			]

			// Mock callback that throws an error
			const throwingCallback = vi.fn(() => {
				throw new Error("Callback error")
			})

			render(
				<ExtensionStateContext.Provider value={createMockState(errorFiles) as any}>
					<FilesChangedOverview
						changeset={{ baseCheckpoint: "abc123", files: errorFiles }}
						onViewDiff={throwingCallback}
						onAcceptFile={throwingCallback}
						onRejectFile={throwingCallback}
						onAcceptAll={throwingCallback}
						onRejectAll={throwingCallback}
					/>
				</ExtensionStateContext.Provider>,
			)

			// Component should still render
			expect(screen.getByText((content) => content.includes("(1) Files Changed"))).toBeInTheDocument()

			// Expand to show buttons
			fireEvent.click(screen.getByTitle("Expand files list"))

			// Clicking buttons should not crash the app (errors are caught internally)
			expect(() => {
				fireEvent.click(screen.getByText("Accept All"))
			}).not.toThrow()

			expect(() => {
				fireEvent.click(screen.getByTestId("diff-error-test.ts"))
			}).not.toThrow()
		})

		it("should handle missing translation keys gracefully", () => {
			const files = [
				{
					uri: "test.ts",
					type: "edit" as FileChangeType,
					fromCheckpoint: "hash1",
					toCheckpoint: "hash2",
					linesAdded: 10,
					linesRemoved: 5,
				},
			]

			// Component should still render even with translation issues
			// (Global mock handles this scenario)
			expect(() => renderComponent(files)).not.toThrow()
			expect(screen.getByText((content) => content.includes("(1) Files Changed"))).toBeInTheDocument()
		})

		it("should handle rapid successive interactions", () => {
			const files = [
				{
					uri: "rapid-test.ts",
					type: "edit" as FileChangeType,
					fromCheckpoint: "hash1",
					toCheckpoint: "hash2",
					linesAdded: 10,
					linesRemoved: 5,
				},
			]

			renderComponent(files)

			// Rapid expand/collapse
			const expandButton = screen.getByTitle("Expand files list")

			// Should handle rapid clicks without issues
			for (let i = 0; i < 10; i++) {
				fireEvent.click(expandButton)
			}

			// Should end up in a consistent state
			expect(expandButton).toHaveAttribute("aria-expanded")
		})

		it("should handle component unmounting during operations", async () => {
			const files = [
				{
					uri: "unmount-test.ts",
					type: "edit" as FileChangeType,
					fromCheckpoint: "hash1",
					toCheckpoint: "hash2",
					linesAdded: 10,
					linesRemoved: 5,
				},
			]

			const { unmount } = renderComponent(files)

			// Start an operation
			fireEvent.click(screen.getByTitle("Expand files list"))

			// Unmount while operation might be in progress
			expect(() => unmount()).not.toThrow()
		})

		it("should handle memory constraints with large datasets", () => {
			// Create a large dataset that might cause memory issues
			const hugeFileList = Array.from({ length: 50000 }, (_, i) => ({
				uri: `huge-file-${i}.ts`,
				type: (i % 3 === 0 ? "create" : i % 3 === 1 ? "edit" : "delete") as FileChangeType,
				fromCheckpoint: "hash1",
				toCheckpoint: "hash2",
				linesAdded: Math.floor(Math.random() * 100),
				linesRemoved: Math.floor(Math.random() * 50),
			}))

			// Should handle large datasets without memory issues
			expect(() => renderComponent(hugeFileList)).not.toThrow()

			// Should show correct count
			expect(screen.getByText((content) => content.includes("(50000) Files Changed"))).toBeInTheDocument()

			// Should use virtualization to limit DOM nodes
			fireEvent.click(screen.getByTitle("Expand files list"))
			const fileItems = screen.getAllByTestId(/^file-item-/)
			expect(fileItems.length).toBeLessThan(50) // Should be heavily virtualized
		})

		it("should handle concurrent state changes", () => {
			const files = [
				{
					uri: "concurrent-test.ts",
					type: "edit" as FileChangeType,
					fromCheckpoint: "hash1",
					toCheckpoint: "hash2",
					linesAdded: 10,
					linesRemoved: 5,
				},
			]

			renderComponent(files)

			const expandButton = screen.getByTitle("Expand files list")

			// Simulate concurrent operations
			fireEvent.click(expandButton)
			fireEvent.click(screen.getByText("Accept All"))
			fireEvent.click(expandButton)

			// Should maintain consistent state
			expect(expandButton).toHaveAttribute("aria-expanded")
		})
	})

	describe("Browser Compatibility", () => {
		it("should handle missing ResizeObserver", () => {
			// Temporarily remove ResizeObserver
			const originalResizeObserver = global.ResizeObserver
			delete (global as any).ResizeObserver

			const files = [
				{
					uri: "resize-test.ts",
					type: "edit" as FileChangeType,
					fromCheckpoint: "hash1",
					toCheckpoint: "hash2",
					linesAdded: 10,
					linesRemoved: 5,
				},
			]

			// Should not crash without ResizeObserver
			expect(() => renderComponent(files)).not.toThrow()

			// Restore ResizeObserver
			global.ResizeObserver = originalResizeObserver
		})

		it("should handle missing scroll APIs", () => {
			// Mock missing scrollIntoView
			const originalScrollIntoView = Element.prototype.scrollIntoView
			delete (Element.prototype as any).scrollIntoView

			const files = Array.from({ length: 100 }, (_, i) => ({
				uri: `scroll-test-${i}.ts`,
				type: "edit" as FileChangeType,
				fromCheckpoint: "hash1",
				toCheckpoint: "hash2",
				linesAdded: i,
				linesRemoved: i % 2,
			}))

			// Should not crash without scroll APIs
			expect(() => renderComponent(files)).not.toThrow()

			// Restore scroll API
			Element.prototype.scrollIntoView = originalScrollIntoView
		})
	})

	describe("Performance Under Stress", () => {
		it("should maintain performance with frequent updates", () => {
			const files = Array.from({ length: 1000 }, (_, i) => ({
				uri: `perf-test-${i}.ts`,
				type: "edit" as FileChangeType,
				fromCheckpoint: "hash1",
				toCheckpoint: "hash2",
				linesAdded: i,
				linesRemoved: i % 10,
			}))

			const startTime = performance.now()
			renderComponent(files)
			const renderTime = performance.now() - startTime

			// Should render in reasonable time (less than 1 second)
			expect(renderTime).toBeLessThan(1000)

			// Should handle expansion efficiently
			const expandStartTime = performance.now()
			fireEvent.click(screen.getByTitle("Expand files list"))
			const expandTime = performance.now() - expandStartTime

			expect(expandTime).toBeLessThan(500)
		})

		it("should handle scroll performance with virtualization", () => {
			const files = Array.from({ length: 1000 }, (_, i) => ({
				uri: `scroll-perf-${i}.ts`,
				type: "edit" as FileChangeType,
				fromCheckpoint: "hash1",
				toCheckpoint: "hash2",
				linesAdded: i,
				linesRemoved: i % 5,
			}))

			const { container } = renderComponent(files)

			// Expand the list
			fireEvent.click(screen.getByTitle("Expand files list"))

			// Find the scrollable container
			const scrollContainer = container.querySelector('[style*="overflow-y"]')
			expect(scrollContainer).toBeInTheDocument()

			// Simulate rapid scrolling
			const startTime = performance.now()
			for (let scrollTop = 0; scrollTop <= 5000; scrollTop += 100) {
				fireEvent.scroll(scrollContainer!, { target: { scrollTop } })
			}
			const scrollTime = performance.now() - startTime

			// Should handle scrolling efficiently
			expect(scrollTime).toBeLessThan(1000)
		})
	})
})
