import { ClineStackManager } from "../ClineStackManager"
import { Cline } from "../../Cline"

// Mock Cline class
jest.mock("../../Cline", () => ({
	Cline: jest.fn().mockImplementation(() => ({
		taskId: "mock-task-id",
		instanceId: "mock-instance-id",
		abortTask: jest.fn().mockResolvedValue(undefined),
		rootTask: undefined,
		parentTask: undefined,
	})),
}))

describe("ClineStackManager", () => {
	let clineStackManager: ClineStackManager
	let mockCline1: Cline
	let mockCline2: Cline

	beforeEach(() => {
		// Reset mocks
		jest.clearAllMocks()

		// Create a new instance for each test
		clineStackManager = new ClineStackManager()

		// Create mock Cline instances
		const { Cline } = require("../../Cline")
		mockCline1 = new Cline()
		mockCline2 = new Cline()

		// Set unique task IDs for testing
		Object.defineProperty(mockCline1, "taskId", { value: "task-id-1" })
		Object.defineProperty(mockCline2, "taskId", { value: "task-id-2" })
	})

	test("addClineToStack adds a Cline instance to the stack", async () => {
		await clineStackManager.addClineToStack(mockCline1)

		const stackSize = await clineStackManager.getClineStackSize()
		expect(stackSize).toBe(1)

		const currentCline = await clineStackManager.getCurrentCline()
		expect(currentCline).toBe(mockCline1)
	})

	test("addClineToStack adds multiple Cline instances to the stack", async () => {
		await clineStackManager.addClineToStack(mockCline1)
		await clineStackManager.addClineToStack(mockCline2)

		const stackSize = await clineStackManager.getClineStackSize()
		expect(stackSize).toBe(2)

		const currentCline = await clineStackManager.getCurrentCline()
		expect(currentCline).toBe(mockCline2)
	})

	test("removeClineFromStack removes the top Cline instance from the stack", async () => {
		await clineStackManager.addClineToStack(mockCline1)
		await clineStackManager.addClineToStack(mockCline2)

		await clineStackManager.removeClineFromStack()

		const stackSize = await clineStackManager.getClineStackSize()
		expect(stackSize).toBe(1)

		const currentCline = await clineStackManager.getCurrentCline()
		expect(currentCline).toBe(mockCline1)

		// Verify abortTask was called on the removed Cline
		expect(mockCline2.abortTask).toHaveBeenCalledWith(true)
	})

	test("removeClineFromStack does nothing when stack is empty", async () => {
		await clineStackManager.removeClineFromStack()

		const stackSize = await clineStackManager.getClineStackSize()
		expect(stackSize).toBe(0)
	})

	test("getCurrentCline returns undefined when stack is empty", async () => {
		const currentCline = await clineStackManager.getCurrentCline()
		expect(currentCline).toBeUndefined()
	})

	test("getCurrentTaskStack returns an array of task IDs", async () => {
		await clineStackManager.addClineToStack(mockCline1)
		await clineStackManager.addClineToStack(mockCline2)

		const taskStack = await clineStackManager.getCurrentTaskStack()
		expect(taskStack).toEqual(["task-id-1", "task-id-2"])
	})

	test("getCurrentTaskStack returns an empty array when stack is empty", async () => {
		const taskStack = await clineStackManager.getCurrentTaskStack()
		expect(taskStack).toEqual([])
	})

	test("removeClineFromStack handles errors during abort", async () => {
		// Mock console.log to verify error logging
		const consoleLogSpy = jest.spyOn(console, "log").mockImplementation()

		// Create a Cline instance that throws an error when abortTask is called
		// Create a mock Cline instance with all required properties
		const errorCline = {
			taskId: "error-task-id",
			instanceId: "error-instance-id",
			abortTask: jest.fn().mockRejectedValue(new Error("Abort error")),
			rootTask: undefined,
			parentTask: undefined,
			taskNumber: 1,
			isPaused: false,
			pausedModeSlug: "default",
			pauseInterval: undefined,
			apiConfiguration: {},
			api: {},
			diffEnabled: false,
			fuzzyMatchThreshold: 1.0,
			// Add other required properties from Cline class
			on: jest.fn(),
			once: jest.fn(),
			off: jest.fn(),
			emit: jest.fn(),
		} as unknown as Cline

		await clineStackManager.addClineToStack(errorCline)
		await clineStackManager.removeClineFromStack()

		// Verify abortTask was called
		expect(errorCline.abortTask).toHaveBeenCalledWith(true)

		// Verify error was logged
		expect(consoleLogSpy).toHaveBeenCalledWith(
			expect.stringContaining("[subtasks] encountered error while aborting task error-task-id.error-instance-id"),
		)

		// Verify Cline was still removed from stack
		const stackSize = await clineStackManager.getClineStackSize()
		expect(stackSize).toBe(0)

		// Restore console.log
		consoleLogSpy.mockRestore()
	})
})
