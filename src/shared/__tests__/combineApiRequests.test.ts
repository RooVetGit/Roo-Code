import { combineApiRequests } from "../combineApiRequests"
import { ClineMessage } from "../ExtensionMessage"

describe("combineApiRequests", () => {
	// Helper function to create a basic api_req_started message
	const createStartMessage = (text: string = '{"request":"GET /api/data"}', ts: number = 1000): ClineMessage => ({
		type: "say",
		say: "api_req_started",
		text,
		ts,
	})

	// Helper function to create a basic api_req_finished message
	const createFinishMessage = (text: string = '{"cost":0.005}', ts: number = 1001): ClineMessage => ({
		type: "say",
		say: "api_req_finished",
		text,
		ts,
	})

	// Helper function to create a non-API message
	const createOtherMessage = (
		say: "text" | "task" | "error" | "command" = "text",
		text: string = "Hello world",
		ts: number = 999,
	): ClineMessage => ({
		type: "say",
		say,
		text,
		ts,
	})

	describe("Basic functionality", () => {
		it("should combine a pair of api_req_started and api_req_finished messages", () => {
			const messages: ClineMessage[] = [createStartMessage(), createFinishMessage()]

			const result = combineApiRequests(messages)

			// Should have one message (the combined one)
			expect(result).toHaveLength(1)

			// The combined message should have the properties of the start message
			expect(result[0].type).toBe("say")
			expect(result[0].say).toBe("api_req_started")
			expect(result[0].ts).toBe(1000)

			// The text should be a JSON string with combined properties
			const parsedText = JSON.parse(result[0].text || "{}")
			expect(parsedText).toEqual({
				request: "GET /api/data",
				cost: 0.005,
			})
		})

		it("should handle multiple pairs of API request messages", () => {
			const messages: ClineMessage[] = [
				createStartMessage('{"request":"GET /api/data1"}', 1000),
				createFinishMessage('{"cost":0.005}', 1001),
				createStartMessage('{"request":"GET /api/data2"}', 2000),
				createFinishMessage('{"cost":0.007}', 2001),
			]

			const result = combineApiRequests(messages)

			// Should have two messages (the combined ones)
			expect(result).toHaveLength(2)

			// Check first combined message
			const parsedText1 = JSON.parse(result[0].text || "{}")
			expect(parsedText1).toEqual({
				request: "GET /api/data1",
				cost: 0.005,
			})

			// Check second combined message
			const parsedText2 = JSON.parse(result[1].text || "{}")
			expect(parsedText2).toEqual({
				request: "GET /api/data2",
				cost: 0.007,
			})
		})

		it("should preserve non-API messages", () => {
			const otherMessage = createOtherMessage()
			const messages: ClineMessage[] = [otherMessage, createStartMessage(), createFinishMessage()]

			const result = combineApiRequests(messages)

			// Should have two messages (the other message and the combined one)
			expect(result).toHaveLength(2)

			// The first message should be unchanged
			expect(result[0]).toEqual(otherMessage)
		})

		it("should handle interleaved API and non-API messages", () => {
			const otherMessage1 = createOtherMessage("text", "Message 1", 999)
			const otherMessage2 = createOtherMessage("text", "Message 2", 1500)

			const messages: ClineMessage[] = [
				otherMessage1,
				createStartMessage('{"request":"GET /api/data1"}', 1000),
				createFinishMessage('{"cost":0.005}', 1001),
				otherMessage2,
				createStartMessage('{"request":"GET /api/data2"}', 2000),
				createFinishMessage('{"cost":0.007}', 2001),
			]

			const result = combineApiRequests(messages)

			// Should have four messages (two other messages and two combined ones)
			expect(result).toHaveLength(4)

			// Check the order and content of messages
			expect(result[0]).toEqual(otherMessage1)

			const parsedText1 = JSON.parse(result[1].text || "{}")
			expect(parsedText1).toEqual({
				request: "GET /api/data1",
				cost: 0.005,
			})

			expect(result[2]).toEqual(otherMessage2)

			const parsedText2 = JSON.parse(result[3].text || "{}")
			expect(parsedText2).toEqual({
				request: "GET /api/data2",
				cost: 0.007,
			})
		})
	})

	describe("Edge cases", () => {
		it("should handle empty messages array", () => {
			const result = combineApiRequests([])
			expect(result).toEqual([])
		})

		it("should keep api_req_started message if no matching api_req_finished is found", () => {
			const startMessage = createStartMessage()
			const messages: ClineMessage[] = [startMessage]

			const result = combineApiRequests(messages)

			// Should have one message (the original start message)
			expect(result).toHaveLength(1)
			expect(result[0]).toEqual(startMessage)
		})

		it("should handle missing text field in api_req_started", () => {
			const startMessage: ClineMessage = {
				type: "say",
				say: "api_req_started",
				ts: 1000,
				// text field is missing
			}
			const finishMessage = createFinishMessage()

			const messages: ClineMessage[] = [startMessage, finishMessage]

			const result = combineApiRequests(messages)

			// Should have one message (the combined one)
			expect(result).toHaveLength(1)

			// The text should be a JSON string with only the finish message properties
			const parsedText = JSON.parse(result[0].text || "{}")
			expect(parsedText).toEqual({
				cost: 0.005,
			})
		})

		it("should handle missing text field in api_req_finished", () => {
			const startMessage = createStartMessage()
			const finishMessage: ClineMessage = {
				type: "say",
				say: "api_req_finished",
				ts: 1001,
				// text field is missing
			}

			const messages: ClineMessage[] = [startMessage, finishMessage]

			const result = combineApiRequests(messages)

			// Should have one message (the combined one)
			expect(result).toHaveLength(1)

			// The text should be a JSON string with only the start message properties
			const parsedText = JSON.parse(result[0].text || "{}")
			expect(parsedText).toEqual({
				request: "GET /api/data",
			})
		})

		it("should use the first api_req_finished message if multiple matches exist", () => {
			const messages: ClineMessage[] = [
				createStartMessage('{"request":"GET /api/data"}', 1000),
				createFinishMessage('{"cost":0.005}', 1001),
				createFinishMessage('{"cost":0.007}', 1002), // This should be ignored
			]

			const result = combineApiRequests(messages)

			// Should have one message (the combined one)
			expect(result).toHaveLength(1)

			// The text should be a JSON string with combined properties from the first finish message
			const parsedText = JSON.parse(result[0].text || "{}")
			expect(parsedText).toEqual({
				request: "GET /api/data",
				cost: 0.005, // Should use the first finish message's cost
			})
		})

		it("should handle multiple start messages with some missing finish messages", () => {
			const messages: ClineMessage[] = [
				createStartMessage('{"request":"GET /api/data1"}', 1000),
				createFinishMessage('{"cost":0.005}', 1001),
				createStartMessage('{"request":"GET /api/data2"}', 2000),
				// No finish message for the second start message
			]

			const result = combineApiRequests(messages)

			// Should have two messages (one combined and one original start message)
			expect(result).toHaveLength(2)

			// Check first combined message
			const parsedText1 = JSON.parse(result[0].text || "{}")
			expect(parsedText1).toEqual({
				request: "GET /api/data1",
				cost: 0.005,
			})

			// Check second message (should be the original start message)
			expect(result[1].say).toBe("api_req_started")
			const parsedText2 = JSON.parse(result[1].text || "{}")
			expect(parsedText2).toEqual({
				request: "GET /api/data2",
			})
		})

		it("should preserve additional properties in the messages", () => {
			const startMessage: ClineMessage = {
				type: "say",
				say: "api_req_started",
				text: '{"request":"GET /api/data"}',
				ts: 1000,
				reasoning: "This is a test",
				partial: false,
			}

			const finishMessage: ClineMessage = {
				type: "say",
				say: "api_req_finished",
				text: '{"cost":0.005}',
				ts: 1001,
			}

			const messages: ClineMessage[] = [startMessage, finishMessage]

			const result = combineApiRequests(messages)

			// Should have one message (the combined one)
			expect(result).toHaveLength(1)

			// The combined message should preserve additional properties from the start message
			expect(result[0].reasoning).toBe("This is a test")
			expect(result[0].partial).toBe(false)
		})
	})

	describe("Bug verification", () => {
		it("should correctly replace api_req_started messages with combined ones", () => {
			// Create a scenario where we can verify the replacement logic
			const otherMessage = createOtherMessage()
			const startMessage1 = createStartMessage('{"request":"GET /api/data1"}', 1000)
			const finishMessage1 = createFinishMessage('{"cost":0.005}', 1001)
			const startMessage2 = createStartMessage('{"request":"GET /api/data2"}', 2000)
			// No finish message for the second start

			const messages: ClineMessage[] = [otherMessage, startMessage1, finishMessage1, startMessage2]

			const result = combineApiRequests(messages)

			// Should have three messages (other, combined, and the orphaned start)
			expect(result).toHaveLength(3)

			// First message should be unchanged
			expect(result[0]).toEqual(otherMessage)

			// Second message should be a combined message with the same ts as startMessage1
			expect(result[1].ts).toBe(startMessage1.ts)
			expect(result[1].say).toBe("api_req_started")
			const parsedText1 = JSON.parse(result[1].text || "{}")
			expect(parsedText1).toEqual({
				request: "GET /api/data1",
				cost: 0.005,
			})

			// Third message should be the original startMessage2
			expect(result[2]).toEqual(startMessage2)
		})

		it("should filter out all api_req_finished messages", () => {
			const messages: ClineMessage[] = [
				createOtherMessage(),
				createStartMessage(),
				createFinishMessage(),
				createFinishMessage('{"cost":0.007}', 2000), // Orphaned finish message
			]

			const result = combineApiRequests(messages)

			// Should have two messages (other and combined), no finish messages
			expect(result).toHaveLength(2)

			// No message should have say="api_req_finished"
			expect(result.some((msg) => msg.say === "api_req_finished")).toBe(false)
		})
	})
})
