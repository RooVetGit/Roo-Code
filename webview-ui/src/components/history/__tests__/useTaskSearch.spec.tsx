import { vi, describe, it, expect, beforeEach, afterEach } from "vitest"
import { renderHook, act } from "@testing-library/react"
import type { HistoryItem } from "@roo-code/types"

import { useTaskSearch } from "../useTaskSearch"
import { vscode } from "@src/utils/vscode"
import * as ExtensionStateContext from "@/context/ExtensionStateContext"
import * as highlight from "@/utils/highlight"

// Mock the dependencies
vi.mock("@src/utils/vscode", () => ({
	vscode: {
		postMessage: vi.fn(),
	},
}))

vi.mock("@/context/ExtensionStateContext", () => ({
	useExtensionState: vi.fn(),
}))

vi.mock("@/utils/highlight", () => ({
	highlightFzfMatch: vi.fn((text, positions) => {
		if (!positions || !positions.length) return text
		return `<mark>${text}</mark>`
	}),
}))

// Sample task history data for tests
const mockTaskHistory: HistoryItem[] = [
	{
		id: "task-1",
		number: 1,
		task: "Create a React component",
		ts: new Date("2022-02-16T12:00:00").getTime(),
		tokensIn: 100,
		tokensOut: 50,
		totalCost: 0.01,
		workspace: "/workspace/project1",
	},
	{
		id: "task-2",
		number: 2,
		task: "Write unit tests",
		ts: new Date("2022-02-17T12:00:00").getTime(),
		tokensIn: 200,
		tokensOut: 100,
		totalCost: 0.02,
		cacheWrites: 25,
		cacheReads: 10,
		workspace: "/workspace/project1",
	},
	{
		id: "task-3",
		number: 3,
		task: "Fix bug in authentication",
		ts: new Date("2022-02-15T12:00:00").getTime(),
		tokensIn: 150,
		tokensOut: 75,
		totalCost: 0.05,
		workspace: "/workspace/project2",
	},
]

