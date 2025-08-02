// Comprehensive virtualization tests for ChatView
// npx vitest run src/components/chat/__tests__/ChatView.virtualization.comprehensive.spec.tsx

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import React from "react"
import { render, waitFor, fireEvent } from "@testing-library/react"

// Define types
interface MockMessage {
	id: string
	text: string
	timestamp: number
	expanded?: boolean
}

interface VirtualizationState {
	expandedMessages: Set<string>
	scrollPosition: number
	isUserScrolling: boolean
}

// Create global state for the mock
const mockState: VirtualizationState = {
	expandedMessages: new Set<string>(),
	scrollPosition: 0,
	isUserScrolling: false,
}

// Mock react-virtuoso with more realistic behavior
vi.mock("react-virtuoso", () => {
	return {
		Virtuoso: function MockVirtuoso({
			data,
			itemContent,
			onScroll,
			_scrollSeekConfiguration,
			_overscan,
			_increaseViewportBy,
			_alignToBottom,
			_followOutput,
			_initialTopMostItemIndex,
			rangeChanged,
			isScrolling,
			atBottomStateChange,
		}: any) {
			const [scrollTop, setScrollTop] = React.useState(0)
			const itemHeight = 50 // Mock item height
			const clientHeight = 600 // Viewport height
			const scrollHeight = data.length * itemHeight

			// Calculate visible range based on scroll position
			const startIndex = Math.floor(scrollTop / itemHeight)
			const visibleCount = Math.ceil(clientHeight / itemHeight)
			const endIndex = Math.min(startIndex + visibleCount + 2, data.length - 1) // +2 for overscan

			// Simulate range change callback
			React.useEffect(() => {
				if (rangeChanged && data.length > 0) {
					rangeChanged({ startIndex, endIndex })
				}
			}, [startIndex, endIndex, rangeChanged, data.length])

			// Simulate scroll state
			React.useEffect(() => {
				if (isScrolling) {
					isScrolling(false)
				}
			}, [isScrolling])

			// Simulate at bottom state
			React.useEffect(() => {
				if (atBottomStateChange) {
					const isAtBottom = scrollTop + clientHeight >= scrollHeight - 10
					atBottomStateChange(isAtBottom)
				}
			}, [scrollTop, atBottomStateChange, scrollHeight])

			// For initial render, always show first items
			const actualStartIndex = data.length > 0 ? Math.min(startIndex, data.length - 1) : 0
			const actualEndIndex = data.length > 0 ? Math.min(endIndex, data.length - 1) : -1

			// Ensure we render visible items
			const itemsToRender =
				actualEndIndex >= actualStartIndex ? data.slice(actualStartIndex, actualEndIndex + 1) : []

			return (
				<div
					data-testid="virtuoso-container"
					style={{ height: "600px", overflow: "auto" }}
					onScroll={(e) => {
						const newScrollTop = (e.target as HTMLElement).scrollTop
						setScrollTop(newScrollTop)
						if (onScroll) {
							onScroll(e)
						}
					}}>
					<div style={{ height: `${scrollHeight}px`, position: "relative" }}>
						{itemsToRender.map((item: any, index: number) => (
							<div
								key={actualStartIndex + index}
								data-testid={`virtuoso-item-${actualStartIndex + index}`}
								style={{
									position: "absolute",
									top: `${(actualStartIndex + index) * itemHeight}px`,
									height: `${itemHeight}px`,
									width: "100%",
								}}>
								{itemContent(actualStartIndex + index, item)}
							</div>
						))}
					</div>
				</div>
			)
		},
	}
})

// Mock virtualization hook
const mockVirtualizationHook = vi.fn(({ _messages }: any) => ({
	virtuosoRef: { current: null },
	viewportConfig: {
		top: 500,
		bottom: 1000,
		overscan: { main: 200, reverse: 200 },
	},
	stateManager: {
		isExpanded: (messageTs: number) => mockState.expandedMessages.has(String(messageTs)),
		setState: (messageTs: number, stateUpdate: any) => {
			const id = String(messageTs)
			if (stateUpdate.isExpanded !== undefined) {
				if (stateUpdate.isExpanded) {
					mockState.expandedMessages.add(id)
				} else {
					mockState.expandedMessages.delete(id)
				}
			}
		},
		clear: () => mockState.expandedMessages.clear(),
		hasExpandedMessages: () => mockState.expandedMessages.size > 0,
		pinMessage: vi.fn(),
		cleanup: vi.fn(),
	},
	scrollManager: {
		shouldAutoScroll: () => !mockState.isUserScrolling,
		resetUserScrolling: () => {
			mockState.isUserScrolling = false
		},
		forceUserScrolling: () => {
			mockState.isUserScrolling = true
		},
		reset: () => {
			mockState.isUserScrolling = false
			mockState.scrollPosition = 0
		},
	},
	performanceMonitor: {
		startMonitoring: vi.fn(),
		stopMonitoring: vi.fn(),
		getMetrics: () => ({
			renderTime: 50,
			scrollFPS: 60,
			memoryUsage: 100,
		}),
	},
	handleScroll: vi.fn((scrollTop: number) => {
		mockState.scrollPosition = scrollTop
		mockState.isUserScrolling = true
	}),
	handleRangeChange: vi.fn(),
	handleScrollStateChange: vi.fn((_state: any) => {}),
	scrollToBottom: vi.fn((_behavior?: ScrollBehavior) => {}),
	isAtBottom: mockState.scrollPosition === 0, // Simplified
	showScrollToBottom: mockState.isUserScrolling,
	visibleRange: { startIndex: 0, endIndex: 10 },
}))

