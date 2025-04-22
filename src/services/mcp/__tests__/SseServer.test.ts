import { runSseServer } from "../SseServer"
import { NotificationEventHub } from "../NotificationEventHub"
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js"
import express from "express"

// Set up mocks - use direct implementation in jest.mock
jest.mock("express", () => {
	const mockApp = {
		get: jest.fn(),
		post: jest.fn(),
		listen: jest.fn(),
	}
	const mockExpress = jest.fn(() => mockApp)
	return mockExpress
})

// Mock the server module
jest.mock("../server", () => ({
	createServer: jest.fn().mockReturnValue({
		connect: jest.fn(),
		disconnect: jest.fn(),
	}),
}))

// Mock the SSE transport class
jest.mock("@modelcontextprotocol/sdk/server/sse.js", () => {
	const mockTransport = {
		handlePostMessage: jest.fn(),
	}
	return {
		SSEServerTransport: jest.fn().mockImplementation(() => mockTransport),
	}
})

// Get the mock express app for testing
const mockExpressApp = express() as unknown as {
	get: jest.Mock
	post: jest.Mock
	listen: jest.Mock
}

describe("runSseServer", () => {
	beforeEach(() => {
		jest.clearAllMocks()
		jest.spyOn(console, "log").mockImplementation()
	})

	afterEach(() => {
		jest.restoreAllMocks()
	})

	it("should initialize express with SSE endpoints", async () => {
		const mockEventHub = {} as NotificationEventHub
		const mockCline = {} as any

		await runSseServer(mockEventHub, mockCline)

		expect(mockExpressApp.get).toHaveBeenCalledWith("/sse", expect.any(Function))
		expect(mockExpressApp.post).toHaveBeenCalledWith("/messages", expect.any(Function))
		expect(mockExpressApp.listen).toHaveBeenCalledWith(3001)
	})

	it("should create SSE transport when connecting", async () => {
		const mockEventHub = {} as NotificationEventHub
		const mockCline = {} as any
		const mockRes = {
			setHeader: jest.fn(),
			flushHeaders: jest.fn(),
			write: jest.fn(),
			end: jest.fn(),
		} as unknown as express.Response

		await runSseServer(mockEventHub, mockCline)

		const sseHandler = mockExpressApp.get.mock.calls[0][1]
		await sseHandler({} as express.Request, mockRes)

		expect(SSEServerTransport).toHaveBeenCalledWith("/messages", mockRes)
	})
})
