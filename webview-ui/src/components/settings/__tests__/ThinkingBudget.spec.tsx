// npx vitest src/components/settings/__tests__/ThinkingBudget.spec.tsx

import { render, screen, fireEvent } from "@/utils/test-utils"

import type { ModelInfo } from "@roo-code/types"

import { ThinkingBudget } from "../ThinkingBudget"

vi.mock("@/components/ui", () => ({
	Slider: ({ value, onValueChange, min, max }: any) => (
		<input
			type="range"
			data-testid="slider"
			min={min}
			max={max}
			value={value[0]}
			onChange={(e) => onValueChange([parseInt(e.target.value)])}
		/>
	),
}))

describe("ThinkingBudget", () => {
	const mockModelInfo: ModelInfo = {
		supportsReasoningBudget: true,
		requiredReasoningBudget: true,
		maxTokens: 16384,
		contextWindow: 200000,
		supportsPromptCache: true,
		supportsImages: true,
	}

	const defaultProps = {
		apiConfiguration: {},
		setApiConfigurationField: vi.fn(),
		modelInfo: mockModelInfo,
	}

	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("should render nothing when model doesn't support thinking", () => {
		const { container } = render(
			<ThinkingBudget
				{...defaultProps}
				modelInfo={{
					...mockModelInfo,
					maxTokens: 16384,
					contextWindow: 200000,
					supportsPromptCache: true,
					supportsImages: true,
					supportsReasoningBudget: false,
				}}
			/>,
		)

		expect(container.firstChild).toBeNull()
	})

	it("should render slider when model supports thinking", () => {
		render(<ThinkingBudget {...defaultProps} />)

		expect(screen.getAllByTestId("slider")).toHaveLength(1)
	})

	it("should update modelMaxThinkingTokens", () => {
		const setApiConfigurationField = vi.fn()

		render(
			<ThinkingBudget
				{...defaultProps}
				apiConfiguration={{ modelMaxThinkingTokens: 4096 }}
				setApiConfigurationField={setApiConfigurationField}
			/>,
		)

		const slider = screen.getByTestId("slider")
		fireEvent.change(slider, { target: { value: "5000" } })

		expect(setApiConfigurationField).toHaveBeenCalledWith("modelMaxThinkingTokens", 5000)
	})

	it("should cap thinking tokens at 80% of max tokens", () => {
		const setApiConfigurationField = vi.fn()

		render(
			<ThinkingBudget
				{...defaultProps}
				apiConfiguration={{ modelMaxTokens: 10000, modelMaxThinkingTokens: 9000 }}
				setApiConfigurationField={setApiConfigurationField}
			/>,
		)

		// Effect should trigger and cap the value
		expect(setApiConfigurationField).toHaveBeenCalledWith("modelMaxThinkingTokens", 8000) // 80% of 10000
	})

	it("should allow max thinking tokens up to 80% of max output tokens", () => {
		render(<ThinkingBudget {...defaultProps} apiConfiguration={{ modelMaxTokens: 5000 }} />)

		const slider = screen.getByTestId("slider")
		// Max should be 80% of 5000 = 4000
		expect(slider.getAttribute("max")).toBe("4000")
	})

	it("should use default thinking tokens if not provided", () => {
		render(<ThinkingBudget {...defaultProps} apiConfiguration={{ modelMaxTokens: 10000 }} />)

		// Default is 80% of max tokens, capped at 8192
		const slider = screen.getByTestId("slider")
		expect(slider).toHaveValue("8000") // 80% of 10000
	})

	it("should use min thinking tokens of 1024", () => {
		render(<ThinkingBudget {...defaultProps} apiConfiguration={{ modelMaxTokens: 3000 }} />)

		const slider = screen.getByTestId("slider")
		expect(slider.getAttribute("min")).toBe("1024")
	})

	it("should cap displayed value at 80% even if stored value is higher", () => {
		render(
			<ThinkingBudget
				{...defaultProps}
				apiConfiguration={{ modelMaxTokens: 5000, modelMaxThinkingTokens: 8192 }}
			/>,
		)

		const slider = screen.getByTestId("slider")
		// Value should be capped at 4000 (80% of 5000) even though stored value is 8192
		expect(slider).toHaveValue("4000")
	})
})