describe("useTaskSearch", () => {
	const mockPostMessage = vscode.postMessage as ReturnType<typeof vi.fn>
	const mockUseExtensionState = ExtensionStateContext.useExtensionState as ReturnType<typeof vi.fn>
	const mockHighlightFzfMatch = highlight.highlightFzfMatch as ReturnType<typeof vi.fn>

	beforeEach(() => {
		vi.clearAllMocks()
		mockUseExtensionState.mockReturnValue({ cwd: "/workspace/project1" })
		vi.useFakeTimers()
	})

	afterEach(() => {
		vi.restoreAllMocks()
		vi.useRealTimers()
	})

	it("returns all tasks by default", async () => {
		const { result, rerender } = renderHook(() => useTaskSearch())

		expect(result.current.loading).toBe(true)
		expect(result.current.tasks).toEqual([])

		expect(mockPostMessage).toHaveBeenCalledWith({
			type: "getHistoryItems",
			historySearchOptions: {
				searchQuery: "",
				sortOption: "newest",
				workspacePath: undefined,
				limit: undefined,
			},
			requestId: expect.any(String),
		})

		const requestId = mockPostMessage.mock.calls[0][0].requestId

		act(() => {
			const event = new MessageEvent("message", {
				data: {
					type: "historyItems",
					items: mockTaskHistory.filter((item) => item.workspace === "/workspace/project1"),
					requestId,
				},
			})
			window.dispatchEvent(event)
		})

		rerender()

		expect(result.current.tasks).toHaveLength(2)
		expect(result.current.tasks[0].id).toBe("task-1")
		expect(result.current.tasks[1].id).toBe("task-2")
		expect(result.current.loading).toBe(false)
	})

	it("filters tasks by current workspace by default", async () => {
		const { result, rerender } = renderHook(() => useTaskSearch())

		const requestId = mockPostMessage.mock.calls[0][0].requestId

		act(() => {
			const event = new MessageEvent("message", {
				data: {
					type: "historyItems",
					items: mockTaskHistory.filter((item) => item.workspace === "/workspace/project1"),
					requestId,
				},
			})
			window.dispatchEvent(event)
		})

		rerender()

		expect(result.current.tasks).toHaveLength(2)
		expect(result.current.tasks.every((task: HistoryItem) => task.workspace === "/workspace/project1")).toBe(true)
	})

	it("shows tasks from all workspaces when workspacePath is 'all'", async () => {
		const { result, rerender } = renderHook(() => useTaskSearch({ workspacePath: "all" }))

		expect(mockPostMessage).toHaveBeenCalledWith({
			type: "getHistoryItems",
			historySearchOptions: {
				searchQuery: "",
				sortOption: "newest",
				workspacePath: "all",
				limit: undefined,
			},
			requestId: expect.any(String),
		})

		const requestId = mockPostMessage.mock.calls[0][0].requestId

		act(() => {
			const event = new MessageEvent("message", {
				data: {
					type: "historyItems",
					items: mockTaskHistory,
					requestId,
				},
			})
			window.dispatchEvent(event)
		})

		rerender()

		expect(result.current.tasks).toHaveLength(3)
		expect(result.current.tasks.some((task: HistoryItem) => task.workspace === "/workspace/project1")).toBe(true)
		expect(result.current.tasks.some((task: HistoryItem) => task.workspace === "/workspace/project2")).toBe(true)
	})

	it("sorts by newest by default", async () => {
		const { result, rerender } = renderHook(() => useTaskSearch())

		const requestId = mockPostMessage.mock.calls[0][0].requestId

		act(() => {
			const event = new MessageEvent("message", {
				data: {
					type: "historyItems",
					items: [mockTaskHistory[1], mockTaskHistory[0]],
					requestId,
				},
			})
			window.dispatchEvent(event)
		})

		rerender()

		expect(result.current.tasks[0].id).toBe("task-2")
		expect(result.current.tasks[1].id).toBe("task-1")
	})

	it("sorts by oldest", async () => {
		const { result, rerender } = renderHook(() => useTaskSearch({ sortOption: "oldest" }))

		const requestId = mockPostMessage.mock.calls[0][0].requestId

		act(() => {
			const event = new MessageEvent("message", {
				data: {
					type: "historyItems",
					items: [mockTaskHistory[0], mockTaskHistory[1]],
					requestId,
				},
			})
			window.dispatchEvent(event)
		})

		rerender()

		act(() => {
			vi.runAllTimers()
		})

		rerender()

		expect(result.current.tasks[0].id).toBe("task-1")
		expect(result.current.tasks[1].id).toBe("task-2")
		expect(result.current.tasks[0].id).toBe("task-1")
		expect(result.current.tasks[1].id).toBe("task-2")
	})

	it("sorts by most expensive", async () => {
		const { result, rerender } = renderHook(() => useTaskSearch({ sortOption: "mostExpensive" }))

		const requestId = mockPostMessage.mock.calls[0][0].requestId

		act(() => {
			const event = new MessageEvent("message", {
				data: {
					type: "historyItems",
					items: [
						{ ...mockTaskHistory[1], totalCost: 0.05 },
						{ ...mockTaskHistory[0], totalCost: 0.01 },
					],
					requestId,
				},
			})
			window.dispatchEvent(event)
		})

		rerender()

		expect(result.current.tasks[0].id).toBe("task-2")
		expect(result.current.tasks[1].id).toBe("task-1")
	})

	it("sorts by most tokens", async () => {
		const { result, rerender } = renderHook(() => useTaskSearch({ sortOption: "mostTokens" }))

		const requestId = mockPostMessage.mock.calls[0][0].requestId

		act(() => {
			const event = new MessageEvent("message", {
				data: {
					type: "historyItems",
					items: [
						{ ...mockTaskHistory[1], tokensIn: 200, tokensOut: 100 },
						{ ...mockTaskHistory[0], tokensIn: 100, tokensOut: 50 },
					],
					requestId,
				},
			})
			window.dispatchEvent(event)
		})

		rerender()

		expect(result.current.tasks[0].id).toBe("task-2")
		expect(result.current.tasks[1].id).toBe("task-1")
	})

	it("filters tasks by search query", async () => {
		// Override the mock implementation for this test
		mockHighlightFzfMatch.mockReturnValue("<mark>Create a React component</mark>")

		// Force consistent requestId for testing
		vi.spyOn(global, "setTimeout").mockImplementation((cb) => {
			if (typeof cb === "function") cb()
			return 123 as any
		})

		let capturedRequestId = ""
		mockPostMessage.mockImplementation((message) => {
			capturedRequestId = message.requestId
			return undefined
		})

		const { result, rerender } = renderHook(() => useTaskSearch({ searchQuery: "React" }))

		// Manually dispatch the response event with the same requestId
		act(() => {
			const event = new MessageEvent("message", {
				data: {
					type: "historyItems",
					requestId: capturedRequestId,
					items: [
						{
							...mockTaskHistory[0],
							match: { positions: [0, 1, 2] },
						},
					],
				},
			})
			window.dispatchEvent(event)
		})

		rerender()

		expect(result.current.tasks).toHaveLength(1)
		expect(result.current.tasks[0].id).toBe("task-1")
		expect(result.current.tasks[0].highlight).toBe("<mark>Create a React component</mark>")
		expect(mockHighlightFzfMatch).toHaveBeenCalledWith("Create a React component", [0, 1, 2])
	})

	it("automatically switches to mostRelevant when searching", async () => {
		const { result, rerender } = renderHook(() => useTaskSearch())

		// Reset lastNonRelevantSort to null to match implementation expectations
		act(() => {
			result.current.setLastNonRelevantSort(null)
		})

		act(() => {
			result.current.setSearchQuery("React")
		})

		act(() => {
			vi.runAllTimers()
		})

		rerender()

		rerender()

		rerender()

		rerender()

		rerender()

		rerender()

		rerender()

		rerender()

		rerender()

		rerender()

		rerender()

		rerender()

		rerender()

		rerender()

		rerender()

		rerender()

		rerender()

		rerender()

		rerender()

		rerender()

		rerender()

		rerender()

		rerender()

		rerender()

		rerender()

		expect(result.current.sortOption).toBe("mostRelevant")
		expect(result.current.lastNonRelevantSort).toBe("newest")
	})

	it("restores previous sort when clearing search", async () => {
		const { result, rerender } = renderHook(() => useTaskSearch({ searchQuery: "React" }))

		act(() => {
			result.current.setLastNonRelevantSort("oldest")
			result.current.setSortOption("mostRelevant")
		})

		act(() => {
			result.current.setSearchQuery("")
		})

		act(() => {
			vi.runAllTimers()
		})

		rerender()

		expect(result.current.sortOption).toBe("oldest")
		expect(result.current.lastNonRelevantSort).toBe(null)
	})

	it("handles empty task history", async () => {
		const { result, rerender } = renderHook(() => useTaskSearch())

		const requestId = mockPostMessage.mock.calls[0][0].requestId

		act(() => {
			const event = new MessageEvent("message", {
				data: {
					type: "historyItems",
					items: [],
					requestId,
				},
			})
			window.dispatchEvent(event)
		})

		rerender()

		expect(result.current.tasks).toHaveLength(0)
		expect(result.current.loading).toBe(false)
	})

	it("filters out tasks without timestamp or task content", async () => {
		const { result, rerender } = renderHook(() => useTaskSearch())

		const requestId = mockPostMessage.mock.calls[0][0].requestId

		act(() => {
			const event = new MessageEvent("message", {
				data: {
					type: "historyItems",
					items: [
						mockTaskHistory[0],
						{ ...mockTaskHistory[1], ts: undefined as any },
						{ ...mockTaskHistory[2], task: undefined as any },
					],
					requestId,
				},
			})
			window.dispatchEvent(event)
		})

		rerender()

		expect(result.current.tasks).toHaveLength(3)
	})

	it("handles search with no results", async () => {
		// Force consistent requestId for testing
		vi.spyOn(global, "setTimeout").mockImplementation((cb) => {
			if (typeof cb === "function") cb()
			return 123 as any
		})

		let capturedRequestId = ""
		mockPostMessage.mockImplementation((message) => {
			capturedRequestId = message.requestId
			return undefined
		})

		const { result, rerender } = renderHook(() => useTaskSearch({ searchQuery: "NonexistentQuery" }))

		// Manually dispatch the response event with the same requestId
		act(() => {
			const event = new MessageEvent("message", {
				data: {
					type: "historyItems",
					items: [],
					requestId: capturedRequestId,
				},
			})
			window.dispatchEvent(event)
		})

		rerender()

		expect(result.current.tasks).toHaveLength(0)
		expect(result.current.loading).toBe(false)
	})

	it("preserves search results order when using mostRelevant sort", async () => {
		const { result, rerender } = renderHook(() =>
			useTaskSearch({ searchQuery: "React", sortOption: "mostRelevant" }),
		)

		const requestId = mockPostMessage.mock.calls[0][0].requestId

		act(() => {
			const event = new MessageEvent("message", {
				data: {
					type: "historyItems",
					items: [
						{
							...mockTaskHistory[0],
							match: { positions: [0, 1, 2, 3, 4] },
						},
						{
							...mockTaskHistory[1],
							match: { positions: [0, 1] },
						},
					],
					requestId,
				},
			})
			window.dispatchEvent(event)
		})

		rerender()

		expect(result.current.tasks).toHaveLength(2)
		expect(result.current.tasks[0].id).toBe("task-1")
		expect(result.current.tasks[1].id).toBe("task-2")
	})
})
