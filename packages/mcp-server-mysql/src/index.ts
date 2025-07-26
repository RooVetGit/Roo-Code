#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { z } from "zod"
import mysql from "mysql2/promise"
import { Connection, RowDataPacket, FieldPacket } from "mysql2/promise"

// Environment variables for MySQL connection
const MYSQL_HOST = process.env.MYSQL_HOST || "localhost"
const MYSQL_PORT = parseInt(process.env.MYSQL_PORT || "3306")
const MYSQL_USER = process.env.MYSQL_USER || "root"
const MYSQL_PASSWORD = process.env.MYSQL_PASSWORD || ""
const MYSQL_DATABASE = process.env.MYSQL_DATABASE

// Connection pool to manage MySQL connections
let connectionPool: mysql.Pool | null = null

// Create an MCP server
const server = new McpServer({
	name: "mysql-server",
	version: "0.1.0",
	description: "MySQL database operations via MCP",
})

// Initialize connection pool
async function initializePool() {
	if (!connectionPool) {
		connectionPool = mysql.createPool({
			host: MYSQL_HOST,
			port: MYSQL_PORT,
			user: MYSQL_USER,
			password: MYSQL_PASSWORD,
			database: MYSQL_DATABASE,
			waitForConnections: true,
			connectionLimit: 10,
			queueLimit: 0,
			enableKeepAlive: true,
			keepAliveInitialDelay: 0,
		})
	}
	return connectionPool
}

// Helper function to format query results
function formatQueryResult(rows: RowDataPacket[], fields: FieldPacket[]): string {
	if (rows.length === 0) {
		return "No results found."
	}

	// Get column names
	const columns = fields.map((field) => field.name)

	// Create a formatted table
	let result = columns.join(" | ") + "\n"
	result += columns.map((col) => "-".repeat(col.length)).join("-|-") + "\n"

	// Add rows
	rows.forEach((row) => {
		result += columns.map((col) => String(row[col] ?? "NULL")).join(" | ") + "\n"
	})

	return result
}

// Tool: Execute a SELECT query
server.tool(
	"query",
	{
		description: "Execute a SELECT query on the MySQL database",
		inputSchema: z.object({
			query: z.string().describe("The SELECT query to execute"),
			database: z.string().optional().describe("Database to use (overrides default)"),
		}),
	},
	async ({ query, database }) => {
		try {
			// Validate that it's a SELECT query
			const normalizedQuery = query.trim().toUpperCase()
			if (
				!normalizedQuery.startsWith("SELECT") &&
				!normalizedQuery.startsWith("SHOW") &&
				!normalizedQuery.startsWith("DESCRIBE")
			) {
				return {
					content: [
						{
							type: "text",
							text: "Error: Only SELECT, SHOW, and DESCRIBE queries are allowed with this tool. Use 'execute' tool for other operations.",
						},
					],
					isError: true,
				}
			}

			const pool = await initializePool()
			const connection = await pool.getConnection()

			try {
				if (database) {
					await connection.changeUser({ database })
				}

				const [rows, fields] = (await connection.execute(query)) as [RowDataPacket[], FieldPacket[]]
				const formattedResult = formatQueryResult(rows, fields)

				return {
					content: [
						{
							type: "text",
							text: formattedResult,
						},
					],
				}
			} finally {
				connection.release()
			}
		} catch (error) {
			return {
				content: [
					{
						type: "text",
						text: `MySQL Error: ${error instanceof Error ? error.message : String(error)}`,
					},
				],
				isError: true,
			}
		}
	},
)

// Tool: Execute non-SELECT queries (INSERT, UPDATE, DELETE, CREATE, etc.)
server.tool(
	"execute",
	{
		description: "Execute a non-SELECT query on the MySQL database (INSERT, UPDATE, DELETE, CREATE, etc.)",
		inputSchema: z.object({
			query: z.string().describe("The SQL query to execute"),
			database: z.string().optional().describe("Database to use (overrides default)"),
		}),
	},
	async ({ query, database }) => {
		try {
			// Validate that it's NOT a SELECT query
			const normalizedQuery = query.trim().toUpperCase()
			if (normalizedQuery.startsWith("SELECT")) {
				return {
					content: [
						{
							type: "text",
							text: "Error: Use the 'query' tool for SELECT queries. This tool is for INSERT, UPDATE, DELETE, CREATE, and other non-SELECT operations.",
						},
					],
					isError: true,
				}
			}

			const pool = await initializePool()
			const connection = await pool.getConnection()

			try {
				if (database) {
					await connection.changeUser({ database })
				}

				const [result] = await connection.execute(query)

				// Format the result based on the operation type
				let message = "Query executed successfully.\n"
				if ("affectedRows" in result) {
					message += `Affected rows: ${result.affectedRows}\n`
				}
				if ("insertId" in result) {
					message += `Insert ID: ${result.insertId}\n`
				}
				if ("changedRows" in result) {
					message += `Changed rows: ${result.changedRows}\n`
				}

				return {
					content: [
						{
							type: "text",
							text: message,
						},
					],
				}
			} finally {
				connection.release()
			}
		} catch (error) {
			return {
				content: [
					{
						type: "text",
						text: `MySQL Error: ${error instanceof Error ? error.message : String(error)}`,
					},
				],
				isError: true,
			}
		}
	},
)

