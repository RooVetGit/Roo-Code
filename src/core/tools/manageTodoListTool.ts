import { Task } from "../task/Task"
import { ToolUse, AskApproval, HandleError, PushToolResult, RemoveClosingTag } from "../../shared/tools"
import { formatResponse } from "../prompts/responses"

interface TodoItem {
	id: number
	description: string
	completed: boolean
	createdAt: Date
}

export async function manageTodoListTool(
	cline: Task,
	block: ToolUse,
	askApproval: AskApproval,
	handleError: HandleError,
	pushToolResult: PushToolResult,
	removeClosingTag: RemoveClosingTag,
) {
	const todoAction: string | undefined = block.params.todo_action
	const todoItem: string | undefined = block.params.todo_item
	const itemId: string | undefined = block.params.item_id

	try {
		if (block.partial) {
			await cline
				.ask(
					"tool",
					JSON.stringify({ tool: "manageTodoList", action: removeClosingTag("todo_action", todoAction) }),
					block.partial,
				)
				.catch(() => {})
			return
		} else {
			if (!todoAction) {
				cline.consecutiveMistakeCount++
				cline.recordToolError("manage_todo_list")
				pushToolResult(await cline.sayAndCreateMissingParamError("manage_todo_list", "todo_action"))
				return
			}

			cline.consecutiveMistakeCount = 0

			// Get or initialize the todo list from task state
			let todoList: TodoItem[] = cline.todoList || []
			let nextId = cline.nextTodoId || 1

			let result = ""

			switch (todoAction) {
				case "add": {
					if (!todoItem) {
						cline.consecutiveMistakeCount++
						cline.recordToolError("manage_todo_list")
						pushToolResult(await cline.sayAndCreateMissingParamError("manage_todo_list", "todo_item"))
						return
					}

					const newItem: TodoItem = {
						id: nextId,
						description: todoItem,
						completed: false,
						createdAt: new Date(),
					}
					todoList.push(newItem)
					cline.nextTodoId = nextId + 1
					result = `Added todo item #${nextId}: "${todoItem}"`
					break
				}

				case "complete": {
					if (!itemId) {
						cline.consecutiveMistakeCount++
						cline.recordToolError("manage_todo_list")
						pushToolResult(await cline.sayAndCreateMissingParamError("manage_todo_list", "item_id"))
						return
					}

					const id = parseInt(itemId)
					const item = todoList.find((item) => item.id === id)
					if (!item) {
						result = `Todo item #${id} not found`
					} else if (item.completed) {
						result = `Todo item #${id} is already completed`
					} else {
						item.completed = true
						result = `Marked todo item #${id} as completed: "${item.description}"`
					}
					break
				}

				case "list": {
					if (todoList.length === 0) {
						result = "Todo list is empty"
					} else {
						const pendingItems = todoList.filter((item) => !item.completed)
						const completedItems = todoList.filter((item) => item.completed)

						result = "Current Todo List:\n\n"

						if (pendingItems.length > 0) {
							result += "📋 Pending Items:\n"
							pendingItems.forEach((item) => {
								result += `  ${item.id}. [ ] ${item.description}\n`
							})
						}

						if (completedItems.length > 0) {
							result += "\n✅ Completed Items:\n"
							completedItems.forEach((item) => {
								result += `  ${item.id}. [✓] ${item.description}\n`
							})
						}

						result += `\nTotal: ${todoList.length} items (${pendingItems.length} pending, ${completedItems.length} completed)`
					}
					break
				}

				case "clear_completed": {
					const completedCount = todoList.filter((item) => item.completed).length
					todoList = todoList.filter((item) => !item.completed)
					result = `Cleared ${completedCount} completed items from todo list`
					break
				}

				case "clear_all": {
					const totalCount = todoList.length
					todoList = []
					cline.nextTodoId = 1
					result = `Cleared all ${totalCount} items from todo list`
					break
				}

				default:
					result = `Invalid todo_action: "${todoAction}". Valid actions are: add, complete, list, clear_completed, clear_all`
					break
			}

			// Save the updated todo list back to the task
			cline.todoList = todoList

			const didApprove = await askApproval(
				"tool",
				JSON.stringify({
					tool: "manageTodoList",
					action: todoAction,
					result: result,
				}),
			)

			if (!didApprove) {
				return
			}

			pushToolResult(result)
		}
	} catch (error) {
		await handleError("managing todo list", error)
		return
	}
}
