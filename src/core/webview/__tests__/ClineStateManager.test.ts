import { ClineStateManager } from "../ClineStateManager"
import { CustomModesManager } from "../../config/CustomModesManager"
import { ContextProxy } from "../../contextProxy"

// Mock dependencies
jest.mock("../../config/CustomModesManager")
jest.mock("../../contextProxy")

describe("ClineStateManager", () => {
	let mockCustomModesManager: jest.Mocked<CustomModesManager>
	let mockContextProxy: jest.Mocked<ContextProxy>

	beforeEach(() => {
		// Reset all mocks
		jest.clearAllMocks()

		// Create mock instances
		mockCustomModesManager = new CustomModesManager({} as any, () =>
			Promise.resolve(),
		) as jest.Mocked<CustomModesManager>
		mockContextProxy = ContextProxy.getInstance() as jest.Mocked<ContextProxy>
	})

	describe("getInstance", () => {
		it("should create a singleton instance", () => {
			const instance1 = ClineStateManager.getInstance(mockCustomModesManager)
			const instance2 = ClineStateManager.getInstance(mockCustomModesManager)
			expect(instance1).toBe(instance2)
		})

		it("should initialize with provided CustomModesManager", () => {
			const instance = ClineStateManager.getInstance(mockCustomModesManager)
			expect(instance).toBeInstanceOf(ClineStateManager)
			expect(mockContextProxy).toHaveBeenCalled()
		})
	})

	describe("constructor", () => {
		it("should initialize contextProxy", () => {
			const instance = new ClineStateManager(mockCustomModesManager)
			expect(ContextProxy.getInstance).toHaveBeenCalled()
		})
	})
})
