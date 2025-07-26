import { describe, it, expect, beforeAll, afterAll, vi } from "vitest"
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"

// Mock the mysql2/promise module
vi.mock("mysql2/promise", () => ({
	default: {
		createPool: vi.fn(() => ({
			getConnection: vi.fn(() => ({
				execute: vi.fn(() => [[{ Database: "test_db" }], [{ name: "Database" }]]),
				ping: vi.fn(),
				changeUser: vi.fn(),
				release: vi.fn(),
			})),
		})),
	},
}))

describe("MySQL MCP Server", () => {
	it("should create server instance", () => {
		const server = new McpServer({
			name: "mysql-server",
			version: "0.1.0",
			description: "MySQL database operations via MCP",
		})

		expect(server).toBeDefined()
	})

	it("should have required tools", async () => {
		const { server } = await import("./index.js")

		// Check if tools are registered
		const tools = server.getTools()
		const toolNames = tools.map((tool) => tool.name)

		expect(toolNames).toContain("query")
		expect(toolNames).toContain("execute")
		expect(toolNames).toContain("list_databases")
		expect(toolNames).toContain("list_tables")
		expect(toolNames).toContain("describe_table")
		expect(toolNames).toContain("test_connection")
	})
})
