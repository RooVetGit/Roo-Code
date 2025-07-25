import { describe, it, expect } from "vitest"
import { getApplyDiffDescription as getApplyDiffDescriptionLegacy } from "../applyDiffTool"
import { getApplyDiffDescription as getApplyDiffDescriptionMulti } from "../multiApplyDiffTool"

describe("getApplyDiffDescription", () => {
	describe("legacy format (applyDiffTool)", () => {
		it("should show efficiency warning when only one SEARCH/REPLACE block is used", () => {
			const blockParams = {
				path: "test.js",
				diff: `<<<<<<< SEARCH
function old() {
  return 1;
}
=======
function new() {
  return 2;
}
>>>>>>> REPLACE`,
			}

			const result = getApplyDiffDescriptionLegacy("apply_diff", blockParams)
			expect(result).toContain("Using multiple SEARCH/REPLACE blocks in a single request is more efficient")
			expect(result).toContain("[apply_diff for 'test.js'.")
		})

		it("should not show warning when multiple SEARCH/REPLACE blocks are used", () => {
			const blockParams = {
				path: "test.js",
				diff: `<<<<<<< SEARCH
function old1() {
  return 1;
}
=======
function new1() {
  return 2;
}
>>>>>>> REPLACE

<<<<<<< SEARCH
function old2() {
  return 3;
}
=======
function new2() {
  return 4;
}
>>>>>>> REPLACE`,
			}

			const result = getApplyDiffDescriptionLegacy("apply_diff", blockParams)
			expect(result).toBe("[apply_diff for 'test.js']")
			expect(result).not.toContain("Using multiple SEARCH/REPLACE blocks")
		})

		it("should handle missing path gracefully", () => {
			const blockParams = {
				diff: `<<<<<<< SEARCH
old content
=======
new content
>>>>>>> REPLACE`,
			}

			const result = getApplyDiffDescriptionLegacy("apply_diff", blockParams)
			expect(result).toContain("[apply_diff for 'file'.")
			expect(result).toContain("Using multiple SEARCH/REPLACE blocks")
		})

		it("should handle missing diff content", () => {
			const blockParams = {
				path: "test.js",
			}

			const result = getApplyDiffDescriptionLegacy("apply_diff", blockParams)
			expect(result).toBe("[apply_diff for 'test.js']")
		})
	})

	describe("multi-file format (multiApplyDiffTool)", () => {
		it("should show efficiency warning for single file with single SEARCH/REPLACE block", () => {
			const blockParams = {
				args: `<file><path>test.js</path><diff><content><<<<<<< SEARCH
function old() {
  return 1;
}
=======
function new() {
  return 2;
}
>>>>>>> REPLACE</content></diff></file>`,
			}

			const result = getApplyDiffDescriptionMulti("apply_diff", blockParams)
			expect(result).toContain("Using multiple SEARCH/REPLACE blocks in a single request is more efficient")
			expect(result).toContain("[apply_diff for 'test.js'.")
		})

		it("should not show warning for multiple files", () => {
			const blockParams = {
				args: `<file><path>test1.js</path><diff><content><<<<<<< SEARCH
old1
=======
new1
>>>>>>> REPLACE</content></diff></file><file><path>test2.js</path><diff><content><<<<<<< SEARCH
old2
=======
new2
>>>>>>> REPLACE</content></diff></file>`,
			}

			const result = getApplyDiffDescriptionMulti("apply_diff", blockParams)
			expect(result).toBe("[apply_diff for 2 files with 2 changes]")
			expect(result).not.toContain("Using multiple SEARCH/REPLACE blocks")
		})

		it("should not show warning for single file with multiple SEARCH/REPLACE blocks", () => {
			const blockParams = {
				args: `<file><path>test.js</path><diff><content><<<<<<< SEARCH
old1
=======
new1
>>>>>>> REPLACE

<<<<<<< SEARCH
old2
=======
new2
>>>>>>> REPLACE</content></diff></file>`,
			}

			const result = getApplyDiffDescriptionMulti("apply_diff", blockParams)
			expect(result).toBe("[apply_diff for 1 file with 2 changes]")
			expect(result).not.toContain("Using multiple SEARCH/REPLACE blocks")
		})

		it("should handle multiple diffs per file", () => {
			const blockParams = {
				args: `<file><path>test.js</path><diff><content><<<<<<< SEARCH
old1
=======
new1
>>>>>>> REPLACE</content></diff><diff><content><<<<<<< SEARCH
old2
=======
new2
>>>>>>> REPLACE</content></diff></file>`,
			}

			const result = getApplyDiffDescriptionMulti("apply_diff", blockParams)
			expect(result).toBe("[apply_diff for 1 file with 2 changes]")
		})

		it("should handle invalid XML gracefully", () => {
			const blockParams = {
				args: `<invalid>xml</content>`,
			}

			const result = getApplyDiffDescriptionMulti("apply_diff", blockParams)
			expect(result).toBe("[apply_diff with unparsable args]")
		})

		it("should fall back to legacy format when args is not present", () => {
			const blockParams = {
				path: "test.js",
				diff: `<<<<<<< SEARCH
old
=======
new
>>>>>>> REPLACE`,
			}

			const result = getApplyDiffDescriptionMulti("apply_diff", blockParams)
			expect(result).toContain("Using multiple SEARCH/REPLACE blocks")
			expect(result).toContain("[apply_diff for 'test.js'.")
		})
	})
})
