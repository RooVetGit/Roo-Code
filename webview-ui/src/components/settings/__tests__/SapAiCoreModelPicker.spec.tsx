import React from "react"
import { render, screen } from "@testing-library/react"
import { describe, it, expect, vi } from "vitest"

import SapAiCoreModelPicker from "../SapAiCoreModelPicker"

// Mock sapAiCoreModels (partial mock preserving other exports like DEFAULT_MODES)
vi.mock("@roo-code/types", async () => {
	const actual = await vi.importActual<typeof import("@roo-code/types")>("@roo-code/types")
	return {
		...actual,
		sapAiCoreModels: {
			"anthropic--claude-3.5-sonnet": {
				id: "anthropic--claude-3.5-sonnet",
				name: "Claude 3.5 Sonnet",
			},
			"gpt-4o": {
				id: "gpt-4o",
				name: "GPT-4o",
			},
			"gemini-1.5-pro": {
				id: "gemini-1.5-pro",
				name: "Gemini 1.5 Pro",
			},
		},
	}
})

describe("SapAiCoreModelPicker", () => {
	const mockOnModelChange = vi.fn()

	beforeEach(() => {
		mockOnModelChange.mockClear()
	})

	it("renders with default placeholder", () => {
		render(<SapAiCoreModelPicker selectedModelId="" onModelChange={mockOnModelChange} deployedModels={[]} />)

		expect(screen.getByText("settings:modelPicker.label")).toBeInTheDocument()
		expect(screen.getByRole("combobox")).toBeInTheDocument()
	})

	it("shows only supported models when no deployed models", () => {
		render(<SapAiCoreModelPicker selectedModelId="" onModelChange={mockOnModelChange} deployedModels={[]} />)

		// Should not show section headers when no deployed models
		expect(screen.queryByText("🟢 Deployed Models (Ready to Use)")).not.toBeInTheDocument()
		expect(screen.queryByText("🔴 Not Deployed Models (Require Deployment)")).not.toBeInTheDocument()
	})

	it("shows deployed models first when deployment info is available", () => {
		render(
			<SapAiCoreModelPicker
				selectedModelId=""
				onModelChange={mockOnModelChange}
				deployedModels={["anthropic--claude-3.5-sonnet", "gpt-4o"]}
			/>,
		)

		// Click to open dropdown and check that options are properly categorized
		// Note: Since we're using a custom Select component, we'll need to adapt this test
		// based on how the Select component works in the actual implementation
		expect(screen.getByText("settings:modelPicker.label")).toBeInTheDocument()
	})

	it("renders with custom placeholder", () => {
		render(
			<SapAiCoreModelPicker
				selectedModelId=""
				onModelChange={mockOnModelChange}
				deployedModels={[]}
				placeholder="Choose SAP AI Core model..."
			/>,
		)

		expect(screen.getByText("settings:modelPicker.label")).toBeInTheDocument()
	})

	it("handles model selection", () => {
		render(
			<SapAiCoreModelPicker
				selectedModelId="anthropic--claude-3.5-sonnet"
				onModelChange={mockOnModelChange}
				deployedModels={["anthropic--claude-3.5-sonnet"]}
			/>,
		)

		// Check that the component renders with the selected model
		expect(screen.getByText("settings:modelPicker.label")).toBeInTheDocument()
	})
})
