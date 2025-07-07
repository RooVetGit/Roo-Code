import { render, screen } from "@testing-library/react"
import { describe, it, expect, vi } from "vitest"
import UpdateTodoListToolBlock from "../UpdateTodoListToolBlock"

// Mock react-i18next
vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string, options?: { content?: string }) => {
			const translations: Record<string, string> = {
				"chat:fileOperations.todoChanges.noChanges": "No changes",
				"chat:fileOperations.todoChanges.added": `Added: ${options?.content || ""}`,
				"chat:fileOperations.todoChanges.completed": `Completed: ${options?.content || ""}`,
				"chat:fileOperations.todoChanges.started": `Started: ${options?.content || ""}`,
				"chat:fileOperations.todoChanges.removed": `Removed: ${options?.content || ""}`,
				"chat:fileOperations.todoChanges.reordered": `Reordered: ${options?.content || ""}`,
				"chat:fileOperations.todoChanges.reverted": `Reverted: ${options?.content || ""}`,
				"chat:fileOperations.todoListUpdated": "Todo list updated",
			}
			return translations[key] || key
		},
	}),
	initReactI18next: {
		type: "3rdParty",
		init: vi.fn(),
	},
}))

describe("UpdateTodoListToolBlock", () => {
	const mockOnChange = vi.fn()

	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("should show added todos when no previous todos", () => {
		const todos = [{ id: "1", content: "New task", status: "" }]

		render(<UpdateTodoListToolBlock todos={todos} previousTodos={[]} onChange={mockOnChange} />)

		expect(screen.getByText("Added: New task")).toBeInTheDocument()
	})

	it("should show completed todos", () => {
		const previousTodos = [{ id: "1", content: "Task 1", status: "" }]
		const todos = [{ id: "1", content: "Task 1", status: "completed" }]

		render(<UpdateTodoListToolBlock todos={todos} previousTodos={previousTodos} onChange={mockOnChange} />)

		expect(screen.getByText("Completed: Task 1")).toBeInTheDocument()
	})

	it("should show started todos", () => {
		const previousTodos = [{ id: "1", content: "Task 1", status: "" }]
		const todos = [{ id: "1", content: "Task 1", status: "in_progress" }]

		render(<UpdateTodoListToolBlock todos={todos} previousTodos={previousTodos} onChange={mockOnChange} />)

		expect(screen.getByText("Started: Task 1")).toBeInTheDocument()
	})

	it("should show removed todos", () => {
		const previousTodos = [
			{ id: "1", content: "Task 1", status: "" },
			{ id: "2", content: "Task 2", status: "" },
		]
		const todos = [{ id: "1", content: "Task 1", status: "" }]

		render(<UpdateTodoListToolBlock todos={todos} previousTodos={previousTodos} onChange={mockOnChange} />)

		expect(screen.getByText("Removed: Task 2")).toBeInTheDocument()
	})

	it("should show no changes when todos are identical", () => {
		const todos = [{ id: "1", content: "Task 1", status: "" }]

		render(<UpdateTodoListToolBlock todos={todos} previousTodos={todos} onChange={mockOnChange} />)

		expect(screen.getByText("No changes")).toBeInTheDocument()
	})

	it("should show multiple changes", () => {
		const previousTodos = [
			{ id: "1", content: "Task 1", status: "" },
			{ id: "2", content: "Task 2", status: "in_progress" },
			{ id: "3", content: "Task 3", status: "" },
		]
		const todos = [
			{ id: "1", content: "Task 1", status: "completed" },
			{ id: "2", content: "Task 2", status: "completed" },
			{ id: "4", content: "New Task", status: "" },
		]

		render(<UpdateTodoListToolBlock todos={todos} previousTodos={previousTodos} onChange={mockOnChange} />)

		expect(screen.getByText("Completed: Task 1")).toBeInTheDocument()
		expect(screen.getByText("Completed: Task 2")).toBeInTheDocument()
		expect(screen.getByText("Removed: Task 3")).toBeInTheDocument()
		expect(screen.getByText("Added: New Task")).toBeInTheDocument()
	})

	it("should show reordered todos when position changes", () => {
		const previousTodos = [
			{ id: "1", content: "Task 1", status: "" },
			{ id: "2", content: "Task 2", status: "" },
			{ id: "3", content: "Task 3", status: "" },
		]
		const todos = [
			{ id: "3", content: "Task 3", status: "" },
			{ id: "1", content: "Task 1", status: "" },
			{ id: "2", content: "Task 2", status: "" },
		]

		render(<UpdateTodoListToolBlock todos={todos} previousTodos={previousTodos} onChange={mockOnChange} />)

		expect(screen.getByText("Reordered: Task 3")).toBeInTheDocument()
		expect(screen.getByText("Reordered: Task 1")).toBeInTheDocument()
		expect(screen.getByText("Reordered: Task 2")).toBeInTheDocument()
	})

	it("should show reverted when todo goes from completed to pending", () => {
		const previousTodos = [{ id: "1", content: "Task 1", status: "completed" }]
		const todos = [{ id: "1", content: "Task 1", status: "" }]

		render(<UpdateTodoListToolBlock todos={todos} previousTodos={previousTodos} onChange={mockOnChange} />)

		expect(screen.getByText("Reverted: Task 1")).toBeInTheDocument()
	})

	it("should show reverted when todo goes from in_progress to pending", () => {
		const previousTodos = [{ id: "1", content: "Task 1", status: "in_progress" }]
		const todos = [{ id: "1", content: "Task 1", status: "" }]

		render(<UpdateTodoListToolBlock todos={todos} previousTodos={previousTodos} onChange={mockOnChange} />)

		expect(screen.getByText("Reverted: Task 1")).toBeInTheDocument()
	})

	it("should show reverted when todo goes from completed to in_progress", () => {
		const previousTodos = [{ id: "1", content: "Task 1", status: "completed" }]
		const todos = [{ id: "1", content: "Task 1", status: "in_progress" }]

		render(<UpdateTodoListToolBlock todos={todos} previousTodos={previousTodos} onChange={mockOnChange} />)

		expect(screen.getByText("Reverted: Task 1")).toBeInTheDocument()
	})

	it("should prioritize status change over reordering", () => {
		const previousTodos = [
			{ id: "1", content: "Task 1", status: "" },
			{ id: "2", content: "Task 2", status: "" },
		]
		const todos = [
			{ id: "2", content: "Task 2", status: "completed" },
			{ id: "1", content: "Task 1", status: "" },
		]

		render(<UpdateTodoListToolBlock todos={todos} previousTodos={previousTodos} onChange={mockOnChange} />)

		// Should show completed status change, not reordering
		expect(screen.getByText("Completed: Task 2")).toBeInTheDocument()
		expect(screen.getByText("Reordered: Task 1")).toBeInTheDocument()
		// Task 2 should not show as reordered since it has a status change
		expect(screen.queryByText("Reordered: Task 2")).not.toBeInTheDocument()
	})

	it("should handle mixed changes correctly", () => {
		const previousTodos = [
			{ id: "1", content: "Task 1", status: "completed" },
			{ id: "2", content: "Task 2", status: "" },
			{ id: "3", content: "Task 3", status: "in_progress" },
			{ id: "4", content: "Task 4", status: "" },
		]
		const todos = [
			{ id: "4", content: "Task 4", status: "" }, // reordered (3→0)
			{ id: "2", content: "Task 2", status: "completed" }, // completed
			{ id: "1", content: "Task 1", status: "" }, // reverted
			{ id: "5", content: "New Task", status: "" }, // added
		]

		render(<UpdateTodoListToolBlock todos={todos} previousTodos={previousTodos} onChange={mockOnChange} />)

		expect(screen.getByText("Added: New Task")).toBeInTheDocument()
		expect(screen.getByText("Removed: Task 3")).toBeInTheDocument()
		expect(screen.getByText("Completed: Task 2")).toBeInTheDocument()
		expect(screen.getByText("Reverted: Task 1")).toBeInTheDocument()
		expect(screen.getByText("Reordered: Task 4")).toBeInTheDocument()
	})
})
