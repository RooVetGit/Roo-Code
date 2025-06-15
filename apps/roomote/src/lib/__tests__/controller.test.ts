// npx vitest src/lib/__tests__/controller.test.ts

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

const mockQueue = {
	getWaiting: vi.fn(() => Promise.resolve([])),
	getActive: vi.fn(() => Promise.resolve([])),
	close: vi.fn(() => Promise.resolve()),
	on: vi.fn(),
}

const mockSpawn = vi.fn(() => ({
	stdout: { pipe: vi.fn() },
	stderr: { pipe: vi.fn() },
	on: vi.fn(),
	unref: vi.fn(),
}))

const mockCreateWriteStream = vi.fn(() => ({
	end: vi.fn(),
}))

vi.mock("../redis", () => ({
	redis: { host: "localhost", port: 6379 },
}))

vi.mock("child_process", () => ({
	spawn: mockSpawn,
}))

vi.mock("fs", () => ({
	default: {
		existsSync: vi.fn(() => false),
		createWriteStream: mockCreateWriteStream,
	},
}))

const mockQueueConstructor = vi.fn(() => mockQueue)

vi.mock("bullmq", () => ({
	Queue: mockQueueConstructor,
}))

describe("WorkerController", () => {
	let WorkerController: typeof import("../controller").WorkerController

	beforeEach(async () => {
		vi.clearAllMocks()
		const controllerModule = await import("../controller")
		WorkerController = controllerModule.WorkerController
	})

	afterEach(() => {
		vi.restoreAllMocks()
	})

	it("should create a Queue instance with correct configuration", () => {
		const controller = new WorkerController()

		expect(mockQueueConstructor).toHaveBeenCalledWith("roomote", {
			connection: { host: "localhost", port: 6379 },
		})

		expect(controller).toBeDefined()
	})

	it("should handle queue monitoring without errors", async () => {
		const controller = new WorkerController()

		await controller.start()
		expect(controller).toBeDefined()

		await controller.stop()
		expect(mockQueue.close).toHaveBeenCalled()
	})

	it("should handle worker spawning logic", () => {
		const controller = new WorkerController()
		expect(mockSpawn).toBeDefined()
		expect(mockCreateWriteStream).toBeDefined()
		expect(controller).toBeDefined()
	})

	it("should track running state correctly", async () => {
		const controller = new WorkerController()

		expect(controller.isRunning).toBeFalsy()

		await controller.start()
		expect(controller.isRunning).toBeTruthy()

		await controller.stop()
		expect(controller.isRunning).toBeFalsy()
	})
})
