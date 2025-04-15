import { deleteProfileCommand } from "../../src/commands/delete-profile"
import { displayBox, displayConfirmation } from "../../src/utils/display"
import { MockWebSocketClient } from "../utils/websocket-client.mock"

// Mock the display utility and chalk
jest.mock("../../src/utils/display", () => ({
	displayBox: jest.fn(),
	displayConfirmation: jest.fn(),
}))
jest.mock("chalk", () => ({
	yellow: jest.fn((text) => text),
	red: jest.fn((text) => text),
}))

describe("deleteProfileCommand", () => {
	let mockWsClient: MockWebSocketClient
	let command: any
	let consoleErrorSpy: jest.SpyInstance
	let consoleLogSpy: jest.SpyInstance

	beforeEach(() => {
		// Create a new mock WebSocketClient
		mockWsClient = new MockWebSocketClient()
		mockWsClient.connect()

		// Create the command
		command = deleteProfileCommand(mockWsClient as any)

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

	it("should delete a profile with --force option", async () => {
		// Execute the command with the --force option
		await command.parseAsync(["profile", "testProfile", "--force"])

		// Verify that the command was sent with the correct parameters
		expect(mockWsClient.sendCommand).toHaveBeenCalledWith("deleteProfile", { name: "testProfile" })

		// Verify that the result was displayed
		expect(displayBox).toHaveBeenCalledWith("Profile Deleted", 'Profile "testProfile" has been deleted', "success")

		// Verify that confirmation was not requested
		expect(displayConfirmation).not.toHaveBeenCalled()
	})

	it("should delete a profile after confirmation", async () => {
		// Mock the confirmation to return true
		;(displayConfirmation as jest.Mock).mockResolvedValue(true)

		// Execute the command without the --force option
		await command.parseAsync(["profile", "testProfile"])

		// Verify that confirmation was requested
		expect(displayConfirmation).toHaveBeenCalledWith('Are you sure you want to delete profile "testProfile"?')

		// Verify that the command was sent with the correct parameters
		expect(mockWsClient.sendCommand).toHaveBeenCalledWith("deleteProfile", { name: "testProfile" })

		// Verify that the result was displayed
		expect(displayBox).toHaveBeenCalledWith("Profile Deleted", 'Profile "testProfile" has been deleted', "success")
	})

	it("should cancel deletion if confirmation is declined", async () => {
		// Mock the confirmation to return false
		;(displayConfirmation as jest.Mock).mockResolvedValue(false)

		// Execute the command without the --force option
		await command.parseAsync(["profile", "testProfile"])

		// Verify that confirmation was requested
		expect(displayConfirmation).toHaveBeenCalledWith('Are you sure you want to delete profile "testProfile"?')

		// Verify that the command was not sent
		expect(mockWsClient.sendCommand).not.toHaveBeenCalled()

		// Verify that the cancellation message was logged
		expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining("Profile deletion cancelled"))
	})

	it("should handle errors", async () => {
		// Set up the mock error
		const error = new Error("Failed to delete profile")
		mockWsClient.setMockError("deleteProfile", error)

		// Execute the command with the --force option
		await command.parseAsync(["profile", "testProfile", "--force"])

		// Verify that the error was logged
		expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining("Failed to delete profile"))
	})
})
