import { describe, test, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { MaxTokensControl } from "../MaxTokensControl"
import { ModelInfo } from "@roo-code/types"

// Mock the translation hook
vi.mock("@/i18n/TranslationContext", () => ({
	useAppTranslation: () => ({
		t: (key: string, params?: any) => {
			if (params) {
				return key.replace(/\{\{(\w+)\}\}/g, (_, p) => params[p])
			}
			return key
		},
	}),
}))

describe("MaxTokensControl", () => {
	const mockOnChange = vi.fn()
	const defaultProps = {
		onChange: mockOnChange,
	}

	beforeEach(() => {
		mockOnChange.mockClear()
	})

	test("should render with empty value when no value provided", () => {
		render(<MaxTokensControl {...defaultProps} />)

		const input = screen.getByRole("spinbutton") as HTMLInputElement
		expect(input.value).toBe("")
	})

	test("should apply default value on blur when field is empty", () => {
		render(<MaxTokensControl {...defaultProps} />)

		const input = screen.getByRole("spinbutton") as HTMLInputElement
		expect(input.value).toBe("")

		// Blur the empty input
		fireEvent.blur(input)

		// Should now show default value
		expect(input.value).toBe("8192")
		expect(mockOnChange).toHaveBeenCalledWith(8192)
	})

	test("should apply model's max tokens as default on blur when available", () => {
		const modelInfo: ModelInfo = {
			maxTokens: 16000,
			contextWindow: 100000,
			supportsPromptCache: true,
		}

		render(<MaxTokensControl {...defaultProps} modelInfo={modelInfo} />)

		const input = screen.getByRole("spinbutton") as HTMLInputElement
		fireEvent.blur(input)

		expect(input.value).toBe("16000")
		expect(mockOnChange).toHaveBeenCalledWith(16000)
	})

	test("should render with provided value", () => {
		render(<MaxTokensControl {...defaultProps} value={16000} />)

		const input = screen.getByRole("spinbutton") as HTMLInputElement
		expect(input.value).toBe("16000")
	})

	test("should call onChange when value changes", () => {
		render(<MaxTokensControl {...defaultProps} />)

		const input = screen.getByRole("spinbutton")
		fireEvent.change(input, { target: { value: "20000" } })

		expect(mockOnChange).toHaveBeenCalledWith(20000)
	})

	test("should call onChange with undefined when input is cleared and allow empty state", () => {
		render(<MaxTokensControl {...defaultProps} value={16000} />)

		const input = screen.getByRole("spinbutton") as HTMLInputElement
		fireEvent.change(input, { target: { value: "" } })

		expect(mockOnChange).toHaveBeenCalledWith(undefined)
		expect(input.value).toBe("") // Should remain empty until blur
	})

	test("should not show validation error for empty field", () => {
		render(<MaxTokensControl {...defaultProps} />)

		const input = screen.getByRole("spinbutton")
		fireEvent.change(input, { target: { value: "" } })

		// Should not show "too low" error for empty field
		expect(screen.queryByText("settings:providers.maxOutputTokens.validation.tooLow")).not.toBeInTheDocument()
	})

	test("should show validation error when value exceeds model max", () => {
		const modelInfo: ModelInfo = {
			maxTokens: 10000,
			contextWindow: 100000,
			supportsPromptCache: true,
		}

		render(<MaxTokensControl {...defaultProps} value={15000} modelInfo={modelInfo} />)

		expect(screen.getByText("settings:providers.maxOutputTokens.validation.tooHigh")).toBeInTheDocument()
	})

	test("should show validation error when value is below minimum", () => {
		render(<MaxTokensControl {...defaultProps} value={500} minValue={2048} />)

		expect(screen.getByText("settings:providers.maxOutputTokens.validation.tooLow")).toBeInTheDocument()
	})

	test("should show model support message when valid and not empty", () => {
		const modelInfo: ModelInfo = {
			maxTokens: 64000,
			contextWindow: 200000,
			supportsPromptCache: true,
		}

		render(<MaxTokensControl {...defaultProps} value={8192} modelInfo={modelInfo} />)

		expect(screen.getByText("settings:providers.maxOutputTokens.modelSupports")).toBeInTheDocument()
	})

	test("should not show model support message when field is empty", () => {
		const modelInfo: ModelInfo = {
			maxTokens: 64000,
			contextWindow: 200000,
			supportsPromptCache: true,
		}

		render(<MaxTokensControl {...defaultProps} modelInfo={modelInfo} />)

		// Empty field should not show model support message
		expect(screen.queryByText("settings:providers.maxOutputTokens.modelSupports")).not.toBeInTheDocument()
	})

	test("should use custom min and max values", () => {
		render(<MaxTokensControl {...defaultProps} minValue={2000} maxValue={50000} />)

		const input = screen.getByRole("spinbutton") as HTMLInputElement
		expect(input.min).toBe("2000")
		expect(input.max).toBe("50000")
	})

	test("should use model's maxTokens as max value when available", () => {
		const modelInfo: ModelInfo = {
			maxTokens: 32000,
			contextWindow: 100000,
			supportsPromptCache: true,
		}

		render(<MaxTokensControl {...defaultProps} modelInfo={modelInfo} />)

		const input = screen.getByRole("spinbutton") as HTMLInputElement
		expect(input.max).toBe("32000")
	})

	test("should apply error styling when validation fails", () => {
		render(<MaxTokensControl {...defaultProps} value={500} minValue={2048} />)

		const input = screen.getByRole("spinbutton")
		expect(input.className).toContain("border-red-500")
	})
})