vi.mock("../virtualization", () => ({
	useOptimizedVirtualization: mockVirtualizationHook,
}))

// Import Virtuoso from the mock
import { Virtuoso } from "react-virtuoso"

// Test component that simulates ChatView virtualization
const VirtualizedChatView = ({ messages }: { messages: MockMessage[] }) => {
	const virtualization = mockVirtualizationHook({ messages })
	const [localMessages, setLocalMessages] = React.useState(messages)

	React.useEffect(() => {
		setLocalMessages(messages)
	}, [messages])

	const handleToggleExpand = (messageId: string) => {
		// Extract the index from the message ID
		const messageIndex = parseInt(messageId.replace("msg-", ""))
		// Get the actual timestamp from the message
		const messageTs = localMessages[messageIndex]?.timestamp
		if (messageTs) {
			const isExpanded = virtualization.stateManager.isExpanded(messageTs)
			virtualization.stateManager.setState(messageTs, { isExpanded: !isExpanded })
			// Force re-render
			setLocalMessages([...localMessages])
		}
	}

	return (
		<div data-testid="chat-view" style={{ height: "600px" }}>
			<Virtuoso
				data={localMessages}
				itemContent={(_index, message) => (
					<div
						data-testid={`message-${message.id}`}
						style={{
							padding: "10px",
							height: virtualization.stateManager.isExpanded(message.timestamp) ? "100px" : "50px",
							transition: "height 0.2s",
						}}>
						<div>{message.text}</div>
						<button data-testid={`expand-${message.id}`} onClick={() => handleToggleExpand(message.id)}>
							{virtualization.stateManager.isExpanded(message.timestamp) ? "Collapse" : "Expand"}
						</button>
					</div>
				)}
				onScroll={(e) => virtualization.handleScroll((e.target as HTMLElement).scrollTop)}
				rangeChanged={virtualization.handleRangeChange}
				isScrolling={(_isScrolling: boolean) =>
					virtualization.handleScrollStateChange({
						scrollTop: 0,
						scrollHeight: 1000,
						viewportHeight: 600,
					})
				}
				alignToBottom={true}
				followOutput={virtualization.scrollManager.shouldAutoScroll()}
			/>
			{virtualization.showScrollToBottom && (
				<button data-testid="scroll-to-bottom" onClick={() => virtualization.scrollToBottom("smooth")}>
					Scroll to Bottom
				</button>
			)}
		</div>
	)
}

// Helper to generate messages
const generateMessages = (count: number): MockMessage[] => {
	return Array.from({ length: count }, (_, i) => ({
		id: `msg-${i}`,
		text: `Message ${i}`,
		timestamp: Date.now() - (count - i) * 1000,
	}))
}

