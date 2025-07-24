import React from "react"
import { render } from "@testing-library/react"
import { SearchHighlight, highlightText, SettingHighlightWrapper } from "../SearchHighlight"

describe("SearchHighlight", () => {
	describe("highlightText", () => {
		it("should return plain text when query is empty", () => {
			const result = highlightText("Hello World", "")
			expect(result).toBe("Hello World")
		})

		it("should return plain text when query is only spaces", () => {
			const result = highlightText("Hello World", "   ")
			expect(result).toBe("Hello World")
		})

		it("should highlight matching text case-insensitively", () => {
			const result = highlightText("Hello World", "world")

			expect(Array.isArray(result)).toBe(true)
			// The result is an array of strings and React elements
			const resultArray = result as Array<string | React.ReactElement>
			// Filter out empty strings from the result
			const nonEmptyResult = resultArray.filter((item) => (typeof item === "string" ? item !== "" : true))
			expect(nonEmptyResult).toHaveLength(2)
			expect(nonEmptyResult[0]).toBe("Hello ")
			expect((nonEmptyResult[1] as React.ReactElement).type).toBe("mark")
			expect((nonEmptyResult[1] as React.ReactElement).props.children).toBe("World")
		})

		it("should highlight multiple occurrences", () => {
			const result = highlightText("The test is a test", "test")

			expect(Array.isArray(result)).toBe(true)
			// The result is an array of strings and React elements
			const resultArray = result as Array<string | React.ReactElement>
			// Filter out empty strings from the result
			const nonEmptyResult = resultArray.filter((item) => (typeof item === "string" ? item !== "" : true))
			expect(nonEmptyResult).toHaveLength(4)
			expect(nonEmptyResult[0]).toBe("The ")
			expect((nonEmptyResult[1] as React.ReactElement).type).toBe("mark")
			expect((nonEmptyResult[1] as React.ReactElement).props.children).toBe("test")
			expect(nonEmptyResult[2]).toBe(" is a ")
			expect((nonEmptyResult[3] as React.ReactElement).type).toBe("mark")
			expect((nonEmptyResult[3] as React.ReactElement).props.children).toBe("test")
		})

		it("should handle case variations", () => {
			const result = highlightText("Test TEST test", "test")

			expect(Array.isArray(result)).toBe(true)
			// The result is an array of strings and React elements
			const resultArray = result as Array<string | React.ReactElement>
			// All variations should be highlighted
			const marks = resultArray.filter(
				(item): item is React.ReactElement =>
					typeof item === "object" && item !== null && "type" in item && item.type === "mark",
			)
			expect(marks).toHaveLength(3)
			expect(marks[0].props.children).toBe("Test")
			expect(marks[1].props.children).toBe("TEST")
			expect(marks[2].props.children).toBe("test")
		})

		it("should handle regex special characters without breaking", () => {
			// Test that regex special characters don't cause errors
			const result = highlightText("function test() { return true; }", "test()")

			expect(Array.isArray(result)).toBe(true)
			const resultArray = result as Array<string | React.ReactElement>
			const nonEmptyResult = resultArray.filter((item) => (typeof item === "string" ? item !== "" : true))

			// Should find and highlight "test()" literally, not as a regex pattern
			expect(nonEmptyResult).toHaveLength(3)
			expect((nonEmptyResult[1] as React.ReactElement).props.children).toBe("test()")
		})
	})

	describe("SearchHighlight component", () => {
		it("should render highlighted text", () => {
			const { container } = render(<SearchHighlight text="Hello World" searchQuery="world" />)

			const mark = container.querySelector("mark")
			expect(mark).toBeTruthy()
			expect(mark?.textContent).toBe("World")
			expect(mark?.className).toContain("bg-vscode-editor-findMatchHighlightBackground")
		})

		it("should apply custom className to span", () => {
			const { container } = render(
				<SearchHighlight text="Hello World" searchQuery="world" className="custom-class" />,
			)

			const span = container.querySelector("span")
			expect(span?.className).toBe("custom-class")
		})

		it("should render plain text when no match", () => {
			const { container } = render(<SearchHighlight text="Hello World" searchQuery="xyz" />)

			const mark = container.querySelector("mark")
			expect(mark).toBeFalsy()
			expect(container.textContent).toBe("Hello World")
		})
	})

	describe("SettingHighlightWrapper", () => {
		it("should render children without wrapper when no search query", () => {
			const { container } = render(
				<SettingHighlightWrapper settingId="test" searchQuery="" matches={[]}>
					<div>Test Content</div>
				</SettingHighlightWrapper>,
			)

			expect(container.querySelector(".relative")).toBeFalsy()
			expect(container.textContent).toBe("Test Content")
		})

		it("should render children without wrapper when not in matches", () => {
			const { container } = render(
				<SettingHighlightWrapper settingId="test" searchQuery="query" matches={[{ settingId: "other" }]}>
					<div>Test Content</div>
				</SettingHighlightWrapper>,
			)

			expect(container.querySelector(".relative")).toBeFalsy()
			expect(container.textContent).toBe("Test Content")
		})

		it("should render with highlight wrapper when in matches", () => {
			const { container } = render(
				<SettingHighlightWrapper settingId="test" searchQuery="query" matches={[{ settingId: "test" }]}>
					<div>Test Content</div>
				</SettingHighlightWrapper>,
			)

			const wrapper = container.querySelector(".relative")
			expect(wrapper).toBeTruthy()

			const highlightBar = container.querySelector(".absolute")
			expect(highlightBar).toBeTruthy()
			expect(highlightBar?.className).toContain("bg-vscode-editor-findMatchHighlightBackground")
			expect(highlightBar?.className).toContain("-left-2")
			expect(highlightBar?.className).toContain("w-1")

			expect(container.textContent).toBe("Test Content")
		})

		it("should handle multiple matches correctly", () => {
			const { container } = render(
				<SettingHighlightWrapper
					settingId="test2"
					searchQuery="query"
					matches={[{ settingId: "test1" }, { settingId: "test2" }, { settingId: "test3" }]}>
					<div>Test Content</div>
				</SettingHighlightWrapper>,
			)

			const wrapper = container.querySelector(".relative")
			expect(wrapper).toBeTruthy()
		})
	})
})
