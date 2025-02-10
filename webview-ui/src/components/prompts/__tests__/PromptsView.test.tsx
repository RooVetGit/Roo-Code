import { render, screen, fireEvent } from "@testing-library/react"
import PromptsView from "../PromptsView"
import { ExtensionStateContext } from "../../../context/ExtensionStateContext"
import { vscode } from "../../../utils/vscode"

// Mock vscode API
vi.mock("../../../utils/vscode", () => ({
	vscode: {
		postMessage: vi.fn(),
	},
}))

const mockExtensionState = {
	customModePrompts: {},
	listApiConfigMeta: [
		{ id: "config1", name: "Config 1" },
		{ id: "config2", name: "Config 2" },
	],
	enhancementApiConfigId: "",
	setEnhancementApiConfigId: vi.fn(),
	mode: "code",
	customInstructions: "Initial instructions",
	setCustomInstructions: vi.fn(),
}

const renderPromptsView = (props = {}) => {
	const mockOnDone = vi.fn()
	return render(
		<ExtensionStateContext.Provider value={{ ...mockExtensionState, ...props } as any}>
			<PromptsView onDone={mockOnDone} />
		</ExtensionStateContext.Provider>,
	)
}

describe("PromptsView", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("renders all mode tabs", () => {
		renderPromptsView()
		expect(screen.getByTestId("code-tab")).toBeInTheDocument()
		expect(screen.getByTestId("ask-tab")).toBeInTheDocument()
		expect(screen.getByTestId("architect-tab")).toBeInTheDocument()
	})

	it("highlights the correct tab when mode is 'ask'", () => {
		renderPromptsView({ mode: "ask" })

		// Get all mode tab buttons
		const codeModeTab = screen.getByTestId("code-tab")
		const askModeTab = screen.getByTestId("ask-tab")
		const architectModeTab = screen.getByTestId("architect-tab")

		// Check that only the 'ask' tab has the active state
		expect(codeModeTab).not.toHaveAttribute("data-active", "true")
		expect(askModeTab).toHaveAttribute("data-active", "true")
		expect(architectModeTab).not.toHaveAttribute("data-active", "true")
	})

	it("switches mode when a tab is clicked", () => {
		renderPromptsView()

		// Find the 'ask' mode tab and click it
		const askModeTab = screen.getByTestId("ask-tab")
		fireEvent.click(askModeTab)

		// Verify that vscode.postMessage was called with the correct mode
		expect(vscode.postMessage).toHaveBeenCalledWith({
			type: "mode",
			text: "ask",
		})
	})

	it("renders mode-specific custom instructions textarea", () => {
		renderPromptsView()

		// Check for the mode-specific custom instructions textarea
		const customInstructionsTextarea = screen.getByTestId("code-custom-instructions-textarea")
		expect(customInstructionsTextarea).toBeInTheDocument()
	})

	// todo: implement additional tests but need to restructure mocks to get the postMessage mock working 2025-02-10 13-41-53
	// it("handles prompt changes correctly", async () => {
	// 	renderPromptsView()

	// 	// Get the textarea
	// 	const textarea = await waitFor(() => screen.getByTestId("code-prompt-textarea"))
	// 	fireEvent.change(textarea, {
	// 		target: { value: "New prompt value" },
	// 	})

	// 	expect(vscode.postMessage).toHaveBeenCalledWith({
	// 		type: "updatePrompt",
	// 		promptMode: "code",
	// 		customPrompt: { roleDefinition: "New prompt value" },
	// 	})
	// })

	// it("resets role definition only for built-in modes", async () => {
	// 	const customMode = {
	// 		slug: "custom-mode",
	// 		name: "Custom Mode",
	// 		roleDefinition: "Custom role",
	// 		groups: [],
	// 	}

	// 	// Test with built-in mode (code)
	// 	const { unmount } = render(
	// 		<ExtensionStateContext.Provider
	// 			value={{ ...mockExtensionState, mode: "code", customModes: [customMode] } as any}>
	// 			<PromptsView onDone={jest.fn()} />
	// 		</ExtensionStateContext.Provider>,
	// 	)

	// 	// Find and click the role definition reset button
	// 	const resetButton = screen.getByTestId("role-definition-reset")
	// 	expect(resetButton).toBeInTheDocument()
	// 	await fireEvent.click(resetButton)

	// 	// Verify it only resets role definition
	// 	expect(vscode.postMessage).toHaveBeenCalledWith({
	// 		type: "updatePrompt",
	// 		promptMode: "code",
	// 		customPrompt: { roleDefinition: undefined },
	// 	})

	// 	// Cleanup before testing custom mode
	// 	unmount()

	// 	// Test with custom mode
	// 	render(
	// 		<ExtensionStateContext.Provider
	// 			value={{ ...mockExtensionState, mode: "custom-mode", customModes: [customMode] } as any}>
	// 			<PromptsView onDone={jest.fn()} />
	// 		</ExtensionStateContext.Provider>,
	// 	)

	// 	// Verify reset button is not present for custom mode
	// 	expect(screen.queryByTestId("role-definition-reset")).not.toBeInTheDocument()
	// })

	// it("handles API configuration selection", async () => {
	// 	renderPromptsView()

	// 	// Click the ENHANCE tab first to show the API config dropdown
	// 	const enhanceTab = screen.getByTestId("ENHANCE-tab")
	// 	fireEvent.click(enhanceTab)

	// 	// Wait for the ENHANCE tab click to take effect
	// 	const dropdown = await waitFor(() => screen.getByTestId("api-config-dropdown"))
	// 	fireEvent.change(dropdown, {
	// 		target: { value: "config1" },
	// 	})

	// 	expect(mockExtensionState.setEnhancementApiConfigId).toHaveBeenCalledWith("config1")
	// 	expect(vscode.postMessage).toHaveBeenCalledWith({
	// 		type: "enhancementApiConfigId",
	// 		text: "config1",
	// 	})
	// })

	// it("handles clearing custom instructions correctly", async () => {
	// 	const setCustomInstructions = vi.fn()
	// 	renderPromptsView({
	// 		...mockExtensionState,
	// 		customInstructions: "Initial instructions",
	// 		setCustomInstructions,
	// 	})

	// 	const textarea = screen.getByTestId("global-custom-instructions-textarea")
	// 	fireEvent.change(textarea, {
	// 		target: { value: "" },
	// 	})

	// 	expect(setCustomInstructions).toHaveBeenCalledWith(undefined)
	// 	expect(vscode.postMessage).toHaveBeenCalledWith({
	// 		type: "customInstructions",
	// 		text: undefined,
	// 	})
	// })
})
