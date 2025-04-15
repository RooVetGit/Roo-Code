import { createProfileCommand } from "../../src/commands/create-profile"
import { displayBox } from "../../src/utils/display"
import { MockWebSocketClient } from "../utils/websocket-client.mock"

// Mock the display utility
jest.mock("../../src/utils/display", () => ({
	displayBox: jest.fn(),
}))

describe("createProfileCommand", () => {
	let mockWsClient: MockWebSocketClient
	let command: any
	let consoleErrorSpy: jest.SpyInstance

	beforeEach(() => {
		// Create a new mock WebSocketClient
		mockWsClient = new MockWebSocketClient()
		mockWsClient.connect()

		// Create the command
		command = createProfileCommand(mockWsClient as any)

		// Mock console.error
		consoleErrorSpy = jest.spyOn(console, "error").mockImplementation()

		// Reset all mocks
		jest.clearAllMocks()
	})

	afterEach(() => {
		// Restore console.error
		consoleErrorSpy.mockRestore()

		// Reset mock responses
		mockWsClient.resetMocks()
	})

	it("should create a profile", async () => {
		// Set up the mock response
		const profileId = "profile123"
		mockWsClient.setMockResponse("createProfile", profileId)

		// Execute the command
		await command.parseAsync(["profile", "testProfile"])

		// Verify that the command was sent with the correct parameters
		expect(mockWsClient.sendCommand).toHaveBeenCalledWith("createProfile", { name: "testProfile" })

		// Verify that the result was displayed
		expect(displayBox).toHaveBeenCalledWith(
			"Profile Created",
			'Profile "testProfile" created with ID: profile123',
			"success",
		)
	})

	it("should handle errors", async () => {
		// Set up the mock error
		const error = new Error("Failed to create profile")
		mockWsClient.setMockError("createProfile", error)

		// Execute the command
		await command.parseAsync(["profile", "testProfile"])

		// Verify that the error was logged
		expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining("Failed to create profile"))
	})
})
