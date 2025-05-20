import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { ExpandableSection } from "../ExpandableSection"

// Mock ChevronDownIcon used in Accordion component
jest.mock("lucide-react", () => ({
	ChevronDownIcon: () => <div data-testid="chevron-icon" />,
}))

// Mock ResizeObserver
class MockResizeObserver {
	observe() {}
	unobserve() {}
	disconnect() {}
}

global.ResizeObserver = MockResizeObserver

describe("ExpandableSection", () => {
	it("renders with basic props", () => {
		render(
			<ExpandableSection title="Test Section">
				<div>Test Content</div>
			</ExpandableSection>,
		)

		expect(screen.getByText("Test Section")).toBeInTheDocument()
		// Content is hidden in accordion
		const content = screen.getByRole("region", { hidden: true })
		expect(content).toHaveAttribute("hidden")
	})

	it("applies custom className", () => {
		render(
			<ExpandableSection title="Test Section" className="custom-class">
				<div>Test Content</div>
			</ExpandableSection>,
		)

		const accordion = screen.getByTestId("chevron-icon").closest(".border-t-0")
		expect(accordion).toHaveClass("custom-class")
	})

	it("renders badge when provided", () => {
		render(
			<ExpandableSection title="Test Section" badge="123">
				<div>Test Content</div>
			</ExpandableSection>,
		)

		expect(screen.getByText("123")).toBeInTheDocument()
		expect(screen.getByText("123")).toHaveClass(
			"text-xs",
			"bg-vscode-badge-background",
			"text-vscode-badge-foreground",
		)
	})

	it("expands and collapses on click", async () => {
		const user = userEvent.setup()
		render(
			<ExpandableSection title="Test Section">
				<div>Test Content</div>
			</ExpandableSection>,
		)

		const trigger = screen.getByRole("button")
		const content = screen.getByRole("region", { hidden: true })

		// Initially hidden
		expect(content).toHaveAttribute("hidden")

		// Expand
		await user.click(trigger)
		expect(content).not.toHaveAttribute("hidden")

		// Collapse
		await user.click(trigger)
		expect(content).toHaveAttribute("hidden")
	})

	it("starts expanded when defaultExpanded is true", () => {
		render(
			<ExpandableSection title="Test Section" defaultExpanded={true}>
				<div>Test Content</div>
			</ExpandableSection>,
		)

		const content = screen.getByRole("region")
		expect(content).not.toHaveAttribute("hidden")
	})

	it("has correct accessibility attributes", () => {
		render(
			<ExpandableSection title="Test Section">
				<div>Test Content</div>
			</ExpandableSection>,
		)

		const trigger = screen.getByRole("button")
		const content = screen.getByRole("region", { hidden: true })

		expect(trigger).toHaveAttribute("id", "details-button")
		expect(trigger).toHaveAttribute("aria-controls", "details-content")
		expect(content).toHaveAttribute("id", "details-content")
		expect(content).toHaveAttribute("aria-labelledby", "details-button")
	})

	it("renders list icon", () => {
		render(
			<ExpandableSection title="Test Section">
				<div>Test Content</div>
			</ExpandableSection>,
		)

		const icon = screen.getByRole("button").querySelector(".codicon-list-unordered")
		expect(icon).toHaveClass("codicon", "codicon-list-unordered")
	})
})
