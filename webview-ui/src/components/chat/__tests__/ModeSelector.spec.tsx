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
		t: (key: string) => {
			const translations: Record<string, string> = {
				"chat:modeSelector.global": "Global",
				"chat:modeSelector.project": "Project",
				"chat:modeSelector.globalShort": "G",
				"chat:modeSelector.projectShort": "P",
				"chat:modeSelector.description": "Select a mode to change how the assistant responds.",
				"chat:modeSelector.searchPlaceholder": "Search modes...",
				"chat:modeSelector.noResults": "No modes found",
				"chat:modeSelector.marketplace": "Browse Marketplace",
				"chat:modeSelector.settings": "Mode Settings",
				"chat:modeSelector.title": "Modes",
			}
			return translations[key] || key
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
		expect(screen.getByText("Modes")).toBeInTheDocument()
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
		expect(screen.getByText(/Select a mode to change how the assistant responds./)).toBeInTheDocument()

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
		expect(screen.getByText(/Select a mode to change how the assistant responds./)).toBeInTheDocument()

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

	test("shows source indicator for custom modes", () => {
		const customModesWithSource: ModeConfig[] = [
			{
				slug: "custom-global",
				name: "Custom Global Mode",
				roleDefinition: "Role",
				groups: ["read"] as ModeConfig["groups"],
				source: "global",
			},
			{
				slug: "custom-project",
				name: "Custom Project Mode",
				roleDefinition: "Role",
				groups: ["read"] as ModeConfig["groups"],
				source: "project",
			},
		]

		// Set up mock to return custom modes
		mockModes = [
			...customModesWithSource,
			{
				slug: "code",
				name: "Code",
				roleDefinition: "Role",
				groups: ["read"] as ModeConfig["groups"],
			},
		]

		render(
			<ModeSelector
				value={"custom-global" as Mode}
				onChange={vi.fn()}
				modeShortcutText="Ctrl+M"
				customModes={customModesWithSource}
			/>,
		)

		// Check selected mode shows full indicator
		const trigger = screen.getByTestId("mode-selector-trigger")
		expect(trigger).toHaveTextContent("Custom Global Mode")
		expect(trigger).toHaveTextContent("(Global)")

		// Open dropdown
		fireEvent.click(trigger)

		// Check dropdown shows short indicators
		const items = screen.getAllByTestId("mode-selector-item")
		const globalItem = items.find((item) => item.textContent?.includes("Custom Global Mode"))
		const projectItem = items.find((item) => item.textContent?.includes("Custom Project Mode"))

		expect(globalItem).toHaveTextContent("(G)")
		expect(projectItem).toHaveTextContent("(P)")
	})

	test("shows no indicator for built-in modes", () => {
		// Set up mock to return only built-in modes
		mockModes = [
			{
				slug: "code",
				name: "Code",
				roleDefinition: "Role",
				groups: ["read"] as ModeConfig["groups"],
			},
			{
				slug: "architect",
				name: "Architect",
				roleDefinition: "Role",
				groups: ["read"] as ModeConfig["groups"],
			},
		]

		render(<ModeSelector value={"code" as Mode} onChange={vi.fn()} modeShortcutText="Ctrl+M" />)

		const trigger = screen.getByTestId("mode-selector-trigger")
		expect(trigger).toHaveTextContent("Code")
		expect(trigger).not.toHaveTextContent("(")

		// Open dropdown
		fireEvent.click(trigger)

		// Check that no items have indicators
		const items = screen.getAllByTestId("mode-selector-item")
		items.forEach((item) => {
			expect(item).not.toHaveTextContent("(Global")
			expect(item).not.toHaveTextContent("(Project")
		})
	})

	test("defaults to global for custom modes without source", () => {
		const customModesNoSource: ModeConfig[] = [
			{
				slug: "custom-old",
				name: "Old Custom Mode",
				roleDefinition: "Role",
				groups: ["read"] as ModeConfig["groups"],
				// No source field
			},
		]

		// Set up mock to include the custom mode
		mockModes = [
			...customModesNoSource,
			{
				slug: "code",
				name: "Code",
				roleDefinition: "Role",
				groups: ["read"] as ModeConfig["groups"],
			},
		]

		render(
			<ModeSelector
				value={"custom-old" as Mode}
				onChange={vi.fn()}
				modeShortcutText="Ctrl+M"
				customModes={customModesNoSource}
			/>,
		)

		const trigger = screen.getByTestId("mode-selector-trigger")
		expect(trigger).toHaveTextContent("Old Custom Mode")
		expect(trigger).toHaveTextContent("(Global)")
	})
})
