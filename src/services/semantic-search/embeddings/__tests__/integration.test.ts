import { MiniLMModel } from "../minilm"
import { Vector } from "../../vector-store/types"
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

// Helper function to calculate cosine similarity
function cosineSimilarity(a: Vector, b: Vector): number {
	let dotProduct = 0
	let normA = 0
	let normB = 0

	for (let i = 0; i < a.dimension; i++) {
		dotProduct += a.values[i] * b.values[i]
		normA += a.values[i] * a.values[i]
		normB += b.values[i] * b.values[i]
	}

	const magnitude = Math.sqrt(normA) * Math.sqrt(normB)
	if (magnitude === 0) return 0

	return dotProduct / magnitude
}

describe("MiniLM Integration Tests", () => {
	let model: MiniLMModel
	let tempDir: string

	beforeEach(async () => {
		tempDir = path.join(os.tmpdir(), "minilm-test")
		model = new MiniLMModel({
			modelPath: tempDir,
			normalize: true,
			maxSeqLength: 512,
		})
		await model.initialize()
	})

	const testSnippets = {
		auth: `function authenticateUser(username: string, password: string) {
      // Hash password and verify credentials
      const hashedPassword = hashPassword(password)
      return verifyCredentials(username, hashedPassword)
    }`,

		logging: `function logError(error: Error) {
      // Log error details to monitoring system
      console.error(\`[ERROR] \${error.message}\`)
      metrics.recordError(error)
    }`,

		database: `async function queryDatabase(sql: string) {
      // Execute SQL query and return results
      const connection = await pool.getConnection()
      return connection.query(sql)
    }`,
	}

	test("generates embeddings for single code snippet", async () => {
		const embedding = await model.embed(testSnippets.auth)
		expect(embedding.values).toHaveLength(384)
		expect(embedding.values.every((n: number) => !isNaN(n))).toBe(true)
	})

	test("generates embeddings for multiple code snippets", async () => {
		const snippets = Object.values(testSnippets)
		const embeddings = await model.embedBatch(snippets)

		expect(embeddings).toHaveLength(snippets.length)
		embeddings.forEach((embedding) => {
			expect(embedding.values).toHaveLength(384)
			expect(embedding.values.every((n: number) => !isNaN(n))).toBe(true)
		})
	})

	test("finds similar code snippets", async () => {
		const authQuery = "verify user credentials and check password"
		const logQuery = "log an error message to the console"
		const dbQuery = "execute a database query"

		const snippets = Object.values(testSnippets)
		const snippetEmbeddings = await model.embedBatch(snippets)

		// Test auth query
		const authQueryEmbedding = await model.embed(authQuery)
		const authSimilarities = snippetEmbeddings.map((embedding) => cosineSimilarity(authQueryEmbedding, embedding))

		// Auth snippet should be most similar to auth query
		const maxAuthIndex = authSimilarities.indexOf(Math.max(...authSimilarities))
		expect(snippets[maxAuthIndex]).toBe(testSnippets.auth)

		// Test log query
		const logQueryEmbedding = await model.embed(logQuery)
		const logSimilarities = snippetEmbeddings.map((embedding) => cosineSimilarity(logQueryEmbedding, embedding))

		// Log snippet should be most similar to log query
		const maxLogIndex = logSimilarities.indexOf(Math.max(...logSimilarities))
		expect(snippets[maxLogIndex]).toBe(testSnippets.logging)

		// Test db query
		const dbQueryEmbedding = await model.embed(dbQuery)
		const dbSimilarities = snippetEmbeddings.map((embedding) => cosineSimilarity(dbQueryEmbedding, embedding))

		// DB snippet should be most similar to db query
		const maxDbIndex = dbSimilarities.indexOf(Math.max(...dbSimilarities))
		expect(snippets[maxDbIndex]).toBe(testSnippets.database)
	})
})
