import { LogManager } from "../LogManager"

describe("LogManager", () => {
	let mockProvider: any
	let logManager: LogManager

	beforeEach(() => {
		mockProvider = {
			log: jest.fn(),
		}
		logManager = new LogManager(mockProvider as any)
	})

	describe("log", () => {
		it("should format and log messages with timestamp and level", () => {
			// Mock Date.toISOString to return a fixed timestamp
			const mockDate = new Date("2023-01-01T12:00:00Z")
			jest.spyOn(global, "Date").mockImplementation(() => mockDate as any)

			logManager.log("Test message", "info")

			expect(mockProvider.log).toHaveBeenCalledWith("[2023-01-01T12:00:00.000Z] [INFO] Test message")
		})

		it("should use 'info' as default log level", () => {
			const mockDate = new Date("2023-01-01T12:00:00Z")
			jest.spyOn(global, "Date").mockImplementation(() => mockDate as any)

			logManager.log("Test message")

			expect(mockProvider.log).toHaveBeenCalledWith("[2023-01-01T12:00:00.000Z] [INFO] Test message")
		})
	})

	describe("processLogEntry", () => {
		it("should log complete entries", () => {
			const spy = jest.spyOn(logManager, "log")

			const result = logManager.processLogEntry("Test log entry", "debug", false)

			expect(result).toBe(true)
			expect(spy).toHaveBeenCalledWith("Test log entry", "debug")
		})

		it("should not log partial entries", () => {
			const spy = jest.spyOn(logManager, "log")

			const result = logManager.processLogEntry("Partial log entry", "warn", true)

			expect(result).toBe(false)
			expect(spy).not.toHaveBeenCalled()
		})
	})
})
