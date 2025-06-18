import React from "react"
import { render, screen } from "@testing-library/react"
import MarkdownBlock from "../MarkdownBlock"
import { vi } from "vitest"

vi.mock("@src/utils/vscode", () => ({
	vscode: {
		postMessage: vi.fn(),
	},
}))

vi.mock("@src/context/ExtensionStateContext", () => ({
	useExtensionState: () => ({
		theme: "dark",
	}),
}))

describe("MarkdownBlock", () => {
	it("should correctly handle URLs with trailing punctuation", async () => {
		const markdown = "Check out this link: https://example.com."
		render(<MarkdownBlock markdown={markdown} />)

		await (async () => {
			const linkElement = screen.getByRole("link")
			expect(linkElement).toHaveAttribute("href", "https://example.com")
			expect(linkElement.textContent).toBe("https://example.com.")
		})
	})
})
