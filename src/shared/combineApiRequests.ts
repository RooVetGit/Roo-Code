import { ClineMessage } from "./ExtensionMessage"

/**
 * Combines API request start and finish messages in an array of ClineMessages.
 *
 * This function looks for pairs of 'api_req_started' and 'api_req_finished' messages.
 * When it finds a pair, it combines them into a single 'api_req_combined' message.
 * The JSON data in the text fields of both messages are merged.
 *
 * @param messages - An array of ClineMessage objects to process.
 * @returns A new array of ClineMessage objects with API requests combined.
 *
 * @example
 * const messages = [
 *   { type: "say", say: "api_req_started", text: '{"request":"GET /api/data"}', ts: 1000 },
 *   { type: "say", say: "api_req_finished", text: '{"cost":0.005}', ts: 1001 }
 * ];
 * const result = combineApiRequests(messages);
 * // Result: [{ type: "say", say: "api_req_started", text: '{"request":"GET /api/data","cost":0.005}', ts: 1000 }]
 */
export function combineApiRequests(messages: ClineMessage[]): ClineMessage[] {
	// Early return for empty array
	if (messages.length === 0) {
		return []
	}

	// Map to track which api_req_started messages have been combined
	const combinedStartIndices = new Set<number>()

	// First pass: identify and combine api requests
	const result: ClineMessage[] = []
	const startedRequests: { index: number; message: ClineMessage }[] = []

	// Process all messages in a single pass
	for (let i = 0; i < messages.length; i++) {
		const message = messages[i]

		if (message.type === "say") {
			if (message.say === "api_req_started") {
				// Add to result and track for potential combination
				result.push(message)
				startedRequests.push({ index: result.length - 1, message })
			} else if (message.say === "api_req_finished" && startedRequests.length > 0) {
				// Find the most recent api_req_started that hasn't been combined
				const startRequest = startedRequests.pop()
				if (startRequest) {
					// Parse and combine the requests
					const startedData = JSON.parse(startRequest.message.text || "{}")
					const finishedData = JSON.parse(message.text || "{}")
					const combinedData = { ...startedData, ...finishedData }

					// Update the api_req_started message in the result array
					result[startRequest.index] = {
						...startRequest.message,
						text: JSON.stringify(combinedData),
					}

					// Mark this start message as combined
					combinedStartIndices.add(startRequest.index)
				}
				// Skip adding api_req_finished to result (filtered out)
			} else if (message.say !== "api_req_finished") {
				// Add any other message type to the result
				result.push(message)
			}
		} else {
			// Add non-say message types to the result
			result.push(message)
		}
	}

	return result
}
