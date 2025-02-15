import { render, fireEvent, screen } from "@testing-library/react"
import { describe, it, expect, beforeEach, vi } from "vitest"
import ChatTextArea from "../ChatTextArea"
import { useExtensionState } from "../../../context/ExtensionStateContext"
import { vscode } from "../../../utils/vscode"
import { defaultModeSlug } from "../../../../../src/shared/modes"

// Mock modules
vi.mock("../../../utils/vscode", () => ({
	vscode: {
		postMessage: vi.fn(),
	},
}))
vi.mock("../../../components/common/CodeBlock")
vi.mock("../../../components/common/MarkdownBlock")
vi.mock("../../../context/ExtensionStateContext")

describe("ChatTextArea", () => {
	const defaultProps = {
		inputValue: "",
		setInputValue: vi.fn(),
		onSend: vi.fn(),
		textAreaDisabled: false,
		onSelectImages: vi.fn(),
		shouldDisableImages: false,
		placeholderText: "Type a message...",
		selectedImages: [],
		setSelectedImages: vi.fn(),
		onHeightChange: vi.fn(),
		mode: defaultModeSlug,
		setMode: vi.fn(),
	}

	beforeEach(() => {
		vi.clearAllMocks()
		// Default mock implementation for useExtensionState
		vi.mocked(useExtensionState).mockReturnValue({
			filePaths: [],
			openedTabs: [],
			apiConfiguration: {
				apiProvider: "anthropic",
			},
		})
	})

	describe("enhance prompt button", () => {
		it("should be disabled when textAreaDisabled is true", () => {
			vi.mocked(useExtensionState).mockReturnValue({
				filePaths: [],
				openedTabs: [],
			})

			render(<ChatTextArea {...defaultProps} textAreaDisabled={true} />)
			const enhanceButton = screen.getByRole("button", { name: /enhance prompt/i })
			expect(enhanceButton).toHaveClass("disabled")
		})
	})

	describe("handleEnhancePrompt", () => {
		it("should send message with correct configuration when clicked", () => {
			const apiConfiguration = {
				apiProvider: "openrouter",
				apiKey: "test-key",
			}

			vi.mocked(useExtensionState).mockReturnValue({
				filePaths: [],
				openedTabs: [],
				apiConfiguration,
			})

			render(<ChatTextArea {...defaultProps} inputValue="Test prompt" />)

			const enhanceButton = screen.getByRole("button", { name: /enhance prompt/i })
			fireEvent.click(enhanceButton)

			expect(vscode.postMessage).toHaveBeenCalledWith({
				type: "enhancePrompt",
				text: "Test prompt",
			})
		})

		it("should not send message when input is empty", () => {
			vi.mocked(useExtensionState).mockReturnValue({
				filePaths: [],
				openedTabs: [],
				apiConfiguration: {
					apiProvider: "openrouter",
				},
			})

			render(<ChatTextArea {...defaultProps} inputValue="" />)

			const enhanceButton = screen.getByRole("button", { name: /enhance prompt/i })
			fireEvent.click(enhanceButton)

			expect(vscode.postMessage).not.toHaveBeenCalled()
		})

		it("should show loading state while enhancing", () => {
			vi.mocked(useExtensionState).mockReturnValue({
				filePaths: [],
				openedTabs: [],
				apiConfiguration: {
					apiProvider: "openrouter",
				},
			})

			render(<ChatTextArea {...defaultProps} inputValue="Test prompt" />)

			const enhanceButton = screen.getByRole("button", { name: /enhance prompt/i })
			fireEvent.click(enhanceButton)

			const loadingSpinner = screen.getByText("", { selector: ".codicon-loading" })
			expect(loadingSpinner).toBeInTheDocument()
		})
	})

	describe("effect dependencies", () => {
		it("should update when apiConfiguration changes", () => {
			const { rerender } = render(<ChatTextArea {...defaultProps} />)

			// Update apiConfiguration
			vi.mocked(useExtensionState).mockReturnValue({
				filePaths: [],
				openedTabs: [],
				apiConfiguration: {
					apiProvider: "openrouter",
					newSetting: "test",
				},
			})

			rerender(<ChatTextArea {...defaultProps} />)

			// Verify the enhance button appears after apiConfiguration changes
			expect(screen.getByRole("button", { name: /enhance prompt/i })).toBeInTheDocument()
		})
	})

	describe("enhanced prompt response", () => {
		it("should update input value when receiving enhanced prompt", () => {
			const setInputValue = vi.fn()

			render(<ChatTextArea {...defaultProps} setInputValue={setInputValue} />)

			// Simulate receiving enhanced prompt message
			window.dispatchEvent(
				new MessageEvent("message", {
					data: {
						type: "enhancedPrompt",
						text: "Enhanced test prompt",
					},
				}),
			)

			expect(setInputValue).toHaveBeenCalledWith("Enhanced test prompt")
		})
	})
})
