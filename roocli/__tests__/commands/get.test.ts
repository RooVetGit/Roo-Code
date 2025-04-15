import { getCommand } from "../../src/commands/get"
import { displayBox } from "../../src/utils/display"
import { MockWebSocketClient } from "../utils/websocket-client.mock"

// Mock the display utility
jest.mock("../../src/utils/display", () => ({
	displayBox: jest.fn(),
}))

describe("getCommand", () => {
	let mockWsClient: MockWebSocketClient
	let command: any
	let consoleErrorSpy: jest.SpyInstance
	let consoleLogSpy: jest.SpyInstance

	beforeEach(() => {
		// Create a new mock WebSocketClient
		mockWsClient = new MockWebSocketClient()
		mockWsClient.connect()

		// Create the command
		command = getCommand(mockWsClient as any)

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

	describe("--config", () => {
		it("should display the configuration", async () => {
			// Set up the mock response
			const mockConfig = {
				apiEndpoint: "https://api.example.com",
				version: "1.0.0",
			}
			mockWsClient.setMockResponse("getConfiguration", mockConfig)

			// Execute the command
			await command.parseAsync(["get", "--config"])

			// Verify that the command was sent
			expect(mockWsClient.sendCommand).toHaveBeenCalledWith("getConfiguration")

			// Verify that the result was displayed
			expect(displayBox).toHaveBeenCalledWith("Configuration", JSON.stringify(mockConfig, null, 2), "info")
		})

		it("should handle errors", async () => {
			// Set up the mock error
			const error = new Error("Failed to get configuration")
			mockWsClient.setMockError("getConfiguration", error)

			// Execute the command
			await command.parseAsync(["get", "--config"])

			// Verify that the error was logged
			expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining("Failed to get configuration"))
		})
	})

	describe("--profiles", () => {
		it("should display all profiles", async () => {
			// Set up the mock response
			const mockProfiles = ["profile1", "profile2", "profile3"]
			mockWsClient.setMockResponse("getProfiles", mockProfiles)

			// Execute the command
			await command.parseAsync(["get", "--profiles"])

			// Verify that the command was sent
			expect(mockWsClient.sendCommand).toHaveBeenCalledWith("getProfiles")

			// Verify that the result was displayed
			expect(displayBox).toHaveBeenCalledWith("Profiles", mockProfiles.join("\n"), "info")
		})

		it("should handle errors", async () => {
			// Set up the mock error
			const error = new Error("Failed to get profiles")
			mockWsClient.setMockError("getProfiles", error)

			// Execute the command
			await command.parseAsync(["get", "--profiles"])

			// Verify that the error was logged
			expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining("Failed to get profiles"))
		})
	})

	describe("--active-profile", () => {
		it("should display the active profile", async () => {
			// Set up the mock response
			const mockActiveProfile = "profile1"
			mockWsClient.setMockResponse("getActiveProfile", mockActiveProfile)

			// Execute the command
			await command.parseAsync(["get", "--active-profile"])

			// Verify that the command was sent
			expect(mockWsClient.sendCommand).toHaveBeenCalledWith("getActiveProfile")

			// Verify that the result was displayed
			expect(displayBox).toHaveBeenCalledWith("Active Profile", mockActiveProfile, "info")
		})

		it("should handle no active profile", async () => {
			// Set up the mock response
			mockWsClient.setMockResponse("getActiveProfile", null)

			// Execute the command
			await command.parseAsync(["get", "--active-profile"])

			// Verify that the command was sent
			expect(mockWsClient.sendCommand).toHaveBeenCalledWith("getActiveProfile")

			// Verify that the result was displayed
			expect(displayBox).toHaveBeenCalledWith("Active Profile", "No active profile", "info")
		})

		it("should handle errors", async () => {
			// Set up the mock error
			const error = new Error("Failed to get active profile")
			mockWsClient.setMockError("getActiveProfile", error)

			// Execute the command
			await command.parseAsync(["get", "--active-profile"])

			// Verify that the error was logged
			expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining("Failed to get active profile"))
		})
	})

	describe("--ready", () => {
		it("should display ready status when ready", async () => {
			// Set up the mock response
			mockWsClient.setMockResponse("isReady", true)

			// Execute the command
			await command.parseAsync(["get", "--ready"])

			// Verify that the command was sent
			expect(mockWsClient.sendCommand).toHaveBeenCalledWith("isReady")

			// Verify that the result was displayed
			expect(displayBox).toHaveBeenCalledWith("RooCode Status", "Ready", "success")
		})

		it("should display not ready status when not ready", async () => {
			// Set up the mock response
			mockWsClient.setMockResponse("isReady", false)

			// Execute the command
			await command.parseAsync(["get", "--ready"])

			// Verify that the command was sent
			expect(mockWsClient.sendCommand).toHaveBeenCalledWith("isReady")

			// Verify that the result was displayed
			expect(displayBox).toHaveBeenCalledWith("RooCode Status", "Not Ready", "warning")
		})

		it("should handle errors", async () => {
			// Set up the mock error
			const error = new Error("Failed to check ready status")
			mockWsClient.setMockError("isReady", error)

			// Execute the command
			await command.parseAsync(["get", "--ready"])

			// Verify that the error was logged
			expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining("Failed to check ready status"))
		})
	})

	describe("--tasks", () => {
		it("should display the current task stack", async () => {
			// Set up the mock response
			const mockTasks = ["task1", "task2", "task3"]
			mockWsClient.setMockResponse("getCurrentTaskStack", mockTasks)

			// Execute the command
			await command.parseAsync(["get", "--tasks"])

			// Verify that the command was sent
			expect(mockWsClient.sendCommand).toHaveBeenCalledWith("getCurrentTaskStack")

			// Verify that the result was displayed
			expect(displayBox).toHaveBeenCalledWith("Current Task Stack", mockTasks.join("\n"), "info")
		})

		it("should handle empty task stack", async () => {
			// Set up the mock response
			mockWsClient.setMockResponse("getCurrentTaskStack", [])

			// Execute the command
			await command.parseAsync(["get", "--tasks"])

			// Verify that the command was sent
			expect(mockWsClient.sendCommand).toHaveBeenCalledWith("getCurrentTaskStack")

			// Verify that the result was displayed
			expect(displayBox).toHaveBeenCalledWith("Current Task Stack", "No active tasks", "info")
		})

		it("should handle errors", async () => {
			// Set up the mock error
			const error = new Error("Failed to get task stack")
			mockWsClient.setMockError("getCurrentTaskStack", error)

			// Execute the command
			await command.parseAsync(["get", "--tasks"])

			// Verify that the error was logged
			expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining("Failed to get task stack"))
		})
	})

	describe("no options", () => {
		it("should display help", async () => {
			// Mock the help method
			const helpSpy = jest.spyOn(command, "help").mockImplementation()

			// Execute the command
			await command.parseAsync(["get"])

			// Verify that help was displayed
			expect(helpSpy).toHaveBeenCalled()

			// Restore the help method
			helpSpy.mockRestore()
		})
	})
})
