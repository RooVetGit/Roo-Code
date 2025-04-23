import { describe, test } from "@jest/globals"
import { inspectTreeStructure } from "./helpers"
import sampleGoContent from "./fixtures/sample-go"

describe("Go Structure Tests", () => {
	test("should output Go structures", async () => {
		await inspectTreeStructure(sampleGoContent, "go")
	})
})
