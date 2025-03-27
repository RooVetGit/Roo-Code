import { ClineStackManager } from "../ClineStackManager"

// Create a mock Cline-like object that satisfies the ClineStackManager requirements
class MockCline {
	readonly taskId: string
	readonly instanceId: string
	private _isAbandoned: boolean = false

	constructor() {
		this.taskId = Math.random().toString(36).substring(7)
		this.instanceId = Math.random().toString(36).substring(7)
	}

	dispose = jest.fn()

	async abortTask(isAbandoned: boolean = false): Promise<void> {
		this._isAbandoned = isAbandoned
	}

	get abandoned(): boolean {
		return this._isAbandoned
	}
}

describe("ClineStackManager", () => {
	let clineStackManager: ClineStackManager
	let mockCline: MockCline

	beforeEach(() => {
		clineStackManager = new ClineStackManager()
		mockCline = new MockCline()
	})

	test("addClineToStack adds a Cline instance to the stack", async () => {
		await clineStackManager.addClineToStack(mockCline as any)
		const currentCline = await clineStackManager.getCurrentCline()
		expect(currentCline).toBe(mockCline)
	})

	test("removeClineFromStack removes the last Cline instance", async () => {
		await clineStackManager.addClineToStack(mockCline as any)
		await clineStackManager.removeClineFromStack()
		const currentCline = await clineStackManager.getCurrentCline()
		expect(currentCline).toBeUndefined()
		expect(mockCline.abandoned).toBe(true)
	})

	test("getCurrentCline returns undefined when stack is empty", async () => {
		const currentCline = await clineStackManager.getCurrentCline()
		expect(currentCline).toBeUndefined()
	})

	test("getCurrentCline returns the last added Cline", async () => {
		const mockCline2 = new MockCline()

		await clineStackManager.addClineToStack(mockCline as any)
		await clineStackManager.addClineToStack(mockCline2 as any)
		const currentCline = await clineStackManager.getCurrentCline()
		expect(currentCline).toBe(mockCline2)
	})

	test("getClineStackSize returns correct stack size", async () => {
		await clineStackManager.addClineToStack(mockCline as any)
		const stackSize = await clineStackManager.getClineStackSize()
		expect(stackSize).toBe(1)
	})

	test("getCurrentTaskStack returns task IDs", async () => {
		await clineStackManager.addClineToStack(mockCline as any)
		const taskStack = await clineStackManager.getCurrentTaskStack()
		expect(taskStack).toContain(mockCline.taskId)
	})
})