// Tool: List databases
server.tool(
	"list_databases",
	{
		description: "List all databases in the MySQL server",
	},
	async () => {
		try {
			const pool = await initializePool()
			const connection = await pool.getConnection()

			try {
				const [rows] = (await connection.execute("SHOW DATABASES")) as [RowDataPacket[], FieldPacket[]]
				const databases = rows.map((row) => row.Database || row.database).join("\n")

				return {
					content: [
						{
							type: "text",
							text: `Available databases:\n${databases}`,
						},
					],
				}
			} finally {
				connection.release()
			}
		} catch (error) {
			return {
				content: [
					{
						type: "text",
						text: `MySQL Error: ${error instanceof Error ? error.message : String(error)}`,
					},
				],
				isError: true,
			}
		}
	},
)

// Tool: List tables in a database
server.tool(
	"list_tables",
	{
		description: "List all tables in a database",
		inputSchema: z.object({
			database: z.string().describe("The database name"),
		}),
	},
	async ({ database }) => {
		try {
			const pool = await initializePool()
			const connection = await pool.getConnection()

			try {
				await connection.changeUser({ database })
				const [rows] = (await connection.execute("SHOW TABLES")) as [RowDataPacket[], FieldPacket[]]
				const tables = rows.map((row) => Object.values(row)[0]).join("\n")

				return {
					content: [
						{
							type: "text",
							text: `Tables in ${database}:\n${tables}`,
						},
					],
				}
			} finally {
				connection.release()
			}
		} catch (error) {
			return {
				content: [
					{
						type: "text",
						text: `MySQL Error: ${error instanceof Error ? error.message : String(error)}`,
					},
				],
				isError: true,
			}
		}
	},
)

// Tool: Describe table structure
server.tool(
	"describe_table",
	{
		description: "Get the structure of a table",
		inputSchema: z.object({
			table: z.string().describe("The table name"),
			database: z.string().optional().describe("The database name (uses default if not specified)"),
		}),
	},
	async ({ table, database }) => {
		try {
			const pool = await initializePool()
			const connection = await pool.getConnection()

			try {
				if (database) {
					await connection.changeUser({ database })
				}

				const [rows, fields] = (await connection.execute(`DESCRIBE ${table}`)) as [
					RowDataPacket[],
					FieldPacket[],
				]
				const formattedResult = formatQueryResult(rows, fields)

				return {
					content: [
						{
							type: "text",
							text: `Structure of table ${table}:\n${formattedResult}`,
						},
					],
				}
			} finally {
				connection.release()
			}
		} catch (error) {
			return {
				content: [
					{
						type: "text",
						text: `MySQL Error: ${error instanceof Error ? error.message : String(error)}`,
					},
				],
				isError: true,
			}
		}
	},
)

// Tool: Test connection
server.tool(
	"test_connection",
	{
		description: "Test the MySQL connection",
	},
	async () => {
		try {
			const pool = await initializePool()
			const connection = await pool.getConnection()

			try {
				await connection.ping()
				const [rows] = (await connection.execute("SELECT VERSION() as version, DATABASE() as current_db")) as [
					RowDataPacket[],
					FieldPacket[],
				]
				const info = rows[0]

				return {
					content: [
						{
							type: "text",
							text: `MySQL connection successful!\nVersion: ${info.version}\nCurrent database: ${info.current_db || "None"}\nHost: ${MYSQL_HOST}:${MYSQL_PORT}`,
						},
					],
				}
			} finally {
				connection.release()
			}
		} catch (error) {
			return {
				content: [
					{
						type: "text",
						text: `MySQL connection failed: ${error instanceof Error ? error.message : String(error)}`,
					},
				],
				isError: true,
			}
		}
	},
)

// Start the server
async function main() {
	const transport = new StdioServerTransport()
	await server.connect(transport)
	console.error("MySQL MCP server running on stdio")
}

main().catch((error) => {
	console.error("Failed to start MySQL MCP server:", error)
	process.exit(1)
})
