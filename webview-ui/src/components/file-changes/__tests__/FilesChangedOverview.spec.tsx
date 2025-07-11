// Tests for self-managing FilesChangedOverview component
// npx vitest run src/components/file-changes/__tests__/FilesChangedOverview.updated.spec.tsx

import React from "react"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { vi } from "vitest"

import { ExtensionStateContext } from "@src/context/ExtensionStateContext"
import { vscode } from "@src/utils/vscode"
import { FileChangeType } from "@roo-code/types"

import FilesChangedOverview from "../FilesChangedOverview"

// Mock vscode API
vi.mock("@src/utils/vscode", () => ({
	vscode: {
		postMessage: vi.fn(),
	},
}))

// Mock react-i18next
vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string, options?: any) => {
			// Simple key mapping for tests
			const translations: Record<string, string> = {
				"file-changes:summary.count_with_changes": `${options?.count || 0} files changed${options?.changes || ""}`,
				"file-changes:actions.accept_all": "Accept All",
				"file-changes:actions.reject_all": "Reject All",
				"file-changes:actions.view_diff": "View Diff",
				"file-changes:actions.accept_file": "Accept",
				"file-changes:actions.reject_file": "Reject",
				"file-changes:file_types.edit": "Modified",
				"file-changes:file_types.create": "Created",
				"file-changes:file_types.delete": "Deleted",
				"file-changes:line_changes.added": `+${options?.count || 0}`,
				"file-changes:line_changes.removed": `-${options?.count || 0}`,
				"file-changes:line_changes.added_removed": `+${options?.added || 0}, -${options?.removed || 0}`,
				"file-changes:line_changes.deleted": "deleted",
				"file-changes:line_changes.modified": "modified",
				"file-changes:accessibility.files_list": `${options?.count || 0} files ${options?.state || ""}`,
				"file-changes:accessibility.expanded": "expanded",
				"file-changes:accessibility.collapsed": "collapsed",
				"file-changes:header.expand": "Expand",
				"file-changes:header.collapse": "Collapse",
			}
			return translations[key] || key
		},
	}),
}))

