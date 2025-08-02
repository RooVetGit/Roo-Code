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

	test("shows source indicators for custom modes", () => {
		// Set up mock to return custom modes with source
		mockModes = [
			{
				slug: "custom-global",
				name: "Custom Global Mode",
				description: "A global custom mode",
				roleDefinition: "Role definition",
				groups: ["read", "edit"] as const,
				source: "global",
			},
			{
				slug: "custom-project",
				name: "Custom Project Mode",
				description: "A project custom mode",
				roleDefinition: "Role definition",
				groups: ["read", "edit"] as const,
				source: "project",
			},
			{
				slug: "code",
				name: "Code Mode",
				description: "Built-in code mode",
				roleDefinition: "Role definition",
				groups: ["read", "edit"] as const,
			},
		]

		const customModes: ModeConfig[] = [
			{
				slug: "custom-global",
				name: "Custom Global Mode",
				description: "A global custom mode",
				roleDefinition: "Role definition",
				groups: ["read", "edit"],
				source: "global",
			},
			{
				slug: "custom-project",
				name: "Custom Project Mode",
				description: "A project custom mode",
				roleDefinition: "Role definition",
				groups: ["read", "edit"],
				source: "project",
			},
		]

		render(
			<ModeSelector
				value={"custom-global" as Mode}
				onChange={vi.fn()}
				modeShortcutText="Ctrl+M"
				customModes={customModes}
			/>,
		)

		// Click to open the popover
		fireEvent.click(screen.getByTestId("mode-selector-trigger"))

		// Check that custom modes show source indicators in dropdown
		const modeItems = screen.getAllByTestId("mode-selector-item")

		// Find the custom modes in the dropdown
		const globalModeItem = modeItems.find((item) => item.textContent?.includes("Custom Global Mode"))
		const projectModeItem = modeItems.find((item) => item.textContent?.includes("Custom Project Mode"))
		const builtinModeItem = modeItems.find((item) => item.textContent?.includes("Code Mode"))

		// Custom modes should show source indicators
		expect(globalModeItem?.textContent).toContain("(chat:modeSelector.globalShort)")
		expect(projectModeItem?.textContent).toContain("(chat:modeSelector.projectShort)")

		// Built-in mode should not show source indicator
		expect(builtinModeItem?.textContent).not.toContain("(chat:modeSelector.globalShort)")
		expect(builtinModeItem?.textContent).not.toContain("(chat:modeSelector.projectShort)")
	})

	test("shows source indicator in selected mode button", () => {
		// Set up mock to return custom modes with source
		mockModes = [
			{
				slug: "custom-project",
				name: "Custom Project Mode",
				description: "A project custom mode",
				roleDefinition: "Role definition",
				groups: ["read", "edit"] as const,
				source: "project",
			},
		]

		const customModes: ModeConfig[] = [
			{
				slug: "custom-project",
				name: "Custom Project Mode",
				description: "A project custom mode",
				roleDefinition: "Role definition",
				groups: ["read", "edit"],
				source: "project",
			},
		]

		render(
			<ModeSelector
				value={"custom-project" as Mode}
				onChange={vi.fn()}
				modeShortcutText="Ctrl+M"
				customModes={customModes}
			/>,
		)

		// Check that the trigger button shows the source indicator
		const trigger = screen.getByTestId("mode-selector-trigger")
		expect(trigger.textContent).toContain("Custom Project Mode")
		expect(trigger.textContent).toContain("(chat:modeSelector.project)")
	})

	test("does not show source indicator for built-in modes", () => {
		// Set up mock to return only built-in modes
		mockModes = [
			{
				slug: "code",
				name: "Code Mode",
				description: "Built-in code mode",
				roleDefinition: "Role definition",
				groups: ["read", "edit"] as const,
			},
		]

		render(<ModeSelector value={"code" as Mode} onChange={vi.fn()} modeShortcutText="Ctrl+M" customModes={[]} />)

		// Check that the trigger button does not show source indicator
		const trigger = screen.getByTestId("mode-selector-trigger")
		expect(trigger.textContent).toContain("Code Mode")
		expect(trigger.textContent).not.toContain("(Global)")
		expect(trigger.textContent).not.toContain("(Project)")
	})
})
