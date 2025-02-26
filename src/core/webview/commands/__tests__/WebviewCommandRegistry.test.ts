import { WebviewCommandRegistry } from "../WebviewCommandRegistry"
import { WebviewCommandHandler } from "../WebviewCommandHandler"
import { WebviewMessage } from "../../../../shared/WebviewMessage"
import { ClineProviderInterface } from "../../ClineProviderInterface"

describe("WebviewCommandRegistry", () => {
	let registry: WebviewCommandRegistry
	let mockHandler: WebviewCommandHandler
	let mockProvider: ClineProviderInterface

	beforeEach(() => {
		registry = new WebviewCommandRegistry()
		mockHandler = {
			execute: jest.fn().mockResolvedValue(undefined),
		}
		mockProvider = {
			outputChannel: {
				appendLine: jest.fn(),
			},
		} as unknown as ClineProviderInterface
	})

	test("registers and executes a command handler", async () => {
		// Register a handler
		registry.register("testCommand", mockHandler)

		// Create a test message
		const message = {
			type: "testCommand" as string,
			text: "test",
		}

		// Execute the command
		await registry.execute(message, mockProvider)

		// Verify the handler was called
		expect(mockHandler.execute).toHaveBeenCalledWith(message, mockProvider)
	})

	test("logs when no handler is registered for a message type", async () => {
		// Create a test message with no registered handler
		const message = {
			type: "unknownCommand" as string,
			text: "test",
		}

		// Execute the command
		await registry.execute(message, mockProvider)

		// Verify the handler was not called and a message was logged
		expect(mockHandler.execute).not.toHaveBeenCalled()
		expect(mockProvider.outputChannel.appendLine).toHaveBeenCalledWith(
			"No handler registered for message type: unknownCommand",
		)
	})

	test("multiple handlers can be registered", async () => {
		// Create a second mock handler
		const mockHandler2 = {
			execute: jest.fn().mockResolvedValue(undefined),
		}

		// Register both handlers
		registry.register("command1", mockHandler)
		registry.register("command2", mockHandler2)

		// Create test messages
		const message1 = {
			type: "command1" as string,
			text: "test1",
		}
		const message2 = {
			type: "command2" as string,
			text: "test2",
		}

		// Execute both commands
		await registry.execute(message1, mockProvider)
		await registry.execute(message2, mockProvider)

		// Verify each handler was called with the correct message
		expect(mockHandler.execute).toHaveBeenCalledWith(message1, mockProvider)
		expect(mockHandler2.execute).toHaveBeenCalledWith(message2, mockProvider)
	})

	test("registering a handler for an existing type overwrites the previous handler", async () => {
		// Create a second mock handler
		const mockHandler2 = {
			execute: jest.fn().mockResolvedValue(undefined),
		}

		// Register both handlers for the same type
		registry.register("testCommand", mockHandler)
		registry.register("testCommand", mockHandler2)

		// Create a test message
		const message = {
			type: "testCommand" as string,
			text: "test",
		}

		// Execute the command
		await registry.execute(message, mockProvider)

		// Verify only the second handler was called
		expect(mockHandler.execute).not.toHaveBeenCalled()
		expect(mockHandler2.execute).toHaveBeenCalledWith(message, mockProvider)
	})
})
