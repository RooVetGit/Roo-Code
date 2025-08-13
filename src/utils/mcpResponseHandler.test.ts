import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from "vitest"
import * as fs from "fs/promises"
import * as os from "os"

// Mock the modules before importing the module under test
vi.mock("fs/promises", () => ({
	mkdir: vi.fn(),
	writeFile: vi.fn(),
	readdir: vi.fn(),
	stat: vi.fn(),
	unlink: vi.fn(),
}))
vi.mock("os", () => ({
	tmpdir: vi.fn(() => "/mock/tmp/dir"),
}))
vi.mock("./safeWriteJson", () => ({
	safeWriteJson: vi.fn(),
}))

// Import after mocks are set up
const { McpResponseHandler } = await import("./mcpResponseHandler")
const { safeWriteJson } = await import("./safeWriteJson")

describe("McpResponseHandler", () => {
	let handler: InstanceType<typeof McpResponseHandler>
	const mockTmpDir = "/mock/tmp/dir"
	const mockResponseDir = `${mockTmpDir}/roo-code-mcp-responses`

	beforeEach(() => {
		vi.clearAllMocks()
		vi.mocked(fs.mkdir).mockResolvedValue(undefined)
		vi.mocked(fs.writeFile).mockResolvedValue(undefined)
		vi.mocked(safeWriteJson).mockResolvedValue(undefined)

		// Mock Date for consistent file naming
		vi.spyOn(Date.prototype, "toISOString").mockReturnValue("2024-01-01T00:00:00.000Z")
	})

	afterEach(() => {
		vi.restoreAllMocks()
	})

	describe("with default threshold", () => {
		beforeEach(() => {
			handler = new McpResponseHandler()
		})

		it("should return small responses directly without saving to file", async () => {
			const smallResponse = "Small response content"
			const result = await handler.processResponse(smallResponse, "testServer", "testTool")

			expect(result.savedToFile).toBe(false)
			expect(result.content).toBe(smallResponse)
			expect(result.filePath).toBeUndefined()
			expect(fs.writeFile).not.toHaveBeenCalled()
		})

		it("should save large responses to file and return preview", async () => {
			const largeResponse = "x".repeat(60000) // 60KB response
			const result = await handler.processResponse(largeResponse, "testServer", "testTool")

			expect(result.savedToFile).toBe(true)
			expect(result.filePath).toBeDefined()
			expect(result.content).toContain("[MCP Response saved to file due to large size")
			expect(result.content).toContain("File:")
			expect(result.content).toContain("Preview of response:")
			// Check that preview shows limited content
			const lines = result.content.split("\n")
			const previewStartIndex = lines.findIndex((line: string) => line.includes("Preview of response:"))
			expect(previewStartIndex).toBeGreaterThan(-1)

			expect(fs.mkdir).toHaveBeenCalledWith(expect.stringContaining("roo-code-mcp-responses"), {
				recursive: true,
			})
			expect(fs.writeFile).toHaveBeenCalledWith(
				expect.stringContaining("mcp-response-testServer-testTool"),
				largeResponse,
				"utf-8",
			)
		})

		it("should handle JSON responses using processStructuredResponse", async () => {
			const jsonData = {
				data: "x".repeat(50000),
				metadata: { count: 100 },
			}
			const result = await handler.processStructuredResponse(jsonData, "dbServer", "queryTool")

			expect(result.savedToFile).toBe(true)
			expect(result.content).toContain("Preview of response:")
			expect(result.content).toContain('"data"')
			expect(result.content).toContain('"metadata"')

			expect(safeWriteJson).toHaveBeenCalledWith(
				expect.stringContaining("mcp-response-dbServer-queryTool"),
				jsonData,
			)
		})

		it("should handle non-JSON responses in preview", async () => {
			const textResponse = "Plain text response\n".repeat(3000) // Large plain text
			const result = await handler.processResponse(textResponse, "textServer", "textTool")

			expect(result.savedToFile).toBe(true)
			expect(result.content).toContain("Preview of response:")
			expect(result.content).toContain("Plain text response")
		})

		it("should handle file write errors gracefully", async () => {
			vi.mocked(fs.writeFile).mockRejectedValue(new Error("Write failed"))

			const largeResponse = "x".repeat(60000)
			await expect(handler.processResponse(largeResponse, "testServer", "testTool")).rejects.toThrow(
				"Write failed",
			)
		})

		it("should create directory if it doesn't exist", async () => {
			const largeResponse = "x".repeat(60000)
			await handler.processResponse(largeResponse, "testServer", "testTool")

			expect(fs.mkdir).toHaveBeenCalledWith(expect.stringContaining("roo-code-mcp-responses"), {
				recursive: true,
			})
		})
	})

	describe("with custom threshold", () => {
		it("should use custom maxResponseSize when provided", async () => {
			handler = new McpResponseHandler({ maxResponseSize: 1000 }) // 1KB threshold

			const smallResponse = "x".repeat(500) // 500 bytes - under threshold
			const result1 = await handler.processResponse(smallResponse, "server", "tool")
			expect(result1.savedToFile).toBe(false)

			const largeResponse = "x".repeat(1500) // 1.5KB - over threshold
			const result2 = await handler.processResponse(largeResponse, "server", "tool")
			expect(result2.savedToFile).toBe(true)
		})
	})

	describe("edge cases", () => {
		beforeEach(() => {
			handler = new McpResponseHandler()
		})

		it("should handle empty responses", async () => {
			const result = await handler.processResponse("", "server", "tool")
			expect(result.savedToFile).toBe(false)
			expect(result.content).toBe("")
		})

		it("should handle responses exactly at threshold", async () => {
			const maxResponseSize = 50 * 1024 // 50KB
			handler = new McpResponseHandler({ maxResponseSize })

			const response = "x".repeat(maxResponseSize)
			const result = await handler.processResponse(response, "server", "tool")
			expect(result.savedToFile).toBe(false) // Should NOT save when exactly at threshold (<=)

			const largerResponse = "x".repeat(maxResponseSize + 1)
			const result2 = await handler.processResponse(largerResponse, "server", "tool")
			expect(result2.savedToFile).toBe(true) // Should save when over threshold
		})

		it("should handle special characters in server and tool names", async () => {
			const largeResponse = "x".repeat(60000)
			const result = await handler.processResponse(
				largeResponse,
				"server-with-slashes",
				"tool-with-dashes_and_underscores",
			)

			expect(result.savedToFile).toBe(true)
			expect(result.filePath).toContain("server-with-slashes")
			expect(result.filePath).toContain("tool-with-dashes_and_underscores")
			expect(result.content).toContain("[MCP Response saved to file")
		})

		it("should limit preview to configured number of lines", async () => {
			const lines = Array.from({ length: 100 }, (_, i) => `Line ${i + 1}`)
			const response = lines.join("\n")
			handler = new McpResponseHandler({
				maxResponseSize: 100, // Low threshold to trigger save
				previewLines: 10, // Only show 10 lines in preview
			})

			const result = await handler.processResponse(response, "server", "tool")
			expect(result.savedToFile).toBe(true)

			// Check that preview contains first 10 lines
			expect(result.content).toContain("Line 1")
			expect(result.content).toContain("Line 10")
			expect(result.content).not.toContain("Line 11")
			expect(result.content).toContain("... (90 more lines)")
		})

		describe("cleanupOldFiles", () => {
			beforeEach(() => {
				handler = new McpResponseHandler()
			})

			it("should delete old MCP response files", async () => {
				const mockFiles = ["mcp-response-old-file.txt", "mcp-response-recent-file.txt", "other-file.txt"]

				const oldDate = new Date(Date.now() - 25 * 60 * 60 * 1000) // 25 hours ago
				const recentDate = new Date(Date.now() - 1 * 60 * 60 * 1000) // 1 hour ago

				const readdir = vi.mocked(fs.readdir)
				const stat = vi.mocked(fs.stat)
				const unlink = vi.mocked(fs.unlink)

				readdir.mockResolvedValue(mockFiles as any)
				stat.mockImplementation(async (filePath) => {
					const pathStr = String(filePath)
					if (pathStr.includes("old-file")) {
						return { mtime: oldDate } as any
					}
					return { mtime: recentDate } as any
				})
				unlink.mockResolvedValue(undefined)

				const deletedCount = await handler.cleanupOldFiles(24)

				expect(deletedCount).toBe(1)
				expect(unlink).toHaveBeenCalledWith(expect.stringContaining("mcp-response-old-file.txt"))
				expect(unlink).not.toHaveBeenCalledWith(expect.stringContaining("recent-file"))
				expect(unlink).not.toHaveBeenCalledWith(expect.stringContaining("other-file"))
			})

			it("should handle missing directory gracefully", async () => {
				const readdir = vi.mocked(fs.readdir)
				readdir.mockRejectedValue(new Error("ENOENT"))

				const deletedCount = await handler.cleanupOldFiles(24)

				expect(deletedCount).toBe(0)
			})
		})
	})
})
