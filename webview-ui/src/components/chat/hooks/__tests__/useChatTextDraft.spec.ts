// npx vitest webview-ui/src/components/chat/hooks/__tests__/useChatTextDraft.spec.ts

import { renderHook, act } from "@testing-library/react"
import { useChatTextDraft } from "../useChatTextDraft"
import { vi } from "vitest"
import { vscode } from "@src/utils/vscode"

describe("useChatTextDraft (postMessage version)", () => {
	let setInputValue: (v: string) => void
	let onSend: () => void
	let postMessageMock: ReturnType<typeof vi.fn>
	let addEventListenerMock: ReturnType<typeof vi.fn>
	let removeEventListenerMock: ReturnType<typeof vi.fn>
	let eventListener: ((event: MessageEvent) => void) | undefined

	beforeEach(() => {
		setInputValue = vi.fn((_: string) => {})
		onSend = vi.fn()
		postMessageMock = vi.fn()
		addEventListenerMock = vi.fn((type, cb) => {
			if (type === "message") eventListener = cb
		})
		removeEventListenerMock = vi.fn((type, cb) => {
			if (type === "message" && eventListener === cb) eventListener = undefined
		})

		global.window.addEventListener = addEventListenerMock
		global.window.removeEventListener = removeEventListenerMock
		// mock vscode.postMessage
		vi.resetModules()
		vi.clearAllMocks()
		vscode.postMessage = postMessageMock

		vi.useFakeTimers()
	})

	afterEach(() => {
		vi.clearAllTimers()
		vi.useRealTimers()
		vi.restoreAllMocks()
		eventListener = undefined
	})

	it("should send getChatTextDraft on mount and set input value when chatTextDraftValue received", () => {
		renderHook(() => useChatTextDraft("", setInputValue, onSend))
		expect(postMessageMock).toHaveBeenCalledWith({ type: "getChatTextDraft" })
		expect(setInputValue).not.toHaveBeenCalled()
		// Simulate extension host response
		act(() => {
			eventListener?.({ data: { type: "chatTextDraftValue", text: "restored draft" } } as MessageEvent)
		})
		expect(setInputValue).toHaveBeenCalledWith("restored draft")
	})

	it("should not set input value if inputValue is not empty when chatTextDraftValue received", () => {
		renderHook(() => useChatTextDraft("already typed", setInputValue, onSend))
		act(() => {
			eventListener?.({ data: { type: "chatTextDraftValue", text: "restored draft" } } as MessageEvent)
		})
		expect(setInputValue).not.toHaveBeenCalled()
	})

	it("should debounce and send updateChatTextDraft with text after 2s if inputValue is non-empty", () => {
		renderHook(({ value }) => useChatTextDraft(value, setInputValue, onSend), {
			initialProps: { value: "hello world" },
		})
		expect(postMessageMock).toHaveBeenCalledWith({ type: "getChatTextDraft" })
		postMessageMock.mockClear()
		act(() => {
			vi.advanceTimersByTime(1999)
		})
		expect(postMessageMock).not.toHaveBeenCalled()
		act(() => {
			vi.advanceTimersByTime(1)
		})
		expect(postMessageMock).toHaveBeenCalledWith({ type: "updateChatTextDraft", text: "hello world" })
	})

	it("should reset debounce timer when inputValue changes before debounce delay", () => {
		const { rerender } = renderHook(({ value }) => useChatTextDraft(value, setInputValue, onSend), {
			initialProps: { value: "foo" },
		})
		act(() => {
			vi.advanceTimersByTime(1000)
		})
		postMessageMock.mockClear()
		rerender({ value: "bar" })
		act(() => {
			vi.advanceTimersByTime(1999)
		})
		expect(postMessageMock).not.toHaveBeenCalled()
		act(() => {
			vi.advanceTimersByTime(1)
		})
		expect(postMessageMock).toHaveBeenCalledWith({ type: "updateChatTextDraft", text: "bar" })
	})

	it("should send clearChatTextDraft if inputValue is empty after user has input", () => {
		const { rerender } = renderHook(({ value }) => useChatTextDraft(value, setInputValue, onSend), {
			initialProps: { value: "foo" },
		})
		act(() => {
			vi.advanceTimersByTime(2000)
		})
		postMessageMock.mockClear()
		rerender({ value: "" })
		expect(postMessageMock).toHaveBeenCalledWith({ type: "clearChatTextDraft" })
	})

	it("should send clearChatTextDraft and call onSend when handleSendAndClearDraft is called", () => {
		const { result } = renderHook(() => useChatTextDraft("msg", setInputValue, onSend))
		postMessageMock.mockClear()
		act(() => {
			result.current.handleSendAndClearDraft()
		})
		expect(postMessageMock).toHaveBeenCalledWith({ type: "clearChatTextDraft" })
		expect(onSend).toHaveBeenCalled()
	})

	it("should not send updateChatTextDraft and should warn if inputValue exceeds 100KB (ASCII)", () => {
		const MAX_DRAFT_BYTES = 102400
		const largeStr = "a".repeat(MAX_DRAFT_BYTES + 5000)
		const warnMock = vi.spyOn(console, "warn").mockImplementation(() => {})
		renderHook(() => useChatTextDraft(largeStr, setInputValue, onSend))
		act(() => {
			vi.advanceTimersByTime(3000)
		})
		expect(postMessageMock).not.toHaveBeenCalledWith({ type: "updateChatTextDraft", text: largeStr })
		expect(warnMock).toHaveBeenCalledWith(expect.stringContaining("exceeds 100KB"))
		warnMock.mockRestore()
	})

	it("should not send updateChatTextDraft and should warn if inputValue exceeds 100KB (UTF-8 multi-byte)", () => {
		const emoji = "😀"
		const hanzi = "汉"
		const utf8Str = emoji.repeat(20000) + hanzi.repeat(10000) + "abc"
		const warnMock = vi.spyOn(console, "warn").mockImplementation(() => {})
		renderHook(() => useChatTextDraft(utf8Str, setInputValue, onSend))
		act(() => {
			vi.advanceTimersByTime(3000)
		})
		expect(postMessageMock).not.toHaveBeenCalledWith({ type: "updateChatTextDraft", text: utf8Str })
		expect(warnMock).toHaveBeenCalledWith(expect.stringContaining("exceeds 100KB"))
		warnMock.mockRestore()
	})
})
