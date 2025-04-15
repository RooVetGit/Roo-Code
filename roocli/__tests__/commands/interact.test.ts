import { interactCommand } from "../../src/commands/interact"
import { displayBox } from "../../src/utils/display"
import { MockWebSocketClient } from "../utils/websocket-client.mock"

// Mock the display utility and chalk
jest.mock("../../src/utils/display", () => ({
	displayBox: jest.fn(),
}))
jest.mock("chalk", () => ({
	yellow: jest.fn((text) => text),
}))

describe("interactCommand", () => {
	let mockWsClient: MockWebSocketClient
	let command: any
	let consoleErrorSpy: jest.SpyInstance
	let consoleLogSpy: jest.SpyInstance

	beforeEach(() => {
		// Create a new mock WebSocketClient
		mockWsClient = new MockWebSocketClient()
		mockWsClient.connect()

		// Create the command
		command = interactCommand(mockWsClient as any)

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

	it("should press the primary button", async () => {
		// Execute the command with the --primary option
		await command.parseAsync(["interact", "--primary"])

		// Verify that the command was sent
		expect(mockWsClient.sendCommand).toHaveBeenCalledWith("pressPrimaryButton")

		// Verify that the result was displayed
		expect(displayBox).toHaveBeenCalledWith("Button Pressed", "Primary button pressed", "success")
	})

	it("should press the secondary button", async () => {
		// Execute the command with the --secondary option
		await command.parseAsync(["interact", "--secondary"])

		// Verify that the command was sent
		expect(mockWsClient.sendCommand).toHaveBeenCalledWith("pressSecondaryButton")

		// Verify that the result was displayed
		expect(displayBox).toHaveBeenCalledWith("Button Pressed", "Secondary button pressed", "success")
	})

	it("should display help when no option is provided", async () => {
		// Mock the help method
		const helpSpy = jest.spyOn(command, "help").mockImplementation()

		// Execute the command without any options
		await command.parseAsync(["interact"])

		// Verify that the warning was logged
		expect(consoleLogSpy).toHaveBeenCalledWith(
			expect.stringContaining("Please specify either --primary or --secondary"),
		)

		// Verify that help was displayed
		expect(helpSpy).toHaveBeenCalled()

		// Restore the help method
		helpSpy.mockRestore()
	})

	it("should handle errors when pressing the primary button", async () => {
		// Set up the mock error
		const error = new Error("Failed to press primary button")
		mockWsClient.setMockError("pressPrimaryButton", error)

		// Execute the command with the --primary option
		await command.parseAsync(["interact", "--primary"])

		// Verify that the error was logged
		expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining("Failed to press primary button"))
	})

	it("should handle errors when pressing the secondary button", async () => {
		// Set up the mock error
		const error = new Error("Failed to press secondary button")
		mockWsClient.setMockError("pressSecondaryButton", error)

		// Execute the command with the --secondary option
		await command.parseAsync(["interact", "--secondary"])

		// Verify that the error was logged
		expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining("Failed to press secondary button"))
	})
})
