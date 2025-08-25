import React from "react"
import { render, screen, fireEvent, waitFor } from "@/utils/test-utils"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { ErrorBanner } from "../ErrorBanner"

// Mock the clipboard utility
vi.mock("@src/utils/clipboard", () => ({
	useCopyToClipboard: () => ({
		copyWithFeedback: vi.fn().mockResolvedValue(true),
	}),
}))

describe("ErrorBanner", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("renders with title and default warning variant", () => {
		render(<ErrorBanner title="Test Warning" />)

		expect(screen.getByText("Test Warning")).toBeInTheDocument()
		const icon = document.querySelector(".codicon-warning")
		expect(icon).toBeInTheDocument()
	})

	it("renders with error variant", () => {
		render(<ErrorBanner title="Test Error" variant="error" />)

		expect(screen.getByText("Test Error")).toBeInTheDocument()
		const icon = document.querySelector(".codicon-error")
		expect(icon).toBeInTheDocument()
	})

	it("renders with info variant", () => {
		render(<ErrorBanner title="Test Info" variant="info" />)

		expect(screen.getByText("Test Info")).toBeInTheDocument()
		const icon = document.querySelector(".codicon-info")
		expect(icon).toBeInTheDocument()
	})

	it("uses custom icon when provided", () => {
		render(<ErrorBanner title="Custom Icon" icon="check" />)

		const icon = document.querySelector(".codicon-check")
		expect(icon).toBeInTheDocument()
	})

	it("does not show expand/collapse controls when no details provided", () => {
		render(<ErrorBanner title="No Details" />)

		const chevron = document.querySelector(".codicon-chevron-down")
		expect(chevron).not.toBeInTheDocument()

		const copyButton = screen.queryByLabelText("Copy details")
		expect(copyButton).not.toBeInTheDocument()
	})

	it("shows expand/collapse controls when details are provided", () => {
		render(<ErrorBanner title="With Details" details="Error details here" />)

		const chevron = document.querySelector(".codicon-chevron-down")
		expect(chevron).toBeInTheDocument()

		const copyButton = screen.getByLabelText("Copy details")
		expect(copyButton).toBeInTheDocument()
	})

	it("expands and collapses when clicked", () => {
		render(<ErrorBanner title="Expandable" details="Error details" />)

		// Initially collapsed
		expect(screen.queryByText("Error details")).not.toBeInTheDocument()
		expect(document.querySelector(".codicon-chevron-down")).toBeInTheDocument()

		// Click to expand
		const banner = screen.getByText("Expandable").parentElement?.parentElement
		fireEvent.click(banner!)

		// Should be expanded
		expect(screen.getByText("Error details")).toBeInTheDocument()
		expect(document.querySelector(".codicon-chevron-up")).toBeInTheDocument()

		// Click to collapse
		fireEvent.click(banner!)

		// Should be collapsed again
		expect(screen.queryByText("Error details")).not.toBeInTheDocument()
		expect(document.querySelector(".codicon-chevron-down")).toBeInTheDocument()
	})

	it("respects defaultExpanded prop", () => {
		render(<ErrorBanner title="Default Expanded" details="Error details" defaultExpanded={true} />)

		// Should be expanded by default
		expect(screen.getByText("Error details")).toBeInTheDocument()
		expect(document.querySelector(".codicon-chevron-up")).toBeInTheDocument()
	})

	it("copies details when copy button is clicked", async () => {
		const onCopy = vi.fn()
		render(<ErrorBanner title="Copy Test" details="Details to copy" onCopy={onCopy} />)

		const copyButton = screen.getByLabelText("Copy details")

		// Initially shows copy icon
		expect(copyButton.querySelector(".codicon-copy")).toBeInTheDocument()

		// Click copy button
		fireEvent.click(copyButton)

		// Should call onCopy callback
		await waitFor(() => {
			expect(onCopy).toHaveBeenCalled()
		})
	})

	it("shows copy success feedback", async () => {
		render(<ErrorBanner title="Copy Success" details="Details to copy" />)

		const copyButton = screen.getByLabelText("Copy details")

		// Initially shows copy icon
		expect(copyButton.querySelector(".codicon-copy")).toBeInTheDocument()

		// Click copy button
		fireEvent.click(copyButton)

		// Should show check icon briefly
		await waitFor(() => {
			expect(copyButton.querySelector(".codicon-check")).toBeInTheDocument()
		})
	})

	it("renders custom actions", () => {
		const customAction = <button data-testid="custom-action">Custom</button>
		render(<ErrorBanner title="With Actions" actions={customAction} />)

		expect(screen.getByTestId("custom-action")).toBeInTheDocument()
	})

	it("does not make banner clickable when no details", () => {
		const { container } = render(<ErrorBanner title="Not Clickable" />)

		const banner = container.querySelector('[style*="cursor"]')
		expect(banner).toHaveStyle({ cursor: "default" })
	})

	it("makes banner clickable when details are provided", () => {
		const { container } = render(<ErrorBanner title="Clickable" details="Some details" />)

		const banner = container.querySelector('[style*="cursor"]')
		expect(banner).toHaveStyle({ cursor: "pointer" })
	})

	it("applies correct colors based on variant", () => {
		const { rerender } = render(<ErrorBanner title="Color Test" variant="error" />)
		let icon = document.querySelector(".codicon-error")
		expect(icon).toHaveStyle({ color: "var(--vscode-errorForeground)" })

		rerender(<ErrorBanner title="Color Test" variant="warning" />)
		icon = document.querySelector(".codicon-warning")
		expect(icon).toHaveStyle({ color: "var(--vscode-editorWarning-foreground)" })

		rerender(<ErrorBanner title="Color Test" variant="info" />)
		icon = document.querySelector(".codicon-info")
		expect(icon).toHaveStyle({ color: "var(--vscode-charts-blue)" })
	})
})
