import * as fs from "fs/promises"
import * as os from "os"
import * as path from "path"
import { WebSocketConfig, getWebSocketConfigPath, readWebSocketConfig } from "../../../comms-clients/websocket-config"

// Mock the fs module
jest.mock("fs/promises")
jest.mock("os")
jest.mock("path")

describe("WebSocket Configuration Utilities (CLI)", () => {
	const mockTmpDir = "/mock/tmp/dir"
	const mockConfigPath = "/mock/tmp/dir/roocode-websocket-config.json"
	const mockConfig: WebSocketConfig = {
		port: 12345,
		token: "test-token",
	}

	beforeEach(() => {
		jest.clearAllMocks()

		// Mock os.tmpdir to return a consistent path
		;(os.tmpdir as jest.Mock).mockReturnValue(mockTmpDir)

		// Mock path.join to return a consistent config path
		;(path.join as jest.Mock).mockReturnValue(mockConfigPath)
	})

	describe("getWebSocketConfigPath", () => {
		it("should return the path to the WebSocket configuration file", () => {
			const configPath = getWebSocketConfigPath()

			expect(os.tmpdir).toHaveBeenCalled()
			expect(path.join).toHaveBeenCalledWith(mockTmpDir, "roocode-websocket-config.json")
			expect(configPath).toBe(mockConfigPath)
		})
	})

	describe("readWebSocketConfig", () => {
		it("should read the WebSocket configuration from a file", async () => {
			// Mock fs.access to resolve successfully
			;(fs.access as jest.Mock).mockResolvedValue(undefined)

			// Mock fs.readFile to return a valid configuration
			;(fs.readFile as jest.Mock).mockResolvedValue(JSON.stringify(mockConfig))

			const config = await readWebSocketConfig()

			expect(fs.access).toHaveBeenCalledWith(mockConfigPath)
			expect(fs.readFile).toHaveBeenCalledWith(mockConfigPath, "utf-8")
			expect(config).toEqual(mockConfig)
		})

		it("should throw an error if the configuration file does not exist", async () => {
			// Mock fs.access to reject with an error
			;(fs.access as jest.Mock).mockRejectedValue(new Error("File not found"))

			await expect(readWebSocketConfig()).rejects.toThrow(
				"WebSocket configuration file not found. Is the RooCode extension running?",
			)
		})

		it("should throw an error if the configuration is invalid", async () => {
			// Mock fs.access to resolve successfully
			;(fs.access as jest.Mock).mockResolvedValue(undefined)

			// Mock fs.readFile to return an invalid configuration
			;(fs.readFile as jest.Mock).mockResolvedValue(JSON.stringify({ port: 12345 }))

			await expect(readWebSocketConfig()).rejects.toThrow("Invalid WebSocket configuration")
		})

		it("should throw an error if reading the file fails", async () => {
			// Mock fs.access to resolve successfully
			;(fs.access as jest.Mock).mockResolvedValue(undefined)

			// Mock fs.readFile to reject with an error
			const mockError = new Error("Read error")
			;(fs.readFile as jest.Mock).mockRejectedValue(mockError)

			await expect(readWebSocketConfig()).rejects.toThrow("Read error")
		})
	})
})
