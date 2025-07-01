// Simplified internationalization integration test for FilesChangedOverview

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

describe("FilesChangedOverview Internationalization Integration", () => {
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

	const renderComponent = () => {
		const changeset = { baseCheckpoint: "abc123", files: mockFilesChanged }

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

	describe("Translation Integration", () => {
		it("should use useTranslation hook correctly", () => {
			renderComponent()

			// Component should render without errors
			expect(screen.getByRole("button", { name: /Files list/ })).toBeInTheDocument()
		})

		it("should display translated text (not translation keys)", () => {
			renderComponent()

			// All text should be translated, not showing translation keys
			const component = screen.getByRole("button", { name: /Files list/ })
			const componentText = component.textContent || ""

			// Should not contain translation keys
			expect(componentText).not.toContain("file-changes:")
			expect(componentText).not.toContain("{{")
			expect(componentText).not.toContain("}}")

			// Should contain expected English text (from our mock)
			expect(componentText).toContain("Files Changed")
		})

		it("should properly interpolate variables in translations", () => {
			renderComponent()

			// Check that file count is properly interpolated
			expect(screen.getByText(/\(3\) Files Changed/)).toBeInTheDocument()

			// Check that change counts are interpolated
			expect(screen.getByText(/\+30, -20/)).toBeInTheDocument()
		})

		it("should translate all interactive elements", () => {
			renderComponent()

			// All buttons should have translated text
			expect(screen.getByText("Accept All")).toBeInTheDocument()
			expect(screen.getByText("Reject All")).toBeInTheDocument()

			// Tooltips should be translated
			expect(screen.getByTitle("Expand files list")).toBeInTheDocument()
		})

		it("should translate file-level elements when expanded", () => {
			renderComponent()

			// Expand to see file details
			const expandButton = screen.getByTitle("Expand files list")
			fireEvent.click(expandButton)

			// File type labels should be translated (they appear within other text)
			expect(screen.getByTestId("file-item-src/components/test1.ts")).toHaveTextContent("edit")
			expect(screen.getByTestId("file-item-src/utils/test2.ts")).toHaveTextContent("create")
			expect(screen.getByTestId("file-item-docs/readme.md")).toHaveTextContent("delete")

			// Action button tooltips should be translated (there are multiple, so check one specific)
			expect(screen.getByTestId("diff-src/components/test1.ts")).toHaveAttribute("title", "View Diff")
			expect(screen.getByTestId("accept-src/components/test1.ts")).toHaveAttribute(
				"title",
				"Accept changes for this file",
			)
			expect(screen.getByTestId("reject-src/components/test1.ts")).toHaveAttribute(
				"title",
				"Reject changes for this file",
			)
		})

		it("should translate line change descriptions", () => {
			renderComponent()

			// Expand to see file details
			const expandButton = screen.getByTitle("Expand files list")
			fireEvent.click(expandButton)

			// Check line change translations (they appear within other text)
			expect(screen.getByTestId("file-item-src/components/test1.ts")).toHaveTextContent("+10, -5 lines") // edit file
			expect(screen.getByTestId("file-item-src/utils/test2.ts")).toHaveTextContent("+20 lines") // create file
			expect(screen.getByTestId("file-item-docs/readme.md")).toHaveTextContent("deleted") // delete file
		})
	})

	describe("Translation Keys Coverage", () => {
		it("should use all expected translation namespaces", () => {
			renderComponent()

			// The component should use translations from the file-changes namespace
			// This test verifies that our mock is being called with the right keys

			// Check header translations are called
			expect(screen.getByText(/Files Changed/)).toBeInTheDocument()

			// Check action translations are called
			expect(screen.getByText("Accept All")).toBeInTheDocument()
			expect(screen.getByText("Reject All")).toBeInTheDocument()
		})

		it("should handle empty file sets correctly", () => {
			const emptyState = {
				...mockState,
				currentFileChangeset: {
					baseCheckpoint: "abc123",
					files: [],
				},
			}

			render(
				<ExtensionStateContext.Provider value={emptyState as any}>
					<FilesChangedOverview
						changeset={{ baseCheckpoint: "abc123", files: [] }}
						onViewDiff={(uri) => vscode.postMessage({ type: "viewDiff", uri })}
						onAcceptFile={(uri) => vscode.postMessage({ type: "acceptFileChange", uri })}
						onRejectFile={(uri) => vscode.postMessage({ type: "rejectFileChange", uri })}
						onAcceptAll={() => vscode.postMessage({ type: "acceptAllFileChanges" })}
						onRejectAll={() => vscode.postMessage({ type: "rejectAllFileChanges" })}
					/>
				</ExtensionStateContext.Provider>,
			)

			// Should handle zero count translation
			expect(screen.getByText(/\(0\) Files Changed/)).toBeInTheDocument()
		})

		it("should translate accessibility labels", () => {
			renderComponent()

			// Check ARIA labels are translated
			const expandButton = screen.getByRole("button", { name: /Files list/ })
			expect(expandButton).toHaveAttribute("aria-label")

			const ariaLabel = expandButton.getAttribute("aria-label")
			expect(ariaLabel).not.toContain("file-changes:")
			expect(ariaLabel).toContain("files")
		})
	})

	describe("Performance with Translations", () => {
		it("should not impact performance when rendering with translations", () => {
			const startTime = performance.now()
			renderComponent()
			const renderTime = performance.now() - startTime

			// Translation should not significantly impact render time
			expect(renderTime).toBeLessThan(100) // 100ms threshold

			// Component should render correctly
			expect(screen.getByText(/Files Changed/)).toBeInTheDocument()
		})

		it("should handle frequent re-renders with translations efficiently", () => {
			const { rerender } = renderComponent()

			// Simulate multiple re-renders (like when files change)
			const startTime = performance.now()

			for (let i = 0; i < 5; i++) {
				const updatedFiles = [
					...mockFilesChanged,
					{
						uri: `src/new-file-${i}.ts`,
						type: "create" as FileChangeType,
						fromCheckpoint: "hash1",
						toCheckpoint: `hash${i + 10}`,
						linesAdded: i * 5,
						linesRemoved: 0,
					},
				]

				const updatedState = {
					...mockState,
					currentFileChangeset: {
						baseCheckpoint: "abc123",
						files: updatedFiles,
					},
				}

				rerender(
					<ExtensionStateContext.Provider value={updatedState as any}>
						<FilesChangedOverview
							changeset={{ baseCheckpoint: "abc123", files: updatedFiles }}
							onViewDiff={(uri) => vscode.postMessage({ type: "viewDiff", uri })}
							onAcceptFile={(uri) => vscode.postMessage({ type: "acceptFileChange", uri })}
							onRejectFile={(uri) => vscode.postMessage({ type: "rejectFileChange", uri })}
							onAcceptAll={() => vscode.postMessage({ type: "acceptAllFileChanges" })}
							onRejectAll={() => vscode.postMessage({ type: "rejectAllFileChanges" })}
						/>
					</ExtensionStateContext.Provider>,
				)
			}

			const rerenderTime = performance.now() - startTime

			// Multiple re-renders should still be fast
			expect(rerenderTime).toBeLessThan(200) // 200ms for 5 re-renders

			// Final state should be correct (3 original + 1 added in last iteration = 4 total)
			// The rerender only updates with the last iteration's state
			expect(screen.getByText(/\(4\) Files Changed/)).toBeInTheDocument()
		})
	})

	describe("Edge Cases with Translations", () => {
		it("should handle special characters in file paths with translations", () => {
			const specialFiles = [
				{
					uri: "src/files with spaces.ts",
					type: "edit" as FileChangeType,
					fromCheckpoint: "hash1",
					toCheckpoint: "hash2",
					linesAdded: 1,
					linesRemoved: 0,
				},
				{
					uri: "src/files-with-unicode-éñ.ts",
					type: "create" as FileChangeType,
					fromCheckpoint: "hash1",
					toCheckpoint: "hash3",
					linesAdded: 5,
					linesRemoved: 0,
				},
			]

			const specialState = {
				...mockState,
				currentFileChangeset: {
					baseCheckpoint: "abc123",
					files: specialFiles,
				},
			}

			render(
				<ExtensionStateContext.Provider value={specialState as any}>
					<FilesChangedOverview
						changeset={{ baseCheckpoint: "abc123", files: specialFiles }}
						onViewDiff={(uri) => vscode.postMessage({ type: "viewDiff", uri })}
						onAcceptFile={(uri) => vscode.postMessage({ type: "acceptFileChange", uri })}
						onRejectFile={(uri) => vscode.postMessage({ type: "rejectFileChange", uri })}
						onAcceptAll={() => vscode.postMessage({ type: "acceptAllFileChanges" })}
						onRejectAll={() => vscode.postMessage({ type: "rejectAllFileChanges" })}
					/>
				</ExtensionStateContext.Provider>,
			)

			// Translation should work with special character files
			expect(screen.getByText(/\(2\) Files Changed/)).toBeInTheDocument()

			// Expand to check file details
			const expandButton = screen.getByTitle("Expand files list")
			fireEvent.click(expandButton)

			// Files with special characters should display correctly
			expect(screen.getByTestId("file-item-src/files with spaces.ts")).toBeInTheDocument()
			expect(screen.getByTestId("file-item-src/files-with-unicode-éñ.ts")).toBeInTheDocument()
		})

		it("should maintain translation consistency across state changes", () => {
			const { rerender } = renderComponent()

			// Verify initial translations
			expect(screen.getByText("Accept All")).toBeInTheDocument()
			expect(screen.getByText("Reject All")).toBeInTheDocument()

			// Change state and verify translations remain consistent
			const updatedState = {
				...mockState,
				currentFileChangeset: {
					baseCheckpoint: "abc123",
					files: [mockFilesChanged[0]], // Only one file now
				},
			}

			rerender(
				<ExtensionStateContext.Provider value={updatedState as any}>
					<FilesChangedOverview
						changeset={{ baseCheckpoint: "abc123", files: [mockFilesChanged[0]] }}
						onViewDiff={(uri) => vscode.postMessage({ type: "viewDiff", uri })}
						onAcceptFile={(uri) => vscode.postMessage({ type: "acceptFileChange", uri })}
						onRejectFile={(uri) => vscode.postMessage({ type: "rejectFileChange", uri })}
						onAcceptAll={() => vscode.postMessage({ type: "acceptAllFileChanges" })}
						onRejectAll={() => vscode.postMessage({ type: "rejectAllFileChanges" })}
					/>
				</ExtensionStateContext.Provider>,
			)

			// Translations should remain consistent
			expect(screen.getByText("Accept All")).toBeInTheDocument()
			expect(screen.getByText("Reject All")).toBeInTheDocument()
			expect(screen.getByText(/\(1\) Files Changed/)).toBeInTheDocument()
		})
	})
})
