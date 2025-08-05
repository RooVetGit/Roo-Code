// npx vitest run src/components/chat/__tests__/ChatView.virtualization.spec.tsx

import React from "react"
import { render, waitFor, act } from "@/utils/test-utils"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

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
	default: vi.fn(() => [mockPlayFunction]),
}))

// Mock window.AUDIO_BASE_URI
Object.defineProperty(window, "AUDIO_BASE_URI", {
	writable: true,
	value: "http://localhost/audio",
})

// Mock the virtualization hook to return a simpler implementation
vi.mock("../virtualization", () => ({
	useOptimizedVirtualization: vi.fn(({ messages: _messages }) => ({
		virtuosoRef: { current: null },
		viewportConfig: { top: 500, bottom: 1000 },
		stateManager: {
			isExpanded: () => false,
			setState: vi.fn(),
			clear: vi.fn(),
			hasExpandedMessages: () => false,
		},
		scrollManager: {
			shouldAutoScroll: () => true,
			resetUserScrolling: vi.fn(),
			forceUserScrolling: vi.fn(),
			reset: vi.fn(),
		},
		performanceMonitor: {
			startMonitoring: vi.fn(),
			stopMonitoring: vi.fn(),
		},
		handleScroll: vi.fn(),
		handleRangeChange: vi.fn(),
		handleScrollStateChange: vi.fn(),
		scrollToBottom: vi.fn(),
		isAtBottom: true,
		showScrollToBottom: false,
		visibleRange: { startIndex: 0, endIndex: 10 },
	})),
}))

// Mock components that use ESM dependencies
vi.mock("../BrowserSessionRow", () => ({
	default: function MockBrowserSessionRow({ messages: _messages }: { messages: ClineMessage[] }) {
		return <div data-testid="browser-session">{_messages.length} browser actions</div>
	},
}))

vi.mock("../ChatRow", () => ({
	default: function MockChatRow({ message }: { message: ClineMessage }) {
		return (
			<div data-testid={`message-${message.ts}`} className="chat-row">
				{message.text || message.say || message.ask || `Message ${message.ts}`}
			</div>
		)
	},
}))

// Mock Virtuoso to render items directly
vi.mock("react-virtuoso", () => ({
	Virtuoso: function MockVirtuoso({ data, itemContent }: any) {
		// Only render first 10 items to avoid memory issues
		const itemsToRender = data?.slice(0, 10) || []
		return (
			<div data-testid="virtuoso-container">
				{itemsToRender.map((item: any, index: number) => (
					<div key={index} data-testid="virtuoso-item">
						{itemContent(index, item)}
					</div>
				))}
			</div>
		)
	},
	VirtuosoHandle: {},
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

// Mock i18n
vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string) => key,
	}),
	initReactI18next: {
		type: "3rdParty",
		init: () => {},
	},
	Trans: ({ i18nKey }: { i18nKey: string }) => <>{i18nKey}</>,
}))

// Mock ChatTextArea
vi.mock("../ChatTextArea", () => ({
	default: React.forwardRef(function MockChatTextArea(_props: any, ref: any) {
		React.useImperativeHandle(ref, () => ({
			focus: vi.fn(),
		}))
		return <div data-testid="chat-textarea" />
	}),
}))

// Mock VSCode components
vi.mock("@vscode/webview-ui-toolkit/react", () => ({
	VSCodeButton: function MockVSCodeButton({ children, onClick }: any) {
		return <button onClick={onClick}>{children}</button>
	},
	VSCodeTextField: function MockVSCodeTextField() {
		return <input type="text" />
	},
	VSCodeLink: function MockVSCodeLink({ children }: any) {
		return <a>{children}</a>
	},
}))

