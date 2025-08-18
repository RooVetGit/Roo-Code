import React from "react"
import { render, screen, fireEvent } from "@/utils/test-utils"
import { describe, test, expect, vi } from "vitest"
import ModeSelector from "../ModeSelector"
import { Mode } from "@roo/modes"
import { ModeConfig } from "@roo-code/types"

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

describe("ModeSelector", () => {
	test("shows source indicators for custom modes", () => {
		// Set up mock modes including custom modes with different sources
		mockModes = [
			{
				slug: "built-in-mode",
				name: "Built-in Mode",
				description: "A built-in mode",
				roleDefinition: "Role definition",
				groups: ["read"],
			},
			{
				slug: "global-custom",
				name: "Global Custom",
				description: "A global custom mode",
				roleDefinition: "Role definition",
				groups: ["read"],
				source: "global",
			},
			{
				slug: "project-custom",
				name: "Project Custom",
				description: "A project custom mode",
				roleDefinition: "Role definition",
				groups: ["read"],
				source: "project",
			},
		]

		const customModes: ModeConfig[] = [
			{
				slug: "global-custom",
				name: "Global Custom",
				description: "A global custom mode",
				roleDefinition: "Role definition",
				groups: ["read"],
				source: "global",
			},
			{
				slug: "project-custom",
				name: "Project Custom",
				description: "A project custom mode",
				roleDefinition: "Role definition",
				groups: ["read"],
				source: "project",
			},
		]

		const { rerender } = render(
			<ModeSelector
				value={"global-custom" as Mode}
				onChange={vi.fn()}
				modeShortcutText="Ctrl+M"
				customModes={customModes}
			/>,
		)

		// Check trigger shows full source text for selected custom mode
		const trigger = screen.getByTestId("mode-selector-trigger")
		expect(trigger.textContent).toContain("Global Custom")
		expect(trigger.textContent).toContain("(common:customModes.scope.global)")

		// Click to open dropdown
		fireEvent.click(trigger)

		// Check dropdown items show short indicators
		const modeItems = screen.getAllByTestId("mode-selector-item")

		// Built-in mode should not have indicator
		expect(modeItems[0].textContent).toContain("Built-in Mode")
		expect(modeItems[0].textContent).not.toContain("(")

		// Global custom mode should have (G) indicator
		expect(modeItems[1].textContent).toContain("Global Custom")
		expect(modeItems[1].textContent).toContain("(common:customModes.scope.globalShort)")

		// Project custom mode should have (P) indicator
		expect(modeItems[2].textContent).toContain("Project Custom")
		expect(modeItems[2].textContent).toContain("(common:customModes.scope.projectShort)")

		// Close dropdown
		fireEvent.click(document.body)

		// Test with project mode selected
		rerender(
			<ModeSelector
				value={"project-custom" as Mode}
				onChange={vi.fn()}
				modeShortcutText="Ctrl+M"
				customModes={customModes}
			/>,
		)

		// Check trigger shows project source
		expect(screen.getByTestId("mode-selector-trigger").textContent).toContain("(common:customModes.scope.project)")
	})

	test("does not show source indicators for built-in modes", () => {
		mockModes = [
			{
				slug: "code",
				name: "Code",
				description: "Code mode",
				roleDefinition: "Role definition",
				groups: ["read", "edit"],
			},
		]

		render(<ModeSelector value={"code" as Mode} onChange={vi.fn()} modeShortcutText="Ctrl+M" />)

		// Check trigger does not show source indicator
		const trigger = screen.getByTestId("mode-selector-trigger")
		expect(trigger.textContent).toBe("Code")
		expect(trigger.textContent).not.toContain("(")

		// Click to open dropdown
		fireEvent.click(trigger)

		// Check dropdown item does not show indicator
		const modeItem = screen.getByTestId("mode-selector-item")
		expect(modeItem.textContent).toContain("Code")
		expect(modeItem.textContent).not.toContain("(")
	})

	test("defaults source to global when custom mode has no source field", () => {
		const customModes: ModeConfig[] = [
			{
				slug: "custom-no-source",
				name: "Custom No Source",
				description: "A custom mode without source field",
				roleDefinition: "Role definition",
				groups: ["read"],
				// No source field - should default to "global"
			},
		]

		mockModes = [...customModes]

		render(
			<ModeSelector
				value={"custom-no-source" as Mode}
				onChange={vi.fn()}
				modeShortcutText="Ctrl+M"
				customModes={customModes}
			/>,
		)

		// Check trigger shows global source (default)
		const trigger = screen.getByTestId("mode-selector-trigger")
		expect(trigger.textContent).toContain("(common:customModes.scope.global)")
	})

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

	test("shows search bar when there are more than 6 modes", () => {
		// Set up mock to return 7 modes
		mockModes = Array.from({ length: 7 }, (_, i) => ({
			slug: `mode-${i}`,
			name: `Mode ${i}`,
			description: `Description for mode ${i}`,
			roleDefinition: "Role definition",
			groups: ["read", "edit"],
		}))

		render(<ModeSelector value={"mode-0" as Mode} onChange={vi.fn()} modeShortcutText="Ctrl+M" />)

		// Click to open the popover
		fireEvent.click(screen.getByTestId("mode-selector-trigger"))

		// Search input should be visible
		expect(screen.getByTestId("mode-search-input")).toBeInTheDocument()

		// Info icon should be visible
		expect(screen.getByText("chat:modeSelector.title")).toBeInTheDocument()
		const infoIcon = document.querySelector(".codicon-info")
		expect(infoIcon).toBeInTheDocument()
	})

	test("shows info blurb instead of search bar when there are 6 or fewer modes", () => {
		// Set up mock to return 5 modes
		mockModes = Array.from({ length: 5 }, (_, i) => ({
			slug: `mode-${i}`,
			name: `Mode ${i}`,
			description: `Description for mode ${i}`,
			roleDefinition: "Role definition",
			groups: ["read", "edit"],
		}))

		render(<ModeSelector value={"mode-0" as Mode} onChange={vi.fn()} modeShortcutText="Ctrl+M" />)

		// Click to open the popover
		fireEvent.click(screen.getByTestId("mode-selector-trigger"))

		// Search input should NOT be visible
		expect(screen.queryByTestId("mode-search-input")).not.toBeInTheDocument()

		// Info blurb should be visible
		expect(screen.getByText(/chat:modeSelector.description/)).toBeInTheDocument()

		// Info icon should NOT be visible
		const infoIcon = document.querySelector(".codicon-info")
		expect(infoIcon).not.toBeInTheDocument()
	})

	test("filters modes correctly when searching", () => {
		// Set up mock to return 7 modes to enable search
		mockModes = Array.from({ length: 7 }, (_, i) => ({
			slug: `mode-${i}`,
			name: `Mode ${i}`,
			description: `Description for mode ${i}`,
			roleDefinition: "Role definition",
			groups: ["read", "edit"],
		}))

		render(<ModeSelector value={"mode-0" as Mode} onChange={vi.fn()} modeShortcutText="Ctrl+M" />)

		// Click to open the popover
		fireEvent.click(screen.getByTestId("mode-selector-trigger"))

		// Type in search
		const searchInput = screen.getByTestId("mode-search-input")
		fireEvent.change(searchInput, { target: { value: "Mode 3" } })

		// Should show filtered results
		const modeItems = screen.getAllByTestId("mode-selector-item")
		expect(modeItems.length).toBeLessThan(7) // Should have filtered some out
	})

	test("respects disableSearch prop even when there are more than 6 modes", () => {
		// Set up mock to return 10 modes
		mockModes = Array.from({ length: 10 }, (_, i) => ({
			slug: `mode-${i}`,
			name: `Mode ${i}`,
			description: `Description for mode ${i}`,
			roleDefinition: "Role definition",
			groups: ["read", "edit"],
		}))

		render(
			<ModeSelector value={"mode-0" as Mode} onChange={vi.fn()} modeShortcutText="Ctrl+M" disableSearch={true} />,
		)

		// Click to open the popover
		fireEvent.click(screen.getByTestId("mode-selector-trigger"))

		// Search input should NOT be visible even with 10 modes
		expect(screen.queryByTestId("mode-search-input")).not.toBeInTheDocument()

		// Info blurb should be visible instead
		expect(screen.getByText(/chat:modeSelector.description/)).toBeInTheDocument()

		// Info icon should NOT be visible
		const infoIcon = document.querySelector(".codicon-info")
		expect(infoIcon).not.toBeInTheDocument()
	})

	test("shows search when disableSearch is false (default) and modes > 6", () => {
		// Set up mock to return 8 modes
		mockModes = Array.from({ length: 8 }, (_, i) => ({
			slug: `mode-${i}`,
			name: `Mode ${i}`,
			description: `Description for mode ${i}`,
			roleDefinition: "Role definition",
			groups: ["read", "edit"],
		}))

		// Don't pass disableSearch prop (should default to false)
		render(<ModeSelector value={"mode-0" as Mode} onChange={vi.fn()} modeShortcutText="Ctrl+M" />)

		// Click to open the popover
		fireEvent.click(screen.getByTestId("mode-selector-trigger"))

		// Search input should be visible
		expect(screen.getByTestId("mode-search-input")).toBeInTheDocument()

		// Info icon should be visible
		const infoIcon = document.querySelector(".codicon-info")
		expect(infoIcon).toBeInTheDocument()
	})
})
