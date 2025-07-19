import type { Task } from "../../task/Task"

export function getTodoContext(cline: Task) {
	if (cline.todoList && cline.todoList.length > 0) {
		const todoLines = cline.todoList
			.map((todo) => {
				let statusPrefix = "[ ]" // pending
				if (todo.status === "in_progress") statusPrefix = "[-]"
				else if (todo.status === "completed") statusPrefix = "[x]"
				return `${statusPrefix} ${todo.content}`
			})
			.join("\n")

		const todoText = [
			todoLines,
			"IMPORTANT: When task status changes, remember to call the `update_todo_list` tool to update your progress.",
		].join("\n")

		return {
			todo: {
				"#text": todoText,
			},
		}
	}
	return {
		todo: {
			"#text":
				"You have not created a todo list yet. Create one with `update_todo_list` if your task is complicated or involves multiple steps.",
		},
	}
}
