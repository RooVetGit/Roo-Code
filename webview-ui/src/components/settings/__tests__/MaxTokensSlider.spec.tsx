import React from "react"
import { render, screen, fireEvent } from "@testing-library/react"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { MaxTokensSlider } from "../MaxTokensSlider"
import { ModelInfo } from "@roo-code/types"

// Mock the translation hook
vi.mock("@/i18n/TranslationContext", () => ({
	useAppTranslation: () => ({
		t: (key: string, params?: any) => {
			if (key === "settings:providers.maxOutputTokens.label") return "Max Output Tokens"
			if (key === "settings:providers.maxOutputTokens.description") return "Maximum number of tokens"
			if (key === "settings:providers.maxOutputTokens.modelSupports")
				return `Model supports up to ${params?.max} tokens`
			return key
		},
	}),
}))

// Mock the Slider component
vi.mock("@/components/ui", () => ({
	Slider: ({ value, onValueChange, min, max, step }: any) => (
		<div data-testid="slider">
			<input
				type="range"
				min={min}
				max={max}
				step={step}
				value={value[0]}
				onChange={(e) => onValueChange([parseInt(e.target.value)])}
				data-testid="slider-input"
			/>
		</div>
	),
}))

describe("MaxTokensSlider", () => {
	const mockOnChange = vi.fn()

	beforeEach(() => {
		mockOnChange.mockClear()
	})

	it("renders with default value", () => {
		render(<MaxTokensSlider onChange={mockOnChange} />)

		expect(screen.getByText("Max Output Tokens")).toBeInTheDocument()
		expect(screen.getByText("Maximum number of tokens")).toBeInTheDocument()
		// Default value is DEFAULT_HYBRID_REASONING_MODEL_MAX_TOKENS which is 16384
		expect(screen.getByText("16384")).toBeInTheDocument()
	})

	it("renders with custom value", () => {
		render(<MaxTokensSlider value={16384} onChange={mockOnChange} />)

		expect(screen.getByText("16384")).toBeInTheDocument()
	})

	it("shows model support information when modelInfo is provided", () => {
		const modelInfo: ModelInfo = {
			maxTokens: 32768,
			contextWindow: 100000,
			supportsPromptCache: false,
		}

		render(<MaxTokensSlider onChange={mockOnChange} modelInfo={modelInfo} />)

		expect(screen.getByText("Model supports up to 32768 tokens")).toBeInTheDocument()
	})

	it("calls onChange when slider value changes", () => {
		render(<MaxTokensSlider value={8192} onChange={mockOnChange} />)

		const slider = screen.getByTestId("slider-input") as HTMLInputElement
		// Simulate changing the slider value
		fireEvent.change(slider, { target: { value: "16384" } })

		expect(mockOnChange).toHaveBeenCalledWith(16384)
	})

	it("calculates max value correctly based on model info", () => {
		const modelInfo: ModelInfo = {
			maxTokens: 65536,
			contextWindow: 100000,
			supportsPromptCache: false,
		}

		render(<MaxTokensSlider value={8192} onChange={mockOnChange} modelInfo={modelInfo} />)

		const slider = screen.getByTestId("slider-input") as HTMLInputElement
		expect(slider.max).toBe("65536")
	})

	it("uses default max value when model info is not provided", () => {
		render(<MaxTokensSlider value={8192} onChange={mockOnChange} />)

		const slider = screen.getByTestId("slider-input") as HTMLInputElement
		// When no model info, max is Math.max(value, DEFAULT_HYBRID_REASONING_MODEL_MAX_TOKENS)
		expect(slider.max).toBe("16384")
	})

	it("applies custom className", () => {
		const { container } = render(<MaxTokensSlider onChange={mockOnChange} className="custom-class" />)

		expect(container.firstChild).toHaveClass("custom-class")
	})
})
