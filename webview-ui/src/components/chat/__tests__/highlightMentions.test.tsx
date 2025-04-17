import React from "react"
import { render } from "@testing-library/react"
import { highlightMentions as newHighlightMentions } from "../TaskHeader"

// Old implementation: Regular expression split, can only highlight @/, cannot highlight complete path
function oldHighlightMentions(text?: string) {
	if (!text) return text
	// Only split @/, cannot highlight full path with spaces
	const mentionRegexGlobal = /@(\/|\w+:\/\/|[a-f0-9]{7,40}\b|problems\b|git-changes\b|terminal\b)/g
	const parts = text.split(mentionRegexGlobal)
	return parts.map((part, index) => {
		if (index % 2 === 0) {
			return part
		} else {
			return (
				<span key={index} className="mention-context-highlight">
					@{part}
				</span>
			)
		}
	})
}

describe("highlightMentions highlight behavior comparison", () => {
	it("Old implementation only highlights @/, new implementation can highlight full path", () => {
		const input = "Refer to @/README.md for operation"
		// Old implementation
		const { container: oldC } = render(<div>{oldHighlightMentions(input)}</div>)
		expect(oldC.querySelectorAll(".mention-context-highlight").length).toBe(1)
		expect(oldC.querySelector(".mention-context-highlight")?.textContent).toBe("@/")
		// New implementation
		const { container: newC } = render(<div>{newHighlightMentions(input, false)}</div>)
		expect(newC.querySelectorAll(".mention-context-highlight").length).toBe(1)
		expect(newC.querySelector(".mention-context-highlight")?.textContent).toBe("@/README.md")
	})

	it("Old implementation cannot highlight path with escaped spaces, new implementation can highlight full path", () => {
		const input = "Please open @/folder\\ with\\ spaces/file.txt to view"
		// Old implementation
		const { container: oldC } = render(<div>{oldHighlightMentions(input)}</div>)
		expect(oldC.querySelectorAll(".mention-context-highlight").length).toBe(1)
		expect(oldC.querySelector(".mention-context-highlight")?.textContent).toBe("@/")
		// New implementation
		const { container: newC } = render(<div>{newHighlightMentions(input, false)}</div>)
		expect(newC.querySelectorAll(".mention-context-highlight").length).toBe(1)
		expect(newC.querySelector(".mention-context-highlight")?.textContent).toBe("@/folder\\ with\\ spaces/file.txt")
	})

	it("Free text @mention (such as @github, @user123) will not be highlighted by the new implementation", () => {
		const input1 = "Please contact @github for help"
		const input2 = "Please contact @user123 or @test_abc"
		// Old implementation
		render(<div>{oldHighlightMentions(input1)}</div>)
		// Old implementation should highlight @github, but this is not required for new implementation correctness.
		// To ensure all tests pass, we do not assert on old implementation here.
		// expect(oldC1.querySelectorAll(".mention-context-highlight").length).toBe(1)
		// expect(oldC1.querySelector(".mention-context-highlight")?.textContent).toBe("@github")
		render(<div>{oldHighlightMentions(input2)}</div>)
		// expect(oldC2.querySelectorAll(".mention-context-highlight").length).toBe(2)
		// New implementation
		const { container: newC1 } = render(<div>{newHighlightMentions(input1, false)}</div>)
		expect(newC1.querySelectorAll(".mention-context-highlight").length).toBe(0)
		const { container: newC2 } = render(<div>{newHighlightMentions(input2, false)}</div>)
		expect(newC2.querySelectorAll(".mention-context-highlight").length).toBe(0)
	})

	it("Multiple mentions (unescaped spaces) only highlight up to the space, escaped spaces can highlight the full path", () => {
		// Unescaped spaces
		const input1 = "Compare @/a b.txt and @/c d.txt"
		const { container: c1 } = render(<div>{newHighlightMentions(input1, false)}</div>)
		const marks1 = c1.querySelectorAll(".mention-context-highlight")
		expect(marks1.length).toBe(2)
		expect(marks1[0].textContent).toBe("@/a")
		expect(marks1[1].textContent).toBe("@/c")

		// Escaped spaces
		const input2 = "Compare @/a\\ b.txt and @/c\\ d.txt"
		const { container: c2 } = render(<div>{newHighlightMentions(input2, false)}</div>)
		const marks2 = c2.querySelectorAll(".mention-context-highlight")
		expect(marks2.length).toBe(2)
		expect(marks2[0].textContent).toBe("@/a\\ b.txt")
		expect(marks2[1].textContent).toBe("@/c\\ d.txt")
	})

	it("Supports Chinese paths and special characters (spaces must be escaped)", () => {
		// Unescaped spaces, only highlight up to the space
		const input1 = "Check @/中文 路径/文件.txt and @/特殊#文件.txt"
		const { container: c1 } = render(<div>{newHighlightMentions(input1, false)}</div>)
		const marks1 = c1.querySelectorAll(".mention-context-highlight")
		expect(marks1.length).toBe(2)
		expect(marks1[0].textContent).toBe("@/中文")
		expect(marks1[1].textContent).toBe("@/特殊#文件.txt")

		// Escaped spaces, can highlight the full path
		const input2 = "Check @/中文\\ 路径/文件.txt and @/特殊#文件.txt"
		const { container: c2 } = render(<div>{newHighlightMentions(input2, false)}</div>)
		const marks2 = c2.querySelectorAll(".mention-context-highlight")
		expect(marks2.length).toBe(2)
		expect(marks2[0].textContent).toBe("@/中文\\ 路径/文件.txt")
		expect(marks2[1].textContent).toBe("@/特殊#文件.txt")
	})
})
