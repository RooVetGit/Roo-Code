import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { FileAttachment } from "../FileAttachment"

describe("FileAttachment", () => {
	const mockFiles = [
		{ path: "test.json", content: '{"test": true}', type: "json" },
		{ path: "readme.md", content: "# Test", type: "md" },
		{ path: "data.xml", content: "<root></root>", type: "xml" },
	]

	it("should not render when files array is empty", () => {
		const { container } = render(<FileAttachment files={[]} setFiles={vi.fn()} />)

		expect(container.firstChild).toBeNull()
	})

	it("should render all files", () => {
		render(<FileAttachment files={mockFiles} setFiles={vi.fn()} />)

		expect(screen.getByText("test.json")).toBeInTheDocument()
		expect(screen.getByText("readme.md")).toBeInTheDocument()
		expect(screen.getByText("data.xml")).toBeInTheDocument()
	})

	it("should display correct icons for file types", () => {
		const { container } = render(<FileAttachment files={mockFiles} setFiles={vi.fn()} />)

		expect(container.querySelector(".codicon-file-code")).toBeInTheDocument() // json
		expect(container.querySelector(".codicon-file-markdown")).toBeInTheDocument() // md
	})

	it("should call setFiles when remove button is clicked", () => {
		const mockSetFiles = vi.fn()
		const { container } = render(<FileAttachment files={mockFiles} setFiles={mockSetFiles} />)

		// Click remove button on the first file
		const removeButtons = container.querySelectorAll("vscode-button")
		fireEvent.click(removeButtons[0])

		expect(mockSetFiles).toHaveBeenCalledWith([
			{ path: "readme.md", content: "# Test", type: "md" },
			{ path: "data.xml", content: "<root></root>", type: "xml" },
		])
	})

	it("should apply custom className and style", () => {
		const { container } = render(
			<FileAttachment
				files={mockFiles}
				setFiles={vi.fn()}
				className="custom-class"
				style={{ marginTop: "10px" }}
			/>,
		)

		const wrapper = container.firstChild as HTMLElement
		expect(wrapper).toHaveClass("custom-class")
		expect(wrapper).toHaveStyle({ marginTop: "10px" })
	})

	it("should handle unknown file types with default icon", () => {
		const unknownFile = [{ path: "unknown.xyz", content: "data", type: "xyz" }]
		const { container } = render(<FileAttachment files={unknownFile} setFiles={vi.fn()} />)

		expect(container.querySelector(".codicon-file-text")).toBeInTheDocument()
	})
})
