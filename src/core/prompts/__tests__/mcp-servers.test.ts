import { getMcpServersSection } from "../sections/mcp-servers"
import { McpHub } from "../../../services/mcp/McpHub"
import { ClineProvider } from "../../../core/webview/ClineProvider"

// Mock the ClineProvider and McpHub
jest.mock("../../../core/webview/ClineProvider")
jest.mock("../../../services/mcp/McpHub", () => {
	return {
		McpHub: jest.fn().mockImplementation(() => {
			return {
				getServers: jest.fn().mockReturnValue([]),
			}
		}),
	}
})

describe("getMcpServersSection", () => {
	// Create a mock provider for McpHub constructor
	const mockProvider = {} as ClineProvider

	it("should return an empty string when McpHub is not provided", async () => {
		const result = await getMcpServersSection(undefined, undefined, true)
		expect(result).toBe("")
	})

	it("should return an empty string when enableMcpServerCreation is false", async () => {
		const mockMcpHub = new McpHub(mockProvider) as any
		const result = await getMcpServersSection(mockMcpHub, undefined, false)
		expect(result).toBe("")
	})

	it("should return a non-empty string when McpHub is provided and enableMcpServerCreation is true", async () => {
		const mockMcpHub = new McpHub(mockProvider) as any
		const result = await getMcpServersSection(mockMcpHub, undefined, true)
		expect(result).not.toBe("")
		expect(result.includes("MCP SERVERS")).toBe(true)
	})
})
