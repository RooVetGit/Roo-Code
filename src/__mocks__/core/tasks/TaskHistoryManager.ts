// Mock implementation of TaskHistoryManager
export const TaskHistoryManager = jest.fn().mockImplementation(() => ({
	getTaskWithId: jest.fn().mockResolvedValue({
		historyItem: {
			id: "test-task-id",
			ts: 123456789,
			task: "Test task",
			tokensIn: 100,
			tokensOut: 200,
			totalCost: 0.01,
		},
		taskDirPath: "/test/path",
		apiConversationHistoryFilePath: "/test/path/api_conversation_history.json",
		uiMessagesFilePath: "/test/path/ui_messages.json",
		apiConversationHistory: [],
	}),
	showTaskWithId: jest.fn().mockResolvedValue({
		id: "test-task-id",
		ts: 123456789,
		task: "Test task",
		tokensIn: 100,
		tokensOut: 200,
		totalCost: 0.01,
	}),
	exportTaskWithId: jest.fn().mockResolvedValue(undefined),
	deleteTaskWithId: jest.fn().mockResolvedValue(undefined),
	deleteTaskFromState: jest.fn().mockResolvedValue(undefined),
	updateTaskHistory: jest.fn().mockResolvedValue([
		{
			id: "test-task-id",
			ts: 123456789,
			task: "Test task",
			tokensIn: 100,
			tokensOut: 200,
			totalCost: 0.01,
		},
	]),
}))

export const GlobalFileNames = {
	apiConversationHistory: "api_conversation_history.json",
	uiMessages: "ui_messages.json",
}
