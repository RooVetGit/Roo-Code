import { drizzle } from "drizzle-orm/libsql"
import { createClient } from "@libsql/client"
import { schema } from "./schema.js"

// Use a connection pool with proper cleanup
const connections = new Map()

export function getDb(path = process.env.BENCHMARKS_DB_PATH || "/tmp/evals.db") {
	if (!connections.has(path)) {
		const client = process.env.BENCHMARKS_DB_PATH
			? createClient({ url: path, concurrency: 50 })
			: createClient({
					url: process.env.TURSO_CONNECTION_URL!,
					authToken: process.env.TURSO_AUTH_TOKEN!,
				})

		const db = drizzle(client, { schema })
		connections.set(path, { db, client })
	}
	return connections.get(path).db
}

// Add cleanup function
export async function closeConnections() {
	for (const { client } of connections.values()) {
		try {
			// Close the connection if the client has a close method
			if (client && typeof client.close === "function") {
				await client.close()
			}
		} catch (error) {
			console.error("Error closing database connection:", error)
		}
	}
	connections.clear()
}

// Register cleanup handlers
process.on("exit", () => {
	// On exit, we can't use async functions, so we just try our best
	for (const { client } of connections.values()) {
		try {
			if (client && typeof client.close === "function") {
				// Use sync close if available, otherwise we can't do much on exit
				if (typeof client.close.sync === "function") {
					client.close.sync()
				}
			}
		} catch (error) {
			console.error("Error closing database connection on exit:", error)
		}
	}
})

process.on("SIGINT", async () => {
	console.log("Received SIGINT, closing database connections...")
	await closeConnections()
	process.exit(0)
})

// For backward compatibility
export const db = getDb()
