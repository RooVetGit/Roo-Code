import { describe, it } from "@jest/globals"
import { debugLog, testParseSourceCodeDefinitions } from "./helpers"
import { zigQuery } from "../queries"
import { sampleZig } from "./fixtures/sample-zig"

describe("parseSourceCodeDefinitions (Zig)", () => {
	const testOptions = {
		language: "zig",
		wasmFile: "tree-sitter-zig.wasm",
		queryString: zigQuery,
		extKey: "zig",
	}

	it("should inspect Zig tree structure", async () => {
		const result = await testParseSourceCodeDefinitions("test.zig", sampleZig, testOptions)
		debugLog("All definitions:", result)

		// Verify result is a string containing expected definitions
		expect(typeof result).toBe("string")
		expect(result).toContain("# test.zig")

		// Struct declarations
		expect(result).toMatch(/\d+--\d+ \| pub const Point = struct/)
		expect(result).toMatch(/\d+--\d+ \| pub const Vector = struct/)

		// Container declarations
		expect(result).toMatch(/\d+--\d+ \| pub const Point = struct \{/)
		expect(result).toMatch(/\d+--\d+ \| const Direction = enum \{/)
		expect(result).toMatch(/\d+--\d+ \| pub const Vector = struct \{/)

		// Function declarations
		expect(result).toMatch(/\d+--\d+ \| pub fn main\(\) !void \{/)

		// Variable declarations
		expect(result).toMatch(/\d+--\d+ \| const std = @import\("std"\)/)

		// Variable declarations
		expect(result).toMatch(/\d+--\d+ \| const std = @import\("std"\)/)

		// Container declarations
		expect(result).toMatch(/\d+--\d+ \| pub const Point = struct \{/)
		expect(result).toMatch(/\d+--\d+ \| const Direction = enum \{/)
		expect(result).toMatch(/\d+--\d+ \| pub const Vector = struct \{/)

		// Function declarations
		expect(result).toMatch(/\d+--\d+ \| pub fn main\(\) !void \{/)
	})
})
