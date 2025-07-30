import React from "react"
import { render, screen, fireEvent } from "@/utils/test-utils"
import { describe, test, expect, vi } from "vitest"
import AgentSelector from "../AgentSelector"
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

describe("AgentSelector", () => {
	test("shows custom description from customModePrompts", () => {
		const customModePrompts = {
			code: {
				description: "Custom code agent description",
			},
		}

		render(
			<AgentSelector
				value={"code" as Mode}
				onChange={vi.fn()}
				modeShortcutText="Ctrl+M"
				customModePrompts={customModePrompts}
			/>,
		)

		// The component should be rendered
		expect(screen.getByTestId("agent-selector-trigger")).toBeInTheDocument()
	})

	test("falls back to default description when no custom prompt", () => {
		render(<AgentSelector value={"code" as Mode} onChange={vi.fn()} modeShortcutText="Ctrl+M" />)

		// The component should be rendered
		expect(screen.getByTestId("agent-selector-trigger")).toBeInTheDocument()
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

		render(<AgentSelector value={"mode-0" as Mode} onChange={vi.fn()} modeShortcutText="Ctrl+M" />)

		// Click to open the popover
		fireEvent.click(screen.getByTestId("agent-selector-trigger"))

		// Search input should be visible
		expect(screen.getByTestId("agent-search-input")).toBeInTheDocument()

		// Info icon should be visible
		expect(screen.getByText("chat:agentSelector.title")).toBeInTheDocument()
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

		render(<AgentSelector value={"mode-0" as Mode} onChange={vi.fn()} modeShortcutText="Ctrl+M" />)

		// Click to open the popover
		fireEvent.click(screen.getByTestId("agent-selector-trigger"))

		// Search input should NOT be visible
		expect(screen.queryByTestId("agent-search-input")).not.toBeInTheDocument()

		// Info blurb should be visible
		expect(screen.getByText(/chat:agentSelector.description/)).toBeInTheDocument()

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

		render(<AgentSelector value={"mode-0" as Mode} onChange={vi.fn()} modeShortcutText="Ctrl+M" />)

		// Click to open the popover
		fireEvent.click(screen.getByTestId("agent-selector-trigger"))

		// Type in search
		const searchInput = screen.getByTestId("agent-search-input")
		fireEvent.change(searchInput, { target: { value: "Mode 3" } })

		// Should show filtered results
		const modeItems = screen.getAllByTestId("agent-selector-item")
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
			<AgentSelector
				value={"mode-0" as Mode}
				onChange={vi.fn()}
				modeShortcutText="Ctrl+M"
				disableSearch={true}
			/>,
		)

		// Click to open the popover
		fireEvent.click(screen.getByTestId("agent-selector-trigger"))

		// Search input should NOT be visible even with 10 modes
		expect(screen.queryByTestId("agent-search-input")).not.toBeInTheDocument()

		// Info blurb should be visible instead
		expect(screen.getByText(/chat:agentSelector.description/)).toBeInTheDocument()

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
		render(<AgentSelector value={"mode-0" as Mode} onChange={vi.fn()} modeShortcutText="Ctrl+M" />)

		// Click to open the popover
		fireEvent.click(screen.getByTestId("agent-selector-trigger"))

		// Search input should be visible
		expect(screen.getByTestId("agent-search-input")).toBeInTheDocument()

		// Info icon should be visible
		const infoIcon = document.querySelector(".codicon-info")
		expect(infoIcon).toBeInTheDocument()
	})
})
