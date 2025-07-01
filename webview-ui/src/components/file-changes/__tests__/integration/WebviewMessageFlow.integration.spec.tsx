// Integration tests for webview message flow in FilesChangedOverview
// npx vitest run src/components/file-changes/__tests__/integration/WebviewMessageFlow.integration.spec.tsx

import React from "react"
import { render, screen, fireEvent } from "@testing-library/react"
import { describe, beforeEach, afterEach, it, expect, vi } from "vitest"

import { ExtensionStateContext } from "@src/context/ExtensionStateContext"
import { vscode } from "@src/utils/vscode"
import { FileChangeType } from "@roo-code/types"
import FilesChangedOverview from "../../FilesChangedOverview"
import FilesChangedOverviewWrapper from "../../FilesChangedOverviewWrapper"

// Mock vscode API
vi.mock("@src/utils/vscode", () => ({
	vscode: {
		postMessage: vi.fn(),
	},
}))

// No need to mock FileDiffApproval - using the actual component now

interface ExtensionMessage {
	type: string
	[key: string]: any
}

// Simulate extension state context with message handling
class MockExtensionState {
	private currentFileChangeset: any = undefined
	private listeners: Array<(changeset: any) => void> = []
	private messageHandlers: Array<(message: ExtensionMessage) => void> = []

	constructor() {
		// Simulate receiving messages from extension
		this.messageHandlers.push((message) => {
			switch (message.type) {
				case "filesChanged":
					this.setCurrentFileChangeset(message.filesChanged)
					break
			}
		})
	}

	setCurrentFileChangeset(changeset: any) {
		this.currentFileChangeset = changeset
		this.listeners.forEach((listener) => listener(changeset))
	}

	getCurrentFileChangeset() {
		return this.currentFileChangeset
	}

	// Simulate receiving message from extension
	receiveFromExtension(message: ExtensionMessage) {
		this.messageHandlers.forEach((handler) => handler(message))
	}

	onChangesetUpdate(listener: (changeset: any) => void) {
		this.listeners.push(listener)
	}

	clear() {
		this.currentFileChangeset = undefined
		this.listeners = []
	}
}

