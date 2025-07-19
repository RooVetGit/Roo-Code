import React from "react"
import { render, screen, fireEvent } from "@testing-library/react"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { CommandPatternSelector } from "../CommandPatternSelector"
import { CommandPattern } from "../../../utils/commandPatterns"

// Mock react-i18next
vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string) => key,
	}),
	Trans: ({ i18nKey, components }: any) => {
		if (i18nKey === "chat:commandExecution.commandManagementDescription") {
			return (
				<span>
					Manage command permissions: Click ✓ to allow auto-execution, ✗ to deny execution. Patterns can be
					toggled on/off or removed from lists. {components.settingsLink}
				</span>
			)
		}
		return <span>{i18nKey}</span>
	},
}))

// Mock VSCodeLink
vi.mock("@vscode/webview-ui-toolkit/react", () => ({
	VSCodeLink: ({ children, onClick }: any) => (
		<a href="#" onClick={onClick}>
			{children || "View all settings"}
		</a>
	),
}))

// Mock StandardTooltip
vi.mock("../../ui/standard-tooltip", () => ({
	StandardTooltip: ({ children, content }: any) => (
		<div title={typeof content === "string" ? content : "tooltip"}>
			{children}
			{/* Render the content to make it testable */}
			<div style={{ display: "none" }}>{content}</div>
		</div>
	),
}))

// Mock window.postMessage
const mockPostMessage = vi.fn()
window.postMessage = mockPostMessage

