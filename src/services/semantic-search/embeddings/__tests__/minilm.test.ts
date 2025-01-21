import { MiniLMModel } from "../minilm"
import * as path from "path"
import * as os from "os"

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

describe("MiniLMModel", () => {
	let model: MiniLMModel
	const tmpDir = path.join(os.tmpdir(), "roo-cline-test-models")

	beforeEach(async () => {
		model = new MiniLMModel({
			modelPath: tmpDir,
			normalize: true,
			maxSeqLength: 512,
		})
		await model.initialize()
	})

	describe("initialization", () => {
		it("should have correct dimension", () => {
			expect(model.dimension).toBe(384)
		})

		it("should be initialized after setup", () => {
			expect(model.isInitialized()).toBe(true)
		})
	})

	describe("embedding generation", () => {
		it("should generate embeddings of correct dimension", async () => {
			const embedding = await model.embed("test text")
			expect(embedding.dimension).toBe(384)
			expect(embedding.values.length).toBe(384)
			expect(embedding.values.every((n) => !isNaN(n))).toBe(true)
		})

		it("should generate normalized embeddings when configured", async () => {
			const embedding = await model.embed("test text")
			const norm = Math.sqrt(embedding.values.reduce((sum, val) => sum + val * val, 0))
			expect(norm).toBeCloseTo(1.0, 6)
		})

		it("should handle batch embedding", async () => {
			const texts = ["first text", "second text"]
			const embeddings = await model.embedBatch(texts)
			expect(embeddings).toHaveLength(2)
			embeddings.forEach((emb) => {
				expect(emb.dimension).toBe(384)
				expect(emb.values.length).toBe(384)
				expect(emb.values.every((n) => !isNaN(n))).toBe(true)
			})
		})

		it("should generate similar embeddings for similar texts", async () => {
			const emb1 = await model.embed("The cat sat on the mat")
			const emb2 = await model.embed("A cat is sitting on a mat")
			const emb3 = await model.embed("The weather is nice today")

			const sim12 = cosineSimilarity(emb1, emb2)
			const sim13 = cosineSimilarity(emb1, emb3)

			expect(sim12).toBeGreaterThan(sim13)
		})
	})
})

function cosineSimilarity(a: { values: number[] }, b: { values: number[] }): number {
	let dotProduct = 0
	let normA = 0
	let normB = 0

	for (let i = 0; i < a.values.length; i++) {
		dotProduct += a.values[i] * b.values[i]
		normA += a.values[i] * a.values[i]
		normB += b.values[i] * b.values[i]
	}

	return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB))
}
