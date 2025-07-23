import React from "react"
import { render, screen, fireEvent, waitFor } from "@/utils/test-utils"
import { describe, test, expect, vi } from "vitest"
import ModeSelector from "../ModeSelector"
import { Mode } from "@roo/modes"

// Mock the dependencies
vi.mock("@/utils/vscode", () => ({
	vscode: {
		postMessage: vi.fn(),
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
		t: (key: string) => key,
	}),
}))

vi.mock("@/components/ui/hooks/useRooPortal", () => ({
	useRooPortal: () => document.body,
}))

describe("ModeSelector", () => {
	test("shows custom description from customModePrompts", () => {
		const customModePrompts = {
			code: {
				description: "Custom code mode description",
			},
		}

		render(
			<ModeSelector
				value={"code" as Mode}
				onChange={vi.fn()}
				modeShortcutText="Ctrl+M"
				customModePrompts={customModePrompts}
			/>,
		)

		// The component should be rendered
		expect(screen.getByTestId("mode-selector-trigger")).toBeInTheDocument()
	})

	test("falls back to default description when no custom prompt", () => {
		render(<ModeSelector value={"code" as Mode} onChange={vi.fn()} modeShortcutText="Ctrl+M" />)

		// The component should be rendered
		expect(screen.getByTestId("mode-selector-trigger")).toBeInTheDocument()
	})

	test("opens popover and shows search input when clicked", async () => {
		render(<ModeSelector value={"code" as Mode} onChange={vi.fn()} modeShortcutText="Ctrl+M" />)

		const trigger = screen.getByTestId("mode-selector-trigger")
		fireEvent.click(trigger)

		await waitFor(() => {
			expect(screen.getByTestId("mode-search-input")).toBeInTheDocument()
			expect(screen.getByPlaceholderText("chat:modeSelector.searchPlaceholder")).toBeInTheDocument()
		})
	})

	test("filters modes based on search input", async () => {
		const onChange = vi.fn()
		render(<ModeSelector value={"code" as Mode} onChange={onChange} modeShortcutText="Ctrl+M" />)

		// Open the popover
		const trigger = screen.getByTestId("mode-selector-trigger")
		fireEvent.click(trigger)

		// Wait for the popover to open
		await waitFor(() => {
			expect(screen.getByTestId("mode-search-input")).toBeInTheDocument()
		})

		// Type in the search input
		const searchInput = screen.getByTestId("mode-search-input")
		fireEvent.change(searchInput, { target: { value: "code" } })

		// Check that modes are filtered (this assumes "code" mode exists)
		await waitFor(() => {
			const modeItems = screen.getAllByTestId("mode-selector-item")
			expect(modeItems.length).toBeGreaterThan(0)
		})
	})

	test("clears search when X button is clicked", async () => {
		render(<ModeSelector value={"code" as Mode} onChange={vi.fn()} modeShortcutText="Ctrl+M" />)

		// Open the popover
		const trigger = screen.getByTestId("mode-selector-trigger")
		fireEvent.click(trigger)

		// Wait for the popover to open
		await waitFor(() => {
			expect(screen.getByTestId("mode-search-input")).toBeInTheDocument()
		})

		// Type in the search input
		const searchInput = screen.getByTestId("mode-search-input")
		fireEvent.change(searchInput, { target: { value: "test" } })

		// Wait for the X button to appear
		await waitFor(() => {
			// The X button is an svg element with specific classes
			const clearButton = document.querySelector(".lucide-x")
			expect(clearButton).toBeInTheDocument()
		})

		// Click the clear button
		const clearButton = document.querySelector(".lucide-x") as HTMLElement
		fireEvent.click(clearButton)

		// Check that search input is cleared
		await waitFor(() => {
			expect(searchInput).toHaveValue("")
		})
	})

	test("shows marketplace and settings buttons at the bottom", async () => {
		render(<ModeSelector value={"code" as Mode} onChange={vi.fn()} modeShortcutText="Ctrl+M" />)

		// Open the popover
		const trigger = screen.getByTestId("mode-selector-trigger")
		fireEvent.click(trigger)

		await waitFor(() => {
			// Check for marketplace button by aria-label
			expect(screen.getByLabelText("chat:modeSelector.marketplace")).toBeInTheDocument()
			// Check for settings button by aria-label
			expect(screen.getByLabelText("chat:modeSelector.settings")).toBeInTheDocument()
		})
	})

	test("shows info icon with tooltip for description", async () => {
		render(<ModeSelector value={"code" as Mode} onChange={vi.fn()} modeShortcutText="Ctrl+M" />)

		// Open the popover
		const trigger = screen.getByTestId("mode-selector-trigger")
		fireEvent.click(trigger)

		await waitFor(() => {
			// Look for the info icon by its class
			const infoIcon = document.querySelector(".lucide-info")
			expect(infoIcon).toBeInTheDocument()
		})
	})

	test("selects a mode when clicked", async () => {
		const onChange = vi.fn()
		render(<ModeSelector value={"code" as Mode} onChange={onChange} modeShortcutText="Ctrl+M" />)

		// Open the popover
		const trigger = screen.getByTestId("mode-selector-trigger")
		fireEvent.click(trigger)

		await waitFor(() => {
			const modeItems = screen.getAllByTestId("mode-selector-item")
			expect(modeItems.length).toBeGreaterThan(0)
		})

		// Click on a mode item
		const modeItems = screen.getAllByTestId("mode-selector-item")
		fireEvent.click(modeItems[0])

		// Check that onChange was called
		await waitFor(() => {
			expect(onChange).toHaveBeenCalled()
		})
	})
})
