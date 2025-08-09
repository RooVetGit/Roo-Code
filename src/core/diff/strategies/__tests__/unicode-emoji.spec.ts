import { MultiSearchReplaceDiffStrategy } from "../multi-search-replace"

describe("MultiSearchReplaceDiffStrategy - Unicode Emoji Handling", () => {
	let strategy: MultiSearchReplaceDiffStrategy

	beforeEach(() => {
		strategy = new MultiSearchReplaceDiffStrategy(1.0) // Exact matching
	})

	describe("Unicode emoji character handling", () => {
		it("should correctly match and replace content containing checkmark emoji (✔)", async () => {
			const originalContent = `# Test File

**✔ This is a test line.**

Some other content.`

			const diffContent = `<<<<<<< SEARCH
**✔ This is a test line.**
=======
**This line has been successfully modified.**
>>>>>>> REPLACE`

			const result = await strategy.applyDiff(originalContent, diffContent)
			expect(result.success).toBe(true)
			if (result.success) {
				expect(result.content).toBe(`# Test File

**This line has been successfully modified.**

Some other content.`)
			}
		})

		it("should handle multiple different emoji characters", async () => {
			const originalContent = `# Task List

✅ Completed task
⚠️ Warning task
❌ Failed task
🚀 Rocket task`

			const diffContent = `<<<<<<< SEARCH
✅ Completed task
⚠️ Warning task
❌ Failed task
🚀 Rocket task
=======
✅ Completed task
⚠️ Warning task
❌ Failed task
🚀 Rocket task
🎉 Celebration task
>>>>>>> REPLACE`

			const result = await strategy.applyDiff(originalContent, diffContent)
			expect(result.success).toBe(true)
			if (result.success) {
				expect(result.content).toBe(`# Task List

✅ Completed task
⚠️ Warning task
❌ Failed task
🚀 Rocket task
🎉 Celebration task`)
			}
		})

		it("should handle emoji in code comments", async () => {
			const originalContent = `function celebrate() {
    // 🎉 This function celebrates success
    console.log("Success!");
}`

			const diffContent = `<<<<<<< SEARCH
    // 🎉 This function celebrates success
=======
    // 🎉 This function celebrates success
    // 🚀 And launches rockets!
>>>>>>> REPLACE`

			const result = await strategy.applyDiff(originalContent, diffContent)
			expect(result.success).toBe(true)
			if (result.success) {
				expect(result.content).toBe(`function celebrate() {
    // 🎉 This function celebrates success
    // 🚀 And launches rockets!
    console.log("Success!");
}`)
			}
		})

		it("should handle mixed emoji and regular text", async () => {
			const originalContent = `## Status Report

Current status: ✔ All systems operational
Performance: 🚀 Blazing fast
Issues: ❌ None found`

			const diffContent = `<<<<<<< SEARCH
Current status: ✔ All systems operational
Performance: 🚀 Blazing fast
Issues: ❌ None found
=======
Current status: ✅ All systems operational
Performance: 🚀 Blazing fast
Issues: ⚠️ Minor warnings detected
>>>>>>> REPLACE`

			const result = await strategy.applyDiff(originalContent, diffContent)
			expect(result.success).toBe(true)
			if (result.success) {
				expect(result.content).toBe(`## Status Report

Current status: ✅ All systems operational
Performance: 🚀 Blazing fast
Issues: ⚠️ Minor warnings detected`)
			}
		})

		it("should handle emoji with line numbers", async () => {
			const originalContent = `# Test File

**✔ This is a test line.**

Some other content.`

			const diffContent = `<<<<<<< SEARCH
:start_line:3
-------
**✔ This is a test line.**
=======
**✅ This line has been successfully modified.**
>>>>>>> REPLACE`

			const result = await strategy.applyDiff(originalContent, diffContent)
			expect(result.success).toBe(true)
			if (result.success) {
				expect(result.content).toBe(`# Test File

**✅ This line has been successfully modified.**

Some other content.`)
			}
		})

		it("should handle complex Unicode characters beyond basic emoji", async () => {
			const originalContent = `# International Characters

Chinese: 你好世界
Japanese: こんにちは世界
Korean: 안녕하세요
Arabic: مرحبا بالعالم
Hebrew: שלום עולם
Emoji: 🌍🌎🌏`

			const diffContent = `<<<<<<< SEARCH
Chinese: 你好世界
Japanese: こんにちは世界
Korean: 안녕하세요
=======
Chinese: 你好世界 (Hello World)
Japanese: こんにちは世界 (Hello World)
Korean: 안녕하세요 (Hello)
>>>>>>> REPLACE`

			const result = await strategy.applyDiff(originalContent, diffContent)
			expect(result.success).toBe(true)
			if (result.success) {
				expect(result.content).toBe(`# International Characters

Chinese: 你好世界 (Hello World)
Japanese: こんにちは世界 (Hello World)
Korean: 안녕하세요 (Hello)
Arabic: مرحبا بالعالم
Hebrew: שלום עולם
Emoji: 🌍🌎🌏`)
			}
		})
	})
})
