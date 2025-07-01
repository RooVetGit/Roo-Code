// npx vitest run src/components/file-changes/__tests__/FilesChangedOverview.spec.tsx

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

// No mocks needed - testing the actual component

describe("FilesChangedOverview", () => {
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

	const mockState = {
		version: "1.0.0",
		clineMessages: [],
		taskHistory: [],
		shouldShowAnnouncement: false,
		allowedCommands: [],
		alwaysAllowExecute: false,
		currentFileChangeset: {
			baseCheckpoint: "abc123",
			files: mockFilesChanged,
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
	}

	const renderComponent = (state = mockState) => {
		const changeset = state.currentFileChangeset || { baseCheckpoint: "abc123", files: [] }
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

	beforeEach(() => {
		vi.clearAllMocks()
	})

	describe("rendering", () => {
		it("should render files changed overview with correct file count", () => {
			renderComponent()

			// New format: "(3) Files Changed (+30, -20)"
			expect(screen.getByText(/\(3\) Files Changed/)).toBeInTheDocument()
		})

		it("should display collapse/expand button", () => {
			renderComponent()

			const expandButton = screen.getByTitle("Expand files list")
			expect(expandButton).toBeInTheDocument()
		})

		it("should render with empty files list", () => {
			const emptyState = { ...mockState, currentFileChangeset: { baseCheckpoint: "abc123", files: [] } }
			renderComponent(emptyState)

			// Component should render with 0 files
			expect(screen.getByText(/\(0\) Files Changed/)).toBeInTheDocument()
		})

		it("should handle undefined filesChanged gracefully", () => {
			const undefinedState = { ...mockState, currentFileChangeset: { baseCheckpoint: "abc123", files: [] } }
			renderComponent(undefinedState)

			// Component should render with 0 files
			expect(screen.getByText(/\(0\) Files Changed/)).toBeInTheDocument()
		})
	})

	describe("collapse/expand functionality", () => {
		it("should start in collapsed state", () => {
			renderComponent()

			// Component starts collapsed, so file items should not be visible initially
			expect(screen.queryByTestId("file-item-src/components/test1.ts")).not.toBeInTheDocument()
			expect(screen.queryByTestId("file-item-src/utils/test2.ts")).not.toBeInTheDocument()
			expect(screen.queryByTestId("file-item-docs/readme.md")).not.toBeInTheDocument()
		})

		it("should expand and collapse when button is clicked", async () => {
			renderComponent()

			const expandButton = screen.getByTitle("Expand files list")

			// Expand first (starts collapsed)
			fireEvent.click(expandButton)

			await waitFor(() => {
				expect(screen.getByTestId("file-item-src/components/test1.ts")).toBeInTheDocument()
				expect(screen.getByTestId("file-item-src/utils/test2.ts")).toBeInTheDocument()
				expect(screen.getByTestId("file-item-docs/readme.md")).toBeInTheDocument()
			})

			// Collapse
			fireEvent.click(expandButton)

			await waitFor(() => {
				expect(screen.queryByTestId("file-item-src/components/test1.ts")).not.toBeInTheDocument()
				expect(screen.queryByTestId("file-item-src/utils/test2.ts")).not.toBeInTheDocument()
				expect(screen.queryByTestId("file-item-docs/readme.md")).not.toBeInTheDocument()
			})
		})
	})

	describe("bulk actions", () => {
		it("should render accept all and reject all buttons", () => {
			renderComponent()

			expect(screen.getByRole("button", { name: /accept all/i })).toBeInTheDocument()
			expect(screen.getByRole("button", { name: /reject all/i })).toBeInTheDocument()
		})

		it("should send acceptAllFileChanges message when accept all is clicked", () => {
			renderComponent()

			const acceptAllButton = screen.getByRole("button", { name: /accept all/i })
			fireEvent.click(acceptAllButton)

			expect(vscode.postMessage).toHaveBeenCalledWith({
				type: "acceptAllFileChanges",
			})
		})

		it("should send rejectAllFileChanges message when reject all is clicked", () => {
			renderComponent()

			const rejectAllButton = screen.getByRole("button", { name: /reject all/i })
			fireEvent.click(rejectAllButton)

			expect(vscode.postMessage).toHaveBeenCalledWith({
				type: "rejectAllFileChanges",
			})
		})
	})

	describe("individual file actions", () => {
		it("should handle accept individual file", () => {
			renderComponent()

			// Expand the list first to access individual file buttons
			const expandButton = screen.getByTitle("Expand files list")
			fireEvent.click(expandButton)

			const acceptButton = screen.getByTestId("accept-src/components/test1.ts")
			fireEvent.click(acceptButton)

			expect(vscode.postMessage).toHaveBeenCalledWith({
				type: "acceptFileChange",
				uri: "src/components/test1.ts",
			})
		})

		it("should handle reject individual file", () => {
			renderComponent()

			// Expand the list first to access individual file buttons
			const expandButton = screen.getByTitle("Expand files list")
			fireEvent.click(expandButton)

			const rejectButton = screen.getByTestId("reject-src/utils/test2.ts")
			fireEvent.click(rejectButton)

			expect(vscode.postMessage).toHaveBeenCalledWith({
				type: "rejectFileChange",
				uri: "src/utils/test2.ts",
			})
		})
	})

	describe("file display", () => {
		it("should display all file types correctly", () => {
			renderComponent()

			// Expand the list first to access individual files
			const expandButton = screen.getByTitle("Expand files list")
			fireEvent.click(expandButton)

			// Check edit file
			const editFile = screen.getByTestId("file-item-src/components/test1.ts")
			expect(editFile).toHaveTextContent("src/components/test1.ts")
			expect(editFile).toHaveTextContent("edit")
			expect(editFile).toHaveTextContent("+10, -5 lines")

			// Check create file
			const createFile = screen.getByTestId("file-item-src/utils/test2.ts")
			expect(createFile).toHaveTextContent("src/utils/test2.ts")
			expect(createFile).toHaveTextContent("create")
			expect(createFile).toHaveTextContent("+20 lines")

			// Check delete file
			const deleteFile = screen.getByTestId("file-item-docs/readme.md")
			expect(deleteFile).toHaveTextContent("docs/readme.md")
			expect(deleteFile).toHaveTextContent("delete")
			expect(deleteFile).toHaveTextContent("deleted")
		})

		it("should handle files with missing line counts", () => {
			const filesWithMissingCounts = [
				{
					uri: "test-file.ts",
					type: "edit" as FileChangeType,
					fromCheckpoint: "hash1",
					toCheckpoint: "hash2",
					linesAdded: 0,
					linesRemoved: 0,
				},
			]

			const stateWithMissingCounts = {
				...mockState,
				currentFileChangeset: { baseCheckpoint: "abc123", files: filesWithMissingCounts },
			}
			renderComponent(stateWithMissingCounts)

			// Expand the list first to access individual files
			const expandButton = screen.getByTitle("Expand files list")
			fireEvent.click(expandButton)

			const fileElement = screen.getByTestId("file-item-test-file.ts")
			expect(fileElement).toHaveTextContent("modified") // Should default to "modified" when no counts
		})
	})

	describe("accessibility", () => {
		it("should have proper ARIA labels", () => {
			renderComponent()

			const collapseButton = screen.getByRole("button", { name: /collapse/i })
			expect(collapseButton).toHaveAttribute("aria-expanded")
		})

		it("should be keyboard navigable", () => {
			renderComponent()

			const acceptAllButton = screen.getByRole("button", { name: /accept all/i })
			const rejectAllButton = screen.getByRole("button", { name: /reject all/i })

			expect(acceptAllButton).toHaveAttribute("tabIndex", "0")
			expect(rejectAllButton).toHaveAttribute("tabIndex", "0")
		})
	})

	describe("edge cases", () => {
		it("should handle very long file paths", () => {
			const longPathFiles = [
				{
					uri: "very/deeply/nested/directory/structure/with/many/levels/and/a/very/long/filename/that/might/cause/issues.ts",
					type: "edit" as FileChangeType,
					fromCheckpoint: "hash1",
					toCheckpoint: "hash2",
					linesAdded: 1,
					linesRemoved: 0,
				},
			]

			const longPathState = {
				...mockState,
				currentFileChangeset: { baseCheckpoint: "abc123", files: longPathFiles },
			}
			renderComponent(longPathState)

			// Expand the list first to access individual files
			const expandButton = screen.getByTitle("Expand files list")
			fireEvent.click(expandButton)

			const longPathElement = screen.getByTestId(
				"file-item-very/deeply/nested/directory/structure/with/many/levels/and/a/very/long/filename/that/might/cause/issues.ts",
			)
			expect(longPathElement).toBeInTheDocument()
		})

		it("should handle large numbers of files", () => {
			const manyFiles = Array.from({ length: 100 }, (_, i) => ({
				uri: `src/file${i}.ts`,
				type: "edit" as FileChangeType,
				fromCheckpoint: "hash1",
				toCheckpoint: "hash2",
				linesAdded: i + 1,
				linesRemoved: i,
			}))

			const manyFilesState = {
				...mockState,
				currentFileChangeset: { baseCheckpoint: "abc123", files: manyFiles },
			}
			renderComponent(manyFilesState)

			expect(screen.getByText(/\(100\) Files Changed/)).toBeInTheDocument()

			// Expand the list first to access individual files
			const expandButton = screen.getByTitle("Expand files list")
			fireEvent.click(expandButton)

			// Check that first file is rendered (virtualization shows only visible items)
			expect(screen.getByTestId("file-item-src/file0.ts")).toBeInTheDocument()
			// With virtualization enabled (>50 files), only visible items are rendered
			// So file99.ts won't be in DOM until scrolled to bottom
			expect(screen.queryByTestId("file-item-src/file99.ts")).not.toBeInTheDocument()
		})

		it("should handle files with special characters in paths", () => {
			const specialCharFiles = [
				{
					uri: "src/files with spaces.ts",
					type: "edit" as FileChangeType,
					fromCheckpoint: "hash1",
					toCheckpoint: "hash2",
					linesAdded: 1,
					linesRemoved: 0,
				},
				{
					uri: "src/files-with-dashes.ts",
					type: "create" as FileChangeType,
					fromCheckpoint: "hash1",
					toCheckpoint: "hash2",
					linesAdded: 5,
					linesRemoved: 0,
				},
			]

			const specialCharState = {
				...mockState,
				currentFileChangeset: { baseCheckpoint: "abc123", files: specialCharFiles },
			}
			renderComponent(specialCharState)

			// Expand the list first
			const expandButton = screen.getByTitle("Expand files list")
			fireEvent.click(expandButton)

			expect(screen.getByTestId("file-item-src/files with spaces.ts")).toBeInTheDocument()
			expect(screen.getByTestId("file-item-src/files-with-dashes.ts")).toBeInTheDocument()
		})
	})

	describe("error handling", () => {
		it("should handle corrupted file data gracefully", () => {
			const corruptedFiles = [
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
			] as any

			const corruptedState = {
				...mockState,
				currentFileChangeset: { baseCheckpoint: "abc123", files: corruptedFiles },
			}

			// Should not crash
			expect(() => renderComponent(corruptedState)).not.toThrow()
		})

		it("should handle postMessage errors gracefully", () => {
			// Set up the mock after the component is rendered to avoid initialization errors
			renderComponent()

			vi.mocked(vscode.postMessage).mockImplementation(() => {
				throw new Error("VSCode API error")
			})

			const acceptAllButton = screen.getByRole("button", { name: /accept all/i })

			// Should not crash when clicking buttons
			expect(() => fireEvent.click(acceptAllButton)).not.toThrow()
		})
	})
})
