import { setProfileCommand } from "../../src/commands/set-profile"
import { displayBox } from "../../src/utils/display"
import { MockWebSocketClient } from "../utils/websocket-client.mock"

// Mock the display utility and chalk
jest.mock("../../src/utils/display", () => ({
	displayBox: jest.fn(),
}))
jest.mock("chalk", () => ({
	yellow: jest.fn((text) => text),
}))

describe("setProfileCommand", () => {
	let mockWsClient: MockWebSocketClient
	let command: any
	let consoleErrorSpy: jest.SpyInstance
	let consoleLogSpy: jest.SpyInstance

	beforeEach(() => {
		// Create a new mock WebSocketClient
		mockWsClient = new MockWebSocketClient()
		mockWsClient.connect()

		// Create the command
		command = setProfileCommand(mockWsClient as any)

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

	it("should set a profile as active", async () => {
		// Execute the command with the --active option
		await command.parseAsync(["profile", "testProfile", "--active"])

		// Verify that the command was sent with the correct parameters
		expect(mockWsClient.sendCommand).toHaveBeenCalledWith("setActiveProfile", { name: "testProfile" })

		// Verify that the result was displayed
		expect(displayBox).toHaveBeenCalledWith("Profile Activated", 'Profile "testProfile" is now active', "success")
	})

	it("should display help when --active is not provided", async () => {
		// Mock the help method
		const helpSpy = jest.spyOn(command, "help").mockImplementation()

		// Execute the command without the --active option
		await command.parseAsync(["profile", "testProfile"])

		// Verify that the warning was logged
		expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining("Use --active to set the profile as active"))

		// Verify that help was displayed
		expect(helpSpy).toHaveBeenCalled()

		// Restore the help method
		helpSpy.mockRestore()
	})

	it("should handle errors", async () => {
		// Set up the mock error
		const error = new Error("Failed to set active profile")
		mockWsClient.setMockError("setActiveProfile", error)

		// Execute the command with the --active option
		await command.parseAsync(["profile", "testProfile", "--active"])

		// Verify that the error was logged
		expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining("Failed to set active profile"))
	})
})
