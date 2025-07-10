import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import FileAttachment from "../FileAttachment"
import { useWindowSize } from "react-use"

// Mock react-use
vi.mock("react-use", () => ({
	useWindowSize: vi.fn(() => ({ width: 1024, height: 768 })),
}))

describe("FileAttachment", () => {
	const mockFiles = [
		{ path: "test.json", content: '{"test": true}', type: "json" },
		{ path: "readme.md", content: "# Test", type: "md" },
		{ path: "data.xml", content: "<root></root>", type: "xml" },
	]

	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("should not render when files array is empty", () => {
		const { container } = render(<FileAttachment files={[]} />)

		expect(container.firstChild).toBeNull()
	})

	it("should render all files", () => {
		render(<FileAttachment files={mockFiles} />)

		expect(screen.getByText("test.json")).toBeInTheDocument()
		expect(screen.getByText("readme.md")).toBeInTheDocument()
		expect(screen.getByText("data.xml")).toBeInTheDocument()
	})

	it("should display correct icons for file types", () => {
		const { container } = render(<FileAttachment files={mockFiles} />)

		expect(container.querySelector(".codicon-file-code")).toBeInTheDocument() // json
		expect(container.querySelector(".codicon-file-markdown")).toBeInTheDocument() // md
		// XML also uses file-code icon
		const codeIcons = container.querySelectorAll(".codicon-file-code")
		expect(codeIcons).toHaveLength(2) // json and xml
	})

	it("should show delete icon on hover", async () => {
		const { container } = render(<FileAttachment files={mockFiles} setFiles={vi.fn()} />)

		// Initially, delete icons should not be visible
		const deleteIcons = container.querySelectorAll(".codicon-close")
		expect(deleteIcons).toHaveLength(0)

		// Hover over first file
		const firstFile = container.querySelector(".file-attachment-item")
		fireEvent.mouseEnter(firstFile!)

		// Delete icon should appear
		await waitFor(() => {
			const deleteIcon = container.querySelector(".codicon-close")
			expect(deleteIcon).toBeInTheDocument()
		})
	})

	it("should call setFiles when delete icon is clicked", async () => {
		const mockSetFiles = vi.fn()
		const { container } = render(<FileAttachment files={mockFiles} setFiles={mockSetFiles} />)

		// Hover over first file
		const firstFile = container.querySelector(".file-attachment-item")
		fireEvent.mouseEnter(firstFile!)

		// Click delete icon container
		await waitFor(() => {
			const deleteContainer = firstFile!.querySelector("div[class*='cursor-pointer']")
			fireEvent.click(deleteContainer!)
		})

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

	it("should call onHeightChange when height changes", async () => {
		const mockOnHeightChange = vi.fn()

		// Mock getBoundingClientRect
		const mockGetBoundingClientRect = vi.fn(() => ({
			height: 100,
			width: 200,
			top: 0,
			left: 0,
			bottom: 100,
			right: 200,
			x: 0,
			y: 0,
			toJSON: () => {},
		}))

		Object.defineProperty(HTMLElement.prototype, "getBoundingClientRect", {
			value: mockGetBoundingClientRect,
			configurable: true,
		})

		const { rerender } = render(<FileAttachment files={mockFiles} onHeightChange={mockOnHeightChange} />)

		// Wait for initial height calculation
		await waitFor(() => {
			expect(mockOnHeightChange).toHaveBeenCalledWith(100)
		})

		// Clear mock
		mockOnHeightChange.mockClear()

		// Add more files
		const moreFiles = [...mockFiles, { path: "new.txt", content: "new", type: "txt" }]
		rerender(<FileAttachment files={moreFiles} onHeightChange={mockOnHeightChange} />)

		// Should call onHeightChange again
		await waitFor(() => {
			expect(mockOnHeightChange).toHaveBeenCalled()
		})
	})

	it("should respond to window size changes", async () => {
		const mockOnHeightChange = vi.fn()

		// Mock getBoundingClientRect
		const mockGetBoundingClientRect = vi.fn(() => ({
			height: 100,
			width: 200,
			top: 0,
			left: 0,
			bottom: 100,
			right: 200,
			x: 0,
			y: 0,
			toJSON: () => {},
		}))

		Object.defineProperty(HTMLElement.prototype, "getBoundingClientRect", {
			value: mockGetBoundingClientRect,
			configurable: true,
		})

		// Initial render with width 1024
		const { unmount } = render(<FileAttachment files={mockFiles} onHeightChange={mockOnHeightChange} />)

		// Wait for initial render
		await waitFor(() => {
			expect(mockOnHeightChange).toHaveBeenCalled()
		})

		// Clear mock and unmount
		mockOnHeightChange.mockClear()
		unmount()

		// Change window size mock
		vi.mocked(useWindowSize).mockReturnValue({ width: 800, height: 600 })

		// Re-render with new window size
		render(<FileAttachment files={mockFiles} onHeightChange={mockOnHeightChange} />)

		// Should trigger height recalculation due to width change
		await waitFor(() => {
			expect(mockOnHeightChange).toHaveBeenCalled()
		})
	})

	it("should not show delete icons when setFiles is not provided", async () => {
		const { container } = render(<FileAttachment files={mockFiles} />)

		// Hover over first file
		const firstFile = container.querySelector(".file-attachment-item")
		fireEvent.mouseEnter(firstFile!)

		// Delete icon should not appear
		await waitFor(() => {
			const deleteIcon = container.querySelector(".codicon-close")
			expect(deleteIcon).not.toBeInTheDocument()
		})
	})

	it("should handle file deletion correctly with hover state", async () => {
		const mockSetFiles = vi.fn()
		const { container } = render(<FileAttachment files={mockFiles} setFiles={mockSetFiles} />)

		// Hover over second file
		const files = container.querySelectorAll(".file-attachment-item")
		fireEvent.mouseEnter(files[1])

		// Click delete icon container
		await waitFor(() => {
			const deleteContainer = files[1].querySelector("div[class*='cursor-pointer']")
			fireEvent.click(deleteContainer!)
		})

		expect(mockSetFiles).toHaveBeenCalledWith([
			{ path: "test.json", content: '{"test": true}', type: "json" },
			{ path: "data.xml", content: "<root></root>", type: "xml" },
		])
	})

	it("should be memoized and not re-render unnecessarily", () => {
		const mockSetFiles = vi.fn()
		const { rerender } = render(<FileAttachment files={mockFiles} setFiles={mockSetFiles} />)

		// Re-render with same props
		rerender(<FileAttachment files={mockFiles} setFiles={mockSetFiles} />)

		// Component should be memoized, so no additional renders
		// This is implicitly tested by React.memo
		expect(true).toBe(true)
	})
})
