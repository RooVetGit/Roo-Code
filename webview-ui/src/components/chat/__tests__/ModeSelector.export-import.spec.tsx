import React from "react"
import { render, screen, fireEvent, waitFor } from "@/utils/test-utils"
import { describe, test, expect, vi, beforeEach } from "vitest"
import ModeSelector from "../ModeSelector"
import { Mode } from "@roo/modes"
import { ModeConfig } from "@roo-code/types"

// Mock the dependencies
const mockPostMessage = vi.fn()
vi.mock("@/utils/vscode", () => ({
	vscode: {
		postMessage: (message: any) => mockPostMessage(message),
	},
}))

vi.mock("@/context/ExtensionStateContext", () => ({
	useExtensionState: () => ({
		hasOpenedModeSelector: false,
		setHasOpenedModeSelector: vi.fn(),
	}),
}))

vi.mock("@/i18n/TranslationContext", () => ({
	useAppTranslation: () => ({
		t: (key: string, _options?: any) => {
			if (key === "prompts:exportMode.title") return "Export Mode"
			if (key === "prompts:modes.importMode") return "Import Mode"
			if (key === "prompts:importMode.selectLevel") return "Select import level"
			if (key === "prompts:importMode.project.label") return "Project"
			if (key === "prompts:importMode.project.description") return "Import to project"
			if (key === "prompts:importMode.global.label") return "Global"
			if (key === "prompts:importMode.global.description") return "Import globally"
			if (key === "prompts:createModeDialog.buttons.cancel") return "Cancel"
			if (key === "prompts:importMode.import") return "Import"
			if (key === "prompts:importMode.importing") return "Importing..."
			if (key === "prompts:exportMode.error") return "Export failed"
			if (key === "prompts:importMode.error") return "Import failed"
			if (key === "chat:modeSelector.marketplace") return "Marketplace"
			if (key === "chat:modeSelector.settings") return "Settings"
			if (key === "chat:modeSelector.searchPlaceholder") return "Search modes"
			if (key === "chat:modeSelector.noResults") return "No results"
			if (key === "chat:modeSelector.description") return "Select a mode"
			if (key === "chat:modeSelector.title") return "Modes"
			return key
		},
	}),
}))

vi.mock("@/components/ui/hooks/useRooPortal", () => ({
	useRooPortal: () => document.body,
}))

vi.mock("@/utils/TelemetryClient", () => ({
	telemetryClient: {
		capture: vi.fn(),
	},
}))

// Create a variable to control what getAllModes returns
let mockModes: ModeConfig[] = []

vi.mock("@roo/modes", async () => {
	const actual = await vi.importActual<typeof import("@roo/modes")>("@roo/modes")
	return {
		...actual,
		getAllModes: () => mockModes,
	}
})

