import { render, screen, fireEvent, act } from "@testing-library/react"
import "@testing-library/jest-dom"
import CodeBlock from "../CodeBlock"

// Mock shiki
jest.mock("shiki", () => ({
	createHighlighter: jest.fn().mockImplementation(async () => ({
		codeToHtml: jest.fn().mockImplementation((code, options) => {
			const theme = options.theme === "github-light" ? "light" : "dark"
			return `<pre><code class="hljs language-${options.lang}">${code} [${theme}-theme]</code></pre>`
		}),
	})),
}))

// Mock clipboard utility
jest.mock("../../../utils/clipboard", () => ({
	useCopyToClipboard: () => ({
		showCopyFeedback: false,
		copyWithFeedback: jest.fn(),
	}),
}))

describe("CodeBlock", () => {
	const mockIntersectionObserver = jest.fn()
	const originalGetComputedStyle = window.getComputedStyle

	beforeEach(() => {
		// Mock scroll container
		const scrollContainer = document.createElement("div")
		scrollContainer.setAttribute("data-virtuoso-scroller", "true")
		document.body.appendChild(scrollContainer)

		// Mock IntersectionObserver
		window.IntersectionObserver = mockIntersectionObserver

		// Mock getComputedStyle
		window.getComputedStyle = jest.fn().mockImplementation((element) => ({
			...originalGetComputedStyle(element),
			getPropertyValue: () => "12px",
		}))
	})

	afterEach(() => {
		jest.clearAllMocks()
		const scrollContainer = document.querySelector('[data-virtuoso-scroller="true"]')
		if (scrollContainer) {
			document.body.removeChild(scrollContainer)
		}
		window.getComputedStyle = originalGetComputedStyle
	})

	it("renders basic syntax highlighting", async () => {
		const code = "const x = 1;\nconsole.log(x);"

		await act(async () => {
			render(<CodeBlock source={code} language="typescript" />)
		})

		expect(screen.getByText(/const x = 1/)).toBeInTheDocument()
	})

	it("handles theme switching", async () => {
		const code = "const x = 1;"

		await act(async () => {
			const { rerender } = render(<CodeBlock source={code} language="typescript" />)

			// Simulate light theme
			document.body.className = "light"
			rerender(<CodeBlock source={code} language="typescript" />)
		})

		expect(screen.getByText(/\[light-theme\]/)).toBeInTheDocument()

		await act(async () => {
			document.body.className = "dark"
			render(<CodeBlock source={code} language="typescript" />)
		})

		expect(screen.getByText(/\[dark-theme\]/)).toBeInTheDocument()
	})

	it("handles invalid language gracefully", async () => {
		const code = "some code"

		await act(async () => {
			render(<CodeBlock source={code} language="invalid-lang" />)
		})

		expect(screen.getByText(/some code/)).toBeInTheDocument()
	})

	it("handles WASM loading errors", async () => {
		const mockError = new Error("WASM load failed")
		const createHighlighter = require("shiki").createHighlighter
		createHighlighter.mockRejectedValueOnce(mockError)

		const code = "const x = 1;"
		const consoleSpy = jest.spyOn(console, "error").mockImplementation()

		await act(async () => {
			render(<CodeBlock source={code} language="typescript" />)
		})

		expect(consoleSpy).toHaveBeenCalledWith(
			"CodeBlock highlighting error:",
			mockError,
			"\nStack trace:",
			mockError.stack,
		)
		expect(screen.getByText(/const x = 1;/)).toBeInTheDocument()

		consoleSpy.mockRestore()
	})

	it("verifies CSP compliance with precompiled WASM", async () => {
		const code = "const x = 1;"
		const createHighlighter = require("shiki").createHighlighter

		await act(async () => {
			render(<CodeBlock source={code} language="typescript" />)
		})

		// Verify createHighlighter was called with themes/langs only (no dynamic WASM)
		expect(createHighlighter).toHaveBeenCalledWith({
			themes: ["github-dark", "github-light"],
			langs: ["typescript"],
		})
	})

	it("handles copy functionality", async () => {
		const code = "const x = 1;"
		const { container } = render(<CodeBlock source={code} language="typescript" />)

		// Simulate code block visibility
		const codeBlock = container.querySelector("[data-partially-visible]")
		if (codeBlock) {
			codeBlock.setAttribute("data-partially-visible", "true")
		}

		const copyButton = screen.getByTitle("Copy code")
		await act(async () => {
			fireEvent.click(copyButton)
		})
	})
})
