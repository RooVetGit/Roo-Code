import { taskCommand } from "../../src/commands/task"
import { displayBox, displayTextInput } from "../../src/utils/display"
import { MockWebSocketClient } from "../utils/websocket-client.mock"

// Mock the display utility and chalk
jest.mock("../../src/utils/display", () => ({
	displayBox: jest.fn(),
	displayTextInput: jest.fn(),
}))
jest.mock("chalk", () => ({
	yellow: jest.fn((text) => text),
	red: jest.fn((text) => text),
}))

describe("taskCommand", () => {
	let mockWsClient: MockWebSocketClient
	let command: any
	let consoleErrorSpy: jest.SpyInstance
	let consoleLogSpy: jest.SpyInstance

	beforeEach(() => {
		// Create a new mock WebSocketClient
		mockWsClient = new MockWebSocketClient()
		mockWsClient.connect()

		// Create the command
		command = taskCommand(mockWsClient as any)

		// Mock console.error and console.log
		consoleErrorSpy = jest.spyOn(console, "error").mockImplementation()
		consoleLogSpy = jest.spyOn(console, "log").mockImplementation()

		// Reset all mocks
		jest.clearAllMocks()
	})

	afterEach(() => {
		// Restore console.error and console.log
		consoleErrorSpy.mockRestore()
		consoleLogSpy.mockRestore()

		// Reset mock responses
		mockWsClient.resetMocks()
	})

	describe("task new", () => {
		it("should create a new task with a message", async () => {
			// Set up the mock response
			const taskId = "task123"
			mockWsClient.setMockResponse("startNewTask", taskId)

			// Execute the command with a message
			await command.parseAsync(["task", "new", "Test task message"])

			// Verify that the command was sent with the correct parameters
			expect(mockWsClient.sendCommand).toHaveBeenCalledWith("startNewTask", {
				text: "Test task message",
				newTab: false,
			})

			// Verify that the result was displayed
			expect(displayBox).toHaveBeenCalledWith("Task Created", "New task created with ID: task123", "success")
		})

		it("should create a new task in a new tab", async () => {
			// Set up the mock response
			const taskId = "task123"
			mockWsClient.setMockResponse("startNewTask", taskId)

			// Execute the command with a message and the --tab option
			await command.parseAsync(["task", "new", "Test task message", "--tab"])

			// Verify that the command was sent with the correct parameters
			expect(mockWsClient.sendCommand).toHaveBeenCalledWith("startNewTask", {
				text: "Test task message",
				newTab: true,
			})
		})

		it("should prompt for a message when --interactive is used", async () => {
			// Set up the mock response
			const taskId = "task123"
			mockWsClient.setMockResponse("startNewTask", taskId)

			// Mock the text input to return a message
			;(displayTextInput as jest.Mock).mockResolvedValue("Interactive task message")

			// Execute the command with the --interactive option
			await command.parseAsync(["task", "new", "--interactive"])

			// Verify that the text input was displayed
			expect(displayTextInput).toHaveBeenCalledWith("Enter your task message:")

			// Verify that the command was sent with the correct parameters
			expect(mockWsClient.sendCommand).toHaveBeenCalledWith("startNewTask", {
				text: "Interactive task message",
				newTab: false,
			})
		})

		it("should prompt for a message when no message is provided", async () => {
			// Set up the mock response
			const taskId = "task123"
			mockWsClient.setMockResponse("startNewTask", taskId)

			// Mock the text input to return a message
			;(displayTextInput as jest.Mock).mockResolvedValue("Prompted task message")

			// Execute the command without a message
			await command.parseAsync(["task", "new"])

			// Verify that the text input was displayed
			expect(displayTextInput).toHaveBeenCalledWith("Enter your task message:")

			// Verify that the command was sent with the correct parameters
			expect(mockWsClient.sendCommand).toHaveBeenCalledWith("startNewTask", {
				text: "Prompted task message",
				newTab: false,
			})
		})

		it("should cancel task creation if no message is provided in interactive mode", async () => {
			// Mock the text input to return null (cancelled)
			;(displayTextInput as jest.Mock).mockResolvedValue(null)

			// Execute the command with the --interactive option
			await command.parseAsync(["task", "new", "--interactive"])

			// Verify that the text input was displayed
			expect(displayTextInput).toHaveBeenCalledWith("Enter your task message:")

			// Verify that the command was not sent
			expect(mockWsClient.sendCommand).not.toHaveBeenCalled()

			// Verify that the cancellation message was logged
			expect(consoleLogSpy).toHaveBeenCalledWith(
				expect.stringContaining("No message provided. Task creation cancelled."),
			)
		})

		it("should handle errors", async () => {
			// Set up the mock error
			const error = new Error("Failed to create task")
			mockWsClient.setMockError("startNewTask", error)

			// Execute the command with a message
			await command.parseAsync(["task", "new", "Test task message"])

			// Verify that the error was logged
			expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining("Failed to create task"))
		})

		it("should set up event listeners for streaming responses", async () => {
			// Set up the mock response
			const taskId = "task123"
			mockWsClient.setMockResponse("startNewTask", taskId)

			// Spy on the on method
			const onSpy = jest.spyOn(mockWsClient, "on")

			// Execute the command with a message
			await command.parseAsync(["task", "new", "Test task message"])

			// Verify that the event listener was set up
			expect(onSpy).toHaveBeenCalledWith("message", expect.any(Function))

			// Test the event handler
			const handler = onSpy.mock.calls[0][1]

			// Simulate a message event with matching taskId
			handler([{ taskId: "task123", message: { text: "Response from task" } }])

			// Verify that the message was logged
			expect(consoleLogSpy).toHaveBeenCalledWith("Response from task")

			// Simulate a message event with non-matching taskId
			handler([{ taskId: "other-task", message: { text: "Response from other task" } }])

			// Verify that the message was not logged
			expect(consoleLogSpy).not.toHaveBeenCalledWith("Response from other task")

			// Restore the spy
			onSpy.mockRestore()
		})
	})

	describe("task resume", () => {
		it("should resume a task", async () => {
			// Set up the mock responses
			mockWsClient.setMockResponse("isTaskInHistory", true)

			// Execute the command
			await command.parseAsync(["task", "resume", "task123"])

			// Verify that the commands were sent with the correct parameters
			expect(mockWsClient.sendCommand).toHaveBeenCalledWith("isTaskInHistory", { taskId: "task123" })
			expect(mockWsClient.sendCommand).toHaveBeenCalledWith("resumeTask", { taskId: "task123" })

			// Verify that the result was displayed
			expect(displayBox).toHaveBeenCalledWith("Task Resumed", "Task task123 has been resumed", "success")
		})

		it("should handle non-existent tasks", async () => {
			// Set up the mock response
			mockWsClient.setMockResponse("isTaskInHistory", false)

			// Execute the command
			await command.parseAsync(["task", "resume", "task123"])

			// Verify that only the check command was sent
			expect(mockWsClient.sendCommand).toHaveBeenCalledWith("isTaskInHistory", { taskId: "task123" })
			expect(mockWsClient.sendCommand).not.toHaveBeenCalledWith("resumeTask", expect.anything())

			// Verify that the error was logged
			expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining("Task with ID task123 does not exist"))
		})

		it("should handle errors when checking task existence", async () => {
			// Set up the mock error
			const error = new Error("Failed to check task existence")
			mockWsClient.setMockError("isTaskInHistory", error)

			// Execute the command
			await command.parseAsync(["task", "resume", "task123"])

			// Verify that the error was logged
			expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining("Failed to check task existence"))
		})

		it("should handle errors when resuming a task", async () => {
			// Set up the mock responses and error
			mockWsClient.setMockResponse("isTaskInHistory", true)
			const error = new Error("Failed to resume task")
			mockWsClient.setMockError("resumeTask", error)

			// Execute the command
			await command.parseAsync(["task", "resume", "task123"])

			// Verify that the error was logged
			expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining("Failed to resume task"))
		})
	})

	describe("task clear", () => {
		it("should clear the current task", async () => {
			// Execute the command
			await command.parseAsync(["task", "clear"])

			// Verify that the command was sent with the correct parameters
			expect(mockWsClient.sendCommand).toHaveBeenCalledWith("clearCurrentTask", { lastMessage: undefined })

			// Verify that the result was displayed
			expect(displayBox).toHaveBeenCalledWith("Task Cleared", "Current task has been cleared", "success")
		})

		it("should clear the current task with a final message", async () => {
			// Execute the command with a message
			await command.parseAsync(["task", "clear", "--message", "Final message"])

			// Verify that the command was sent with the correct parameters
			expect(mockWsClient.sendCommand).toHaveBeenCalledWith("clearCurrentTask", { lastMessage: "Final message" })
		})

		it("should handle errors", async () => {
			// Set up the mock error
			const error = new Error("Failed to clear task")
			mockWsClient.setMockError("clearCurrentTask", error)

			// Execute the command
			await command.parseAsync(["task", "clear"])

			// Verify that the error was logged
			expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining("Failed to clear task"))
		})
	})

	describe("task cancel", () => {
		it("should cancel the current task", async () => {
			// Execute the command
			await command.parseAsync(["task", "cancel"])

			// Verify that the command was sent
			expect(mockWsClient.sendCommand).toHaveBeenCalledWith("cancelCurrentTask")

			// Verify that the result was displayed
			expect(displayBox).toHaveBeenCalledWith("Task Cancelled", "Current task has been cancelled", "success")
		})

		it("should handle errors", async () => {
			// Set up the mock error
			const error = new Error("Failed to cancel task")
			mockWsClient.setMockError("cancelCurrentTask", error)

			// Execute the command
			await command.parseAsync(["task", "cancel"])

			// Verify that the error was logged
			expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining("Failed to cancel task"))
		})
	})

	describe("task message", () => {
		it("should send a message to the current task", async () => {
			// Execute the command with a message
			await command.parseAsync(["task", "message", "Test message"])

			// Verify that the command was sent with the correct parameters
			expect(mockWsClient.sendCommand).toHaveBeenCalledWith("sendMessage", { text: "Test message" })

			// Verify that the result was displayed
			expect(displayBox).toHaveBeenCalledWith(
				"Message Sent",
				"Message has been sent to the current task",
				"success",
			)
		})

		it("should prompt for a message when --interactive is used", async () => {
			// Mock the text input to return a message
			;(displayTextInput as jest.Mock).mockResolvedValue("Interactive message")

			// Execute the command with the --interactive option
			await command.parseAsync(["task", "message", "Initial message", "--interactive"])

			// Verify that the text input was displayed with the initial message
			expect(displayTextInput).toHaveBeenCalledWith("Enter your message:", "Initial message")

			// Verify that the command was sent with the correct parameters
			expect(mockWsClient.sendCommand).toHaveBeenCalledWith("sendMessage", { text: "Interactive message" })
		})

		it("should handle errors", async () => {
			// Set up the mock error
			const error = new Error("Failed to send message")
			mockWsClient.setMockError("sendMessage", error)

			// Execute the command with a message
			await command.parseAsync(["task", "message", "Test message"])

			// Verify that the error was logged
			expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining("Failed to send message"))
		})
	})
})