describe("CommandPatternSelector", () => {
	const mockPatterns: CommandPattern[] = [
		{ pattern: "npm", description: "npm commands" },
		{ pattern: "npm install", description: "npm install commands" },
		{ pattern: "git", description: "git commands" },
	]

	const defaultProps = {
		patterns: mockPatterns,
		allowedCommands: ["npm"],
		deniedCommands: ["git"],
		onAllowPatternChange: vi.fn(),
		onDenyPatternChange: vi.fn(),
	}

	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("should render collapsed by default", () => {
		render(<CommandPatternSelector {...defaultProps} />)

		expect(screen.getByText("chat:commandExecution.manageCommands")).toBeInTheDocument()
		expect(screen.queryByText("npm commands")).not.toBeInTheDocument()
	})

	it("should expand when clicked", () => {
		render(<CommandPatternSelector {...defaultProps} />)

		const expandButton = screen.getByRole("button", { name: "chat:commandExecution.expandManagement" })
		fireEvent.click(expandButton)

		// Check for the patterns themselves
		expect(screen.getByText("npm")).toBeInTheDocument()
		expect(screen.getByText("npm install")).toBeInTheDocument()
		expect(screen.getByText("git")).toBeInTheDocument()

		// Check for the descriptions
		expect(screen.getByText("- npm commands")).toBeInTheDocument()
		expect(screen.getByText("- npm install commands")).toBeInTheDocument()
		expect(screen.getByText("- git commands")).toBeInTheDocument()
	})

	it("should collapse when clicked again", () => {
		render(<CommandPatternSelector {...defaultProps} />)

		const expandButton = screen.getByRole("button", { name: "chat:commandExecution.expandManagement" })
		fireEvent.click(expandButton)

		const collapseButton = screen.getByRole("button", { name: "chat:commandExecution.collapseManagement" })
		fireEvent.click(collapseButton)

		expect(screen.queryByText("npm commands")).not.toBeInTheDocument()
	})

	it("should show correct status for patterns", () => {
		render(<CommandPatternSelector {...defaultProps} />)

		const expandButton = screen.getByRole("button", { name: "chat:commandExecution.expandManagement" })
		fireEvent.click(expandButton)

		// Check that npm has allowed styling (green)
		const npmAllowButton = screen.getAllByRole("button", { name: "chat:commandExecution.removeFromAllowed" })[0]
		expect(npmAllowButton).toHaveClass("bg-green-500/20")

		// Check that git has denied styling (red)
		const gitDenyButton = screen.getAllByRole("button", { name: "chat:commandExecution.removeFromDenied" })[0]
		expect(gitDenyButton).toHaveClass("bg-red-500/20")
	})

	it("should call onAllowPatternChange when allow button is clicked", () => {
		render(<CommandPatternSelector {...defaultProps} />)

		const expandButton = screen.getByRole("button", { name: "chat:commandExecution.expandManagement" })
		fireEvent.click(expandButton)

		// Find all allow buttons with the "add to allowed" label
		const allowButtons = screen.getAllByRole("button", { name: "chat:commandExecution.addToAllowed" })

		// The second one should be for npm install (first is npm which is already allowed)
		fireEvent.click(allowButtons[0])

		expect(defaultProps.onAllowPatternChange).toHaveBeenCalledWith("npm install")
	})

	it("should call onDenyPatternChange when deny button is clicked", () => {
		render(<CommandPatternSelector {...defaultProps} />)

		const expandButton = screen.getByRole("button", { name: "chat:commandExecution.expandManagement" })
		fireEvent.click(expandButton)

		// Find all deny buttons with the "add to denied" label
		const denyButtons = screen.getAllByRole("button", { name: "chat:commandExecution.addToDenied" })

		// The second one should be for npm install (first is npm, third is git which is already denied)
		fireEvent.click(denyButtons[1])

		expect(defaultProps.onDenyPatternChange).toHaveBeenCalledWith("npm install")
	})

	it("should toggle allowed pattern when clicked", () => {
		render(<CommandPatternSelector {...defaultProps} />)

		const expandButton = screen.getByRole("button", { name: "chat:commandExecution.expandManagement" })
		fireEvent.click(expandButton)

		// Find the allow button for npm (which is already allowed)
		const npmAllowButton = screen.getAllByRole("button", { name: "chat:commandExecution.removeFromAllowed" })[0]
		fireEvent.click(npmAllowButton)

		expect(defaultProps.onAllowPatternChange).toHaveBeenCalledWith("npm")
	})

	it("should toggle denied pattern when clicked", () => {
		render(<CommandPatternSelector {...defaultProps} />)

		const expandButton = screen.getByRole("button", { name: "chat:commandExecution.expandManagement" })
		fireEvent.click(expandButton)

		// Find the deny button for git (which is already denied)
		const gitDenyButton = screen.getAllByRole("button", { name: "chat:commandExecution.removeFromDenied" })[0]
		fireEvent.click(gitDenyButton)

		expect(defaultProps.onDenyPatternChange).toHaveBeenCalledWith("git")
	})

	it("should have tooltip with settings link", () => {
		const { container } = render(<CommandPatternSelector {...defaultProps} />)

		// The info icon should have a tooltip
		const tooltipWrapper = container.querySelector('[title="tooltip"]')
		expect(tooltipWrapper).toBeTruthy()

		// The tooltip content includes a settings link (mocked as VSCodeLink)
		// It's rendered in a hidden div for testing purposes
		const settingsLink = container.querySelector('a[href="#"]')
		expect(settingsLink).toBeTruthy()
		expect(settingsLink?.textContent).toBe("View all settings")

		// Test that clicking the link posts the correct message
		if (settingsLink) {
			fireEvent.click(settingsLink)

			expect(mockPostMessage).toHaveBeenCalledWith(
				{
					type: "action",
					action: "settingsButtonClicked",
					values: { section: "autoApprove" },
				},
				"*",
			)
		}
	})

	it("should render with empty patterns", () => {
		render(<CommandPatternSelector {...defaultProps} patterns={[]} />)

		const expandButton = screen.getByRole("button", { name: "chat:commandExecution.expandManagement" })
		fireEvent.click(expandButton)

		// The expanded view should exist but be empty since there are no patterns
		const expandedContent = screen
			.getByRole("button", { name: "chat:commandExecution.collapseManagement" })
			.parentElement?.querySelector(".px-3.pb-3")
		expect(expandedContent).toBeInTheDocument()
		expect(expandedContent?.children.length).toBe(0)
	})

	it("should render patterns without descriptions", () => {
		const patternsWithoutDesc: CommandPattern[] = [{ pattern: "custom-command" }]

		render(<CommandPatternSelector {...defaultProps} patterns={patternsWithoutDesc} />)

		const expandButton = screen.getByRole("button", { name: "chat:commandExecution.expandManagement" })
		fireEvent.click(expandButton)

		expect(screen.getByText("custom-command")).toBeInTheDocument()
	})

	it("should always show info icon with tooltip", () => {
		const { container } = render(<CommandPatternSelector {...defaultProps} />)

		// Info icon should always be visible (not just when expanded)
		// Look for the Info icon which is wrapped in StandardTooltip
		const infoIcon = container.querySelector(".ml-1")
		expect(infoIcon).toBeTruthy()
	})

	it("should apply correct classes for chevron rotation", () => {
		const { container } = render(<CommandPatternSelector {...defaultProps} />)

		// Initially collapsed - chevron should be rotated
		let chevron = container.querySelector(".size-3.transition-transform")
		expect(chevron).toHaveClass("-rotate-90")

		// Click to expand
		const expandButton = screen.getByRole("button", { name: "chat:commandExecution.expandManagement" })
		fireEvent.click(expandButton)

		// When expanded - chevron should not be rotated
		chevron = container.querySelector(".size-3.transition-transform")
		expect(chevron).toHaveClass("rotate-0")
	})
})
