import { render, screen } from "@testing-library/react"
import { ThinkingBudget } from "../ThinkingBudget"
import { ModelInfo } from "@roo/shared/api"

jest.mock("@/components/ui", () => ({
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
		thinking: true,
		maxTokens: 16384,
		contextWindow: 200000,
		supportsPromptCache: true,
		supportsImages: true,
	}

	const defaultProps = {
		apiConfiguration: {},
		setApiConfigurationField: jest.fn(),
		modelInfo: mockModelInfo,
	}

	beforeEach(() => {
		jest.clearAllMocks()
	})

	it("should render nothing when model doesn't support thinking", () => {
		const { container } = render(
			<ThinkingBudget
				{...defaultProps}
				modelInfo={{
					...mockModelInfo,
					thinking: false,
					maxTokens: 16384,
					contextWindow: 200000,
					supportsPromptCache: true,
					supportsImages: true,
				}}
			/>,
		)

		expect(container.firstChild).toBeNull()
	})

	it("should render sliders when model supports thinking", () => {
		render(<ThinkingBudget {...defaultProps} />)

		expect(screen.getAllByTestId("slider")).toHaveLength(1)
	})

	it("should cap thinking tokens at 80% of model max tokens", () => {
		const setApiConfigurationField = jest.fn()
		const modelInfoWithLowerMaxTokens: ModelInfo = {
			...mockModelInfo,
			maxTokens: 10000, // Lower max tokens
		}

		render(
			<ThinkingBudget
				{...defaultProps}
				modelInfo={modelInfoWithLowerMaxTokens}
				apiConfiguration={{ modelMaxThinkingTokens: 9000 }} // Value higher than 80% of new maxTokens
				setApiConfigurationField={setApiConfigurationField}
			/>,
		)

		// Effect should trigger and cap the value
		expect(setApiConfigurationField).toHaveBeenCalledWith("modelMaxThinkingTokens", 8000) // 80% of 10000
	})

	it("should use default thinking tokens if not provided in apiConfiguration", () => {
		render(<ThinkingBudget {...defaultProps} />)

		// Default is DEFAULT_MAX_THINKING_TOKENS if not provided in apiConfiguration
		const slider = screen.getByTestId("slider")
		expect(slider).toHaveValue("8192")
	})

	it("should use min thinking tokens of 1024", () => {
		render(<ThinkingBudget {...defaultProps} apiConfiguration={{ modelMaxTokens: 1000 }} />)

		const slider = screen.getByTestId("slider")
		expect(slider.getAttribute("min")).toBe("1024")
	})
})
