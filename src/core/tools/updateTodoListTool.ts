import { Task, TodoItem, TodoStatus } from "../task/Task"
import { ToolUse, AskApproval, HandleError, PushToolResult, RemoveClosingTag } from "../../shared/tools"
import { formatResponse } from "../prompts/responses"

const VALID_STATUS: string[] = ["pending", "in_progress", "completed", "todo", "doing", "done"]

function normalizeStatus(status: string | undefined): TodoStatus {
	if (status === "completed" || status === "done") return "completed"
	if (status === "in_progress" || status === "doing" || status === "working" || status === "doing")
		return "in_progress"
	return "pending"
}

import crypto from "crypto"

function parseMarkdownChecklist(md: string): TodoItem[] {
	if (typeof md !== "string") return []
	const lines = md
		.split(/\r?\n/)
		.map((l) => l.trim())
		.filter(Boolean)
	const todos: TodoItem[] = []
	for (const line of lines) {
		const match = line.match(/^\[\s*([ xX\-~])\s*\]\s+(.+)$/)
		if (!match) continue
		let status: TodoStatus = "pending"
		if (match[1] === "x" || match[1] === "X") status = "completed"
		else if (match[1] === "-" || match[1] === "~") status = "in_progress"
		const id = crypto
			.createHash("md5")
			.update(match[2] + status)
			.digest("hex")
		todos.push({
			id,
			content: match[2],
			status,
		})
	}
	return todos
}

function validateTodos(todos: any[]): { valid: boolean; error?: string } {
	if (!Array.isArray(todos)) return { valid: false, error: "todos must be an array" }
	for (const [i, t] of todos.entries()) {
		if (!t || typeof t !== "object") return { valid: false, error: `Item ${i + 1} is not an object` }
		if (!t.id || typeof t.id !== "string") return { valid: false, error: `Item ${i + 1} is missing id` }
		if (!t.content || typeof t.content !== "string")
			return { valid: false, error: `Item ${i + 1} is missing content` }
		if (t.status && !VALID_STATUS.includes(t.status))
			return { valid: false, error: `Item ${i + 1} has invalid status` }
	}
	return { valid: true }
}

export async function updateTodoListTool(
	cline: Task,
	block: ToolUse,
	askApproval: AskApproval,
	handleError: HandleError,
	pushToolResult: PushToolResult,
	removeClosingTag: RemoveClosingTag,
) {
	try {
		if ((block as any).partial) {
			return
		}
		const todosRaw = (block.params as any).todos
		let todos: TodoItem[]
		try {
			if (typeof todosRaw === "string") {
				todos = parseMarkdownChecklist(todosRaw)
				if (!todos.length) {
					todos = JSON.parse(todosRaw)
				}
			} else {
				todos = todosRaw
			}
		} catch {
			cline.consecutiveMistakeCount++
			cline.recordToolError("update_todo_list")
			pushToolResult(formatResponse.toolError("The todos parameter is not valid markdown checklist or JSON"))
			return
		}

		const { valid, error } = validateTodos(todos)
		if (!valid) {
			cline.consecutiveMistakeCount++
			cline.recordToolError("update_todo_list")
			pushToolResult(formatResponse.toolError(error || "todos parameter validation failed"))
			return
		}

		const normalizedTodos: TodoItem[] = todos.map((t) => ({
			id: t.id,
			content: t.content,
			status: normalizeStatus(t.status),
		}))

		const approvalMsg = JSON.stringify({
			tool: "updateTodoList",
			todos: normalizedTodos,
		})
		const didApprove = await askApproval("tool", approvalMsg)
		if (!didApprove) {
			pushToolResult("User declined to update the todoList.")
			return
		}

		await cline.setTodoList(normalizedTodos)

		pushToolResult(formatResponse.toolResult("Todo list updated successfully."))
	} catch (error) {
		await handleError("update todo list", error)
	}
}