describe("FilesChangedOverview (Self-Managing)", () => {
	const mockExtensionState = {
		filesChangedEnabled: true,
		// Other required state properties
	}

	const mockFilesChanged = [
		{
			uri: "src/components/test1.ts",
			type: "edit" as FileChangeType,
			fromCheckpoint: "hash1",
			toCheckpoint: "hash2",
			linesAdded: 10,
			linesRemoved: 5,
		},
		{
			uri: "src/components/test2.ts",
			type: "create" as FileChangeType,
			fromCheckpoint: "hash1",
			toCheckpoint: "hash2",
			linesAdded: 25,
			linesRemoved: 0,
		},
	]

	const mockChangeset = {
		baseCheckpoint: "hash1",
		files: mockFilesChanged,
	}

	beforeEach(() => {
		vi.clearAllMocks()
		// Mock window.addEventListener for message handling
		vi.spyOn(window, "addEventListener")
		vi.spyOn(window, "removeEventListener")
	})

	afterEach(() => {
		vi.restoreAllMocks()
	})

	const renderComponent = () => {
		return render(
			<ExtensionStateContext.Provider value={mockExtensionState as any}>
				<FilesChangedOverview />
			</ExtensionStateContext.Provider>,
		)
	}

	// Helper to simulate messages from backend
	const simulateMessage = (message: any) => {
		const messageEvent = new MessageEvent("message", {
			data: message,
		})
		window.dispatchEvent(messageEvent)
	}

	// Helper to setup component with files for integration tests
	const setupComponentWithFiles = async () => {
		renderComponent()
		simulateMessage({
			type: "filesChanged",
			filesChanged: mockChangeset,
		})
		await waitFor(() => {
			expect(screen.getByTestId("files-changed-overview")).toBeInTheDocument()
		})
	}

	it("should render without errors when no files changed", () => {
		renderComponent()
		// Component should not render anything when no files
		expect(screen.queryByTestId("files-changed-overview")).not.toBeInTheDocument()
	})

	it("should listen for window messages on mount", () => {
		renderComponent()
		expect(window.addEventListener).toHaveBeenCalledWith("message", expect.any(Function))
	})

	it("should remove event listener on unmount", () => {
		const { unmount } = renderComponent()
		unmount()
		expect(window.removeEventListener).toHaveBeenCalledWith("message", expect.any(Function))
	})

	it("should display files when receiving filesChanged message", async () => {
		renderComponent()

		// Simulate receiving filesChanged message
		simulateMessage({
			type: "filesChanged",
			filesChanged: mockChangeset,
		})

		await waitFor(() => {
			expect(screen.getByTestId("files-changed-overview")).toBeInTheDocument()
		})

		// Check header shows file count
		expect(screen.getByTestId("files-changed-header")).toHaveTextContent("2 files changed")
	})

	it("should handle checkpoint_created message", async () => {
		renderComponent()

		// Simulate checkpoint created event
		simulateMessage({
			type: "checkpoint_created",
			checkpoint: "new-checkpoint-hash",
			previousCheckpoint: "previous-hash",
		})

		// Backend automatically sends filesChanged message after checkpoint creation
		// So we simulate that behavior
		simulateMessage({
			type: "filesChanged",
			filesChanged: mockChangeset,
		})

		await waitFor(() => {
			expect(screen.getByTestId("files-changed-overview")).toBeInTheDocument()
		})
	})

	it("should handle checkpoint_restored message", async () => {
		renderComponent()

		// First set up some files
		simulateMessage({
			type: "filesChanged",
			filesChanged: mockChangeset,
		})

		await waitFor(() => {
			expect(screen.getByTestId("files-changed-overview")).toBeInTheDocument()
		})

		// Simulate checkpoint restore
		simulateMessage({
			type: "checkpoint_restored",
			checkpoint: "restored-checkpoint-hash",
		})

		await waitFor(() => {
			expect(vscode.postMessage).toHaveBeenCalledWith({
				type: "filesChangedRequest",
			})
		})
	})

	it("should expand/collapse when header is clicked", async () => {
		renderComponent()

		// Add some files first
		simulateMessage({
			type: "filesChanged",
			filesChanged: mockChangeset,
		})

		await waitFor(() => {
			expect(screen.getByTestId("files-changed-overview")).toBeInTheDocument()
		})

		// Component should start collapsed
		expect(screen.queryByTestId("file-item-src/components/test1.ts")).not.toBeInTheDocument()

		// Click to expand
		const header = screen.getByTestId("files-changed-header").closest('[role="button"]')
		fireEvent.click(header!)

		await waitFor(() => {
			expect(screen.getByTestId("file-item-src/components/test1.ts")).toBeInTheDocument()
		})
	})

	it("should send accept file message when accept button clicked", async () => {
		renderComponent()

		// Add files and expand
		simulateMessage({
			type: "filesChanged",
			filesChanged: mockChangeset,
		})

		await waitFor(() => {
			expect(screen.getByTestId("files-changed-overview")).toBeInTheDocument()
		})

		// Expand to show files
		const header = screen.getByTestId("files-changed-header").closest('[role="button"]')
		fireEvent.click(header!)

		await waitFor(() => {
			expect(screen.getByTestId("file-item-src/components/test1.ts")).toBeInTheDocument()
		})

		// Click accept button
		const acceptButton = screen.getByTestId("accept-src/components/test1.ts")
		fireEvent.click(acceptButton)

		expect(vscode.postMessage).toHaveBeenCalledWith({
			type: "acceptFileChange",
			uri: "src/components/test1.ts",
		})
	})

	it("should send reject file message when reject button clicked", async () => {
		renderComponent()

		// Add files and expand
		simulateMessage({
			type: "filesChanged",
			filesChanged: mockChangeset,
		})

		await waitFor(() => {
			expect(screen.getByTestId("files-changed-overview")).toBeInTheDocument()
		})

		// Expand to show files
		const header = screen.getByTestId("files-changed-header").closest('[role="button"]')
		fireEvent.click(header!)

		await waitFor(() => {
			expect(screen.getByTestId("file-item-src/components/test1.ts")).toBeInTheDocument()
		})

		// Click reject button
		const rejectButton = screen.getByTestId("reject-src/components/test1.ts")
		fireEvent.click(rejectButton)

		expect(vscode.postMessage).toHaveBeenCalledWith({
			type: "rejectFileChange",
			uri: "src/components/test1.ts",
		})
	})

	it("should send accept all message when accept all button clicked", async () => {
		renderComponent()

		// Add files
		simulateMessage({
			type: "filesChanged",
			filesChanged: mockChangeset,
		})

		await waitFor(() => {
			expect(screen.getByTestId("files-changed-overview")).toBeInTheDocument()
		})

		// Click accept all button
		const acceptAllButton = screen.getByTestId("accept-all-button")
		fireEvent.click(acceptAllButton)

		expect(vscode.postMessage).toHaveBeenCalledWith({
			type: "acceptAllFileChanges",
		})
	})

	it("should send reject all message when reject all button clicked", async () => {
		renderComponent()

		// Add files
		simulateMessage({
			type: "filesChanged",
			filesChanged: mockChangeset,
		})

		await waitFor(() => {
			expect(screen.getByTestId("files-changed-overview")).toBeInTheDocument()
		})

		// Click reject all button
		const rejectAllButton = screen.getByTestId("reject-all-button")
		fireEvent.click(rejectAllButton)

		expect(vscode.postMessage).toHaveBeenCalledWith({
			type: "rejectAllFileChanges",
			uris: ["src/components/test1.ts", "src/components/test2.ts"],
		})
	})

	it("should send accept message and update display when backend sends filtered results", async () => {
		renderComponent()

		// Add files
		simulateMessage({
			type: "filesChanged",
			filesChanged: mockChangeset,
		})

		await waitFor(() => {
			expect(screen.getByTestId("files-changed-overview")).toBeInTheDocument()
		})

		// Expand to show files
		const header = screen.getByTestId("files-changed-header").closest('[role="button"]')
		fireEvent.click(header!)

		await waitFor(() => {
			expect(screen.getByTestId("file-item-src/components/test1.ts")).toBeInTheDocument()
			expect(screen.getByTestId("file-item-src/components/test2.ts")).toBeInTheDocument()
		})

		// Accept one file
		const acceptButton = screen.getByTestId("accept-src/components/test1.ts")
		fireEvent.click(acceptButton)

		// Should send message to backend
		expect(vscode.postMessage).toHaveBeenCalledWith({
			type: "acceptFileChange",
			uri: "src/components/test1.ts",
		})

		// Backend responds with filtered results (only unaccepted files)
		const filteredChangeset = {
			baseCheckpoint: "hash1",
			files: [mockFilesChanged[1]], // Only the second file
		}

		simulateMessage({
			type: "filesChanged",
			filesChanged: filteredChangeset,
		})

		// File should be filtered out from display
		await waitFor(() => {
			expect(screen.queryByTestId("file-item-src/components/test1.ts")).not.toBeInTheDocument()
			expect(screen.getByTestId("file-item-src/components/test2.ts")).toBeInTheDocument()
		})
	})

	it("should not render when filesChangedEnabled is false", () => {
		const disabledState = { ...mockExtensionState, filesChangedEnabled: false }

		render(
			<ExtensionStateContext.Provider value={disabledState as any}>
				<FilesChangedOverview />
			</ExtensionStateContext.Provider>,
		)

		// Add files
		simulateMessage({
			type: "filesChanged",
			filesChanged: mockChangeset,
		})

		// Component should not render when disabled
		expect(screen.queryByTestId("files-changed-overview")).not.toBeInTheDocument()
	})

	it("should clear files when receiving empty filesChanged message", async () => {
		renderComponent()

		// First add files
		simulateMessage({
			type: "filesChanged",
			filesChanged: mockChangeset,
		})

		await waitFor(() => {
			expect(screen.getByTestId("files-changed-overview")).toBeInTheDocument()
		})

		// Clear files with empty message
		simulateMessage({
			type: "filesChanged",
			filesChanged: undefined,
		})

		await waitFor(() => {
			expect(screen.queryByTestId("files-changed-overview")).not.toBeInTheDocument()
		})
	})

	// ===== INTEGRATION TESTS =====
	describe("Message Type Validation", () => {
		it("should send viewDiff message for individual file action", async () => {
			vi.clearAllMocks()
			await setupComponentWithFiles()

			// Expand to show individual files
			const header = screen.getByTestId("files-changed-header").closest('[role="button"]')
			fireEvent.click(header!)

			await waitFor(() => {
				expect(screen.getByTestId("file-item-src/components/test1.ts")).toBeInTheDocument()
			})

			// Test diff button
			const diffButton = screen.getByTestId("diff-src/components/test1.ts")
			fireEvent.click(diffButton)

			expect(vscode.postMessage).toHaveBeenCalledWith({
				type: "viewDiff",
				uri: "src/components/test1.ts",
			})
		})

		it("should send acceptAllFileChanges message correctly", async () => {
			vi.clearAllMocks()
			await setupComponentWithFiles()

			const acceptAllButton = screen.getByTestId("accept-all-button")
			fireEvent.click(acceptAllButton)

			expect(vscode.postMessage).toHaveBeenCalledWith({
				type: "acceptAllFileChanges",
			})
		})

		it("should send rejectAllFileChanges message correctly", async () => {
			vi.clearAllMocks()
			await setupComponentWithFiles()

			const rejectAllButton = screen.getByTestId("reject-all-button")
			fireEvent.click(rejectAllButton)

			expect(vscode.postMessage).toHaveBeenCalledWith({
				type: "rejectAllFileChanges",
				uris: ["src/components/test1.ts", "src/components/test2.ts"],
			})
		})

		it("should only send URIs of visible files in reject all, not all changed files", async () => {
			vi.clearAllMocks()

			// Create a larger changeset with more files than what's visible
			const allChangedFiles = [
				{
					uri: "src/components/visible1.ts",
					type: "edit" as FileChangeType,
					fromCheckpoint: "hash1",
					toCheckpoint: "hash2",
					linesAdded: 10,
					linesRemoved: 5,
				},
				{
					uri: "src/components/visible2.ts",
					type: "create" as FileChangeType,
					fromCheckpoint: "hash1",
					toCheckpoint: "hash2",
					linesAdded: 25,
					linesRemoved: 0,
				},
				{
					uri: "src/utils/hidden1.ts",
					type: "edit" as FileChangeType,
					fromCheckpoint: "hash1",
					toCheckpoint: "hash2",
					linesAdded: 15,
					linesRemoved: 3,
				},
				{
					uri: "src/utils/hidden2.ts",
					type: "delete" as FileChangeType,
					fromCheckpoint: "hash1",
					toCheckpoint: "hash2",
					linesAdded: 0,
					linesRemoved: 20,
				},
			]

			const largeChangeset = {
				baseCheckpoint: "hash1",
				files: allChangedFiles,
			}

			renderComponent()

			// Simulate receiving a large changeset
			simulateMessage({
				type: "filesChanged",
				filesChanged: largeChangeset,
			})

			await waitFor(() => {
				expect(screen.getByTestId("files-changed-overview")).toBeInTheDocument()
			})

			// Now simulate backend filtering to show only some files (e.g., after accepting some)
			const filteredChangeset = {
				baseCheckpoint: "hash1",
				files: [allChangedFiles[0], allChangedFiles[1]], // Only first 2 files visible
			}

			simulateMessage({
				type: "filesChanged",
				filesChanged: filteredChangeset,
			})

			await waitFor(() => {
				expect(screen.getByTestId("files-changed-header")).toHaveTextContent("2 files changed")
			})

			// Click reject all button
			const rejectAllButton = screen.getByTestId("reject-all-button")
			fireEvent.click(rejectAllButton)

			// Should only send URIs of the 2 visible files, not all 4 changed files
			expect(vscode.postMessage).toHaveBeenCalledWith({
				type: "rejectAllFileChanges",
				uris: ["src/components/visible1.ts", "src/components/visible2.ts"],
			})

			// Verify it doesn't include the hidden files
			expect(vscode.postMessage).not.toHaveBeenCalledWith({
				type: "rejectAllFileChanges",
				uris: expect.arrayContaining(["src/utils/hidden1.ts", "src/utils/hidden2.ts"]),
			})
		})
	})

	// ===== ACCESSIBILITY COMPLIANCE =====
	describe("Accessibility Compliance", () => {
		it("should have proper ARIA attributes for main interactive elements", async () => {
			await setupComponentWithFiles()

			// Header should have proper ARIA attributes
			const header = screen.getByTestId("files-changed-header").closest('[role="button"]')
			expect(header).toHaveAttribute("role", "button")
			expect(header).toHaveAttribute("aria-expanded", "false")
			expect(header).toHaveAttribute("aria-label")

			// ARIA label should be translated (shows actual file count in tests)
			const ariaLabel = header!.getAttribute("aria-label")
			expect(ariaLabel).toBe("2 files collapsed")

			// Action buttons should have proper attributes
			const acceptAllButton = screen.getByTestId("accept-all-button")
			const rejectAllButton = screen.getByTestId("reject-all-button")

			expect(acceptAllButton).toHaveAttribute("title", "Accept All")
			expect(rejectAllButton).toHaveAttribute("title", "Reject All")
			expect(acceptAllButton).toHaveAttribute("tabIndex", "0")
			expect(rejectAllButton).toHaveAttribute("tabIndex", "0")
		})

		it("should update ARIA attributes when state changes", async () => {
			await setupComponentWithFiles()

			const header = screen.getByTestId("files-changed-header").closest('[role="button"]')
			expect(header).toHaveAttribute("aria-expanded", "false")

			// Expand
			fireEvent.click(header!)
			await waitFor(() => {
				expect(header).toHaveAttribute("aria-expanded", "true")
			})

			// ARIA label should be translated (shows actual file count in tests)
			const expandedAriaLabel = header!.getAttribute("aria-label")
			expect(expandedAriaLabel).toBe("2 files expanded")
		})

		it("should provide meaningful tooltips for file actions", async () => {
			await setupComponentWithFiles()

			// Expand to show individual file actions
			const header = screen.getByTestId("files-changed-header").closest('[role="button"]')
			fireEvent.click(header!)

			await waitFor(() => {
				expect(screen.getByTestId("file-item-src/components/test1.ts")).toBeInTheDocument()
			})

			// File action buttons should have descriptive tooltips
			const viewDiffButton = screen.getByTestId("diff-src/components/test1.ts")
			const acceptButton = screen.getByTestId("accept-src/components/test1.ts")

			expect(viewDiffButton).toHaveAttribute("title", "View Diff")
			expect(acceptButton).toHaveAttribute("title", "Accept")
		})
	})

	// ===== ERROR HANDLING =====
	describe("Error Handling", () => {
		it("should handle malformed filesChanged messages gracefully", () => {
			renderComponent()

			// Send malformed message
			simulateMessage({
				type: "filesChanged",
				// Missing filesChanged property
			})

			// Should not crash or render component
			expect(screen.queryByTestId("files-changed-overview")).not.toBeInTheDocument()
		})

		it("should handle malformed checkpoint messages gracefully", () => {
			renderComponent()

			// Send checkpoint message without required fields
			simulateMessage({
				type: "checkpoint_created",
				// Missing checkpoint property
			})

			// Should not crash - component is resilient
			expect(screen.queryByTestId("files-changed-overview")).not.toBeInTheDocument()
		})

		it("should handle undefined/null message data gracefully", () => {
			renderComponent()

			// Send message with null data (simulates real-world edge case)
			const nullEvent = new MessageEvent("message", {
				data: null,
			})

			// Should handle null data gracefully without throwing
			expect(() => window.dispatchEvent(nullEvent)).not.toThrow()

			// Should not render component with null data
			expect(screen.queryByTestId("files-changed-overview")).not.toBeInTheDocument()

			// Test other malformed message types
			const undefinedEvent = new MessageEvent("message", {
				data: undefined,
			})
			const stringEvent = new MessageEvent("message", {
				data: "invalid",
			})
			const objectWithoutTypeEvent = new MessageEvent("message", {
				data: { someField: "value" },
			})

			// All should be handled gracefully
			expect(() => {
				window.dispatchEvent(undefinedEvent)
				window.dispatchEvent(stringEvent)
				window.dispatchEvent(objectWithoutTypeEvent)
			}).not.toThrow()

			// Still should not render component
			expect(screen.queryByTestId("files-changed-overview")).not.toBeInTheDocument()
		})

		it("should handle vscode API errors gracefully", async () => {
			// Mock postMessage to throw error
			vi.mocked(vscode.postMessage).mockImplementation(() => {
				throw new Error("VSCode API error")
			})

			await setupComponentWithFiles()

			// Expand to show individual files
			const header = screen.getByTestId("files-changed-header").closest('[role="button"]')
			fireEvent.click(header!)

			await waitFor(() => {
				expect(screen.getByTestId("file-item-src/components/test1.ts")).toBeInTheDocument()
			})

			// Clicking buttons should not crash the component
			const acceptButton = screen.getByTestId("accept-src/components/test1.ts")
			expect(() => fireEvent.click(acceptButton)).not.toThrow()

			// Restore mock
			vi.mocked(vscode.postMessage).mockRestore()
		})
	})

	// ===== PERFORMANCE & EDGE CASES =====
	describe("Performance and Edge Cases", () => {
		it("should handle large file sets efficiently", async () => {
			// Create large changeset (50 files)
			const largeFiles = Array.from({ length: 50 }, (_, i) => ({
				uri: `src/file${i}.ts`,
				type: "edit" as FileChangeType,
				fromCheckpoint: "hash1",
				toCheckpoint: "hash2",
				linesAdded: 10,
				linesRemoved: 5,
			}))

			const largeChangeset = {
				baseCheckpoint: "hash1",
				files: largeFiles,
			}

			renderComponent()

			// Should render efficiently with large dataset
			const startTime = performance.now()
			simulateMessage({
				type: "filesChanged",
				filesChanged: largeChangeset,
			})

			await waitFor(() => {
				expect(screen.getByTestId("files-changed-overview")).toBeInTheDocument()
			})

			const renderTime = performance.now() - startTime
			// Rendering should be fast (under 500ms for 50 files)
			expect(renderTime).toBeLessThan(500)

			// Header should show correct count
			expect(screen.getByTestId("files-changed-header")).toHaveTextContent("50 files changed")
		})

		it("should handle rapid message updates", async () => {
			renderComponent()

			// Send multiple rapid updates
			for (let i = 0; i < 5; i++) {
				simulateMessage({
					type: "filesChanged",
					filesChanged: {
						baseCheckpoint: `hash${i}`,
						files: [
							{
								uri: `src/rapid${i}.ts`,
								type: "edit" as FileChangeType,
								fromCheckpoint: `hash${i}`,
								toCheckpoint: `hash${i + 1}`,
								linesAdded: i + 1,
								linesRemoved: 0,
							},
						],
					},
				})
			}

			// Should show latest update (1 file from last message)
			await waitFor(() => {
				expect(screen.getByTestId("files-changed-overview")).toBeInTheDocument()
				expect(screen.getByTestId("files-changed-header")).toHaveTextContent("1 files changed")
			})
		})

		it("should handle empty file changesets", async () => {
			renderComponent()

			// Send empty changeset
			simulateMessage({
				type: "filesChanged",
				filesChanged: {
					baseCheckpoint: "hash1",
					files: [],
				},
			})

			// Should not render component with empty files
			expect(screen.queryByTestId("files-changed-overview")).not.toBeInTheDocument()
		})
	})

	// ===== INTERNATIONALIZATION =====
	describe("Internationalization", () => {
		it("should use proper translation keys for all UI elements", async () => {
			await setupComponentWithFiles()

			// Header should use translated text with file count and line changes
			expect(screen.getByTestId("files-changed-header")).toHaveTextContent("2 files changed")
			expect(screen.getByTestId("files-changed-header")).toHaveTextContent("(+35, -5)")

			// Action buttons should use translations
			expect(screen.getByTestId("accept-all-button")).toHaveAttribute("title", "Accept All")
			expect(screen.getByTestId("reject-all-button")).toHaveAttribute("title", "Reject All")
		})

		it("should format file type labels correctly", async () => {
			await setupComponentWithFiles()

			// Expand to show individual files
			const header = screen.getByTestId("files-changed-header").closest('[role="button"]')
			fireEvent.click(header!)

			await waitFor(() => {
				expect(screen.getByTestId("file-item-src/components/test1.ts")).toBeInTheDocument()
			})

			// File type labels should be translated
			// Check for file type labels within the file items (main test data has different files)
			const editedFile = screen.getByTestId("file-item-src/components/test1.ts")
			const createdFile = screen.getByTestId("file-item-src/components/test2.ts")

			expect(editedFile).toHaveTextContent("Modified")
			expect(createdFile).toHaveTextContent("Created")
		})

		it("should handle line count formatting for different locales", async () => {
			await setupComponentWithFiles()

			// Header should format line changes correctly
			const header = screen.getByTestId("files-changed-header")
			expect(header).toHaveTextContent("+35, -5") // Standard format
		})
	})
})
