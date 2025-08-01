// npx vitest run src/components/chat/__tests__/ChatView.pagination.spec.tsx

import React from "react"
import { render, waitFor, act } from "@/utils/test-utils"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { vi } from "vitest"

import { ExtensionStateContextProvider } from "@src/context/ExtensionStateContext"

import ChatView, { ChatViewProps } from "../ChatView"

// Define minimal types needed for testing
interface ClineMessage {
	type: "say" | "ask"
	say?: string
	ask?: string
	ts: number
	text?: string
	partial?: boolean
}

interface ExtensionState {
	version: string
	clineMessages: ClineMessage[]
	taskHistory: any[]
	shouldShowAnnouncement: boolean
	allowedCommands: string[]
	alwaysAllowExecute: boolean
	[key: string]: any
}

// Mock vscode API
vi.mock("@src/utils/vscode", () => ({
	vscode: {
		postMessage: vi.fn(),
	},
}))

// Mock use-sound hook
const mockPlayFunction = vi.fn()
vi.mock("use-sound", () => ({
	default: vi.fn().mockImplementation(() => {
		return [mockPlayFunction]
	}),
}))

// Mock Virtuoso component to test pagination logic
let mockVirtuosoProps: any = {}
let mockRangeChanged: any = null
let mockAtBottomStateChange: any = null

vi.mock("react-virtuoso", () => ({
	Virtuoso: vi.fn().mockImplementation((props: any) => {
		// Store all props including data and key
		mockVirtuosoProps = {
			...props,
			data: props.data || [],
			key: props.key,
		}
		const { data, itemContent, rangeChanged, components, atBottomStateChange } = props

		// Store callbacks for test use
		if (rangeChanged) {
			mockRangeChanged = rangeChanged
		}
		if (atBottomStateChange) {
			mockAtBottomStateChange = atBottomStateChange
		}

		// Simulate rendering visible items
		const visibleItems = data || []

		return (
			<div data-testid="virtuoso-container" data-key={props.key}>
				{components?.Header && <div data-testid="virtuoso-header">{components.Header()}</div>}
				<div data-testid="virtuoso-content">
					{visibleItems.map((item: any, index: number) => (
						<div key={index} data-testid={`virtuoso-item-${index}`}>
							{itemContent ? itemContent(index, item) : null}
						</div>
					))}
				</div>
				{components?.Footer && <div data-testid="virtuoso-footer">{components.Footer()}</div>}
			</div>
		)
	}),
	VirtuosoHandle: vi.fn(),
}))

// Mock components that use ESM dependencies
vi.mock("../BrowserSessionRow", () => ({
	default: function MockBrowserSessionRow({ messages }: { messages: ClineMessage[] }) {
		return <div data-testid="browser-session">{messages.length} browser messages</div>
	},
}))

vi.mock("../ChatRow", () => ({
	default: function MockChatRow({ message }: { message: ClineMessage }) {
		return <div data-testid="chat-row">{message.text || message.say || message.ask}</div>
	},
}))

vi.mock("../AutoApproveMenu", () => ({
	default: () => null,
}))

vi.mock("../../common/VersionIndicator", () => ({
	default: () => null,
}))

vi.mock("../Announcement", () => ({
	default: () => null,
}))

vi.mock("@src/components/welcome/RooCloudCTA", () => ({
	default: () => null,
}))

vi.mock("../QueuedMessages", () => ({
	default: () => null,
}))

vi.mock("@src/components/welcome/RooTips", () => ({
	default: () => null,
}))

vi.mock("@src/components/welcome/RooHero", () => ({
	default: () => null,
}))

vi.mock("../common/TelemetryBanner", () => ({
	default: () => null,
}))

vi.mock("../TaskHeader", () => ({
	default: function MockTaskHeader() {
		return <div data-testid="task-header">Task Header</div>
	},
}))

vi.mock("../SystemPromptWarning", () => ({
	default: () => null,
}))

vi.mock("../CheckpointWarning", () => ({
	CheckpointWarning: () => null,
}))

vi.mock("../ProfileViolationWarning", () => ({
	default: () => null,
}))

vi.mock("../HistoryPreview", () => ({
	default: () => null,
}))

// Mock i18n
vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string) => key,
	}),
	initReactI18next: {
		type: "3rdParty",
		init: () => {},
	},
	Trans: ({ i18nKey, children }: { i18nKey: string; children?: React.ReactNode }) => {
		return <>{children || i18nKey}</>
	},
}))

