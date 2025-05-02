import React from "react"
import { screen } from "@testing-library/react"
import { TypeGroup } from "../TypeGroup"
import { renderWithProviders } from "@/test/test-utils"

describe("TypeGroup", () => {
	const mockItems = [
		{
			name: "Test Item 1",
			description: "Description 1",
			path: "test/path/1",
		},
		{
			name: "Test Item 2",
			description: "Description 2",
			path: "test/path/2",
		},
	]

	it("should render type header and items", () => {
		renderWithProviders(<TypeGroup type="mcp" items={mockItems} />)

		// Test using translation key with flexible text matching
		expect(screen.getByText((content, element) => element?.textContent === "MCP Servers")).toBeInTheDocument()

		// Check items using list roles and text content
		const items = screen.getAllByRole("listitem")
		expect(items[0]).toHaveTextContent("Test Item 1")
		expect(items[0]).toHaveTextContent("Description 1")
		expect(items[1]).toHaveTextContent("Test Item 2")
		expect(items[1]).toHaveTextContent("Description 2")
	})

	it("should format different types correctly", () => {
		const types = [
			{ input: "mode", expected: "Modes" },
			{ input: "mcp", expected: "MCP Servers" },
			{ input: "prompt", expected: "Prompts" },
			{ input: "package", expected: "Packages" },
			{ input: "custom", expected: "Customs" }, // Uses generic-type with capitalization
		]

		types.forEach(({ input, expected }) => {
			const { unmount } = renderWithProviders(<TypeGroup type={input} items={mockItems} />)
			expect(screen.getByText((content, element) => element?.textContent === expected)).toBeInTheDocument()
			unmount()
		})
	})

	it("should handle items without descriptions", () => {
		const itemsWithoutDesc = [{ name: "Test Item", path: "test/path" }]

		renderWithProviders(<TypeGroup type="test" items={itemsWithoutDesc} />)
		expect(screen.getByText("Test Item")).toBeInTheDocument()
	})

	it("should not render when items array is empty", () => {
		const { container } = renderWithProviders(<TypeGroup type="test" items={[]} />)
		expect(container).toBeEmptyDOMElement()
	})

	it("should not render when items is undefined", () => {
		const { container } = renderWithProviders(<TypeGroup type="test" items={undefined as any} />)
		expect(container).toBeEmptyDOMElement()
	})

	it("should apply custom className", () => {
		const customClass = "custom-test-class"
		renderWithProviders(<TypeGroup type="test" items={mockItems} className={customClass} />)

		const container = screen.getByRole("heading").parentElement
		expect(container).toHaveClass(customClass)
	})

	it("should render items in a numbered list", () => {
		renderWithProviders(<TypeGroup type="test" items={mockItems} />)

		const list = screen.getByRole("list")
		expect(list).toHaveClass("list-decimal")
		expect(list.children).toHaveLength(2)
	})

	it("should show path as title attribute", () => {
		renderWithProviders(<TypeGroup type="test" items={mockItems} />)

		const items = screen.getAllByRole("listitem")
		expect(items[0]).toHaveAttribute("title", "test/path/1")
		expect(items[1]).toHaveAttribute("title", "test/path/2")
	})
})
