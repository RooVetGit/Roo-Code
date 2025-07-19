import { ClineMessage } from "@roo-code/types"
export function getLatestTodo(clineMessages: ClineMessage[]) {
	const filteredMessages = clineMessages.filter(
		(msg) => (msg.type === "ask" && msg.ask === "tool") || (msg.type === "say" && msg.say === "user_edit_todos"),
	)

	const parsedItems = filteredMessages.map((msg) => {
		try {
			const text = msg.text ?? "{}"
			const parsed = JSON.parse(text)
			return parsed
		} catch (error) {
			return null
		}
	})

	const todoItems = parsedItems.filter((item) => {
		if (!item) {
			return false
		}

		const hasTool = item.tool === "updateTodoList"
		const hasTodos = item.todos !== undefined
		const isArrayTodos = Array.isArray(item.todos)

		return hasTool && hasTodos && isArrayTodos
	})

	if (todoItems.length === 0) {
		return []
	}

	const todos = todoItems.map((item) => item.todos).pop()

	if (todos && Array.isArray(todos)) {
		return todos
	} else {
		return []
	}
}
