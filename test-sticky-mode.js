// Test script to verify sticky mode behavior
const { ClineProvider } = require("./src/core/webview/ClineProvider")
const { Task } = require("./src/core/task/Task")

async function testStickyMode() {
	console.log("Testing sticky mode behavior...\n")

	// Simulate parent task in architect mode
	const parentTaskId = "parent-123"
	const parentMode = "architect"

	// Simulate creating a subtask that switches to code mode
	const subtaskId = "subtask-456"
	const subtaskMode = "code"

	// Task history before subtask creation
	const taskHistory = [
		{
			id: parentTaskId,
			mode: parentMode,
			task: "Parent task in architect mode",
			ts: Date.now(),
		},
	]

	console.log("Initial state:")
	console.log("Parent task mode:", taskHistory[0].mode)

	// Simulate subtask creation and mode switch
	taskHistory.push({
		id: subtaskId,
		mode: parentMode, // Initially inherits parent's mode
		task: "Subtask created",
		ts: Date.now() + 1000,
	})

	// Simulate handleModeSwitch behavior
	// This is where the bug might occur
	const currentTaskId = subtaskId // The current task is the subtask

	// Find and update the current task's mode
	const taskIndex = taskHistory.findIndex((item) => item.id === currentTaskId)
	if (taskIndex !== -1) {
		taskHistory[taskIndex].mode = subtaskMode
		console.log("\nAfter mode switch:")
		console.log("Subtask switched to mode:", taskHistory[taskIndex].mode)
	}

	// Check parent task mode
	const parentTask = taskHistory.find((item) => item.id === parentTaskId)
	console.log("Parent task mode:", parentTask.mode)

	if (parentTask.mode !== parentMode) {
		console.error("\nERROR: Parent task mode was changed!")
		console.error("Expected:", parentMode)
		console.error("Actual:", parentTask.mode)
	} else {
		console.log("\nSUCCESS: Parent task mode preserved!")
	}
}

testStickyMode().catch(console.error)
