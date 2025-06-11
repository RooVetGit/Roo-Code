// npx jest src/components/settings/__tests__/ThinkingBudget.test.tsx

import { render, screen, fireEvent } from "@testing-library/react"

import type { ModelInfo } from "@roo-code/types"

import { ThinkingBudget } from "../ThinkingBudget"

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
	Select: ({ children }: any) => <div data-testid="select">{children}</div>,
	SelectTrigger: ({ children }: any) => <div>{children}</div>,
	SelectValue: ({ placeholder }: any) => <div>{placeholder}</div>,
	SelectContent: ({ children }: any) => <div>{children}</div>,
	SelectItem: ({ children, value }: any) => <div data-value={value}>{children}</div>,
}))

jest.mock("vscrui", () => ({
	Checkbox: ({ children, checked, onChange }: any) => (
		<label>
			<input
				type="checkbox"
				data-testid="checkbox"
				checked={checked}
				onChange={(e) => onChange(e.target.checked)}
			/>
			{children}
		</label>
	),
}))

describe("ThinkingBudget", () => {
	const mockModelInfo: ModelInfo = {
		supportsReasoningBudget: true,
		requiredReasoningBudget: false,
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
					supportsReasoningBudget: false,
				}}
			/>,
		)

		expect(container.firstChild).toBeNull()
	})

	it("should render thinking budget slider when model supports reasoning budget", () => {
		render(<ThinkingBudget {...defaultProps} apiConfiguration={{ enableReasoningEffort: true }} />)

		// Should only have thinking tokens slider, not max output tokens
		expect(screen.getAllByTestId("slider")).toHaveLength(1)
		expect(screen.getByText("settings:thinkingBudget.maxThinkingTokens")).toBeInTheDocument()
	})

	it("should show checkbox when reasoning is not required", () => {
		render(<ThinkingBudget {...defaultProps} />)

		expect(screen.getByTestId("checkbox")).toBeInTheDocument()
		expect(screen.getByText("settings:providers.useReasoning")).toBeInTheDocument()
	})

	it("should not show checkbox when reasoning is required", () => {
		render(
			<ThinkingBudget
				{...defaultProps}
				modelInfo={{
					...mockModelInfo,
					requiredReasoningBudget: true,
				}}
			/>,
		)

		expect(screen.queryByTestId("checkbox")).not.toBeInTheDocument()
		// Should show slider directly
		expect(screen.getByTestId("slider")).toBeInTheDocument()
	})

	it("should update modelMaxThinkingTokens", () => {
		const setApiConfigurationField = jest.fn()

		render(
			<ThinkingBudget
				{...defaultProps}
				apiConfiguration={{ enableReasoningEffort: true, modelMaxThinkingTokens: 4096 }}
				setApiConfigurationField={setApiConfigurationField}
			/>,
		)

		const slider = screen.getByTestId("slider")
		fireEvent.change(slider, { target: { value: "5000" } })

		expect(setApiConfigurationField).toHaveBeenCalledWith("modelMaxThinkingTokens", 5000)
	})

	it("should cap thinking tokens at 80% of max output tokens", () => {
		const setApiConfigurationField = jest.fn()

		render(
			<ThinkingBudget
				{...defaultProps}
				apiConfiguration={{
					modelMaxTokens: 10000,
					modelMaxThinkingTokens: 9000,
					enableReasoningEffort: true,
				}}
				setApiConfigurationField={setApiConfigurationField}
			/>,
		)

		// Effect should trigger and cap the value
		expect(setApiConfigurationField).toHaveBeenCalledWith("modelMaxThinkingTokens", 8000) // 80% of 10000
	})

	it("should use default thinking tokens if not provided", () => {
		render(<ThinkingBudget {...defaultProps} apiConfiguration={{ enableReasoningEffort: true }} />)

		const slider = screen.getByTestId("slider")
		// Default is 8192, but capped at 80% of max output tokens (16384 * 0.8 = 13107.2, rounded down)
		// Since default max output tokens is 16384 and 8192 < 13107, it should be 8192
		expect(slider).toHaveValue("8192")
	})

	it("should render reasoning effort select for models that support it", () => {
		render(
			<ThinkingBudget
				{...defaultProps}
				modelInfo={{
					...mockModelInfo,
					supportsReasoningBudget: false,
					supportsReasoningEffort: true,
				}}
			/>,
		)

		expect(screen.getByTestId("select")).toBeInTheDocument()
		expect(screen.getByText("settings:providers.reasoningEffort.label")).toBeInTheDocument()
	})

	it("should toggle enableReasoningEffort checkbox", () => {
		const setApiConfigurationField = jest.fn()

		render(
			<ThinkingBudget
				{...defaultProps}
				apiConfiguration={{ enableReasoningEffort: false }}
				setApiConfigurationField={setApiConfigurationField}
			/>,
		)

		const checkbox = screen.getByTestId("checkbox")
		fireEvent.click(checkbox)

		expect(setApiConfigurationField).toHaveBeenCalledWith("enableReasoningEffort", true)
	})
})
