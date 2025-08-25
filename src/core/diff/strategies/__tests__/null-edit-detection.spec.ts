import { MultiSearchReplaceDiffStrategy } from "../multi-search-replace"

describe("null edit detection", () => {
	let strategy: MultiSearchReplaceDiffStrategy

	beforeEach(() => {
		strategy = new MultiSearchReplaceDiffStrategy()
	})

	it("should detect and reject null edits (identical search and replace)", async () => {
		const originalContent = 'function hello() {\n    console.log("hello")\n}\n'
		const diffContent = [
			"<<<<<<< SEARCH",
			"function hello() {",
			'    console.log("hello")',
			"}",
			"=======",
			"function hello() {",
			'    console.log("hello")',
			"}",
			">>>>>>> REPLACE",
		].join("\n")

		const result = await strategy.applyDiff(originalContent, diffContent)
		expect(result.success).toBe(false)
		if (!result.success && result.failParts && result.failParts.length > 0) {
			const firstError = result.failParts[0]
			if (!firstError.success && firstError.error) {
				expect(firstError.error).toContain("NULL EDIT DETECTED")
				expect(firstError.error).toContain("Search and replace content are identical")
				expect(firstError.error).toContain("This is a common issue with AI models (especially Gemini)")
				expect(firstError.error).toContain("Model hallucination")
			}
		}
	})

	it("should detect null edits in multi-block diffs", async () => {
		const originalContent =
			'function hello() {\n    console.log("hello")\n}\nfunction world() {\n    return "world"\n}'
		const diffContent = [
			"<<<<<<< SEARCH",
			"function hello() {",
			'    console.log("hello")',
			"}",
			"=======",
			"function hello() {",
			'    console.log("hello world")',
			"}",
			">>>>>>> REPLACE",
			"",
			"<<<<<<< SEARCH",
			"function world() {",
			'    return "world"',
			"}",
			"=======",
			"function world() {",
			'    return "world"',
			"}",
			">>>>>>> REPLACE",
		].join("\n")

		const result = await strategy.applyDiff(originalContent, diffContent)
		// Should partially succeed but report the null edit
		expect(result.success).toBe(true)
		if (result.success) {
			expect(result.failParts).toBeDefined()
			if (result.failParts && result.failParts[0] && !result.failParts[0].success) {
				expect(result.failParts[0].error).toContain("NULL EDIT DETECTED")
			}
		}
	})

	it("should detect null edits with line numbers", async () => {
		const originalContent = "function test() {\n    return true;\n}\n"
		const diffContent = [
			"<<<<<<< SEARCH",
			":start_line:1",
			"-------",
			"function test() {",
			"    return true;",
			"}",
			"=======",
			"function test() {",
			"    return true;",
			"}",
			">>>>>>> REPLACE",
		].join("\n")

		const result = await strategy.applyDiff(originalContent, diffContent)
		expect(result.success).toBe(false)
		if (!result.success && result.failParts && result.failParts.length > 0) {
			const firstError = result.failParts[0]
			if (!firstError.success && firstError.error) {
				expect(firstError.error).toContain("NULL EDIT DETECTED")
				expect(firstError.error).toContain("phantom")
				expect(firstError.error).toContain("Ensure the REPLACE block contains the actual modified content")
			}
		}
	})

	it("should not trigger null edit detection for legitimate empty replacements (deletions)", async () => {
		const originalContent = "function test() {\n    // Remove this comment\n    return true;\n}\n"
		const diffContent = ["<<<<<<< SEARCH", "    // Remove this comment", "=======", ">>>>>>> REPLACE"].join("\n")

		const result = await strategy.applyDiff(originalContent, diffContent)
		expect(result.success).toBe(true)
		// Should not contain null edit error
		if (!result.success && result.error) {
			expect(result.error).not.toContain("NULL EDIT DETECTED")
		}
	})

	it("should not trigger for actual changes even if similar", async () => {
		const originalContent = "function test() {\n    return true;\n}\n"
		const diffContent = [
			"<<<<<<< SEARCH",
			"function test() {",
			"    return true;",
			"}",
			"=======",
			"function test() {",
			"    return false;",
			"}",
			">>>>>>> REPLACE",
		].join("\n")

		const result = await strategy.applyDiff(originalContent, diffContent)
		expect(result.success).toBe(true)
		// Should not contain null edit error
		if (!result.success && result.error) {
			expect(result.error).not.toContain("NULL EDIT DETECTED")
		}
	})
})
