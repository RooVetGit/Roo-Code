import { MemoryMonitor, MemoryStats } from "../monitor"
import { Vector } from "../../vector-store/types"
import { CodeDefinition } from "../../types"

describe("MemoryMonitor", () => {
	const createVector = (dimension: number): Vector => ({
		values: new Array(dimension).fill(1),
		dimension,
	})

	const createDefinition = (content: string): CodeDefinition => ({
		type: "function",
		name: "test",
		filePath: "test.ts",
		content,
		startLine: 1,
		endLine: 1,
	})

	describe("size estimation", () => {
		it("should estimate vector size correctly", () => {
			const vector = createVector(384) // MiniLM dimension
			const size = MemoryMonitor.estimateVectorSize(vector)
			expect(size).toBe(384 * 8) // 8 bytes per number (64-bit float)
		})

		it("should estimate metadata size based on content length", () => {
			const smallDef = createDefinition("small")
			const largeDef = createDefinition("a".repeat(1000))

			const smallSize = MemoryMonitor.estimateMetadataSize(smallDef)
			const largeSize = MemoryMonitor.estimateMetadataSize(largeDef)

			expect(largeSize).toBeGreaterThan(smallSize)
		})
	})

	describe("stats calculation", () => {
		it("should calculate correct stats for empty collections", () => {
			const stats = MemoryMonitor.calculateStats([], [])
			expect(stats).toEqual({
				vectorCount: 0,
				totalVectorMemory: 0,
				totalMetadataMemory: 0,
				cacheEntryCount: 0,
				totalCacheMemory: 0,
				timestamp: expect.any(Number),
			})
		})

		it("should calculate correct stats for vectors and cache entries", () => {
			const vector = createVector(384)
			const definition = createDefinition("test content")

			const vectors = [{ vector, metadata: definition }]
			const cacheEntries = [{ vector, metadata: definition }]

			const stats = MemoryMonitor.calculateStats(vectors, cacheEntries)

			expect(stats).toEqual({
				vectorCount: 1,
				totalVectorMemory: 384 * 8, // Vector size
				totalMetadataMemory: expect.any(Number),
				cacheEntryCount: 1,
				totalCacheMemory: expect.any(Number),
				timestamp: expect.any(Number),
			})

			// Cache should include both vector and metadata memory
			expect(stats.totalCacheMemory).toBe(
				MemoryMonitor.estimateVectorSize(vector) + MemoryMonitor.estimateMetadataSize(definition),
			)
		})
	})

	describe("formatting", () => {
		it("should format bytes with appropriate units", () => {
			expect(MemoryMonitor.formatBytes(500)).toBe("500.00 B")
			expect(MemoryMonitor.formatBytes(1500)).toBe("1.46 KB")
			expect(MemoryMonitor.formatBytes(1500000)).toBe("1.43 MB")
			expect(MemoryMonitor.formatBytes(1500000000)).toBe("1.40 GB")
		})

		it("should format stats as readable string", () => {
			const stats: MemoryStats = {
				vectorCount: 100,
				totalVectorMemory: 307200, // 300 KB
				totalMetadataMemory: 102400, // 100 KB
				cacheEntryCount: 50,
				totalCacheMemory: 204800, // 200 KB
				timestamp: Date.now(),
			}

			const formatted = MemoryMonitor.formatStats(stats)
			expect(formatted).toContain("Vector Store:")
			expect(formatted).toContain("Vectors: 100")
			expect(formatted).toContain("300.00 KB")
			expect(formatted).toContain("Cache:")
			expect(formatted).toContain("Entries: 50")
			expect(formatted).toContain("200.00 KB")
		})
	})
})
