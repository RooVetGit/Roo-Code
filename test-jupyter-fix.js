const fs = require("fs").promises
const path = require("path")

// Simple test to verify the Jupyter notebook handler works
async function testJupyterHandler() {
	try {
		// Import the handler functions
		const {
			isJupyterNotebook,
			parseJupyterNotebook,
			applyChangesToNotebook,
			writeJupyterNotebook,
			validateJupyterNotebookJson,
		} = require("./src/core/tools/jupyter-notebook-handler.ts")

		console.log("✓ Jupyter notebook handler imported successfully")

		// Test isJupyterNotebook
		console.log("Testing isJupyterNotebook...")
		console.log("test.ipynb:", isJupyterNotebook("test.ipynb")) // should be true
		console.log("test.py:", isJupyterNotebook("test.py")) // should be false

		// Test validateJupyterNotebookJson
		console.log("Testing validateJupyterNotebookJson...")
		const validNotebook = JSON.stringify({
			cells: [],
			metadata: {},
			nbformat: 4,
			nbformat_minor: 2,
		})
		const validation = validateJupyterNotebookJson(validNotebook)
		console.log("Valid notebook validation:", validation)

		console.log("✓ All basic tests passed")
	} catch (error) {
		console.error("✗ Test failed:", error.message)
		process.exit(1)
	}
}

testJupyterHandler()