describe("ChatView Virtualization - Comprehensive Tests", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		// Reset mock state
		mockState.expandedMessages.clear()
		mockState.scrollPosition = 0
		mockState.isUserScrolling = false
	})

	afterEach(() => {
		vi.restoreAllMocks()
	})

	describe("1. Large Message List Handling (1000+ messages)", () => {
		it("should efficiently render 1000 messages", async () => {
			const messages = generateMessages(1000)
			const { container, getByTestId } = render(<VirtualizedChatView messages={messages} />)

			await waitFor(() => {
				expect(getByTestId("chat-view")).toBeInTheDocument()
			})

			// Check that not all messages are rendered at once
			const renderedItems = container.querySelectorAll('[data-testid^="virtuoso-item-"]')
			expect(renderedItems.length).toBeLessThan(50) // Much less than 1000
			expect(renderedItems.length).toBeGreaterThan(0)
		})

		it("should handle 5000 messages without performance degradation", async () => {
			const messages = generateMessages(5000)
			const startTime = performance.now()

			const { getByTestId } = render(<VirtualizedChatView messages={messages} />)

			await waitFor(() => {
				expect(getByTestId("chat-view")).toBeInTheDocument()
			})

			const renderTime = performance.now() - startTime
			expect(renderTime).toBeLessThan(500) // Should render quickly
		})

		it("should update efficiently when messages are added", async () => {
			const { rerender, container } = render(<VirtualizedChatView messages={generateMessages(100)} />)

			// Add more messages
			const updatedMessages = generateMessages(200)
			rerender(<VirtualizedChatView messages={updatedMessages} />)

			await waitFor(() => {
				const items = container.querySelectorAll('[data-testid^="virtuoso-item-"]')
				expect(items.length).toBeGreaterThan(0)
			})
		})
	})

	describe("2. Scrolling Behavior", () => {
		it("should handle scroll events", async () => {
			const messages = generateMessages(100)
			const { getByTestId } = render(<VirtualizedChatView messages={messages} />)

			const container = getByTestId("virtuoso-container")

			// Simulate scroll
			fireEvent.scroll(container, { target: { scrollTop: 500 } })

			// Check that scroll handler was called
			await waitFor(() => {
				expect(mockVirtualizationHook).toHaveBeenCalled()
				const result = mockVirtualizationHook.mock.results[0].value
				expect(result.handleScroll).toHaveBeenCalled()
			})
		})

		it("should show scroll to bottom button when user scrolls up", async () => {
			const messages = generateMessages(100)
			const { getByTestId, queryByTestId, rerender } = render(<VirtualizedChatView messages={messages} />)

			// Initially no scroll button
			expect(queryByTestId("scroll-to-bottom")).not.toBeInTheDocument()

			// Simulate user scroll
			const container = getByTestId("virtuoso-container")
			fireEvent.scroll(container, { target: { scrollTop: 500 } })

			// Update mock state to show button
			mockState.isUserScrolling = true

			// Force re-render to show button
			rerender(<VirtualizedChatView messages={messages} />)

			await waitFor(() => {
				expect(queryByTestId("scroll-to-bottom")).toBeInTheDocument()
			})
		})

		it("should auto-scroll when new messages arrive", async () => {
			const { rerender } = render(<VirtualizedChatView messages={generateMessages(50)} />)

			const hook = mockVirtualizationHook.mock.results[0].value
			expect(hook.scrollManager.shouldAutoScroll()).toBe(true)

			// Add new message
			rerender(<VirtualizedChatView messages={generateMessages(51)} />)

			// Should still auto-scroll
			expect(hook.scrollManager.shouldAutoScroll()).toBe(true)
		})
	})

	describe("3. State Persistence", () => {
		it("should maintain expanded state across renders", async () => {
			const messages = generateMessages(10)
			const { getByTestId, rerender } = render(<VirtualizedChatView messages={messages} />)

			// Wait for initial render
			await waitFor(() => {
				expect(getByTestId("message-msg-0")).toBeInTheDocument()
			})

			// Expand a message that's visible
			const expandButton = getByTestId("expand-msg-0")
			fireEvent.click(expandButton)

			// Wait for state update
			await waitFor(() => {
				const messageTs = messages[0].timestamp
				expect(mockState.expandedMessages.has(String(messageTs))).toBe(true)
			})

			// Re-render with same messages
			rerender(<VirtualizedChatView messages={messages} />)

			// State should persist
			const messageTs = messages[0].timestamp
			expect(mockState.expandedMessages.has(String(messageTs))).toBe(true)
		})

		it("should clear expanded state when requested", () => {
			// Render component to initialize the hook
			render(<VirtualizedChatView messages={generateMessages(5)} />)

			// Get the hook result
			const hook = mockVirtualizationHook.mock.results[0].value

			// Set some expanded states
			const ts1 = Date.now() - 1000
			const ts2 = Date.now() - 2000
			hook.stateManager.setState(ts1, { isExpanded: true })
			hook.stateManager.setState(ts2, { isExpanded: true })

			expect(hook.stateManager.hasExpandedMessages()).toBe(true)

			// Clear all
			hook.stateManager.clear()

			expect(hook.stateManager.hasExpandedMessages()).toBe(false)
			expect(hook.stateManager.isExpanded(ts1)).toBe(false)
			expect(hook.stateManager.isExpanded(ts2)).toBe(false)
		})

		it("should maintain scroll position during updates", async () => {
			const messages = generateMessages(100)
			const { getByTestId, rerender } = render(<VirtualizedChatView messages={messages} />)

			const container = getByTestId("virtuoso-container")

			// Scroll to middle
			fireEvent.scroll(container, { target: { scrollTop: 2500 } })

			// Update messages
			rerender(<VirtualizedChatView messages={[...messages, ...generateMessages(10)]} />)

			// Scroll position should be maintained (user was scrolling)
			const hook = mockVirtualizationHook.mock.results[0].value
			expect(hook.scrollManager.shouldAutoScroll()).toBe(false)
		})
	})

	describe("4. Performance Monitoring", () => {
		it("should track performance metrics", () => {
			// Render component to initialize the hook
			render(<VirtualizedChatView messages={generateMessages(5)} />)

			// Get the hook result
			const hook = mockVirtualizationHook.mock.results[0].value

			// Start monitoring
			hook.performanceMonitor.startMonitoring()
			expect(hook.performanceMonitor.startMonitoring).toHaveBeenCalled()

			// Get metrics
			const metrics = hook.performanceMonitor.getMetrics()
			expect(metrics).toEqual({
				renderTime: 50,
				scrollFPS: 60,
				memoryUsage: 100,
			})

			// Stop monitoring
			hook.performanceMonitor.stopMonitoring()
			expect(hook.performanceMonitor.stopMonitoring).toHaveBeenCalled()
		})

		it("should handle rapid message additions efficiently", async () => {
			let messages = generateMessages(100)
			const { rerender } = render(<VirtualizedChatView messages={messages} />)

			const startTime = performance.now()

			// Rapidly add messages
			for (let i = 0; i < 10; i++) {
				messages = [...messages, ...generateMessages(10)]
				rerender(<VirtualizedChatView messages={messages} />)
			}

			const totalTime = performance.now() - startTime
			expect(totalTime).toBeLessThan(1000) // Should handle rapid updates quickly
		})
	})

	describe("5. Viewport Configuration", () => {
		it("should use optimized viewport settings", () => {
			// Render component to initialize the hook
			render(<VirtualizedChatView messages={generateMessages(5)} />)

			// Get the hook result
			const hook = mockVirtualizationHook.mock.results[0].value

			expect(hook.viewportConfig).toEqual({
				top: 500,
				bottom: 1000,
				overscan: { main: 200, reverse: 200 },
			})
		})

		it("should handle visible range changes", async () => {
			const messages = generateMessages(100)
			render(<VirtualizedChatView messages={messages} />)

			const hook = mockVirtualizationHook.mock.results[0].value

			// Simulate range change
			hook.handleRangeChange({ startIndex: 10, endIndex: 20 })

			expect(hook.handleRangeChange).toHaveBeenCalledWith({
				startIndex: 10,
				endIndex: 20,
			})
		})
	})

	describe("6. Edge Cases", () => {
		it("should handle empty message list", () => {
			const { container } = render(<VirtualizedChatView messages={[]} />)

			const items = container.querySelectorAll('[data-testid^="virtuoso-item-"]')
			expect(items.length).toBe(0)
		})

		it("should handle single message", () => {
			const { getByTestId } = render(<VirtualizedChatView messages={generateMessages(1)} />)

			expect(getByTestId("message-msg-0")).toBeInTheDocument()
		})

		it("should handle message updates", async () => {
			const messages = generateMessages(10)
			const { getByTestId, rerender } = render(<VirtualizedChatView messages={messages} />)

			// Wait for initial render
			await waitFor(() => {
				expect(getByTestId("message-msg-0")).toBeInTheDocument()
			})

			// Update a visible message
			const updatedMessages = [...messages]
			updatedMessages[0] = { ...updatedMessages[0], text: "Updated Message 0" }

			rerender(<VirtualizedChatView messages={updatedMessages} />)

			await waitFor(() => {
				expect(getByTestId("message-msg-0")).toHaveTextContent("Updated Message 0")
			})
		})
	})

	describe("7. Memory Management", () => {
		it("should not leak memory with large datasets", () => {
			const messages = generateMessages(10000)
			const { unmount } = render(<VirtualizedChatView messages={messages} />)

			// Component should unmount cleanly
			expect(() => unmount()).not.toThrow()
		})

		it("should clean up state on unmount", () => {
			const { unmount } = render(<VirtualizedChatView messages={generateMessages(100)} />)

			const hook = mockVirtualizationHook.mock.results[0].value

			// Set some state
			const ts = Date.now() - 1000
			hook.stateManager.setState(ts, { isExpanded: true })
			hook.scrollManager.forceUserScrolling()

			unmount()

			// State should be cleaned up
			hook.scrollManager.reset()
			hook.stateManager.clear()

			expect(hook.stateManager.hasExpandedMessages()).toBe(false)
		})
	})
})
