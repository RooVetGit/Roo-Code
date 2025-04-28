import React from "react"
import { render, screen, fireEvent } from "@testing-library/react"
import { ExpandableSection } from "../ExpandableSection"

describe("ExpandableSection", () => {
	const defaultProps = {
		title: "Test Section",
		children: <div>Test Content</div>,
	}

	it("should render with default state", () => {
		render(<ExpandableSection {...defaultProps} />)

		expect(screen.getByText("Test Section")).toBeInTheDocument()
		expect(screen.getByRole("button")).toHaveAttribute("aria-expanded", "false")

		const content = screen.getByRole("region")
		expect(content).toHaveClass("max-h-0")
		expect(content).toHaveClass("opacity-0")
	})

	it("should expand when clicked", () => {
		render(<ExpandableSection {...defaultProps} />)

		const button = screen.getByRole("button")
		fireEvent.click(button)

		expect(button).toHaveAttribute("aria-expanded", "true")

		const content = screen.getByRole("region")
		expect(content).toHaveClass("max-h-[500px]")
		expect(content).toHaveClass("opacity-100")
	})

	it("should render expanded by default when defaultExpanded is true", () => {
		render(<ExpandableSection {...defaultProps} defaultExpanded />)

		expect(screen.getByRole("button")).toHaveAttribute("aria-expanded", "true")

		const content = screen.getByRole("region")
		expect(content).toHaveClass("max-h-[500px]")
		expect(content).toHaveClass("opacity-100")
	})

	it("should toggle expansion state on button click", () => {
		render(<ExpandableSection {...defaultProps} />)

		const button = screen.getByRole("button")

		// Initial state
		expect(button).toHaveAttribute("aria-expanded", "false")

		// First click - expand
		fireEvent.click(button)
		expect(button).toHaveAttribute("aria-expanded", "true")

		// Second click - collapse
		fireEvent.click(button)
		expect(button).toHaveAttribute("aria-expanded", "false")
	})

	it("should apply custom className", () => {
		const customClass = "custom-test-class"
		render(<ExpandableSection {...defaultProps} className={customClass} />)

		const section = screen.getByRole("region").parentElement
		expect(section).toHaveClass(customClass)
	})

	it("should have proper accessibility attributes", () => {
		render(<ExpandableSection {...defaultProps} />)

		const button = screen.getByRole("button")
		const region = screen.getByRole("region")

		expect(button).toHaveAttribute("aria-expanded")
		expect(button).toHaveAttribute("aria-controls", "details-content")
		expect(region).toHaveAttribute("aria-labelledby", "details-button")
	})

	it("should render children content", () => {
		const testContent = "Special test content"
		render(
			<ExpandableSection title="Test">
				<div>{testContent}</div>
			</ExpandableSection>,
		)

		expect(screen.getByText(testContent)).toBeInTheDocument()
	})
})
