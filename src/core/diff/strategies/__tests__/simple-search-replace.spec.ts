import { describe, it, expect, beforeEach } from "vitest"
import { SimpleSearchReplaceDiffStrategy } from "../simple-search-replace"

describe("SimpleSearchReplaceDiffStrategy", () => {
	let strategy: SimpleSearchReplaceDiffStrategy

	beforeEach(() => {
		strategy = new SimpleSearchReplaceDiffStrategy()
	})

	describe("getName", () => {
		it("should return the correct strategy name", () => {
			expect(strategy.getName()).toBe("SimpleSearchReplace")
		})
	})

	describe("getToolDescription", () => {
		it("should return a simplified tool description", () => {
			const description = strategy.getToolDescription({ cwd: "/test/path" })
			expect(description).toContain("## apply_diff")
			expect(description).toContain("SEARCH:")
			expect(description).toContain("REPLACE:")
			expect(description).not.toContain("<<<<<<< SEARCH")
			expect(description).not.toContain(">>>>>>> REPLACE")
			expect(description).not.toContain(":start_line:")
		})
	})

	describe("applyDiff", () => {
		describe("basic functionality", () => {
			it("should apply a simple search and replace", async () => {
				const originalContent = `function hello() {
    console.log("Hello, world!")
}`
				const diffContent = `SEARCH:
function hello() {
    console.log("Hello, world!")
}
REPLACE:
function greet() {
    console.log("Greetings, universe!")
}`

				const result = await strategy.applyDiff(originalContent, diffContent)
				expect(result.success).toBe(true)
				if (result.success) {
					expect(result.content).toBe(`function greet() {
    console.log("Greetings, universe!")
}`)
				}
			})

			it("should handle multiple search/replace operations", async () => {
				const originalContent = `function add(a, b) {
    return a + b
}

function subtract(a, b) {
    return a - b
}`
				const diffContent = `SEARCH:
function add(a, b) {
    return a + b
}
REPLACE:
function sum(a, b) {
    return a + b
}

SEARCH:
function subtract(a, b) {
    return a - b
}
REPLACE:
function difference(a, b) {
    return a - b
}`

				const result = await strategy.applyDiff(originalContent, diffContent)
				expect(result.success).toBe(true)
				if (result.success) {
					expect(result.content).toBe(`function sum(a, b) {
    return a + b
}

function difference(a, b) {
    return a - b
}`)
				}
			})

			it("should preserve indentation", async () => {
				const originalContent = `class Calculator {
    add(a, b) {
        return a + b
    }
}`
				const diffContent = `SEARCH:
    add(a, b) {
        return a + b
    }
REPLACE:
    sum(a, b) {
        // Add two numbers
        return a + b
    }`

				const result = await strategy.applyDiff(originalContent, diffContent)
				expect(result.success).toBe(true)
				if (result.success) {
					expect(result.content).toBe(`class Calculator {
    sum(a, b) {
        // Add two numbers
        return a + b
    }
}`)
				}
			})
		})

		describe("error handling", () => {
			it("should fail when search content is not found", async () => {
				const originalContent = `function hello() {
    console.log("Hello")
}`
				const diffContent = `SEARCH:
function goodbye() {
    console.log("Goodbye")
}
REPLACE:
function farewell() {
    console.log("Farewell")
}`

				const result = await strategy.applyDiff(originalContent, diffContent)
				expect(result.success).toBe(false)
				if (!result.success) {
					expect(result.failParts).toBeDefined()
					if (result.failParts && result.failParts[0] && !result.failParts[0].success) {
						expect(result.failParts[0].error).toContain("No sufficiently similar match found")
					}
				}
			})

			it("should fail when search and replace content are identical", async () => {
				const originalContent = `function hello() {
    console.log("Hello")
}`
				const diffContent = `SEARCH:
function hello() {
    console.log("Hello")
}
REPLACE:
function hello() {
    console.log("Hello")
}`

				const result = await strategy.applyDiff(originalContent, diffContent)
				expect(result.success).toBe(false)
				if (!result.success) {
					expect(result.failParts).toBeDefined()
					if (result.failParts && result.failParts[0] && !result.failParts[0].success) {
						expect(result.failParts[0].error).toContain("Search and replace content are identical")
					}
				}
			})

			it("should fail when no valid operations are found", async () => {
				const originalContent = `function hello() {
    console.log("Hello")
}`
				const diffContent = `This is not a valid diff format`

				const result = await strategy.applyDiff(originalContent, diffContent)
				expect(result.success).toBe(false)
				if (!result.success) {
					expect(result.error).toContain("No valid SEARCH/REPLACE operations found")
				}
			})

			it("should handle empty search content", async () => {
				const originalContent = `function hello() {
    console.log("Hello")
}`
				const diffContent = `SEARCH:

REPLACE:
function goodbye() {
    console.log("Goodbye")
}`

				const result = await strategy.applyDiff(originalContent, diffContent)
				expect(result.success).toBe(false)
				if (!result.success) {
					expect(result.failParts).toBeDefined()
					if (result.failParts && result.failParts[0] && !result.failParts[0].success) {
						expect(result.failParts[0].error).toContain("Empty search content is not allowed")
					}
				}
			})
		})

		describe("fuzzy matching", () => {
			beforeEach(() => {
				strategy = new SimpleSearchReplaceDiffStrategy(0.9) // 90% similarity threshold
			})

			it("should match content with minor differences", async () => {
				const originalContent = `function hello() {
				console.log("Hello, world!")
}`
				const diffContent = `SEARCH:
function hello() {
				console.log("Hello, world!")
}
REPLACE:
function greet() {
				console.log("Greetings!")
}`

				const result = await strategy.applyDiff(originalContent, diffContent)
				expect(result.success).toBe(true)
				if (result.success) {
					expect(result.content).toContain("function greet()")
				}
			})
		})

		describe("line number stripping", () => {
			it("should strip line numbers from search and replace content", async () => {
				const originalContent = `function hello() {
    console.log("Hello")
}`
				const diffContent = `SEARCH:
1 | function hello() {
2 |     console.log("Hello")
3 | }
REPLACE:
1 | function greet() {
2 |     console.log("Greetings")
3 | }`

				const result = await strategy.applyDiff(originalContent, diffContent)
				expect(result.success).toBe(true)
				if (result.success) {
					expect(result.content).toBe(`function greet() {
    console.log("Greetings")
}`)
				}
			})
		})
	})

	describe("getProgressStatus", () => {
		it("should return progress status for partial tool use", () => {
			const toolUse = {
				type: "tool_use" as const,
				name: "apply_diff" as const,
				params: {
					diff: `SEARCH:
old content
REPLACE:
new content

SEARCH:
another old
REPLACE:
another new`,
				},
				partial: true,
			}

			const status = strategy.getProgressStatus(toolUse)
			expect(status).toBeDefined()
			if (status.icon) {
				expect(status.icon).toBe("diff-multiple")
			}
			if (status.text) {
				expect(status.text).toBe("2")
			}
		})

		it("should return progress status with failures", () => {
			const toolUse = {
				type: "tool_use" as const,
				name: "apply_diff" as const,
				params: {
					diff: `SEARCH:
old content
REPLACE:
new content

SEARCH:
another old
REPLACE:
another new`,
				},
				partial: false,
			}

			const result = {
				success: false as const,
				failParts: [{ success: false as const, error: "Failed" }],
			}

			const status = strategy.getProgressStatus(toolUse, result)
			expect(status.icon).toBe("diff-multiple")
			expect(status.text).toBe("1/2")
		})
	})
})
