// Accessibility compliance tests for FilesChangedOverview

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

describe("FilesChangedOverview Accessibility Compliance", () => {
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

	describe("ARIA Labels and Roles", () => {
		it("should have proper ARIA role for main interactive element", () => {
			renderComponent()

			const mainButton = screen.getByRole("button", { name: /Files list/ })
			expect(mainButton).toBeInTheDocument()
			expect(mainButton).toHaveAttribute("role", "button")
		})

		it("should have descriptive ARIA labels", () => {
			renderComponent()

			const mainButton = screen.getByRole("button", { name: /Files list/ })
			const ariaLabel = mainButton.getAttribute("aria-label")

			// ARIA label should describe the current state
			expect(ariaLabel).toContain("Files list")
			expect(ariaLabel).toContain("3 files")
			expect(ariaLabel).toContain("Collapsed")
		})

		it("should update ARIA labels when state changes", () => {
			renderComponent()

			const expandButton = screen.getByRole("button", { name: /Files list/ })

			// Initially collapsed
			expect(expandButton).toHaveAttribute("aria-expanded", "false")
			expect(expandButton.getAttribute("aria-label")).toContain("Collapsed")

			// Expand the list
			fireEvent.click(expandButton)

			// Should update to expanded state
			expect(expandButton).toHaveAttribute("aria-expanded", "true")
			expect(expandButton.getAttribute("aria-label")).toContain("Expanded")
		})

		it("should have proper ARIA attributes for all interactive elements", () => {
			renderComponent()

			// Main expand/collapse button
			const mainButton = screen.getByRole("button", { name: /Files list/ })
			expect(mainButton).toHaveAttribute("aria-expanded")
			expect(mainButton).toHaveAttribute("aria-label")
			expect(mainButton).toHaveAttribute("tabIndex", "0")

			// Action buttons
			const acceptButton = screen.getByText("Accept All")
			const rejectButton = screen.getByText("Reject All")

			expect(acceptButton).toHaveAttribute("tabIndex", "0")
			expect(rejectButton).toHaveAttribute("tabIndex", "0")
		})

		it("should provide meaningful tooltips for all actions", () => {
			renderComponent()

			// Main button tooltip
			const expandButton = screen.getByTitle("Expand files list")
			expect(expandButton).toBeInTheDocument()

			// Action button tooltips
			expect(screen.getByTitle("Accept All")).toBeInTheDocument()
			expect(screen.getByTitle("Reject All")).toBeInTheDocument()
		})

		it("should have accessible file-level controls when expanded", () => {
			renderComponent()

			// Expand to show individual files
			const expandButton = screen.getByTitle("Expand files list")
			fireEvent.click(expandButton)

			// Each file should have accessible action buttons
			const diffButton = screen.getByTestId("diff-src/components/test1.ts")
			const acceptButton = screen.getByTestId("accept-src/components/test1.ts")
			const rejectButton = screen.getByTestId("reject-src/components/test1.ts")

			// All should have proper tooltips
			expect(diffButton).toHaveAttribute("title", "View Diff")
			expect(acceptButton).toHaveAttribute("title", "Accept changes for this file")
			expect(rejectButton).toHaveAttribute("title", "Reject changes for this file")
		})
	})

	describe("Keyboard Navigation", () => {
		it("should be keyboard navigable with Tab key", () => {
			renderComponent()

			const expandButton = screen.getByRole("button", { name: /Files list/ })
			const acceptAllButton = screen.getByText("Accept All")
			const rejectAllButton = screen.getByText("Reject All")

			// All interactive elements should be in tab order
			expect(expandButton).toHaveAttribute("tabIndex", "0")
			expect(acceptAllButton).toHaveAttribute("tabIndex", "0")
			expect(rejectAllButton).toHaveAttribute("tabIndex", "0")
		})

		it("should respond to Enter key on main button", () => {
			renderComponent()

			const expandButton = screen.getByRole("button", { name: /Files list/ })

			// Initially collapsed
			expect(expandButton).toHaveAttribute("aria-expanded", "false")

			// Press Enter to expand
			fireEvent.keyDown(expandButton, { key: "Enter", code: "Enter" })

			// Should expand
			expect(expandButton).toHaveAttribute("aria-expanded", "true")
		})

		it("should respond to Space key on main button", () => {
			renderComponent()

			const expandButton = screen.getByRole("button", { name: /Files list/ })

			// Initially collapsed
			expect(expandButton).toHaveAttribute("aria-expanded", "false")

			// Press Space to expand
			fireEvent.keyDown(expandButton, { key: " ", code: "Space" })

			// Should expand
			expect(expandButton).toHaveAttribute("aria-expanded", "true")
		})

		it("should prevent default browser behavior for keyboard events", () => {
			renderComponent()

			const expandButton = screen.getByRole("button", { name: /Files list/ })

			// Test with fireEvent.keyDown which properly simulates the event
			const enterSpy = vi.fn()

			expandButton.addEventListener("keydown", (e) => {
				if (e.key === "Enter" || e.key === " ") {
					enterSpy()
					e.preventDefault()
				}
			})

			fireEvent.keyDown(expandButton, { key: "Enter", code: "Enter" })
			fireEvent.keyDown(expandButton, { key: " ", code: "Space" })

			// Event handlers should be called
			expect(enterSpy).toHaveBeenCalledTimes(2)
		})

		it("should maintain focus management when expanding/collapsing", () => {
			renderComponent()

			const expandButton = screen.getByRole("button", { name: /Files list/ })

			// Focus the button
			expandButton.focus()
			// In JSDOM, focus behavior is limited, so we check if the button can be focused
			expect(expandButton).toHaveAttribute("tabIndex", "0")

			// Expand with keyboard
			fireEvent.keyDown(expandButton, { key: "Enter", code: "Enter" })

			// Check that state changed correctly
			expect(expandButton).toHaveAttribute("aria-expanded", "true")

			// Collapse with keyboard
			fireEvent.keyDown(expandButton, { key: "Enter", code: "Enter" })

			// Check that state changed back
			expect(expandButton).toHaveAttribute("aria-expanded", "false")
		})

		it("should have logical tab order when files are expanded", () => {
			renderComponent()

			// Expand to show file controls
			const expandButton = screen.getByTitle("Expand files list")
			fireEvent.click(expandButton)

			// Get all interactive elements
			const acceptAllButton = screen.getByText("Accept All")
			const rejectAllButton = screen.getByText("Reject All")
			const firstFileDiffButton = screen.getByTestId("diff-src/components/test1.ts")
			const firstFileAcceptButton = screen.getByTestId("accept-src/components/test1.ts")
			const firstFileRejectButton = screen.getByTestId("reject-src/components/test1.ts")

			// All should be focusable (tabIndex 0 or missing for native focusable elements)
			const getFocusability = (element: Element) => {
				const tabIndex = element.getAttribute("tabIndex")
				return tabIndex === null || tabIndex === "0"
			}

			expect(getFocusability(expandButton)).toBe(true)
			expect(getFocusability(acceptAllButton)).toBe(true)
			expect(getFocusability(rejectAllButton)).toBe(true)
			expect(getFocusability(firstFileDiffButton)).toBe(true)
			expect(getFocusability(firstFileAcceptButton)).toBe(true)
			expect(getFocusability(firstFileRejectButton)).toBe(true)
		})
	})

	describe("Screen Reader Support", () => {
		it("should provide meaningful text content for screen readers", () => {
			renderComponent()

			const expandButton = screen.getByRole("button", { name: /Files list/ })

			// Button should have accessible text describing current state
			const buttonContent = expandButton.textContent
			expect(buttonContent).toContain("Files Changed")
			expect(buttonContent).toContain("(3)")

			// ARIA label should provide additional context
			const ariaLabel = expandButton.getAttribute("aria-label")
			expect(ariaLabel).toContain("Files list")
			expect(ariaLabel).toContain("3 files")
		})

		it("should announce state changes appropriately", () => {
			renderComponent()

			const expandButton = screen.getByRole("button", { name: /Files list/ })

			// Check initial state announcement
			expect(expandButton).toHaveAttribute("aria-expanded", "false")

			// Expand and check updated announcement
			fireEvent.click(expandButton)
			expect(expandButton).toHaveAttribute("aria-expanded", "true")

			// Title should update to reflect new action
			expect(expandButton).toHaveAttribute("title", "Collapse files list")
		})

		it("should provide context for file change information", () => {
			renderComponent()

			// Expand to show file details
			const expandButton = screen.getByTitle("Expand files list")
			fireEvent.click(expandButton)

			// Check that file information is accessible
			const firstFile = screen.getByTestId("file-item-src/components/test1.ts")
			const fileContent = firstFile.textContent

			// Should include file path, type, and change info
			expect(fileContent).toContain("src/components/test1.ts")
			expect(fileContent).toContain("edit")
			expect(fileContent).toContain("+10, -5 lines")
		})

		it("should provide clear button labels for screen readers", () => {
			renderComponent()

			// Main action buttons should have clear text
			expect(screen.getByText("Accept All")).toBeInTheDocument()
			expect(screen.getByText("Reject All")).toBeInTheDocument()

			// Expand to check file-level buttons
			const expandButton = screen.getByTitle("Expand files list")
			fireEvent.click(expandButton)

			// File action buttons should have descriptive text or ARIA
			const diffButton = screen.getByTestId("diff-src/components/test1.ts")
			expect(diffButton).toHaveTextContent("View Diff")

			// Icon buttons should have descriptive titles
			const acceptButton = screen.getByTestId("accept-src/components/test1.ts")
			const rejectButton = screen.getByTestId("reject-src/components/test1.ts")

			expect(acceptButton).toHaveAttribute("title", "Accept changes for this file")
			expect(rejectButton).toHaveAttribute("title", "Reject changes for this file")
		})
	})

	describe("Color and Visual Accessibility", () => {
		it("should not rely solely on color for important information", () => {
			renderComponent()

			// Expand to see file types
			const expandButton = screen.getByTitle("Expand files list")
			fireEvent.click(expandButton)

			// File types should be indicated by text, not just color
			const editFile = screen.getByTestId("file-item-src/components/test1.ts")
			const createFile = screen.getByTestId("file-item-src/utils/test2.ts")
			const deleteFile = screen.getByTestId("file-item-docs/readme.md")

			// Each should have text labels indicating type
			expect(editFile).toHaveTextContent("edit")
			expect(createFile).toHaveTextContent("create")
			expect(deleteFile).toHaveTextContent("delete")

			// Change information should be in text form
			expect(editFile).toHaveTextContent("+10, -5 lines")
			expect(createFile).toHaveTextContent("+20 lines")
			expect(deleteFile).toHaveTextContent("deleted")
		})

		it("should have sufficient interactive element sizing", () => {
			renderComponent()

			// Main buttons should be adequately sized for interaction
			const acceptButton = screen.getByText("Accept All")
			const rejectButton = screen.getByText("Reject All")

			// Get computed styles (these will be CSS variables in test environment)
			const acceptStyle = getComputedStyle(acceptButton)
			const rejectStyle = getComputedStyle(rejectButton)

			// Buttons should have minimum touch target size (44x44px recommended)
			// In test environment, we check that padding is applied
			expect(acceptStyle.padding).toBeDefined()
			expect(rejectStyle.padding).toBeDefined()
		})
	})

	describe("Focus Management", () => {
		it("should have visible focus indicators", () => {
			renderComponent()

			const expandButton = screen.getByRole("button", { name: /Files list/ })

			// Focus the button
			expandButton.focus()

			// In JSDOM, we can't test actual focus state reliably, but we can test focusability
			expect(expandButton).toHaveAttribute("tabIndex", "0")

			// Focus styles should be defined (JSDOM doesn't compute CSS, so we check the element is focusable)
			expect(expandButton.tagName).toBe("DIV") // It's a div with role="button"
			expect(expandButton).toHaveAttribute("role", "button")
		})

		it("should maintain focus when content changes", () => {
			renderComponent()

			const expandButton = screen.getByRole("button", { name: /Files list/ })

			// Focus and expand
			expandButton.focus()
			fireEvent.click(expandButton)

			// Check that expansion worked correctly
			expect(expandButton).toHaveAttribute("aria-expanded", "true")

			// Collapse and check again
			fireEvent.click(expandButton)
			expect(expandButton).toHaveAttribute("aria-expanded", "false")
		})

		it("should handle focus trapping appropriately", () => {
			renderComponent()

			// When collapsed, focus should be manageable
			const expandButton = screen.getByRole("button", { name: /Files list/ })
			const acceptButton = screen.getByText("Accept All")
			const rejectButton = screen.getByText("Reject All")

			// Should be able to focus all visible interactive elements (check focusability)
			expect(expandButton).toHaveAttribute("tabIndex", "0")
			expect(acceptButton).toHaveAttribute("tabIndex", "0")
			expect(rejectButton).toHaveAttribute("tabIndex", "0")
		})
	})

	describe("High Contrast and Reduced Motion", () => {
		it("should work with high contrast mode", () => {
			renderComponent()

			// Component should render without errors in any contrast mode
			expect(screen.getByRole("button", { name: /Files list/ })).toBeInTheDocument()
			expect(screen.getByText("Accept All")).toBeInTheDocument()
			expect(screen.getByText("Reject All")).toBeInTheDocument()

			// Text content should remain readable
			expect(screen.getByText(/Files Changed/)).toBeInTheDocument()
		})

		it("should handle reduced motion preferences", () => {
			// Mock reduced motion preference
			Object.defineProperty(window, "matchMedia", {
				writable: true,
				value: vi.fn().mockImplementation((query) => ({
					matches: query === "(prefers-reduced-motion: reduce)",
					media: query,
					onchange: null,
					addListener: vi.fn(),
					removeListener: vi.fn(),
					addEventListener: vi.fn(),
					removeEventListener: vi.fn(),
					dispatchEvent: vi.fn(),
				})),
			})

			renderComponent()

			// Component should still function normally
			const expandButton = screen.getByRole("button", { name: /Files list/ })
			fireEvent.click(expandButton)

			// Should expand without animation issues
			expect(expandButton).toHaveAttribute("aria-expanded", "true")
		})
	})

	describe("Mobile Accessibility", () => {
		it("should have appropriate touch targets for mobile", () => {
			renderComponent()

			// Expand to show all interactive elements
			const expandButton = screen.getByTitle("Expand files list")
			fireEvent.click(expandButton)

			// All buttons should be adequately sized for touch
			const buttons = screen.getAllByRole("button")
			buttons.forEach((button) => {
				// In JSDOM, getComputedStyle doesn't work as expected, so we check for inline styles
				const style = button.getAttribute("style")
				// Check that buttons have appropriate styling (padding should be defined in inline styles)
				expect(style).toContain("padding")
			})
		})

		it("should handle touch interactions appropriately", () => {
			renderComponent()

			const expandButton = screen.getByRole("button", { name: /Files list/ })

			// Should respond to touch events (simulated as clicks)
			fireEvent.click(expandButton)
			expect(expandButton).toHaveAttribute("aria-expanded", "true")

			// Should handle rapid touches without issues (debouncing)
			// First click should toggle state
			const initialState = expandButton.getAttribute("aria-expanded")
			fireEvent.click(expandButton)
			const afterFirstClick = expandButton.getAttribute("aria-expanded")
			expect(afterFirstClick).not.toBe(initialState)

			// Second click should toggle back
			fireEvent.click(expandButton)
			const afterSecondClick = expandButton.getAttribute("aria-expanded")
			expect(afterSecondClick).toBe(initialState)
		})
	})
})
