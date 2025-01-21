import { pipeline } from "@huggingface/transformers"

// Workaround for Jest's handling of Float32Array
// See: https://github.com/microsoft/onnxruntime/issues/16622
const originalImplementation = Array.isArray
// @ts-ignore - we need to override Array.isArray for Jest
Array.isArray = (arg: any): boolean => {
	if (arg?.constructor?.name === "Float32Array" || arg?.constructor?.name === "BigInt64Array") {
		return true
	}
	return originalImplementation(arg)
}

describe("Transformer Basic Test", () => {
	const MODEL_NAME = "sentence-transformers/all-MiniLM-L6-v2"

	test("should load and run the model", async () => {
		// Initialize the pipeline for feature extraction
		const pipe = await pipeline("feature-extraction", MODEL_NAME, {
			dtype: "fp32", // Using full precision for testing
		})
		expect(pipe).toBeDefined()

		// Test with a simple text
		const text = "Hello world"
		const output = await pipe(text, {
			pooling: "mean",
			normalize: true,
		})

		// Check the output
		expect(output).toBeDefined()

		// Convert tensor to array for testing
		const values = Array.from(output.data)
		expect(values.length).toBe(384) // MiniLM output dimension

		// Check if values are normalized (should be between -1 and 1)
		const allValuesNormalized = values.every((value: number) => value >= -1 && value <= 1)
		expect(allValuesNormalized).toBe(true)
	}, 30000) // Allow 30s for model download
})
