// npx vitest services/code-index/__tests__/dotnet-support.spec.ts

import { extensions } from "../../tree-sitter"
import { scannerExtensions } from "../shared/supported-extensions"

describe(".NET file extension support", () => {
	it("should include C# files in supported extensions", () => {
		expect(extensions).toContain(".cs")
		expect(scannerExtensions).toContain(".cs")
	})

	it("should include Visual Basic .NET files in supported extensions", () => {
		expect(extensions).toContain(".vb")
		expect(scannerExtensions).toContain(".vb")
	})

	it("should include F# files in supported extensions", () => {
		expect(extensions).toContain(".fs")
		expect(extensions).toContain(".fsx")
		expect(extensions).toContain(".fsi")
		expect(scannerExtensions).toContain(".fs")
		expect(scannerExtensions).toContain(".fsx")
		expect(scannerExtensions).toContain(".fsi")
	})

	it("should not include markdown files in scanner extensions", () => {
		expect(extensions).toContain(".md")
		expect(extensions).toContain(".markdown")
		expect(scannerExtensions).not.toContain(".md")
		expect(scannerExtensions).not.toContain(".markdown")
	})
})
