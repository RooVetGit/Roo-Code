// npx vitest webview-ui/src/components/chat/hooks/__tests__/useChatTextDraft.spec.ts

import { renderHook, act } from "@testing-library/react"
import { useChatTextDraft } from "../useChatTextDraft"
import { vi } from "vitest"

describe("useChatTextDraft", () => {
	const draftKey = "test-draft-key"
	let setInputValue: (v: string) => void
	let onSend: () => void

	let getItemMock: ReturnType<typeof vi.fn>
	let setItemMock: ReturnType<typeof vi.fn>
	let removeItemMock: ReturnType<typeof vi.fn>

	beforeEach(() => {
		setInputValue = vi.fn((_: string) => {})
		onSend = vi.fn()

		getItemMock = vi.fn()
		setItemMock = vi.fn()
		removeItemMock = vi.fn()

		// @ts-expect-error override readonly
		global.localStorage = {
			getItem: getItemMock,
			setItem: setItemMock,
			removeItem: removeItemMock,
		}
		vi.useFakeTimers()
	})

	afterEach(() => {
		vi.clearAllTimers()
		vi.useRealTimers()
		vi.restoreAllMocks()
	})

	describe("Draft restoration on mount", () => {
		it("should restore draft from localStorage on mount if inputValue is empty", () => {
			getItemMock.mockReturnValue("restored draft")
			renderHook(() => useChatTextDraft(draftKey, "", setInputValue, onSend))
			expect(getItemMock).toHaveBeenCalledWith(draftKey)
			expect(setInputValue).toHaveBeenCalledWith("restored draft")
		})

		it("should not restore draft if inputValue is not empty", () => {
			getItemMock.mockReturnValue("restored draft")
			renderHook(() => useChatTextDraft(draftKey, "already typed", setInputValue, onSend))
			expect(getItemMock).toHaveBeenCalledWith(draftKey)
			expect(setInputValue).not.toHaveBeenCalled()
		})

		it("should ignore errors from localStorage.getItem", () => {
			getItemMock.mockImplementation(() => {
				throw new Error("getItem error")
			})
			expect(() => renderHook(() => useChatTextDraft(draftKey, "", setInputValue, onSend))).not.toThrow()
			expect(setInputValue).not.toHaveBeenCalled()
		})
	})

	describe("Auto-save functionality with debounce", () => {
		it("should auto-save draft to localStorage after 3 seconds of inactivity if inputValue is non-empty", () => {
			renderHook(({ value }) => useChatTextDraft(draftKey, value, setInputValue, onSend), {
				initialProps: { value: "hello world" },
			})
			expect(setItemMock).not.toHaveBeenCalled()
			act(() => {
				vi.advanceTimersByTime(2999)
			})
			expect(setItemMock).not.toHaveBeenCalled()
			act(() => {
				vi.advanceTimersByTime(1)
			})
			expect(setItemMock).toHaveBeenCalledWith(draftKey, "hello world")
		})

		it("should reset debounce timer when inputValue changes before debounce delay", () => {
			const { rerender } = renderHook(({ value }) => useChatTextDraft(draftKey, value, setInputValue, onSend), {
				initialProps: { value: "foo" },
			})
			act(() => {
				vi.advanceTimersByTime(2000)
			})
			// Should not save before debounce delay
			expect(setItemMock).not.toHaveBeenCalled()
			rerender({ value: "bar" })
			act(() => {
				vi.advanceTimersByTime(2999)
			})
			expect(setItemMock).not.toHaveBeenCalled()
			act(() => {
				vi.advanceTimersByTime(1)
			})
			expect(setItemMock).toHaveBeenCalledWith(draftKey, "bar")
		})

		it("should remove draft from localStorage if inputValue is empty", () => {
			renderHook(({ value }) => useChatTextDraft(draftKey, value, setInputValue, onSend), {
				initialProps: { value: "" },
			})
			expect(removeItemMock).toHaveBeenCalledWith(draftKey)
		})

		it("should ignore errors from localStorage.setItem", () => {
			setItemMock.mockImplementation(() => {
				throw new Error("setItem error")
			})
			renderHook(({ value }) => useChatTextDraft(draftKey, value, setInputValue, onSend), {
				initialProps: { value: "err" },
			})
			act(() => {
				vi.advanceTimersByTime(5000)
			})
			expect(setItemMock).toHaveBeenCalled()
		})

		it("should ignore errors from localStorage.removeItem", () => {
			removeItemMock.mockImplementation(() => {
				throw new Error("removeItem error")
			})
			renderHook(({ value }) => useChatTextDraft(draftKey, value, setInputValue, onSend), {
				initialProps: { value: "" },
			})
			expect(removeItemMock).toHaveBeenCalledWith(draftKey)
		})
	})

	describe("Draft clearing on send", () => {
		it("should remove draft and call onSend when handleSendAndClearDraft is called", () => {
			const { result } = renderHook(() => useChatTextDraft(draftKey, "msg", setInputValue, onSend))
			act(() => {
				result.current.handleSendAndClearDraft()
			})
			expect(removeItemMock).toHaveBeenCalledWith(draftKey)
			expect(onSend).toHaveBeenCalled()
		})

		it("should ignore errors from localStorage.removeItem on send", () => {
			removeItemMock.mockImplementation(() => {
				throw new Error("removeItem error")
			})
			const { result } = renderHook(() => useChatTextDraft(draftKey, "msg", setInputValue, onSend))
			act(() => {
				expect(() => result.current.handleSendAndClearDraft()).not.toThrow()
			})
			expect(onSend).toHaveBeenCalled()
		})
	})

	/**
	 * @description
	 * Complex scenario: multiple inputValue changes, ensure debounce timer cleanup and localStorage operations have no side effects.
	 */
	it("should handle rapid inputValue changes and cleanup debounce timers", () => {
		const { rerender } = renderHook(({ value }) => useChatTextDraft(draftKey, value, setInputValue, onSend), {
			initialProps: { value: "first" },
		})
		act(() => {
			vi.advanceTimersByTime(2999)
		})
		expect(setItemMock).not.toHaveBeenCalled()
		act(() => {
			vi.advanceTimersByTime(1)
		})
		expect(setItemMock).toHaveBeenCalledWith(draftKey, "first")
		rerender({ value: "second" })
		act(() => {
			vi.advanceTimersByTime(2999)
		})
		expect(setItemMock).toHaveBeenCalledTimes(1)
		act(() => {
			vi.advanceTimersByTime(1)
		})
		expect(setItemMock).toHaveBeenCalledWith(draftKey, "second")
		rerender({ value: "" })
		expect(removeItemMock).toHaveBeenCalledWith(draftKey)
	})
	it("should not save and should warn if inputValue exceeds 100KB (ASCII)", () => {
		const draftKey = "large-draft-key"
		const MAX_DRAFT_BYTES = 102400
		// Generate a string larger than 100KB (1 byte per char, simple ASCII)
		const largeStr = "a".repeat(MAX_DRAFT_BYTES + 5000)
		const setItemMock = vi.fn()
		const getItemMock = vi.fn()
		const removeItemMock = vi.fn()
		// @ts-expect-error override readonly
		global.localStorage = {
			getItem: getItemMock,
			setItem: setItemMock,
			removeItem: removeItemMock,
		}
		const warnMock = vi.spyOn(console, "warn").mockImplementation(() => {})
		const setInputValue = vi.fn()
		const onSend = vi.fn()
		renderHook(() => useChatTextDraft(draftKey, largeStr, setInputValue, onSend))
		act(() => {
			vi.advanceTimersByTime(3000)
		})
		expect(setItemMock).not.toHaveBeenCalled()
		expect(warnMock).toHaveBeenCalledWith(expect.stringContaining("exceeds 100KB"))
		warnMock.mockRestore()
	})

	it("should not save and should warn if inputValue exceeds 100KB (UTF-8 multi-byte)", () => {
		const draftKey = "utf8-draft-key"
		// Each emoji is 4 bytes in UTF-8, 汉字 is 3 bytes
		const emoji = "😀"
		const hanzi = "汉"
		// Compose a string: 20,000 emojis (~80KB) + 10,000 汉 (~30KB) + some ASCII
		const utf8Str = emoji.repeat(20000) + hanzi.repeat(10000) + "abc"
		const setItemMock = vi.fn()
		const getItemMock = vi.fn()
		const removeItemMock = vi.fn()
		// @ts-expect-error override readonly
		global.localStorage = {
			getItem: getItemMock,
			setItem: setItemMock,
			removeItem: removeItemMock,
		}
		const warnMock = vi.spyOn(console, "warn").mockImplementation(() => {})
		const setInputValue = vi.fn()
		const onSend = vi.fn()
		renderHook(() => useChatTextDraft(draftKey, utf8Str, setInputValue, onSend))
		act(() => {
			vi.advanceTimersByTime(3000)
		})
		expect(setItemMock).not.toHaveBeenCalled()
		expect(warnMock).toHaveBeenCalledWith(expect.stringContaining("exceeds 100KB"))
		warnMock.mockRestore()
	})
})
