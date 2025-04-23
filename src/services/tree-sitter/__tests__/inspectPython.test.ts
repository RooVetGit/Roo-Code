import { inspectTreeStructure } from "./helpers"
import { samplePythonContent } from "./fixtures/sample-python"

describe("Python Tree-sitter Parser", () => {
	it("should inspect the tree structure", async () => {
		await inspectTreeStructure(samplePythonContent, "python")
	})
})
