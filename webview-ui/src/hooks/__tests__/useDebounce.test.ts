import { renderHook, act } from "@testing-library/react"
import { useDebounce } from "../useDebounce"

// Mock timers for testing
jest.useFakeTimers()

describe("useDebounce", () => {
	afterEach(() => {
		jest.clearAllTimers()
	})

	it("should initialize with isProcessing as false", () => {
		const { result } = renderHook(() => useDebounce())
		expect(result.current.isProcessing).toBe(false)
	})

	it("should set isProcessing to true when operation starts", () => {
		const { result } = renderHook(() => useDebounce())
		const mockOperation = jest.fn()

		act(() => {
			result.current.handleWithDebounce(mockOperation)
		})

		expect(result.current.isProcessing).toBe(true)
		expect(mockOperation).toHaveBeenCalledTimes(1)
	})

	it("should reset isProcessing to false after delay", () => {
		const { result } = renderHook(() => useDebounce(300))
		const mockOperation = jest.fn()

		act(() => {
			result.current.handleWithDebounce(mockOperation)
		})

		expect(result.current.isProcessing).toBe(true)

		// Fast-forward time by 300ms
		act(() => {
			jest.advanceTimersByTime(300)
		})

		expect(result.current.isProcessing).toBe(false)
	})

	it("should prevent multiple operations when isProcessing is true", () => {
		const { result } = renderHook(() => useDebounce())
		const mockOperation1 = jest.fn()
		const mockOperation2 = jest.fn()

		// First operation
		act(() => {
			result.current.handleWithDebounce(mockOperation1)
		})

		expect(result.current.isProcessing).toBe(true)
		expect(mockOperation1).toHaveBeenCalledTimes(1)

		// Second operation should be prevented
		act(() => {
			result.current.handleWithDebounce(mockOperation2)
		})

		expect(mockOperation2).not.toHaveBeenCalled()
		expect(mockOperation1).toHaveBeenCalledTimes(1)
	})

	it("should use custom delay when provided", () => {
		const customDelay = 500
		const { result } = renderHook(() => useDebounce(customDelay))
		const mockOperation = jest.fn()

		act(() => {
			result.current.handleWithDebounce(mockOperation)
		})

		expect(result.current.isProcessing).toBe(true)

		// Fast-forward by less than custom delay
		act(() => {
			jest.advanceTimersByTime(400)
		})

		expect(result.current.isProcessing).toBe(true)

		// Fast-forward to complete the custom delay
		act(() => {
			jest.advanceTimersByTime(100)
		})

		expect(result.current.isProcessing).toBe(false)
	})

	it("should handle errors in operation without crashing", () => {
		const { result } = renderHook(() => useDebounce())
		const mockOperation = jest.fn(() => {
			throw new Error("Test error")
		})

		expect(() => {
			act(() => {
				result.current.handleWithDebounce(mockOperation)
			})
		}).not.toThrow()

		expect(result.current.isProcessing).toBe(true)
		expect(mockOperation).toHaveBeenCalledTimes(1)
	})

	it("should reset timer if new operation is called after delay starts", () => {
		const { result } = renderHook(() => useDebounce(300))
		const mockOperation1 = jest.fn()
		const mockOperation2 = jest.fn()

		// First operation
		act(() => {
			result.current.handleWithDebounce(mockOperation1)
		})

		// Fast-forward time by 200ms (less than delay)
		act(() => {
			jest.advanceTimersByTime(200)
		})

		expect(result.current.isProcessing).toBe(true)

		// Reset processing state to allow new operation
		act(() => {
			jest.advanceTimersByTime(100)
		})

		expect(result.current.isProcessing).toBe(false)

		// Second operation should work now
		act(() => {
			result.current.handleWithDebounce(mockOperation2)
		})

		expect(mockOperation2).toHaveBeenCalledTimes(1)
	})
})
