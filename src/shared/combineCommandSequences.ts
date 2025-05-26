import { ClineMessage } from "./ExtensionMessage"
import { safeJsonParse } from "./safeJsonParse"

export const COMMAND_OUTPUT_STRING = "Output:"

/**
 * Combines sequences of command and command_output messages in an array of ClineMessages.
 * Also combines sequences of use_mcp_server and mcp_server_response messages.
 *
 * This function processes an array of ClineMessages objects, looking for sequences
 * where a 'command' message is followed by one or more 'command_output' messages,
 * or where a 'use_mcp_server' message is followed by one or more 'mcp_server_response' messages.
 * When such a sequence is found, it combines them into a single message, merging
 * their text contents.
 *
 * @param messages - An array of ClineMessage objects to process.
 * @returns A new array of ClineMessage objects with command and MCP sequences combined.
 *
 * @example
 * const messages: ClineMessage[] = [
 *   { type: 'ask', ask: 'command', text: 'ls', ts: 1625097600000 },
 *   { type: 'ask', ask: 'command_output', text: 'file1.txt', ts: 1625097601000 },
 *   { type: 'ask', ask: 'command_output', text: 'file2.txt', ts: 1625097602000 }
 * ];
 * const result = simpleCombineCommandSequences(messages);
 * // Result: [{ type: 'ask', ask: 'command', text: 'ls\nfile1.txt\nfile2.txt', ts: 1625097600000 }]
 */
export function combineCommandSequences(messages: ClineMessage[]): ClineMessage[] {
	const combinedCommands: ClineMessage[] = []
	const combinedMcpResponses: ClineMessage[] = []

	// Create a map of MCP server responses by timestamp
	const mcpResponseMap = new Map<number, string>()

	// First, collect all MCP server responses
	for (let i = 0; i < messages.length; i++) {
		const msg = messages[i]
		if (msg.say === "mcp_server_response") {
			// Find the closest preceding use_mcp_server message
			let j = i - 1
			while (j >= 0) {
				if (messages[j].type === "ask" && messages[j].ask === "use_mcp_server") {
					const ts = messages[j].ts
					const currentResponse = mcpResponseMap.get(ts) || ""
					const newResponse = currentResponse ? currentResponse + "\n" + (msg.text || "") : msg.text || ""
					mcpResponseMap.set(ts, newResponse)
					break
				}
				j--
			}
		}
	}

	// Process all MCP server requests first
	for (let i = 0; i < messages.length; i++) {
		if (messages[i].type === "ask" && messages[i].ask === "use_mcp_server") {
			const mcpResponse = mcpResponseMap.get(messages[i].ts)

			if (mcpResponse) {
				// Parse the JSON from the message text
				const jsonObj = safeJsonParse<any>(messages[i].text || "{}", {})

				// Add the response to the JSON object
				jsonObj.response = mcpResponse

				// Stringify the updated JSON object
				const combinedText = JSON.stringify(jsonObj)

				combinedMcpResponses.push({ ...messages[i], text: combinedText })
			} else {
				// If there's no response, just keep the original message
				combinedMcpResponses.push({ ...messages[i] })
			}
		}
	}

	// Then process command sequences
	for (let i = 0; i < messages.length; i++) {
		if (messages[i].type === "ask" && messages[i].ask === "command") {
			let combinedText = messages[i].text || ""
			let j = i + 1
			let previous: { type: "ask" | "say"; text: string } | undefined

			while (j < messages.length) {
				const { type, ask, say, text = "" } = messages[j]

				if (type === "ask" && ask === "command") {
					break // Stop if we encounter the next command.
				}

				if (ask === "command_output" || say === "command_output") {
					if (!previous) {
						combinedText += `\n${COMMAND_OUTPUT_STRING}`
					}

					const isDuplicate = previous && previous.type !== type && previous.text === text

					if (text.length > 0 && !isDuplicate) {
						// Add a newline before adding the text if there's already content
						if (
							previous &&
							combinedText.length >
								combinedText.indexOf(COMMAND_OUTPUT_STRING) + COMMAND_OUTPUT_STRING.length
						) {
							combinedText += "\n"
						}
						combinedText += text
					}

					previous = { type, text }
				}

				j++
			}

			combinedCommands.push({ ...messages[i], text: combinedText })

			// Move to the index just before the next command or end of array.
			i = j - 1
		}
	}

	// Second pass: remove command_outputs and mcp_server_responses, and replace original commands and MCP requests with
	// combined ones.
	const result = messages
		.filter(
			(msg) =>
				!(msg.ask === "command_output" || msg.say === "command_output" || msg.say === "mcp_server_response"),
		)
		.map((msg) => {
			if (msg.type === "ask" && msg.ask === "command") {
				return combinedCommands.find((cmd) => cmd.ts === msg.ts) || msg
			}
			if (msg.type === "ask" && msg.ask === "use_mcp_server") {
				return combinedMcpResponses.find((mcp) => mcp.ts === msg.ts) || msg
			}

			return msg
		})

	return result
}
