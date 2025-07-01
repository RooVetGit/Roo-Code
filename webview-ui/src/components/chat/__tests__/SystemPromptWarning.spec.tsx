// npx vitest run src/components/chat/__tests__/SystemPromptWarning.spec.tsx

import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { SystemPromptWarning } from "../SystemPromptWarning"
import { useExtensionState } from "@/context/ExtensionStateContext"
import { useAppTranslation } from "@/i18n/TranslationContext"

// Mock the hooks
vi.mock("@/context/ExtensionStateContext")
vi.mock("@/i18n/TranslationContext")

const mockSetSystemPromptWarningDismissed = vi.fn()
const mockT = vi.fn((key: string) => {
	if (key === "chat:systemPromptWarning") {
		return "WARNING: Custom system prompt override active. This can severely break functionality and cause unpredictable behavior."
	}
	return key
})

describe("SystemPromptWarning", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		;(useExtensionState as any).mockReturnValue({
			setSystemPromptWarningDismissed: mockSetSystemPromptWarningDismissed,
		})
		;(useAppTranslation as any).mockReturnValue({
			t: mockT,
		})
	})

	it("renders the warning message", () => {
		render(<SystemPromptWarning />)

		expect(screen.getByText(/WARNING: Custom system prompt override active/)).toBeInTheDocument()
	})

	it("renders the warning icon", () => {
		render(<SystemPromptWarning />)

		const warningIcon = document.querySelector(".codicon-warning")
		expect(warningIcon).toBeInTheDocument()
	})

	it("renders the dismiss button", () => {
		render(<SystemPromptWarning />)

		const dismissButton = screen.getByRole("button")
		expect(dismissButton).toBeInTheDocument()
		expect(dismissButton).toHaveAttribute("title", "Dismiss warning")
	})

	it("renders the close icon in dismiss button", () => {
		render(<SystemPromptWarning />)

		const closeIcon = document.querySelector(".codicon-close")
		expect(closeIcon).toBeInTheDocument()
	})

	it("calls setSystemPromptWarningDismissed when dismiss button is clicked", () => {
		render(<SystemPromptWarning />)

		const dismissButton = screen.getByRole("button")
		fireEvent.click(dismissButton)

		expect(mockSetSystemPromptWarningDismissed).toHaveBeenCalledWith(true)
		expect(mockSetSystemPromptWarningDismissed).toHaveBeenCalledTimes(1)
	})

	it("has correct CSS classes for styling", () => {
		render(<SystemPromptWarning />)

		const container = document.querySelector(".flex.items-center.px-4.py-2.mb-2")
		expect(container).toBeInTheDocument()
		expect(container).toHaveClass("bg-vscode-editorWarning-foreground", "text-vscode-editor-background")
	})

	it("uses translation for the warning text", () => {
		render(<SystemPromptWarning />)

		expect(mockT).toHaveBeenCalledWith("chat:systemPromptWarning")
	})
})