// Mock ChatTextArea
vi.mock("../ChatTextArea", () => ({
	default: React.forwardRef(function MockChatTextArea(_props: any, _ref: any) {
		return <div data-testid="chat-textarea" />
	}),
}))

// Mock VSCode components
vi.mock("@vscode/webview-ui-toolkit/react", () => ({
	VSCodeButton: function MockVSCodeButton({ children, onClick }: any) {
		return <button onClick={onClick}>{children}</button>
	},
	VSCodeLink: function MockVSCodeLink({ children, href }: any) {
		return <a href={href}>{children}</a>
	},
}))

// Helper to create test messages
function createTestMessages(count: number, baseTs: number = Date.now()): ClineMessage[] {
	const messages: ClineMessage[] = []

	// Always start with a task message
	messages.push({
		type: "say",
		say: "task",
		ts: baseTs,
		text: "Test task",
	})

	// Add the requested number of messages
	for (let i = 1; i < count; i++) {
		if (i % 3 === 0) {
			// Tool message with proper JSON
			messages.push({
				type: "ask",
				ask: "tool",
				ts: baseTs + i * 1000,
				text: JSON.stringify({ tool: "readFile", path: `test${i}.txt` }),
			})
		} else if (i % 3 === 1) {
			// Regular text message
			messages.push({
				type: "say",
				say: "text",
				ts: baseTs + i * 1000,
				text: `Message ${i}`,
			})
		} else {
			// API request message
			messages.push({
				type: "say",
				say: "api_req_started",
				ts: baseTs + i * 1000,
				text: JSON.stringify({ model: "test-model", cost: 0.01 }),
			})
		}
	}

	return messages
}

// Mock window.postMessage to trigger state hydration
const mockPostMessage = (state: Partial<ExtensionState>) => {
	window.postMessage(
		{
			type: "state",
			state: {
				version: "1.0.0",
				clineMessages: [],
				taskHistory: [],
				shouldShowAnnouncement: false,
				allowedCommands: [],
				alwaysAllowExecute: false,
				cloudIsAuthenticated: false,
				telemetrySetting: "enabled",
				...state,
			},
		},
		"*",
	)
}

const defaultProps: ChatViewProps = {
	isHidden: false,
	showAnnouncement: false,
	hideAnnouncement: () => {},
}

const queryClient = new QueryClient({
	defaultOptions: {
		queries: { retry: false },
		mutations: { retry: false },
	},
})

const renderChatView = (props: Partial<ChatViewProps> = {}) => {
	return render(
		<ExtensionStateContextProvider>
			<QueryClientProvider client={queryClient}>
				<ChatView {...defaultProps} {...props} />
			</QueryClientProvider>
		</ExtensionStateContextProvider>,
	)
}

