// npx vitest services/code-index/shared/__tests__/supported-extensions.spec.ts

import { scannerExtensions } from "../supported-extensions"
import { extensions as allExtensions } from "../../../tree-sitter"

describe("Supported Extensions", () => {
	it("should include markdown extensions in scannerExtensions", () => {
		expect(scannerExtensions).toContain(".md")
		expect(scannerExtensions).toContain(".markdown")
	})

	it("should include all extensions from tree-sitter", () => {
		expect(scannerExtensions).toEqual(allExtensions)
	})

	it("should include common programming language extensions", () => {
		expect(scannerExtensions).toContain(".js")
		expect(scannerExtensions).toContain(".ts")
		expect(scannerExtensions).toContain(".py")
		expect(scannerExtensions).toContain(".go")
		expect(scannerExtensions).toContain(".rs")
	})

	it("should include documentation file extensions", () => {
		expect(scannerExtensions).toContain(".md")
		expect(scannerExtensions).toContain(".markdown")
	})

	it("should not be empty", () => {
		expect(scannerExtensions.length).toBeGreaterThan(0)
	})

	it("should contain only valid file extensions", () => {
		scannerExtensions.forEach((ext) => {
			expect(ext).toMatch(/^\.[a-z0-9]+$/)
		})
	})
})