describe("FilesChangedOverview Webview Message Flow Integration", () => {
	let mockExtensionState: MockExtensionState
	let mockState: any

	const mockFiles = [
		{
			uri: "src/components/test1.ts",
			type: "edit" as FileChangeType,
			fromCheckpoint: "hash1",
			toCheckpoint: "hash2",
			linesAdded: 10,
			linesRemoved: 5,
		},
		{
			uri: "src/utils/test2.ts",
			type: "create" as FileChangeType,
			fromCheckpoint: "hash1",
			toCheckpoint: "hash3",
			linesAdded: 20,
			linesRemoved: 0,
		},
		{
			uri: "docs/readme.md",
			type: "delete" as FileChangeType,
			fromCheckpoint: "hash1",
			toCheckpoint: "hash4",
			linesAdded: 0,
			linesRemoved: 15,
		},
	]

	beforeEach(() => {
		vi.clearAllMocks()

		mockExtensionState = new MockExtensionState()

		// Create mock state that tracks changeset updates
		mockState = {
			version: "1.0.0",
			clineMessages: [],
			taskHistory: [],
			shouldShowAnnouncement: false,
			allowedCommands: [],
			alwaysAllowExecute: false,
			currentFileChangeset: undefined,
			setCurrentFileChangeset: (changeset: any) => {
				mockState.currentFileChangeset = changeset
			},
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
		}

		// Set initial file changeset
		const initialChangeset = {
			baseCheckpoint: "abc123",
			files: mockFiles,
		}
		mockState.currentFileChangeset = initialChangeset
		mockExtensionState.setCurrentFileChangeset(initialChangeset)
	})

	afterEach(() => {
		mockExtensionState.clear()
	})

	const renderComponent = (state = mockState) => {
		const changeset = state.currentFileChangeset || { baseCheckpoint: "abc123", files: [] }

		// Don't render if no files
		if (!changeset.files || changeset.files.length === 0) {
			return render(<div data-testid="no-files">No files to display</div>)
		}

		return render(
			<ExtensionStateContext.Provider value={state as any}>
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

	describe("Initial Rendering and State", () => {
		it("should render file changes from extension state", () => {
			renderComponent()

			// Expand the list to access individual files
			const expandButton = screen.getByTitle("Expand files list")
			fireEvent.click(expandButton)

			// Should display all files
			expect(screen.getByTestId("file-item-src/components/test1.ts")).toBeInTheDocument()
			expect(screen.getByTestId("file-item-src/utils/test2.ts")).toBeInTheDocument()
			expect(screen.getByTestId("file-item-docs/readme.md")).toBeInTheDocument()

			// Check file information is displayed correctly
			const editFile = screen.getByTestId("file-item-src/components/test1.ts")
			expect(editFile).toHaveTextContent("edit")
			expect(editFile).toHaveTextContent("+10, -5 lines")

			const createFile = screen.getByTestId("file-item-src/utils/test2.ts")
			expect(createFile).toHaveTextContent("create")
			expect(createFile).toHaveTextContent("+20 lines")

			const deleteFile = screen.getByTestId("file-item-docs/readme.md")
			expect(deleteFile).toHaveTextContent("delete")
			expect(deleteFile).toHaveTextContent("deleted")
		})

		it("should not render when no files changed", () => {
			const emptyState = {
				...mockState,
				currentFileChangeset: { baseCheckpoint: "abc123", files: [] },
			}

			const { container } = render(
				<ExtensionStateContext.Provider value={emptyState as any}>
					<FilesChangedOverviewWrapper />
				</ExtensionStateContext.Provider>,
			)

			// Wrapper returns null for empty states, so container should be empty
			expect(container.firstChild).toBeNull()
		})
	})

	describe("User Actions and Message Sending", () => {
		it("should send acceptFileChange message when accept button is clicked", () => {
			renderComponent()

			// Expand the list to access individual file buttons
			const expandButton = screen.getByTitle("Expand files list")
			fireEvent.click(expandButton)

			const acceptButton = screen.getByTestId("accept-src/components/test1.ts")
			fireEvent.click(acceptButton)

			expect(vscode.postMessage).toHaveBeenCalledWith({
				type: "acceptFileChange",
				uri: "src/components/test1.ts",
			})
		})

		it("should send rejectFileChange message when reject button is clicked", () => {
			renderComponent()

			// Expand the list to access individual file buttons
			const expandButton = screen.getByTitle("Expand files list")
			fireEvent.click(expandButton)

			const rejectButton = screen.getByTestId("reject-src/utils/test2.ts")
			fireEvent.click(rejectButton)

			expect(vscode.postMessage).toHaveBeenCalledWith({
				type: "rejectFileChange",
				uri: "src/utils/test2.ts",
			})
		})

		it("should send acceptAllFileChanges message when accept all is clicked", () => {
			renderComponent()

			// Find and click accept all button
			const acceptAllButton = screen.getByRole("button", { name: /accept all/i })
			fireEvent.click(acceptAllButton)

			expect(vscode.postMessage).toHaveBeenCalledWith({
				type: "acceptAllFileChanges",
			})
		})

		it("should send rejectAllFileChanges message when reject all is clicked", () => {
			renderComponent()

			// Find and click reject all button
			const rejectAllButton = screen.getByRole("button", { name: /reject all/i })
			fireEvent.click(rejectAllButton)

			expect(vscode.postMessage).toHaveBeenCalledWith({
				type: "rejectAllFileChanges",
			})
		})
	})

	describe("Dynamic State Updates", () => {
		it("should render correctly with different file counts", async () => {
			// Test with 2 files
			const updatedFiles = mockFiles.filter((f) => f.uri !== "src/components/test1.ts")
			const updatedChangeset = {
				baseCheckpoint: "abc123",
				files: updatedFiles,
			}

			const updatedState = {
				...mockState,
				currentFileChangeset: updatedChangeset,
			}

			renderComponent(updatedState)

			// Expand the list to access individual files
			const expandButton = screen.getByTitle("Expand files list")
			fireEvent.click(expandButton)

			// Should have 2 files (not the filtered one)
			expect(screen.queryByTestId("file-item-src/components/test1.ts")).not.toBeInTheDocument()
			expect(screen.getByTestId("file-item-src/utils/test2.ts")).toBeInTheDocument()
			expect(screen.getByTestId("file-item-docs/readme.md")).toBeInTheDocument()
		})

		it("should handle empty changeset gracefully", async () => {
			// Test with empty changeset - render component directly since helper returns early for empty files
			const emptyChangeset = { baseCheckpoint: "abc123", files: [] }

			render(
				<ExtensionStateContext.Provider value={mockState as any}>
					<FilesChangedOverview
						changeset={emptyChangeset}
						onViewDiff={(uri) => vscode.postMessage({ type: "viewDiff", uri })}
						onAcceptFile={(uri) => vscode.postMessage({ type: "acceptFileChange", uri })}
						onRejectFile={(uri) => vscode.postMessage({ type: "rejectFileChange", uri })}
						onAcceptAll={() => vscode.postMessage({ type: "acceptAllFileChanges" })}
						onRejectAll={() => vscode.postMessage({ type: "rejectAllFileChanges" })}
					/>
				</ExtensionStateContext.Provider>,
			)

			// Should show empty state with 0 files
			expect(screen.getByText("(0) Files Changed")).toBeInTheDocument()
		})
	})

	describe("Real-time Message Flow Simulation", () => {
		it("should send correct messages for file operations", async () => {
			// Clear any previous mock calls
			vi.clearAllMocks()

			renderComponent()

			// Expand the list to access individual file buttons
			const expandButton = screen.getByTitle("Expand files list")
			fireEvent.click(expandButton)

			// User clicks accept on first file
			const acceptButton = screen.getByTestId("accept-src/components/test1.ts")
			fireEvent.click(acceptButton)

			// Verify first message was sent
			expect(vscode.postMessage).toHaveBeenNthCalledWith(1, {
				type: "acceptFileChange",
				uri: "src/components/test1.ts",
			})

			// Wait for debounce to clear before second click
			await new Promise((resolve) => setTimeout(resolve, 350))

			// User clicks reject on second file
			const rejectButton = screen.getByTestId("reject-src/utils/test2.ts")
			fireEvent.click(rejectButton)

			// Verify second message was sent
			expect(vscode.postMessage).toHaveBeenNthCalledWith(2, {
				type: "rejectFileChange",
				uri: "src/utils/test2.ts",
			})
		})

		it("should send correct messages for bulk operations", async () => {
			// Clear any previous mock calls
			vi.clearAllMocks()

			renderComponent()

			// Test accept all first
			const acceptAllButton = screen.getByRole("button", { name: /accept all/i })
			fireEvent.click(acceptAllButton)

			expect(vscode.postMessage).toHaveBeenNthCalledWith(1, {
				type: "acceptAllFileChanges",
			})

			// Wait for debounce to clear before second click
			await new Promise((resolve) => setTimeout(resolve, 350))

			// Test reject all second
			const rejectAllButton = screen.getByRole("button", { name: /reject all/i })
			fireEvent.click(rejectAllButton)

			expect(vscode.postMessage).toHaveBeenNthCalledWith(2, {
				type: "rejectAllFileChanges",
			})
		})
	})

	describe("Error Handling in UI", () => {
		it("should handle vscode.postMessage errors gracefully", () => {
			// Mock postMessage to throw error
			vi.mocked(vscode.postMessage).mockImplementation(() => {
				throw new Error("VSCode API error")
			})

			renderComponent()

			// Expand the list to access individual file buttons
			const expandButton = screen.getByTitle("Expand files list")
			fireEvent.click(expandButton)

			// Should not crash when clicking buttons
			const acceptButton = screen.getByTestId("accept-src/components/test1.ts")
			expect(() => fireEvent.click(acceptButton)).not.toThrow()

			const rejectButton = screen.getByTestId("reject-src/utils/test2.ts")
			expect(() => fireEvent.click(rejectButton)).not.toThrow()
		})

		it("should handle corrupted file data gracefully", () => {
			const corruptedState = {
				...mockState,
				currentFileChangeset: {
					baseCheckpoint: "abc123",
					files: [
						{
							uri: "valid-file.ts",
							type: "edit" as FileChangeType,
							fromCheckpoint: "hash1",
							toCheckpoint: "hash2",
							linesAdded: 5,
							linesRemoved: 2,
						},
						{
							// Missing required fields
							uri: "",
							type: undefined,
							fromCheckpoint: undefined,
							toCheckpoint: undefined,
						},
					] as any,
				},
			}

			// Should not crash when rendering corrupted data
			expect(() => renderComponent(corruptedState)).not.toThrow()
		})
	})

	describe("Performance with Large File Sets", () => {
		it("should handle large number of files efficiently", () => {
			// Create large file set
			const manyFiles = Array.from({ length: 100 }, (_, i) => ({
				uri: `src/file${i}.ts`,
				type: "edit" as FileChangeType,
				fromCheckpoint: "hash1",
				toCheckpoint: "hash2",
				linesAdded: i + 1,
				linesRemoved: i,
			}))

			const largeState = {
				...mockState,
				currentFileChangeset: {
					baseCheckpoint: "abc123",
					files: manyFiles,
				},
			}

			const startTime = Date.now()
			renderComponent(largeState)
			const endTime = Date.now()

			// Should render quickly even with many files
			expect(endTime - startTime).toBeLessThan(1000)

			// Expand the list to access individual files
			const expandButton = screen.getByTitle("Expand files list")
			fireEvent.click(expandButton)

			// Should render first few files (virtualization only shows visible items)
			expect(screen.getByTestId("file-item-src/file0.ts")).toBeInTheDocument()
			expect(screen.getByTestId("file-item-src/file1.ts")).toBeInTheDocument()
			// With virtualization enabled (>50 files), file99.ts won't be in DOM until scrolled
			expect(screen.queryByTestId("file-item-src/file99.ts")).not.toBeInTheDocument()
		})
	})

	describe("Accessibility and User Experience", () => {
		it("should provide proper button labels and roles", () => {
			renderComponent()

			// Expand the list to access individual file buttons
			const expandButton = screen.getByTitle("Expand files list")
			fireEvent.click(expandButton)

			// All accept buttons should have proper accessibility (using symbols ✓)
			const acceptButtons = screen.getAllByText("✓")
			acceptButtons.forEach((button) => {
				expect(button).toHaveAttribute("data-testid")
				expect(button.tagName).toBe("BUTTON")
				expect(button).toHaveAttribute("title")
			})

			// All reject buttons should have proper accessibility (using symbols ✗)
			const rejectButtons = screen.getAllByText("✗")
			rejectButtons.forEach((button) => {
				expect(button).toHaveAttribute("data-testid")
				expect(button.tagName).toBe("BUTTON")
				expect(button).toHaveAttribute("title")
			})
		})

		it("should handle keyboard navigation", () => {
			renderComponent()

			// Test header button keyboard interaction
			const expandButton = screen.getByTitle("Expand files list")

			// Should have proper tabindex for keyboard navigation
			expect(expandButton).toHaveAttribute("tabindex", "0")
			expect(expandButton).toHaveAttribute("role", "button")

			// Should respond to Enter key to expand
			fireEvent.keyDown(expandButton, { key: "Enter", code: "Enter" })

			// Should now be expanded
			expect(screen.getByTitle("Collapse files list")).toBeInTheDocument()
		})
	})

	describe("Message Type Validation", () => {
		it("should send correct message format for all actions", async () => {
			// Clear any previous mock calls
			vi.clearAllMocks()

			renderComponent()

			// Expand the list to access individual file buttons
			const expandButton = screen.getByTitle("Expand files list")
			fireEvent.click(expandButton)

			// Test individual file accept
			fireEvent.click(screen.getByTestId("accept-src/components/test1.ts"))
			expect(vscode.postMessage).toHaveBeenLastCalledWith({
				type: "acceptFileChange",
				uri: "src/components/test1.ts",
			})

			// Wait for debounce between clicks
			await new Promise((resolve) => setTimeout(resolve, 350))

			// Test individual file reject
			fireEvent.click(screen.getByTestId("reject-src/utils/test2.ts"))
			expect(vscode.postMessage).toHaveBeenLastCalledWith({
				type: "rejectFileChange",
				uri: "src/utils/test2.ts",
			})

			// Wait for debounce between clicks
			await new Promise((resolve) => setTimeout(resolve, 350))

			// Test bulk accept all
			fireEvent.click(screen.getByRole("button", { name: /accept all/i }))
			expect(vscode.postMessage).toHaveBeenLastCalledWith({
				type: "acceptAllFileChanges",
			})

			// Wait for debounce between clicks
			await new Promise((resolve) => setTimeout(resolve, 350))

			// Test bulk reject all
			fireEvent.click(screen.getByRole("button", { name: /reject all/i }))
			expect(vscode.postMessage).toHaveBeenLastCalledWith({
				type: "rejectAllFileChanges",
			})

			// Verify all messages have correct structure
			const calls = vi.mocked(vscode.postMessage).mock.calls
			expect(calls).toHaveLength(4)
			calls.forEach((call) => {
				const message = call[0]
				expect(message).toHaveProperty("type")
				expect(typeof message.type).toBe("string")
			})
		})
	})
})