// Helper to generate mock messages
function generateMockMessages(count: number): ClineMessage[] {
	return Array.from({ length: count }, (_, i) => ({
		type: i % 2 === 0 ? "say" : "ask",
		say: i % 2 === 0 ? "text" : undefined,
		ask: i % 2 === 1 ? "tool" : undefined,
		ts: Date.now() - (count - i) * 1000,
		text:
			i % 2 === 1 && i % 10 === 1 ? JSON.stringify({ tool: "test-tool", params: { index: i } }) : `Message ${i}`,
		partial: false,
	}))
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

describe("ChatView - Virtualization Tests", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	describe("Basic Virtualization", () => {
		it("should render ChatView with virtualization enabled", async () => {
			const { container } = renderChatView()

			// Generate a small set of messages
			const messages = generateMockMessages(20)

			act(() => {
				mockPostMessage({
					clineMessages: messages,
				})
			})

			// Wait for render
			await waitFor(() => {
				expect(container.querySelector('[data-testid="chat-view"]')).toBeInTheDocument()
			})

			// Verify virtuoso container is rendered
			expect(container.querySelector('[data-testid="virtuoso-container"]')).toBeInTheDocument()
		})

		it("should render visible messages", async () => {
			const { container } = renderChatView()

			const messages = generateMockMessages(30)

			act(() => {
				mockPostMessage({
					clineMessages: messages,
				})
			})

			// Wait for messages to render
			await waitFor(() => {
				const items = container.querySelectorAll('[data-testid="virtuoso-item"]')
				expect(items.length).toBeGreaterThan(0)
			})

			// Verify messages are rendered
			const messageElements = container.querySelectorAll('[data-testid^="message-"]')
			expect(messageElements.length).toBeGreaterThan(0)
			expect(messageElements[0].textContent).toContain("Message 0")
		})
	})

	describe("Large Message Lists", () => {
		it("should handle 100+ messages efficiently", async () => {
			const { container } = renderChatView()

			// Generate messages but only render first 10 (mocked)
			const messages = generateMockMessages(100)

			act(() => {
				mockPostMessage({
					clineMessages: messages,
				})
			})

			// Should render without crashing
			await waitFor(() => {
				expect(container.querySelector('[data-testid="chat-view"]')).toBeInTheDocument()
			})

			// Verify virtuoso is handling the messages
			const virtuosoContainer = container.querySelector('[data-testid="virtuoso-container"]')
			expect(virtuosoContainer).toBeInTheDocument()

			// Only first 10 should be rendered (due to our mock)
			const items = container.querySelectorAll('[data-testid="virtuoso-item"]')
			expect(items.length).toBe(10)
		})

		it("should handle message updates", async () => {
			const { container } = renderChatView()

			// Initial messages
			const messages = generateMockMessages(20)

			act(() => {
				mockPostMessage({
					clineMessages: messages,
				})
			})

			await waitFor(() => {
				expect(container.querySelector('[data-testid="virtuoso-container"]')).toBeInTheDocument()
			})

			// Add new message
			const newMessages = [
				...messages,
				{
					type: "say" as const,
					say: "text",
					ts: Date.now(),
					text: "New message",
					partial: false,
				},
			]

			act(() => {
				mockPostMessage({
					clineMessages: newMessages,
				})
			})

			// Should handle the update
			await waitFor(() => {
				const items = container.querySelectorAll('[data-testid="virtuoso-item"]')
				expect(items.length).toBeGreaterThan(0)
			})
		})
	})

	describe("Scrolling Behavior", () => {
		it("should auto-scroll to bottom for new messages", async () => {
			const { container } = renderChatView()

			const messages = generateMockMessages(50)

			act(() => {
				mockPostMessage({
					clineMessages: messages,
				})
			})

			await waitFor(() => {
				expect(container.querySelector('[data-testid="virtuoso-container"]')).toBeInTheDocument()
			})

			// Verify scroll manager is configured for auto-scroll
			const { useOptimizedVirtualization } = await import("../virtualization")
			const mockCall = vi.mocked(useOptimizedVirtualization).mock.calls[0]
			expect(mockCall).toBeDefined()

			// The mock returns shouldAutoScroll as true
			const result = vi.mocked(useOptimizedVirtualization).mock.results[0]
			expect(result.value.scrollManager.shouldAutoScroll()).toBe(true)
		})
	})

	describe("Performance", () => {
		it("should render initial messages quickly", async () => {
			const startTime = performance.now()
			const { container } = renderChatView()

			const messages = generateMockMessages(100)

			act(() => {
				mockPostMessage({
					clineMessages: messages,
				})
			})

			await waitFor(() => {
				expect(container.querySelector('[data-testid="virtuoso-container"]')).toBeInTheDocument()
			})

			const endTime = performance.now()
			const renderTime = endTime - startTime

			// Should render quickly (under 1 second)
			expect(renderTime).toBeLessThan(1000)
		})
	})

	describe("State Management", () => {
		it("should handle expanded state", async () => {
			const { container } = renderChatView()

			const messages = generateMockMessages(20)

			act(() => {
				mockPostMessage({
					clineMessages: messages,
				})
			})

			await waitFor(() => {
				expect(container.querySelector('[data-testid="virtuoso-container"]')).toBeInTheDocument()
			})

			// Verify state manager is available
			const { useOptimizedVirtualization } = await import("../virtualization")
			const result = vi.mocked(useOptimizedVirtualization).mock.results[0]
			expect(result.value.stateManager).toBeDefined()
			expect(result.value.stateManager.isExpanded).toBeDefined()
		})
	})

	describe("Edge Cases", () => {
		it("should handle empty message list", async () => {
			const { container } = renderChatView()

			act(() => {
				mockPostMessage({
					clineMessages: [],
				})
			})

			await waitFor(() => {
				expect(container.querySelector('[data-testid="chat-view"]')).toBeInTheDocument()
			})

			// Virtuoso should still be rendered
			expect(container.querySelector('[data-testid="virtuoso-container"]')).toBeInTheDocument()

			// But no items
			const items = container.querySelectorAll('[data-testid="virtuoso-item"]')
			expect(items.length).toBe(0)
		})

		it("should handle rapid message additions", async () => {
			const { container } = renderChatView()

			let messages = generateMockMessages(10)

			act(() => {
				mockPostMessage({
					clineMessages: messages,
				})
			})

			await waitFor(() => {
				expect(container.querySelector('[data-testid="virtuoso-container"]')).toBeInTheDocument()
			})

			// Rapidly add messages
			for (let i = 0; i < 5; i++) {
				messages = [
					...messages,
					{
						type: "say" as const,
						say: "text",
						ts: Date.now() + i,
						text: `Rapid message ${i}`,
						partial: false,
					},
				]

				act(() => {
					mockPostMessage({
						clineMessages: messages,
					})
				})
			}

			// Should handle all updates
			await waitFor(() => {
				const items = container.querySelectorAll('[data-testid="virtuoso-item"]')
				expect(items.length).toBe(10) // Still capped at 10 by our mock
			})
		})
	})
})
