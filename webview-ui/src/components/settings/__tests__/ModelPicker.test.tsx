// cd webview-ui && npx jest src/components/settings/__tests__/ModelPicker.test.ts

import { screen, fireEvent, render } from "@testing-library/react"
import { act } from "react"
import { ModelPicker } from "../ModelPicker"
import { glamaDefaultModelInfo } from "../../../../../src/shared/api"

jest.mock("../../../context/ExtensionStateContext", () => ({
	useExtensionState: jest.fn(),
}))

class MockResizeObserver {
	observe() {}
	unobserve() {}
	disconnect() {}
}

global.ResizeObserver = MockResizeObserver

Element.prototype.scrollIntoView = jest.fn()

describe("ModelPicker", () => {
	const mockSetApiConfigurationField = jest.fn()

	const mockModels = {
		model1: { name: "Model 1", description: "Test model 1", ...glamaDefaultModelInfo },
		model2: { name: "Model 2", description: "Test model 2", ...glamaDefaultModelInfo },
	}
	const defaultProps = {
		apiConfiguration: {},
		defaultModelId: "model1",
		defaultModelInfo: glamaDefaultModelInfo,
		modelIdKey: "glamaModelId" as const,
		modelInfoKey: "glamaModelInfo" as const,
		serviceName: "Test Service",
		serviceUrl: "https://test.service",
		recommendedModel: "recommended-model",
		models: mockModels,
		setApiConfigurationField: mockSetApiConfigurationField,
	}

	beforeEach(() => {
		jest.clearAllMocks()
	})

	it("calls setApiConfigurationField when a model is selected", async () => {
		await act(async () => {
			render(<ModelPicker {...defaultProps} />)
		})

		await act(async () => {
			// Open the popover by clicking the button.
			const button = screen.getByRole("combobox")
			fireEvent.click(button)
		})

		// Wait for popover to open and animations to complete.
		await act(async () => {
			await new Promise((resolve) => setTimeout(resolve, 100))
		})

		await act(async () => {
			// Find and click the model item by its value.
			const modelItem = screen.getByTestId("model-input")
			fireEvent.input(modelItem, { target: { value: "model2" } })
		})

		// Verify the API config was updated.
		expect(mockSetApiConfigurationField).toHaveBeenCalledWith(defaultProps.modelIdKey, "model2")
		expect(mockSetApiConfigurationField).toHaveBeenCalledWith(defaultProps.modelInfoKey, mockModels.model2)
	})
})
