import { describe, it } from "@jest/globals"
import { inspectTreeStructure } from "./helpers"
import { sampleZig } from "./fixtures/sample-zig"

describe("inspectZig", () => {
	it("should inspect Zig tree structure", async () => {
		await inspectTreeStructure(sampleZig, "zig")
	})
})
