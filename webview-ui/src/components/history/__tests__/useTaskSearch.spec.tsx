// cd webview-ui && npx vitest run src/components/history/__tests__/useTaskSearch.spec.tsx

import { renderHook } from "@testing-library/react"
import { describe, it, expect, vi } from "vitest"
import { useTaskSearch } from "../useTaskSearch"
import type { HistoryItem } from "@roo-code/types"

const mockTaskHistory: HistoryItem[] = [
	{
		number: 1,
		id: "task1",
		ts: 1000,
		task: "Task 1",
		tokensIn: 100,
		tokensOut: 200,
		totalCost: 0.01,
		isStarred: false,
		workspace: "/test",
	},
	{
		number: 2,
		id: "task2",
		ts: 2000,
		task: "Task 2",
		tokensIn: 150,
		tokensOut: 250,
		totalCost: 0.02,
		isStarred: true,
		workspace: "/test",
	},
	{
		number: 3,
		id: "task3",
		ts: 3000,
		task: "Task 3",
		tokensIn: 200,
		tokensOut: 300,
		totalCost: 0.03,
		isStarred: false,
		workspace: "/test",
	},
	{
		number: 4,
		id: "task4",
		ts: 4000,
		task: "Task 4",
		tokensIn: 250,
		tokensOut: 350,
		totalCost: 0.04,
		isStarred: true,
		workspace: "/test",
	},
]

// Mock the useExtensionState hook
vi.mock("@/context/ExtensionStateContext", () => ({
	useExtensionState: vi.fn(() => ({
		taskHistory: mockTaskHistory,
		cwd: "/test",
	})),
}))

describe("useTaskSearch", () => {
	it("should sort starred tasks to the top", () => {
		const { result } = renderHook(() => useTaskSearch())

		// Check that starred tasks (task2 and task4) are at the top
		expect(result.current.tasks[0].id).toBe("task4")
		expect(result.current.tasks[1].id).toBe("task2")
		expect(result.current.tasks[2].id).toBe("task3")
		expect(result.current.tasks[3].id).toBe("task1")
	})

	it("should maintain sort order within starred and unstarred groups", () => {
		const { result } = renderHook(() => useTaskSearch())

		// Starred tasks should be sorted by newest first
		const starredTasks = result.current.tasks.filter((t) => t.isStarred)
		expect(starredTasks[0].id).toBe("task4") // newer
		expect(starredTasks[1].id).toBe("task2") // older

		// Unstarred tasks should also be sorted by newest first
		const unstarredTasks = result.current.tasks.filter((t) => !t.isStarred)
		expect(unstarredTasks[0].id).toBe("task3") // newer
		expect(unstarredTasks[1].id).toBe("task1") // older
	})

	it("should handle empty task history", async () => {
		const { useExtensionState } = await import("@/context/ExtensionStateContext")
		vi.mocked(useExtensionState).mockReturnValueOnce({
			taskHistory: [],
			cwd: "/test",
		} as any)

		const { result } = renderHook(() => useTaskSearch())

		expect(result.current.tasks).toEqual([])
	})

	it("should handle all starred tasks", async () => {
		const allStarredTasks = mockTaskHistory.map((task) => ({ ...task, isStarred: true }))
		const { useExtensionState } = await import("@/context/ExtensionStateContext")
		vi.mocked(useExtensionState).mockReturnValueOnce({
			taskHistory: allStarredTasks,
			cwd: "/test",
		} as any)

		const { result } = renderHook(() => useTaskSearch())

		// All tasks should be present and sorted by newest first
		expect(result.current.tasks.length).toBe(4)
		expect(result.current.tasks[0].id).toBe("task4")
		expect(result.current.tasks[1].id).toBe("task3")
		expect(result.current.tasks[2].id).toBe("task2")
		expect(result.current.tasks[3].id).toBe("task1")
	})
})
