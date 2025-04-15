import { Command } from "commander"
import { getCommands } from "../../src/commands/index"
import { MockWebSocketClient } from "../utils/websocket-client.mock"

// Mock all command modules
jest.mock("../../src/commands/get", () => ({
	getCommand: jest.fn(() => new Command("get")),
}))
jest.mock("../../src/commands/create-profile", () => ({
	createProfileCommand: jest.fn(() => new Command("create")),
}))
jest.mock("../../src/commands/set-profile", () => ({
	setProfileCommand: jest.fn(() => new Command("set")),
}))
jest.mock("../../src/commands/delete-profile", () => ({
	deleteProfileCommand: jest.fn(() => new Command("delete")),
}))
jest.mock("../../src/commands/interact", () => ({
	interactCommand: jest.fn(() => new Command("interact")),
}))
jest.mock("../../src/commands/task", () => ({
	taskCommand: jest.fn(() => new Command("task")),
}))

describe("getCommands", () => {
	let mockWsClient: MockWebSocketClient

	beforeEach(() => {
		// Create a new mock WebSocketClient
		mockWsClient = new MockWebSocketClient()

		// Reset all mocks
		jest.clearAllMocks()
	})

	it("should return all commands", () => {
		// Get the commands
		const commands = getCommands(mockWsClient as any)

		// Verify that all command functions were called with the WebSocketClient
		const { getCommand } = require("../../src/commands/get")
		const { createProfileCommand } = require("../../src/commands/create-profile")
		const { setProfileCommand } = require("../../src/commands/set-profile")
		const { deleteProfileCommand } = require("../../src/commands/delete-profile")
		const { interactCommand } = require("../../src/commands/interact")
		const { taskCommand } = require("../../src/commands/task")

		expect(getCommand).toHaveBeenCalledWith(mockWsClient)
		expect(createProfileCommand).toHaveBeenCalledWith(mockWsClient)
		expect(setProfileCommand).toHaveBeenCalledWith(mockWsClient)
		expect(deleteProfileCommand).toHaveBeenCalledWith(mockWsClient)
		expect(interactCommand).toHaveBeenCalledWith(mockWsClient)
		expect(taskCommand).toHaveBeenCalledWith(mockWsClient)

		// Verify that the correct number of commands were returned
		expect(commands.length).toBe(6)

		// Verify that the commands have the correct names
		expect(commands[0].name()).toBe("get")
		expect(commands[1].name()).toBe("create")
		expect(commands[2].name()).toBe("set")
		expect(commands[3].name()).toBe("delete")
		expect(commands[4].name()).toBe("interact")
		expect(commands[5].name()).toBe("task")
	})
})