describe("ModeSelector Export/Import", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		// Set up mock modes
		mockModes = [
			{
				slug: "code",
				name: "Code",
				description: "Write code",
				roleDefinition: "You are a coding assistant",
				groups: ["read", "edit"],
			},
			{
				slug: "architect",
				name: "Architect",
				description: "Design systems",
				roleDefinition: "You are a system architect",
				groups: ["read"],
			},
		]
	})

	describe("Export Functionality", () => {
		test("export button is hidden by default and shows on hover", async () => {
			render(<ModeSelector value={"code" as Mode} onChange={vi.fn()} modeShortcutText="Ctrl+M" />)

			// Open the popover
			fireEvent.click(screen.getByTestId("mode-selector-trigger"))

			// Find the mode item
			const modeItems = screen.getAllByTestId("mode-selector-item")
			const codeItem = modeItems[0]

			// Export button should have opacity-0 class initially
			const exportButton = codeItem.querySelector('button[aria-label="Export Mode"]')
			expect(exportButton).toHaveClass("opacity-0")

			// Hover over the mode item
			fireEvent.mouseEnter(codeItem)

			// Export button should now have opacity-100 class
			expect(exportButton).toHaveClass("group-hover:opacity-100")
		})

		test("clicking export button sends exportMode message", async () => {
			render(<ModeSelector value={"code" as Mode} onChange={vi.fn()} modeShortcutText="Ctrl+M" />)

			// Open the popover
			fireEvent.click(screen.getByTestId("mode-selector-trigger"))

			// Find and click the export button for the first mode
			const modeItems = screen.getAllByTestId("mode-selector-item")
			const exportButton = modeItems[0].querySelector('button[aria-label="Export Mode"]') as HTMLButtonElement
			fireEvent.click(exportButton)

			// Verify the message was sent
			expect(mockPostMessage).toHaveBeenCalledWith({
				type: "exportMode",
				slug: "code",
			})
		})

		test("export button shows loading state while exporting", async () => {
			render(<ModeSelector value={"code" as Mode} onChange={vi.fn()} modeShortcutText="Ctrl+M" />)

			// Open the popover
			fireEvent.click(screen.getByTestId("mode-selector-trigger"))

			// Find and click the export button
			const modeItems = screen.getAllByTestId("mode-selector-item")
			const exportButton = modeItems[0].querySelector('button[aria-label="Export Mode"]') as HTMLButtonElement
			fireEvent.click(exportButton)

			// Button should be disabled
			expect(exportButton).toBeDisabled()
		})

		test("handles export success", async () => {
			render(<ModeSelector value={"code" as Mode} onChange={vi.fn()} modeShortcutText="Ctrl+M" />)

			// Open the popover
			fireEvent.click(screen.getByTestId("mode-selector-trigger"))

			// Click export
			const modeItems = screen.getAllByTestId("mode-selector-item")
			const exportButton = modeItems[0].querySelector('button[aria-label="Export Mode"]') as HTMLButtonElement
			fireEvent.click(exportButton)

			// Simulate success response
			window.dispatchEvent(
				new MessageEvent("message", {
					data: {
						type: "exportModeResult",
						success: true,
					},
				}),
			)

			// Button should be enabled again
			await waitFor(() => {
				expect(exportButton).not.toBeDisabled()
			})
		})

		test("handles export error", async () => {
			render(<ModeSelector value={"code" as Mode} onChange={vi.fn()} modeShortcutText="Ctrl+M" />)

			// Open the popover
			fireEvent.click(screen.getByTestId("mode-selector-trigger"))

			// Click export
			const modeItems = screen.getAllByTestId("mode-selector-item")
			const exportButton = modeItems[0].querySelector('button[aria-label="Export Mode"]') as HTMLButtonElement
			fireEvent.click(exportButton)

			// Simulate error response
			window.dispatchEvent(
				new MessageEvent("message", {
					data: {
						type: "exportModeResult",
						success: false,
						error: "Failed to save file",
					},
				}),
			)

			// Error message should be displayed
			await waitFor(() => {
				expect(screen.getByText("Failed to save file")).toBeInTheDocument()
			})

			// Button should be enabled again
			expect(exportButton).not.toBeDisabled()
		})
	})

	describe("Import Functionality", () => {
		test("import button is visible in the footer", async () => {
			render(<ModeSelector value={"code" as Mode} onChange={vi.fn()} modeShortcutText="Ctrl+M" />)

			// Open the popover
			fireEvent.click(screen.getByTestId("mode-selector-trigger"))

			// Import button should be visible
			const importButton = screen.getByRole("button", { name: "Import Mode" })
			expect(importButton).toBeInTheDocument()
			// Check for the Download icon (SVG) inside the button
			const icon = importButton.querySelector("svg")
			expect(icon).toBeInTheDocument()
		})

		test("clicking import button opens import dialog", async () => {
			render(<ModeSelector value={"code" as Mode} onChange={vi.fn()} modeShortcutText="Ctrl+M" />)

			// Open the popover
			fireEvent.click(screen.getByTestId("mode-selector-trigger"))

			// Click import button
			const importButton = screen.getByRole("button", { name: "Import Mode" })
			fireEvent.click(importButton)

			// Import dialog should be visible
			expect(screen.getByText("Select import level")).toBeInTheDocument()
			// Check for the text content instead of label association
			expect(screen.getByText("Project")).toBeInTheDocument()
			expect(screen.getByText("Global")).toBeInTheDocument()
		})

		test("import dialog has unique IDs for radio inputs", async () => {
			render(<ModeSelector value={"code" as Mode} onChange={vi.fn()} modeShortcutText="Ctrl+M" />)

			// Open the popover and import dialog
			fireEvent.click(screen.getByTestId("mode-selector-trigger"))
			fireEvent.click(screen.getByRole("button", { name: "Import Mode" }))

			// Check for unique IDs
			const projectRadio = document.getElementById("import-level-project") as HTMLInputElement
			const globalRadio = document.getElementById("import-level-global") as HTMLInputElement

			expect(projectRadio).toBeInTheDocument()
			expect(globalRadio).toBeInTheDocument()
			expect(projectRadio.id).toBe("import-level-project")
			expect(globalRadio.id).toBe("import-level-global")
		})

		test("project level is selected by default", async () => {
			render(<ModeSelector value={"code" as Mode} onChange={vi.fn()} modeShortcutText="Ctrl+M" />)

			// Open the popover and import dialog
			fireEvent.click(screen.getByTestId("mode-selector-trigger"))
			fireEvent.click(screen.getByRole("button", { name: "Import Mode" }))

			// Project should be checked by default
			const projectRadio = document.getElementById("import-level-project") as HTMLInputElement
			const globalRadio = document.getElementById("import-level-global") as HTMLInputElement

			expect(projectRadio).toBeInTheDocument()
			expect(globalRadio).toBeInTheDocument()
			expect(projectRadio.checked).toBe(true)
			expect(globalRadio.checked).toBe(false)
		})

		test("clicking import sends importMode message with selected level", async () => {
			render(<ModeSelector value={"code" as Mode} onChange={vi.fn()} modeShortcutText="Ctrl+M" />)

			// Open the popover and import dialog
			fireEvent.click(screen.getByTestId("mode-selector-trigger"))
			fireEvent.click(screen.getByRole("button", { name: "Import Mode" }))

			// Select global
			const globalRadio = document.getElementById("import-level-global") as HTMLInputElement
			expect(globalRadio).toBeInTheDocument()
			fireEvent.click(globalRadio)

			// Click import
			const importButton = screen.getByText("Import")
			fireEvent.click(importButton)

			// Verify the message was sent
			expect(mockPostMessage).toHaveBeenCalledWith({
				type: "importMode",
				source: "global",
			})
		})

		test("import button shows loading state while importing", async () => {
			render(<ModeSelector value={"code" as Mode} onChange={vi.fn()} modeShortcutText="Ctrl+M" />)

			// Open the popover and import dialog
			fireEvent.click(screen.getByTestId("mode-selector-trigger"))
			fireEvent.click(screen.getByRole("button", { name: "Import Mode" }))

			// Click import
			const importButton = screen.getByText("Import")
			fireEvent.click(importButton)

			// Button should show importing text
			expect(screen.getByText("Importing...")).toBeInTheDocument()
		})

		test("handles import success", async () => {
			render(<ModeSelector value={"code" as Mode} onChange={vi.fn()} modeShortcutText="Ctrl+M" />)

			// Open the popover and import dialog
			fireEvent.click(screen.getByTestId("mode-selector-trigger"))
			fireEvent.click(screen.getByRole("button", { name: "Import Mode" }))

			// Click import
			const importButton = screen.getByText("Import")
			fireEvent.click(importButton)

			// Simulate success response
			window.dispatchEvent(
				new MessageEvent("message", {
					data: {
						type: "importModeResult",
						success: true,
					},
				}),
			)

			// Dialog should be closed
			await waitFor(() => {
				expect(screen.queryByText("Select import level")).not.toBeInTheDocument()
			})
		})

		test("handles import error", async () => {
			render(<ModeSelector value={"code" as Mode} onChange={vi.fn()} modeShortcutText="Ctrl+M" />)

			// Open the popover and import dialog
			fireEvent.click(screen.getByTestId("mode-selector-trigger"))
			fireEvent.click(screen.getByRole("button", { name: "Import Mode" }))

			// Click import
			const importButton = screen.getByText("Import")
			fireEvent.click(importButton)

			// Simulate error response
			window.dispatchEvent(
				new MessageEvent("message", {
					data: {
						type: "importModeResult",
						success: false,
						error: "Invalid file format",
					},
				}),
			)

			// Error message should be displayed
			await waitFor(() => {
				expect(screen.getByText("Invalid file format")).toBeInTheDocument()
			})

			// Dialog should still be open
			expect(screen.getByText("Select import level")).toBeInTheDocument()
		})

		test("handles cancelled import", async () => {
			render(<ModeSelector value={"code" as Mode} onChange={vi.fn()} modeShortcutText="Ctrl+M" />)

			// Open the popover and import dialog
			fireEvent.click(screen.getByTestId("mode-selector-trigger"))
			fireEvent.click(screen.getByRole("button", { name: "Import Mode" }))

			// Click import
			const importButton = screen.getByText("Import")
			fireEvent.click(importButton)

			// Simulate cancelled response
			window.dispatchEvent(
				new MessageEvent("message", {
					data: {
						type: "importModeResult",
						success: false,
						error: "cancelled",
					},
				}),
			)

			// Dialog should be closed and no error shown
			await waitFor(() => {
				expect(screen.queryByText("Select import level")).not.toBeInTheDocument()
			})
			expect(screen.queryByText("cancelled")).not.toBeInTheDocument()
		})

		test("cancel button closes import dialog", async () => {
			render(<ModeSelector value={"code" as Mode} onChange={vi.fn()} modeShortcutText="Ctrl+M" />)

			// Open the popover and import dialog
			fireEvent.click(screen.getByTestId("mode-selector-trigger"))
			fireEvent.click(screen.getByRole("button", { name: "Import Mode" }))

			// Click cancel
			const cancelButton = screen.getByText("Cancel")
			fireEvent.click(cancelButton)

			// Dialog should be closed
			expect(screen.queryByText("Select import level")).not.toBeInTheDocument()
		})
	})

	describe("Accessibility", () => {
		test("export button has proper aria-label", async () => {
			render(<ModeSelector value={"code" as Mode} onChange={vi.fn()} modeShortcutText="Ctrl+M" />)

			// Open the popover
			fireEvent.click(screen.getByTestId("mode-selector-trigger"))

			// Find export button
			const modeItems = screen.getAllByTestId("mode-selector-item")
			const exportButton = modeItems[0].querySelector('button[aria-label="Export Mode"]')

			expect(exportButton).toHaveAttribute("aria-label", "Export Mode")
		})

		test("import button has proper structure", async () => {
			render(<ModeSelector value={"code" as Mode} onChange={vi.fn()} modeShortcutText="Ctrl+M" />)

			// Open the popover
			fireEvent.click(screen.getByTestId("mode-selector-trigger"))

			// Import button should have proper structure
			const importButton = screen.getByRole("button", { name: "Import Mode" })
			expect(importButton).toHaveAttribute("title", "Import Mode")
			// Check for the Download icon (SVG) inside the button
			expect(importButton.querySelector("svg")).toBeInTheDocument()
		})
	})
})
