import * as fs from "fs/promises"
import * as path from "path"
import * as os from "os"
import crypto from "crypto"
import { safeWriteJson } from "./safeWriteJson"

/**
 * Configuration for MCP response handling
 */
export interface McpResponseConfig {
	/** Maximum size in characters before saving to file (default: 50000 ~= 50KB of text) */
	maxResponseSize?: number
	/** Directory to save large responses (default: temp directory) */
	responseDirectory?: string
	/** Whether to include a preview in the context when saving to file (default: true) */
	includePreview?: boolean
	/** Number of lines to include in preview (default: 50) */
	previewLines?: number
}

const getDefaultResponseDirectory = () => path.join(os.tmpdir(), "roo-code-mcp-responses")

const DEFAULT_CONFIG: Required<McpResponseConfig> = {
	maxResponseSize: 50000, // ~50KB of text
	responseDirectory: "", // Will be set dynamically
	includePreview: true,
	previewLines: 50,
}

/**
 * Handles MCP responses, saving large ones to files to avoid context window issues
 */
export class McpResponseHandler {
	private config: Required<McpResponseConfig>

	constructor(config?: McpResponseConfig) {
		this.config = {
			...DEFAULT_CONFIG,
			responseDirectory: config?.responseDirectory || getDefaultResponseDirectory(),
			...config,
		}
	}

	/**
	 * Process an MCP response, saving to file if it exceeds the size threshold
	 * @param response The MCP response content
	 * @param serverName The name of the MCP server
	 * @param toolOrResourceName The name of the tool or resource
	 * @returns The processed response (either original or file reference with preview)
	 */
	async processResponse(
		response: string,
		serverName: string,
		toolOrResourceName: string,
	): Promise<{ content: string; savedToFile: boolean; filePath?: string }> {
		// Check if response exceeds threshold
		if (response.length <= this.config.maxResponseSize) {
			return {
				content: response,
				savedToFile: false,
			}
		}

		// Generate unique filename
		const timestamp = new Date().toISOString().replace(/[:.]/g, "-")
		const hash = crypto.createHash("md5").update(response).digest("hex").substring(0, 8)
		const filename = `mcp-response-${serverName}-${toolOrResourceName}-${timestamp}-${hash}.txt`
		const filePath = path.join(this.config.responseDirectory, filename)

		// Ensure directory exists
		await fs.mkdir(this.config.responseDirectory, { recursive: true })

		// Save response to file
		await fs.writeFile(filePath, response, "utf-8")

		// Create preview if configured
		let preview = ""
		if (this.config.includePreview) {
			const lines = response.split("\n")
			const previewLines = lines.slice(0, this.config.previewLines)
			preview = previewLines.join("\n")

			if (lines.length > this.config.previewLines) {
				preview += `\n\n... (${lines.length - this.config.previewLines} more lines)`
			}
		}

		// Format the file reference message
		const fileReference = this.formatFileReference(filePath, response.length, preview)

		return {
			content: fileReference,
			savedToFile: true,
			filePath,
		}
	}

	/**
	 * Process an MCP response that may contain structured data (JSON)
	 * @param responseData The MCP response data (could be object or string)
	 * @param serverName The name of the MCP server
	 * @param toolOrResourceName The name of the tool or resource
	 * @returns The processed response
	 */
	async processStructuredResponse(
		responseData: any,
		serverName: string,
		toolOrResourceName: string,
	): Promise<{ content: string; savedToFile: boolean; filePath?: string }> {
		// Convert to string if needed
		let responseStr: string
		if (typeof responseData === "string") {
			responseStr = responseData
		} else {
			responseStr = JSON.stringify(responseData, null, 2)
		}

		// Check if response exceeds threshold
		if (responseStr.length <= this.config.maxResponseSize) {
			return {
				content: responseStr,
				savedToFile: false,
			}
		}

		// Generate unique filename for JSON data
		const timestamp = new Date().toISOString().replace(/[:.]/g, "-")
		const hash = crypto.createHash("md5").update(responseStr).digest("hex").substring(0, 8)
		const filename = `mcp-response-${serverName}-${toolOrResourceName}-${timestamp}-${hash}.json`
		const filePath = path.join(this.config.responseDirectory, filename)

		// Ensure directory exists
		await fs.mkdir(this.config.responseDirectory, { recursive: true })

		// Save response to file using safeWriteJson for structured data
		if (typeof responseData === "object") {
			await safeWriteJson(filePath, responseData)
		} else {
			await fs.writeFile(filePath, responseStr, "utf-8")
		}

		// Create preview
		let preview = ""
		if (this.config.includePreview) {
			const lines = responseStr.split("\n")
			const previewLines = lines.slice(0, this.config.previewLines)
			preview = previewLines.join("\n")

			if (lines.length > this.config.previewLines) {
				preview += `\n\n... (${lines.length - this.config.previewLines} more lines)`
			}
		}

		// Format the file reference message
		const fileReference = this.formatFileReference(filePath, responseStr.length, preview)

		return {
			content: fileReference,
			savedToFile: true,
			filePath,
		}
	}

	/**
	 * Format a file reference message for the AI context
	 */
	private formatFileReference(filePath: string, originalSize: number, preview: string): string {
		const sizeKB = Math.round(originalSize / 1024)

		let message = `[MCP Response saved to file due to large size (${sizeKB}KB)]\n`
		message += `File: ${filePath}\n`
		message += `\n`

		if (preview) {
			message += `Preview of response:\n`
			message += `${"=".repeat(50)}\n`
			message += preview
			message += `\n${"=".repeat(50)}\n`
		}

		message += `\n`
		message += `To work with this data, you can:\n`
		message += `1. Use read_file to read the full content: ${filePath}\n`
		message += `2. Use execute_command with tools like grep, jq, or custom scripts to process the data\n`
		message += `3. Use write_to_file to create scripts that analyze the data\n`

		return message
	}

	/**
	 * Clean up old response files (optional maintenance method)
	 */
	async cleanupOldFiles(maxAgeHours: number = 24): Promise<number> {
		try {
			const files = await fs.readdir(this.config.responseDirectory)
			const now = Date.now()
			const maxAgeMs = maxAgeHours * 60 * 60 * 1000
			let deletedCount = 0

			for (const file of files) {
				if (file.startsWith("mcp-response-")) {
					const filePath = path.join(this.config.responseDirectory, file)
					const stats = await fs.stat(filePath)

					if (now - stats.mtime.getTime() > maxAgeMs) {
						await fs.unlink(filePath)
						deletedCount++
					}
				}
			}

			return deletedCount
		} catch (error) {
			// Directory might not exist yet
			return 0
		}
	}
}

// Export a function to get default instance with default configuration
export const getDefaultMcpResponseHandler = (() => {
	let instance: McpResponseHandler | null = null
	return () => {
		if (!instance) {
			instance = new McpResponseHandler()
		}
		return instance
	}
})()

// For backward compatibility
export const defaultMcpResponseHandler = getDefaultMcpResponseHandler()
