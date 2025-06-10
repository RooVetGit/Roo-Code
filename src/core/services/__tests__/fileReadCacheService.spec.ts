import { vi, describe, it, expect, beforeEach } from "vitest"
import {
	processAndFilterReadRequest,
	subtractRange,
	subtractRanges,
	ConversationMessage,
} from "../fileReadCacheService"
import { stat } from "fs/promises"
import { lruCache } from "../../utils/lruCache"
vi.mock("fs/promises", () => ({
	stat: vi.fn(),
}))
vi.mock("../../utils/lruCache")
vi.mock("../../config/envConfig", () => ({
	ROO_AGENT_CONFIG: {
		fileReadCacheSize: () => 10,
	},
}))
const mockedStat = vi.mocked(stat)
describe("fileReadCacheService", () => {
	describe("subtractRange", () => {
		it("should return the original range if there is no overlap", () => {
			const original = { start: 1, end: 10 }
			const toRemove = { start: 11, end: 20 }
			expect(subtractRange(original, toRemove)).toEqual([original])
		})
		it("should return an empty array if the range is completely removed", () => {
			const original = { start: 1, end: 10 }
			const toRemove = { start: 1, end: 10 }
			expect(subtractRange(original, toRemove)).toEqual([])
		})
		it("should subtract from the beginning", () => {
			const original = { start: 1, end: 10 }
			const toRemove = { start: 1, end: 5 }
			expect(subtractRange(original, toRemove)).toEqual([{ start: 6, end: 10 }])
		})
		it("should subtract from the end", () => {
			const original = { start: 1, end: 10 }
			const toRemove = { start: 6, end: 10 }
			expect(subtractRange(original, toRemove)).toEqual([{ start: 1, end: 5 }])
		})
		it("should subtract from the middle, creating two new ranges", () => {
			const original = { start: 1, end: 10 }
			const toRemove = { start: 4, end: 6 }
			expect(subtractRange(original, toRemove)).toEqual([
				{ start: 1, end: 3 },
				{ start: 7, end: 10 },
			])
		})
	})
	describe("subtractRanges", () => {
		it("should subtract multiple ranges from a single original range", () => {
			const originals = [{ start: 1, end: 20 }]
			const toRemoves = [
				{ start: 1, end: 5 },
				{ start: 15, end: 20 },
			]
			expect(subtractRanges(originals, toRemoves)).toEqual([{ start: 6, end: 14 }])
		})
	})
	describe("processAndFilterReadRequest", () => {
		const MOCK_FILE_PATH = "/test/file.txt"
		const CURRENT_MTIME = new Date().toISOString()
		beforeEach(() => {
			vi.clearAllMocks()
			mockedStat.mockResolvedValue({ mtime: { toISOString: () => CURRENT_MTIME } } as any)
		})
		it("should allow all when history is empty", async () => {
			const requestedRanges = [{ start: 1, end: 10 }]
			const result = await processAndFilterReadRequest(MOCK_FILE_PATH, requestedRanges, [])
			expect(result.status).toBe("ALLOW_ALL")
			expect(result.rangesToRead).toEqual(requestedRanges)
		})
		it("should reject all when a full cache hit occurs", async () => {
			const requestedRanges = [{ start: 1, end: 10 }]
			const conversationHistory: ConversationMessage[] = [
				{
					files: [
						{
							fileName: MOCK_FILE_PATH,
							mtime: new Date(CURRENT_MTIME).getTime(),
							lineRanges: [{ start: 1, end: 10 }],
						},
					],
				} as any,
			]
			const result = await processAndFilterReadRequest(MOCK_FILE_PATH, requestedRanges, conversationHistory)
			expect(result.status).toBe("REJECT_ALL")
			expect(result.rangesToRead).toEqual([])
		})
		it("should allow partial when a partial cache hit occurs", async () => {
			const requestedRanges = [{ start: 1, end: 20 }]
			const conversationHistory: ConversationMessage[] = [
				{
					files: [
						{
							fileName: MOCK_FILE_PATH,
							mtime: new Date(CURRENT_MTIME).getTime(),
							lineRanges: [{ start: 1, end: 10 }],
						},
					],
				} as any,
			]
			const result = await processAndFilterReadRequest(MOCK_FILE_PATH, requestedRanges, conversationHistory)
			expect(result.status).toBe("ALLOW_PARTIAL")
			expect(result.rangesToRead).toEqual([{ start: 11, end: 20 }])
		})
		it("should allow all when mtime is older in history", async () => {
			const requestedRanges = [{ start: 1, end: 10 }]
			const conversationHistory: ConversationMessage[] = [
				{
					files: [
						{
							fileName: MOCK_FILE_PATH,
							mtime: new Date(CURRENT_MTIME).getTime() - 100, // Older mtime
							lineRanges: [{ start: 1, end: 10 }],
						},
					],
				} as any,
			]
			const result = await processAndFilterReadRequest(MOCK_FILE_PATH, requestedRanges, conversationHistory)
			expect(result.status).toBe("ALLOW_ALL")
			expect(result.rangesToRead).toEqual(requestedRanges)
		})
		it("should allow all when file does not exist", async () => {
			mockedStat.mockRejectedValue({ code: "ENOENT" })
			const requestedRanges = [{ start: 1, end: 10 }]
			const result = await processAndFilterReadRequest(MOCK_FILE_PATH, requestedRanges, [])
			expect(result.status).toBe("ALLOW_ALL")
			expect(result.rangesToRead).toEqual(requestedRanges)
		})
		it("should throw an error for non-ENOENT stat errors", async () => {
			const error = new Error("EPERM")
			mockedStat.mockRejectedValue(error)
			const requestedRanges = [{ start: 1, end: 10 }]
			const result = await processAndFilterReadRequest(MOCK_FILE_PATH, requestedRanges, [])
			expect(result.status).toBe("ALLOW_ALL") // Fallback to allow all
		})
	})
})
