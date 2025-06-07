import { vi, describe, it, expect, beforeEach } from "vitest"
import {
	processAndFilterReadRequest,
	subtractRange,
	subtractRanges,
	ConversationMessage,
} from "../fileReadCacheService"
import { stat } from "fs/promises"

vi.mock("fs/promises", () => ({
	stat: vi.fn(),
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
		const CURRENT_MTIME = 1000

		beforeEach(() => {
			mockedStat.mockResolvedValue({ mtime: { getTime: () => CURRENT_MTIME } } as any)
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
							mtime: CURRENT_MTIME,
							loadedRanges: [{ start: 1, end: 10 }],
						},
					],
				},
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
							mtime: CURRENT_MTIME,
							loadedRanges: [{ start: 1, end: 10 }],
						},
					],
				},
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
							mtime: CURRENT_MTIME - 100, // Older mtime
							loadedRanges: [{ start: 1, end: 10 }],
						},
					],
				},
			]
			const result = await processAndFilterReadRequest(MOCK_FILE_PATH, requestedRanges, conversationHistory)
			expect(result.status).toBe("ALLOW_ALL")
			expect(result.rangesToRead).toEqual(requestedRanges)
		})

		it("should allow all for a file not in history", async () => {
			const requestedRanges = [{ start: 1, end: 10 }]
			const conversationHistory: ConversationMessage[] = [
				{
					files: [
						{
							fileName: "/another/file.txt",
							mtime: CURRENT_MTIME,
							loadedRanges: [{ start: 1, end: 10 }],
						},
					],
				},
			]
			const result = await processAndFilterReadRequest(MOCK_FILE_PATH, requestedRanges, conversationHistory)
			expect(result.status).toBe("ALLOW_ALL")
			expect(result.rangesToRead).toEqual(requestedRanges)
		})

		it("should correctly use the most recent valid history entry", async () => {
			const requestedRanges = [{ start: 1, end: 20 }]
			const conversationHistory: ConversationMessage[] = [
				{
					// Older, incorrect mtime
					files: [
						{
							fileName: MOCK_FILE_PATH,
							mtime: CURRENT_MTIME - 100,
							loadedRanges: [{ start: 1, end: 20 }],
						},
					],
				},
				{
					// Newer, correct mtime but only partial coverage
					files: [
						{
							fileName: MOCK_FILE_PATH,
							mtime: CURRENT_MTIME,
							loadedRanges: [{ start: 1, end: 5 }],
						},
					],
				},
			]
			const result = await processAndFilterReadRequest(MOCK_FILE_PATH, requestedRanges, conversationHistory)
			expect(result.status).toBe("ALLOW_PARTIAL")
			expect(result.rangesToRead).toEqual([{ start: 6, end: 20 }])
		})
	})
})