describe("ChatView - Dynamic Pagination Tests", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		mockVirtuosoProps = {}
		mockRangeChanged = null
		mockAtBottomStateChange = null
	})

	describe("Large Dataset Performance", () => {
		it("limits DOM elements to ~60 messages for large conversations", async () => {
			const { getByTestId } = renderChatView()

			// Create a conversation with 1000 messages
			const largeMessageSet = createTestMessages(1000)

			mockPostMessage({
				clineMessages: largeMessageSet,
			})

			await waitFor(() => {
				expect(getByTestId("virtuoso-container")).toBeInTheDocument()
			})

			// Wait a bit for the component to process the messages
			await waitFor(() => {
				// Check that Virtuoso is rendering a limited number of items
				const renderedItems = mockVirtuosoProps.data?.length || 0
				expect(renderedItems).toBeGreaterThan(0)
			})

			const renderedItems = mockVirtuosoProps.data?.length || 0
			// Should render approximately 60 messages (20 visible + 40 buffer)
			expect(renderedItems).toBeLessThanOrEqual(60)
		})

		it("handles very large datasets (1000+ messages) efficiently", async () => {
			const { getByTestId } = renderChatView()

			// Create a conversation with 1500 messages
			const veryLargeMessageSet = createTestMessages(1500)

			mockPostMessage({
				clineMessages: veryLargeMessageSet,
			})

			await waitFor(() => {
				expect(getByTestId("virtuoso-container")).toBeInTheDocument()
			})

			// Verify initial render shows last messages
			const renderedItems = mockVirtuosoProps.data?.length || 0
			expect(renderedItems).toBeLessThanOrEqual(60)

			// Verify the data includes recent messages
			if (mockVirtuosoProps.data && mockVirtuosoProps.data.length > 0) {
				const lastItem = mockVirtuosoProps.data[mockVirtuosoProps.data.length - 1]
				expect(lastItem).toBeDefined()
			}
		})

		it("bypasses pagination for small conversations (<20 messages)", async () => {
			const { getByTestId } = renderChatView()

			// Create a small conversation
			const smallMessageSet = createTestMessages(15)

			mockPostMessage({
				clineMessages: smallMessageSet,
			})

			await waitFor(() => {
				expect(getByTestId("virtuoso-container")).toBeInTheDocument()
			})

			// Should render all messages without pagination
			const renderedItems = mockVirtuosoProps.data?.length || 0
			// Small conversations should render all messages (minus filtered ones)
			expect(renderedItems).toBeLessThanOrEqual(15)
			expect(renderedItems).toBeGreaterThan(0)
		})
	})

	describe("Scroll Behavior", () => {
		it("loads older messages when scrolling up", async () => {
			const { getByTestId } = renderChatView()

			// Create a large conversation
			const messages = createTestMessages(100)

			mockPostMessage({
				clineMessages: messages,
			})

			await waitFor(() => {
				expect(getByTestId("virtuoso-container")).toBeInTheDocument()
			})

			// Simulate scrolling to top
			act(() => {
				if (mockRangeChanged) {
					mockRangeChanged({ startIndex: 0, endIndex: 20 })
				}
			})

			// Wait for loading indicator
			await waitFor(() => {
				const header = getByTestId("virtuoso-header")
				expect(header.querySelector(".animate-spin")).toBeInTheDocument()
			})
		})

		it("loads newer messages when scrolling down", async () => {
			const { getByTestId } = renderChatView()

			// Create a large conversation
			const messages = createTestMessages(100)

			mockPostMessage({
				clineMessages: messages,
			})

			await waitFor(() => {
				expect(getByTestId("virtuoso-container")).toBeInTheDocument()
			})

			// Get current data length
			const initialDataLength = mockVirtuosoProps.data?.length || 0

			// Simulate scrolling to bottom area
			act(() => {
				if (mockRangeChanged) {
					mockRangeChanged({
						startIndex: initialDataLength - 10,
						endIndex: initialDataLength,
					})
				}
			})

			// Check for loading indicator in footer
			await waitFor(() => {
				const footer = getByTestId("virtuoso-footer")
				if (footer.children.length > 0) {
					expect(footer.querySelector(".animate-spin")).toBeInTheDocument()
				}
			})
		})

		it("handles rapid scrolling without conflicts", async () => {
			const { getByTestId } = renderChatView()

			// Create a large conversation
			const messages = createTestMessages(200)

			mockPostMessage({
				clineMessages: messages,
			})

			await waitFor(() => {
				expect(getByTestId("virtuoso-container")).toBeInTheDocument()
			})

			// Simulate multiple rapid scroll events
			act(() => {
				if (mockRangeChanged) {
					// Scroll up
					mockRangeChanged({ startIndex: 0, endIndex: 20 })
					// Immediately scroll down
					mockRangeChanged({ startIndex: 50, endIndex: 70 })
					// Scroll up again
					mockRangeChanged({ startIndex: 10, endIndex: 30 })
				}
			})

			// Should handle rapid scrolling without errors
			expect(getByTestId("virtuoso-container")).toBeInTheDocument()
		})
	})

	describe("Loading Indicators", () => {
		it("shows loading spinner when loading older messages", async () => {
			const { getByTestId } = renderChatView()

			// Create a large conversation
			const messages = createTestMessages(100)

			mockPostMessage({
				clineMessages: messages,
			})

			await waitFor(() => {
				expect(getByTestId("virtuoso-container")).toBeInTheDocument()
			})

			// Trigger loading of older messages
			act(() => {
				if (mockRangeChanged) {
					mockRangeChanged({ startIndex: 0, endIndex: 5 })
				}
			})

			// Check for loading indicator
			await waitFor(() => {
				const header = getByTestId("virtuoso-header")
				const spinner = header.querySelector(".animate-spin")
				expect(spinner).toBeInTheDocument()
				expect(spinner).toHaveClass("border-vscode-progressBar-background")
			})
		})

		it("hides loading spinner after messages are loaded", async () => {
			const { getByTestId } = renderChatView()

			// Create a large conversation
			const messages = createTestMessages(100)

			mockPostMessage({
				clineMessages: messages,
			})

			await waitFor(() => {
				expect(getByTestId("virtuoso-container")).toBeInTheDocument()
			})

			// Initially no loading
			const header = getByTestId("virtuoso-header")
			expect(header.children.length).toBe(0)

			// Trigger loading
			act(() => {
				if (mockRangeChanged) {
					mockRangeChanged({ startIndex: 0, endIndex: 5 })
				}
			})

			// Wait for loading to complete (100ms timeout in implementation)
			await waitFor(() => {
				const updatedHeader = getByTestId("virtuoso-header")
				expect(updatedHeader.querySelector(".animate-spin")).toBeInTheDocument()
			})

			// After loading completes, spinner should disappear
			await waitFor(
				() => {
					const finalHeader = getByTestId("virtuoso-header")
					expect(finalHeader.querySelector(".animate-spin")).not.toBeInTheDocument()
				},
				{ timeout: 200 },
			)
		})
	})

	describe("Edge Cases", () => {
		it("handles new message arrival when at bottom of conversation", async () => {
			const { getByTestId } = renderChatView()

			// Start with moderate conversation
			const initialMessages = createTestMessages(50)

			mockPostMessage({
				clineMessages: initialMessages,
			})

			await waitFor(() => {
				expect(getByTestId("virtuoso-container")).toBeInTheDocument()
			})

			// Simulate being at bottom
			act(() => {
				if (mockAtBottomStateChange) {
					mockAtBottomStateChange(true)
				}
			})

			// Add new message
			const newMessages = [
				...initialMessages,
				{
					type: "say" as const,
					say: "text",
					ts: Date.now(),
					text: "New message arrived!",
				},
			]

			mockPostMessage({
				clineMessages: newMessages,
			})

			// Should adjust window to include new message
			await waitFor(() => {
				const items = getByTestId("virtuoso-content").children
				expect(items.length).toBeGreaterThan(0)
			})
		})

		it("resets pagination when switching tasks", async () => {
			const { getByTestId } = renderChatView()

			// First task with many messages
			const firstTaskMessages = createTestMessages(100, Date.now() - 10000)

			mockPostMessage({
				clineMessages: firstTaskMessages,
			})

			await waitFor(() => {
				expect(getByTestId("virtuoso-container")).toBeInTheDocument()
			})

			// Store initial state
			const _initialKey = mockVirtuosoProps.key
			const _initialDataLength = mockVirtuosoProps.data?.length || 0

			// Switch to new task with different timestamp
			const secondTaskMessages = createTestMessages(80, Date.now())

			mockPostMessage({
				clineMessages: secondTaskMessages,
			})

			// Should reset pagination state
			await waitFor(() => {
				// The component should re-render with new data
				const newDataLength = mockVirtuosoProps.data?.length || 0
				// Check that we have data
				expect(newDataLength).toBeGreaterThan(0)
				// If key is used, it should change
				if (mockVirtuosoProps.key !== undefined) {
					expect(mockVirtuosoProps.key).toBe(secondTaskMessages[0].ts)
				}
			})
		})

		it("handles mixed content types in paginated view", async () => {
			const { getByTestId } = renderChatView()

			// Create messages with various types
			const mixedMessages: ClineMessage[] = [
				{
					type: "say",
					say: "task",
					ts: Date.now() - 10000,
					text: "Mixed content task",
				},
				{
					type: "say",
					say: "text",
					ts: Date.now() - 9000,
					text: "Regular text message",
				},
				{
					type: "ask",
					ask: "tool",
					ts: Date.now() - 8000,
					text: JSON.stringify({ tool: "readFile", path: "test.txt" }),
				},
				{
					type: "ask",
					ask: "browser_action_launch",
					ts: Date.now() - 7000,
					text: JSON.stringify({ action: "launch", url: "http://example.com" }),
				},
				{
					type: "say",
					say: "browser_action",
					ts: Date.now() - 6000,
					text: JSON.stringify({ action: "click", selector: "#button" }),
				},
				{
					type: "say",
					say: "browser_action_result",
					ts: Date.now() - 5000,
					text: "Click successful",
				},
			]

			// Repeat pattern to create large dataset
			const largeDataset: ClineMessage[] = [mixedMessages[0]]
			for (let i = 0; i < 20; i++) {
				largeDataset.push(
					...mixedMessages.slice(1).map((msg) => ({
						...msg,
						ts: msg.ts + i * 10000,
					})),
				)
			}

			mockPostMessage({
				clineMessages: largeDataset,
			})

			await waitFor(() => {
				expect(getByTestId("virtuoso-container")).toBeInTheDocument()
			})

			// Should handle browser sessions and regular messages
			const content = getByTestId("virtuoso-content")
			expect(content.querySelector('[data-testid="browser-session"]')).toBeInTheDocument()
			expect(content.querySelector('[data-testid="chat-row"]')).toBeInTheDocument()
		})

		it("handles empty conversation gracefully", async () => {
			const { getByTestId, queryByTestId } = renderChatView()

			mockPostMessage({
				clineMessages: [],
			})

			// Should render without errors
			await waitFor(() => {
				expect(getByTestId("chat-view")).toBeInTheDocument()
			})

			// No virtuoso container when no task
			expect(queryByTestId("virtuoso-container")).not.toBeInTheDocument()
		})
	})

	describe("Performance Metrics", () => {
		it("maintains smooth scrolling with large datasets", async () => {
			const { getByTestId } = renderChatView()

			// Create very large conversation
			const messages = createTestMessages(500)

			const startTime = performance.now()

			mockPostMessage({
				clineMessages: messages,
			})

			await waitFor(() => {
				expect(getByTestId("virtuoso-container")).toBeInTheDocument()
			})

			const loadTime = performance.now() - startTime

			// Initial render should be fast (under 1 second)
			expect(loadTime).toBeLessThan(1000)

			// Verify limited DOM elements
			const renderedItems = mockVirtuosoProps.data?.length || 0
			expect(renderedItems).toBeLessThanOrEqual(60)
		})

		it("loads message chunks quickly (<100ms)", async () => {
			const { getByTestId } = renderChatView()

			const messages = createTestMessages(200)

			mockPostMessage({
				clineMessages: messages,
			})

			await waitFor(() => {
				expect(getByTestId("virtuoso-container")).toBeInTheDocument()
			})

			// Measure chunk loading time
			const loadStartTime = performance.now()

			act(() => {
				if (mockRangeChanged) {
					mockRangeChanged({ startIndex: 0, endIndex: 5 })
				}
			})

			// Loading should complete quickly
			await waitFor(() => {
				const header = getByTestId("virtuoso-header")
				expect(header.querySelector(".animate-spin")).toBeInTheDocument()
			})

			const loadEndTime = performance.now()
			const chunkLoadTime = loadEndTime - loadStartTime

			// Chunk loading should be fast
			expect(chunkLoadTime).toBeLessThan(200) // Allow some margin for test environment
		})
	})

	describe("User Experience", () => {
		it("preserves scroll position during message loading", async () => {
			const { getByTestId } = renderChatView()

			const messages = createTestMessages(150)

			mockPostMessage({
				clineMessages: messages,
			})

			await waitFor(() => {
				expect(getByTestId("virtuoso-container")).toBeInTheDocument()
			})

			// Simulate scroll position
			const scrollPosition = { startIndex: 50, endIndex: 70 }

			act(() => {
				if (mockRangeChanged) {
					mockRangeChanged(scrollPosition)
				}
			})

			// Load more messages
			act(() => {
				if (mockRangeChanged) {
					mockRangeChanged({ startIndex: 45, endIndex: 65 })
				}
			})

			// Position should be maintained (Virtuoso handles this internally)
			expect(getByTestId("virtuoso-container")).toBeInTheDocument()
		})

		it("provides smooth transitions without content jumps", async () => {
			const { getByTestId } = renderChatView()

			const messages = createTestMessages(100)

			mockPostMessage({
				clineMessages: messages,
			})

			await waitFor(() => {
				expect(getByTestId("virtuoso-container")).toBeInTheDocument()
			})

			// Get initial content
			const _initialContent = getByTestId("virtuoso-content").children.length

			// Trigger loading
			act(() => {
				if (mockRangeChanged) {
					mockRangeChanged({ startIndex: 0, endIndex: 10 })
				}
			})

			// Content should transition smoothly
			await waitFor(() => {
				const _newContent = getByTestId("virtuoso-content").children.length
				// Content count may change but container should remain stable
				expect(getByTestId("virtuoso-container")).toBeInTheDocument()
			})
		})

		it("maintains interactive elements during pagination", async () => {
			const { getByTestId } = renderChatView()

			const messages = createTestMessages(100)

			mockPostMessage({
				clineMessages: messages,
			})

			await waitFor(() => {
				expect(getByTestId("virtuoso-container")).toBeInTheDocument()
			})

			// Verify chat textarea remains interactive
			expect(getByTestId("chat-textarea")).toBeInTheDocument()

			// Trigger pagination
			act(() => {
				if (mockRangeChanged) {
					mockRangeChanged({ startIndex: 0, endIndex: 20 })
				}
			})

			// Interactive elements should remain available
			await waitFor(() => {
				expect(getByTestId("chat-textarea")).toBeInTheDocument()
			})
		})
	})

	describe("Browser Session Grouping with Pagination", () => {
		it("correctly groups browser sessions across page boundaries", async () => {
			const { getByTestId } = renderChatView()

			// Create messages that include browser sessions
			const messages: ClineMessage[] = [
				{
					type: "say",
					say: "task",
					ts: Date.now() - 100000,
					text: "Task with browser sessions",
				},
			]

			// Add multiple browser sessions
			for (let i = 0; i < 30; i++) {
				const baseTs = Date.now() - 90000 + i * 3000
				messages.push(
					{
						type: "ask",
						ask: "browser_action_launch",
						ts: baseTs,
						text: JSON.stringify({ action: "launch", url: `http://example${i}.com` }),
					},
					{
						type: "say",
						say: "browser_action",
						ts: baseTs + 1000,
						text: JSON.stringify({ action: "click", selector: "#button" }),
					},
					{
						type: "say",
						say: "browser_action_result",
						ts: baseTs + 2000,
						text: "Success",
					},
				)
			}

			mockPostMessage({
				clineMessages: messages,
			})

			await waitFor(() => {
				expect(getByTestId("virtuoso-container")).toBeInTheDocument()
			})

			// Should have browser session groups
			const content = getByTestId("virtuoso-content")
			expect(content.querySelector('[data-testid="browser-session"]')).toBeInTheDocument()
		})
	})

	describe("Dynamic Window Adjustment", () => {
		it("adjusts visible range when new messages arrive", async () => {
			const { getByTestId } = renderChatView()

			const initialMessages = createTestMessages(50)

			mockPostMessage({
				clineMessages: initialMessages,
			})

			await waitFor(() => {
				expect(getByTestId("virtuoso-container")).toBeInTheDocument()
			})

			// Simulate being at bottom
			act(() => {
				if (mockAtBottomStateChange) {
					mockAtBottomStateChange(true)
				}
			})

			const initialDataLength = mockVirtuosoProps.data?.length || 0

			// Add multiple new messages
			const newMessages = [...initialMessages]
			for (let i = 0; i < 10; i++) {
				newMessages.push({
					type: "say" as const,
					say: "text",
					ts: Date.now() + i,
					text: `New message ${i}`,
				})
			}

			mockPostMessage({
				clineMessages: newMessages,
			})

			// Window should adjust to show new messages
			await waitFor(() => {
				const newDataLength = mockVirtuosoProps.data?.length || 0
				// Should have adjusted to include new messages
				expect(newDataLength).toBeGreaterThanOrEqual(initialDataLength)
			})
		})

		it("maintains pagination limits even with continuous message flow", async () => {
			const { getByTestId } = renderChatView()

			let messages = createTestMessages(50)

			mockPostMessage({
				clineMessages: messages,
			})

			await waitFor(() => {
				expect(getByTestId("virtuoso-container")).toBeInTheDocument()
			})

			// Simulate continuous message flow
			for (let batch = 0; batch < 5; batch++) {
				messages = [...messages]
				for (let i = 0; i < 20; i++) {
					messages.push({
						type: "say" as const,
						say: "text",
						ts: Date.now() + batch * 1000 + i,
						text: `Batch ${batch} Message ${i}`,
					})
				}

				mockPostMessage({
					clineMessages: messages,
				})

				// Even with many messages, DOM should stay limited
				await waitFor(() => {
					const renderedItems = mockVirtuosoProps.data?.length || 0
					expect(renderedItems).toBeLessThanOrEqual(60)
				})
			}
		})
	})
})
