import React from "react"
import { render, screen } from "@testing-library/react"
import { MaxOutputTokensControl } from "./MaxOutputTokensControl"
import { ApiConfiguration, ModelInfo } from "@roo/shared/api"

// Mock ResizeObserver globally
global.ResizeObserver = jest.fn().mockImplementation(() => ({
	observe: jest.fn(),
	unobserve: jest.fn(),
	disconnect: jest.fn(),
}))
// Static import of Slider removed again to avoid TS error for non-existent module

// Mock i18n
jest.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string) => key,
	}),
}))

// Use jest.doMock with { virtual: true } to mock a non-existent module.
// This mock factory will be used when '../Slider' is imported.
jest.mock("../ui/slider", () => ({
	__esModule: true,
	Slider: jest.fn((props) => <div data-testid="mock-slider" {...props} />),
}))

// Import the mocked Slider *after* jest.mock
// We need to refer to it for assertions and clearing.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const MockedSlider = require("../ui/slider").Slider as jest.Mock

describe("MaxOutputTokensControl", () => {
	const mockSetApiConfigurationField = jest.fn()
	const mockApiConfiguration: ApiConfiguration = {
		apiProvider: "openai",
		openAiModelId: "test-model",
		modelTemperature: 0.5,
		modelMaxTokens: undefined,
		modelMaxThinkingTokens: undefined,
	}

	beforeEach(() => {
		mockSetApiConfigurationField.mockClear()
		MockedSlider.mockClear()
	})

	it("should render when modelInfo.maxTokens is a positive number", () => {
		const modelInfo: Partial<ModelInfo> = {
			maxTokens: 16000,
			// Add other potentially accessed properties if needed by the component, even if undefined
		}

		render(
			<MaxOutputTokensControl
				modelInfo={modelInfo as ModelInfo}
				apiConfiguration={mockApiConfiguration}
				setApiConfigurationField={mockSetApiConfigurationField}
			/>,
		)

		expect(screen.getByTestId("max-output-tokens-control")).toBeInTheDocument()
	})

	it("should display the current value and label", () => {
		const modelInfo: Partial<ModelInfo> = {
			maxTokens: 16000,
		}
		const apiConfigurationWithOverride: ApiConfiguration = {
			...mockApiConfiguration,
			modelMaxTokens: 10000, // Override the default maxTokens
		}

		render(
			<MaxOutputTokensControl
				modelInfo={modelInfo as ModelInfo}
				apiConfiguration={apiConfigurationWithOverride}
				setApiConfigurationField={mockSetApiConfigurationField}
			/>,
		)

		// Calculate the expected displayed value
		const expectedValue = apiConfigurationWithOverride.modelMaxTokens ?? modelInfo.maxTokens!

		// Assert that the current value is displayed
		expect(screen.getByText(expectedValue.toString())).toBeInTheDocument()

		// Assert that the label is displayed (using the mocked translation key)
		expect(screen.getByText("providers.customModel.maxTokens.label")).toBeInTheDocument()
	})

	// Make the test async to use dynamic import
	it("should pass min={8192} to the Slider component when rendered", async () => {
		// Dynamically import Slider; it will be the mocked version due to jest.doMock
		// Note: For this to work, the test function must be async and you await the import.
		// However, for prop checking on a mock function, we can directly use the
		// mockSliderImplementation defined in the jest.doMock scope.
		// No need for dynamic import if we directly use the mock function instance.

		const modelInfo: Partial<ModelInfo> = {
			maxTokens: 16000, // A positive number to ensure rendering
		}

		render(
			<MaxOutputTokensControl
				modelInfo={modelInfo as ModelInfo}
				apiConfiguration={mockApiConfiguration}
				setApiConfigurationField={mockSetApiConfigurationField}
			/>,
		)

		// First, ensure the main control is rendered
		expect(screen.getByTestId("max-output-tokens-control")).toBeInTheDocument()

		// Assert that the mockSliderImplementation (which is what Slider becomes)
		// was called with the correct 'min' prop.
		// This test is expected to fail because Slider is not yet used or not with this prop.
		expect(MockedSlider).toHaveBeenCalledWith(
			expect.objectContaining({
				min: 8192,
			}),
			expect.anything(), // Context for React components
		)
	})

	it("should pass max={modelInfo.maxTokens!} to the Slider component when rendered", () => {
		const modelInfo: Partial<ModelInfo> = {
			maxTokens: 32000, // A positive number to ensure rendering
		}

		render(
			<MaxOutputTokensControl
				modelInfo={modelInfo as ModelInfo}
				apiConfiguration={mockApiConfiguration}
				setApiConfigurationField={mockSetApiConfigurationField}
			/>,
		)

		// First, ensure the main control is rendered
		expect(screen.getByTestId("max-output-tokens-control")).toBeInTheDocument()

		// Assert that the MockedSlider was called with the correct 'max' prop.
		expect(MockedSlider).toHaveBeenCalledWith(
			expect.objectContaining({
				max: modelInfo.maxTokens,
			}),
			expect.anything(), // Context for React components
		)
	})

	it("should pass step={1024} to the Slider component when rendered", () => {
		const modelInfo: Partial<ModelInfo> = {
			maxTokens: 16000, // A positive number to ensure rendering
		}

		render(
			<MaxOutputTokensControl
				modelInfo={modelInfo as ModelInfo}
				apiConfiguration={mockApiConfiguration}
				setApiConfigurationField={mockSetApiConfigurationField}
			/>,
		)

		// First, ensure the main control is rendered
		expect(screen.getByTestId("max-output-tokens-control")).toBeInTheDocument()

		// Assert that the MockedSlider was called with the correct 'step' prop.
		expect(MockedSlider).toHaveBeenCalledWith(
			expect.objectContaining({
				step: 1024,
			}),
			expect.anything(), // Context for React components
		)
	})

	describe("should pass the correct initial value to the Slider component", () => {
		it("when apiConfiguration.modelMaxTokens is defined", () => {
			const modelInfo: Partial<ModelInfo> = {
				maxTokens: 32000, // This should be ignored
			}
			const apiConfigurationWithOverride: ApiConfiguration = {
				...mockApiConfiguration,
				modelMaxTokens: 10000,
			}

			render(
				<MaxOutputTokensControl
					modelInfo={modelInfo as ModelInfo}
					apiConfiguration={apiConfigurationWithOverride}
					setApiConfigurationField={mockSetApiConfigurationField}
				/>,
			)

			expect(MockedSlider).toHaveBeenCalledWith(
				expect.objectContaining({
					value: [apiConfigurationWithOverride.modelMaxTokens],
				}),
				expect.anything(),
			)
		})

		it("when apiConfiguration.modelMaxTokens is undefined", () => {
			const modelInfo: Partial<ModelInfo> = {
				maxTokens: 16000, // This should be used
			}
			const apiConfigurationWithoutOverride: ApiConfiguration = {
				...mockApiConfiguration,
				modelMaxTokens: undefined,
			}

			render(
				<MaxOutputTokensControl
					modelInfo={modelInfo as ModelInfo}
					apiConfiguration={apiConfigurationWithoutOverride}
					setApiConfigurationField={mockSetApiConfigurationField}
				/>,
			)

			expect(MockedSlider).toHaveBeenCalledWith(
				expect.objectContaining({
					value: [modelInfo.maxTokens!],
				}),
				expect.anything(),
			)
		})

		it('should call setApiConfigurationField with "modelMaxTokens" and the new value when the slider value changes', () => {
			const modelInfo: Partial<ModelInfo> = {
				maxTokens: 32000, // A positive number to ensure rendering
			}

			render(
				<MaxOutputTokensControl
					modelInfo={modelInfo as ModelInfo}
					apiConfiguration={mockApiConfiguration}
					setApiConfigurationField={mockSetApiConfigurationField}
				/>,
			)

			// Simulate a value change by calling the onValueChange prop of the mocked Slider
			// We need to access the props that the mocked component was called with.
			// MockedSlider.mock.calls[0][0] gives us the props of the first render call.
			const sliderProps = MockedSlider.mock.calls[0][0]
			const newValue = [20000]
			sliderProps.onValueChange(newValue)

			// Assert that setApiConfigurationField was called with the correct arguments
			expect(mockSetApiConfigurationField).toHaveBeenCalledWith("modelMaxTokens", newValue[0])
		})
	})

	describe("should not render when modelInfo.maxTokens is not a positive number", () => {
		const testCases = [
			{ name: "undefined", value: undefined },
			{ name: "null", value: null },
			{ name: "0", value: 0 },
		]

		it.each(testCases)("when maxTokens is $name ($value)", ({ value }) => {
			const modelInfo: Partial<ModelInfo> = {
				maxTokens: value as any, // Use 'as any' to allow null/undefined for testing
			}

			render(
				<MaxOutputTokensControl
					modelInfo={modelInfo as ModelInfo}
					apiConfiguration={mockApiConfiguration}
					setApiConfigurationField={mockSetApiConfigurationField}
				/>,
			)

			// Check that the component renders null or an empty fragment
			// by querying for the test ID and expecting it not to be there.
			expect(screen.queryByTestId("max-output-tokens-control")).not.toBeInTheDocument()
			// Alternatively, if the component renders null, its container might be empty or contain minimal structure.
			// For a component that should render absolutely nothing, its direct container might be empty.
			// However, queryByTestId is more robust for checking absence.
		})
	})
})
