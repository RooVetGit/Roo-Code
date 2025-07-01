// Performance tests for FilesChangedOverview virtualization with large file sets

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

describe("FilesChangedOverview Virtualization Performance", () => {
	const createMockState = (fileCount: number) => ({
		version: "1.0.0",
		clineMessages: [],
		taskHistory: [],
		shouldShowAnnouncement: false,
		allowedCommands: [],
		alwaysAllowExecute: false,
		currentFileChangeset: {
			baseCheckpoint: "abc123",
			files: Array.from({ length: fileCount }, (_, i) => ({
				uri: `src/components/file${i}.ts`,
				type: "edit" as FileChangeType,
				fromCheckpoint: "hash1",
				toCheckpoint: "hash2",
				linesAdded: Math.floor(Math.random() * 50) + 1,
				linesRemoved: Math.floor(Math.random() * 20),
			})),
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

	const renderComponent = (fileCount: number) => {
		const mockState = createMockState(fileCount)
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

	describe("Virtualization Threshold Testing", () => {
		it("should NOT use virtualization for 49 files (below threshold)", () => {
			const { container } = renderComponent(49)

			// Expand the list to see items
			const expandButton = screen.getByTitle("Expand files list")
			fireEvent.click(expandButton)

			// With 49 files, virtualization should not be used
			// All files should be directly rendered in DOM
			expect(screen.getByTestId("file-item-src/components/file0.ts")).toBeInTheDocument()
			expect(screen.getByTestId("file-item-src/components/file48.ts")).toBeInTheDocument()

			// Check that we don't have virtualization wrapper (look for transform translateY)
			const virtualizationTransform = container.querySelector('[style*="transform: translateY"]')
			expect(virtualizationTransform).not.toBeInTheDocument()
		})

		it("should NOT use virtualization for exactly 50 files (at threshold)", () => {
			const { container } = renderComponent(50)

			// Expand the list to see items
			const expandButton = screen.getByTitle("Expand files list")
			fireEvent.click(expandButton)

			// With 50 files, virtualization should not be used (threshold is >50)
			expect(screen.getByTestId("file-item-src/components/file0.ts")).toBeInTheDocument()
			expect(screen.getByTestId("file-item-src/components/file49.ts")).toBeInTheDocument()

			// Check that we don't have virtualization wrapper (look for transform translateY)
			const virtualizationTransform = container.querySelector('[style*="transform: translateY"]')
			expect(virtualizationTransform).not.toBeInTheDocument()
		})

		it("should use virtualization for 51 files (above threshold)", () => {
			const { container } = renderComponent(51)

			// Expand the list to see items
			const expandButton = screen.getByTitle("Expand files list")
			fireEvent.click(expandButton)

			// With 51 files, virtualization should be used
			// Only visible items should be in DOM
			expect(screen.getByTestId("file-item-src/components/file0.ts")).toBeInTheDocument()

			// Last file should NOT be in DOM due to virtualization
			expect(screen.queryByTestId("file-item-src/components/file50.ts")).not.toBeInTheDocument()

			// Check that we have virtualization wrapper with transform
			const virtualizationTransform = container.querySelector('[style*="transform: translateY"]')
			expect(virtualizationTransform).toBeInTheDocument()
		})

		it("should use virtualization for 100 files (well above threshold)", () => {
			const { container } = renderComponent(100)

			// Expand the list to see items
			const expandButton = screen.getByTitle("Expand files list")
			fireEvent.click(expandButton)

			// With 100 files, virtualization should definitely be used
			// Only visible items should be in DOM (approximately 10 items)
			expect(screen.getByTestId("file-item-src/components/file0.ts")).toBeInTheDocument()

			// Files beyond visible range should NOT be in DOM
			expect(screen.queryByTestId("file-item-src/components/file99.ts")).not.toBeInTheDocument()
			expect(screen.queryByTestId("file-item-src/components/file50.ts")).not.toBeInTheDocument()

			// Check that we have virtualization wrapper
			const virtualizationTransform = container.querySelector('[style*="transform: translateY"]')
			expect(virtualizationTransform).toBeInTheDocument()
		})
	})

	describe("Performance Characteristics", () => {
		it("should render large file sets efficiently", () => {
			const startTime = performance.now()

			renderComponent(200)

			// Expand the list
			const expandButton = screen.getByTitle("Expand files list")
			fireEvent.click(expandButton)

			const endTime = performance.now()
			const renderTime = endTime - startTime

			// Should render in less than 1 second even with 200 files
			expect(renderTime).toBeLessThan(1000)

			// Should show correct file count in header
			expect(screen.getByText(/\(200\) Files Changed/)).toBeInTheDocument()
		})

		it("should handle memory efficiently with virtualization", () => {
			renderComponent(500)

			// Expand the list
			const expandButton = screen.getByTitle("Expand files list")
			fireEvent.click(expandButton)

			// Only visible items should be rendered (~10 items max)
			const fileItems = screen.getAllByTestId(/^file-item-/)
			expect(fileItems.length).toBeLessThanOrEqual(15) // Some buffer for visibility

			// But header should show all 500 files
			expect(screen.getByText(/\(500\) Files Changed/)).toBeInTheDocument()
		})

		it("should maintain responsiveness during scrolling simulation", async () => {
			const { container } = renderComponent(100)

			// Expand the list
			const expandButton = screen.getByTitle("Expand files list")
			fireEvent.click(expandButton)

			// Find the scrollable container
			const scrollContainer = container.querySelector('[style*="overflow-y"]')
			expect(scrollContainer).toBeInTheDocument()

			// Simulate scroll events
			for (let scrollTop = 0; scrollTop <= 1000; scrollTop += 100) {
				fireEvent.scroll(scrollContainer!, { target: { scrollTop } })

				// Should still have file items rendered
				const fileItems = screen.getAllByTestId(/^file-item-/)
				expect(fileItems.length).toBeGreaterThan(0)
				expect(fileItems.length).toBeLessThanOrEqual(15)
			}
		})
	})

	describe("Edge Cases with Large Sets", () => {
		it("should handle extremely large file sets (1000+ files)", () => {
			const { container } = renderComponent(1000)

			// Should render without crashing
			expect(screen.getByText(/\(1000\) Files Changed/)).toBeInTheDocument()

			// Expand should work
			const expandButton = screen.getByTitle("Expand files list")
			fireEvent.click(expandButton)

			// Should have virtualization
			const virtualizationWrapper = container.querySelector('[style*="height:"]')
			expect(virtualizationWrapper).toBeInTheDocument()

			// Should only render visible items
			const fileItems = screen.getAllByTestId(/^file-item-/)
			expect(fileItems.length).toBeLessThanOrEqual(15)
		})

		it("should calculate total changes correctly for large sets", () => {
			renderComponent(100)

			// Should calculate and display total changes for all 100 files
			// Each file has random 1-50 lines added and 0-19 lines removed
			const headerText = screen.getByText(/\(100\) Files Changed \(\+\d+, -\d+\)/)
			expect(headerText).toBeInTheDocument()
		})

		it("should handle mixed file types efficiently in large sets", () => {
			const mockState = {
				version: "1.0.0",
				clineMessages: [],
				taskHistory: [],
				shouldShowAnnouncement: false,
				allowedCommands: [],
				alwaysAllowExecute: false,
				currentFileChangeset: {
					baseCheckpoint: "abc123",
					files: Array.from({ length: 75 }, (_, i) => ({
						uri: `src/file${i}.ts`,
						type: (i % 3 === 0 ? "create" : i % 3 === 1 ? "edit" : "delete") as FileChangeType,
						fromCheckpoint: "hash1",
						toCheckpoint: "hash2",
						linesAdded: i % 3 === 2 ? 0 : Math.floor(Math.random() * 30) + 1,
						linesRemoved: i % 3 === 0 ? 0 : Math.floor(Math.random() * 15),
					})),
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

			const changeset = mockState.currentFileChangeset!

			render(
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

			// Should handle mixed file types
			expect(screen.getByText(/\(75\) Files Changed/)).toBeInTheDocument()

			// Expand to see virtualization in action
			const expandButton = screen.getByTitle("Expand files list")
			fireEvent.click(expandButton)

			// Should show virtualized items
			const fileItems = screen.getAllByTestId(/^file-item-/)
			expect(fileItems.length).toBeLessThanOrEqual(15)
		})
	})
})
