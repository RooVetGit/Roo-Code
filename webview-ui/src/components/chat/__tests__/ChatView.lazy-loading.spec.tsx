// npx vitest run src/components/chat/__tests__/ChatView.lazy-loading.spec.tsx

import React from "react"
import { render, waitFor, fireEvent } from "@/utils/test-utils"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

import { ExtensionStateContextProvider } from "@src/context/ExtensionStateContext"
import { vscode } from "@src/utils/vscode"

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
	totalClineMessages?: number
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
vi.mock("use-sound", () => ({
	default: vi.fn().mockImplementation(() => {
		return [vi.fn()]
	}),
}))

// Mock components that use ESM dependencies
vi.mock("../BrowserSessionRow", () => ({
	default: function MockBrowserSessionRow({ messages }: { messages: ClineMessage[] }) {
		return <div data-testid="browser-session">{JSON.stringify(messages)}</div>
	},
}))

vi.mock("../ChatRow", () => ({
	default: function MockChatRow({ message }: { message: ClineMessage }) {
		return <div data-testid="chat-row">{JSON.stringify(message)}</div>
	},
}))

vi.mock("../AutoApproveMenu", () => ({
	default: () => null,
}))

vi.mock("../../common/VersionIndicator", () => ({
	default: vi.fn(() => null),
}))

vi.mock("../Announcement", () => ({
	default: function MockAnnouncement() {
		return null
	},
}))

vi.mock("@src/components/welcome/RooCloudCTA", () => ({
	default: function MockRooCloudCTA() {
		return null
	},
}))

vi.mock("../QueuedMessages", () => ({
	default: function MockQueuedMessages() {
		return null
	},
}))

vi.mock("@src/components/welcome/RooTips", () => ({
	default: function MockRooTips() {
		return null
	},
}))

vi.mock("@src/components/welcome/RooHero", () => ({
	default: function MockRooHero() {
		return null
	},
}))

vi.mock("../common/TelemetryBanner", () => ({
	default: function MockTelemetryBanner() {
		return null
	},
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
	Trans: ({ i18nKey }: { i18nKey: string }) => {
		return <>{i18nKey}</>
	},
}))

// Mock ChatTextArea
vi.mock("../ChatTextArea", () => ({
	default: React.forwardRef(function MockChatTextArea(_props: any, ref: React.ForwardedRef<{ focus: () => void }>) {
		React.useImperativeHandle(ref, () => ({
			focus: vi.fn(),
		}))

		return <div data-testid="chat-textarea" />
	}),
}))

// Mock VSCode components
vi.mock("@vscode/webview-ui-toolkit/react", () => ({
	VSCodeButton: function MockVSCodeButton({
		children,
		onClick,
	}: {
		children: React.ReactNode
		onClick?: () => void
	}) {
		return <button onClick={onClick}>{children}</button>
	},
	VSCodeTextField: function MockVSCodeTextField() {
		return <input type="text" />
	},
	VSCodeLink: function MockVSCodeLink({ children }: { children: React.ReactNode }) {
		return <a>{children}</a>
	},
}))

// Mock react-virtuoso to simulate scroll events
vi.mock("react-virtuoso", () => ({
	Virtuoso: function MockVirtuoso({
		data,
		itemContent,
		startReached,
		components,
	}: {
		data: any[]
		itemContent: (index: number, item: any) => React.ReactNode
		startReached?: () => void
		components?: any
	}) {
		const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
			const element = e.currentTarget
			// Simulate reaching the top when scrollTop is 0
			if (element.scrollTop === 0 && startReached) {
				startReached()
			}
		}

		return (
			<div data-testid="virtuoso-container" onScroll={handleScroll} style={{ height: "400px", overflow: "auto" }}>
				{components?.Header && <div data-testid="virtuoso-header">{components.Header()}</div>}
				{data.map((item, index) => (
					<div key={index} data-testid={`message-${index}`}>
						{itemContent(index, item)}
					</div>
				))}
			</div>
		)
	},
}))

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
		queries: {
			retry: false,
		},
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

describe("ChatView - Lazy Loading Tests", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("initially loads only the last 50 messages", async () => {
		const { getAllByTestId } = renderChatView()

		// Create 101 messages (first one is the task message)
		const messages = Array.from({ length: 101 }, (_, i) => ({
			type: "say" as const,
			say: "assistant" as const,
			ts: i + 1000,
			text: `Message ${i + 1}`,
			partial: false,
		}))

		// Hydrate state with last 51 messages (first is task, next 50 are chat messages)
		mockPostMessage({
			clineMessages: messages.slice(-51), // Last 51 messages (1 task + 50 chat)
			totalClineMessages: 101,
		})

		// Wait for messages to render
		await waitFor(() => {
			const renderedMessages = getAllByTestId(/^message-/)
			expect(renderedMessages).toHaveLength(50)
			// Should show messages 52-101 (check the JSON contains the text)
			expect(renderedMessages[0]).toHaveTextContent('"text":"Message 52"')
			expect(renderedMessages[49]).toHaveTextContent('"text":"Message 101"')
		})
	})

	it("shows loading indicator when fetching more messages", async () => {
		const { getByTestId, queryByTestId } = renderChatView()

		// Initial state with 51 messages (1 task + 50 chat)
		const initialMessages = Array.from({ length: 51 }, (_, i) => ({
			type: "say" as const,
			say: "assistant" as const,
			ts: i + 51000,
			text: `Message ${i + 51}`,
			partial: false,
		}))

		mockPostMessage({
			clineMessages: initialMessages,
			totalClineMessages: 101,
		})

		// Wait for initial render
		await waitFor(() => {
			expect(getByTestId("virtuoso-container")).toBeInTheDocument()
		})

		// Clear previous calls
		vi.mocked(vscode.postMessage).mockClear()

		// Simulate scrolling to top
		const container = getByTestId("virtuoso-container")
		fireEvent.scroll(container, { target: { scrollTop: 0 } })

		// Should request more messages
		await waitFor(() => {
			expect(vscode.postMessage).toHaveBeenCalledWith({
				type: "requestTaskMessages",
				offset: 51,
				limit: 50,
			})
		})

		// Check for loading indicator in header
		expect(queryByTestId("virtuoso-header")).toBeInTheDocument()
	})

	it("appends older messages when received", async () => {
		const { getAllByTestId } = renderChatView()

		// Initial state with messages 51-101 (1 task + 50 chat)
		const initialMessages = Array.from({ length: 51 }, (_, i) => ({
			type: "say" as const,
			say: "assistant" as const,
			ts: (i + 50) * 1000 + 1000,
			text: `Message ${i + 51}`,
			partial: false,
		}))

		mockPostMessage({
			clineMessages: initialMessages,
			totalClineMessages: 101,
		})

		// Wait for initial render
		await waitFor(() => {
			const messages = getAllByTestId(/^message-/)
			expect(messages).toHaveLength(50)
		})

		// Simulate receiving older messages (2-51) - remember first message is task
		const olderMessages = Array.from({ length: 50 }, (_, i) => ({
			type: "say" as const,
			say: "assistant" as const,
			ts: i + 2000,
			text: `Message ${i + 2}`,
			partial: false,
		}))

		// Send taskMessagesResponse
		window.postMessage(
			{
				type: "taskMessagesResponse",
				messages: olderMessages,
				totalMessages: 100,
				hasMore: false,
			},
			"*",
		)

		// Wait for all messages to render
		await waitFor(() => {
			const messages = getAllByTestId(/^message-/)
			expect(messages).toHaveLength(100)
			// Verify we have 100 messages total (excluding the task message)
		})
	})

	it("does not request more messages when hasMore is false", async () => {
		const { getByTestId } = renderChatView()

		// Initial state with all messages loaded (1 task + 50 chat)
		const messages = Array.from({ length: 51 }, (_, i) => ({
			type: "say" as const,
			say: "assistant" as const,
			ts: i + 1000,
			text: `Message ${i + 1}`,
			partial: false,
		}))

		mockPostMessage({
			clineMessages: messages,
			totalClineMessages: 51,
		})

		// Wait for initial render
		await waitFor(() => {
			expect(getByTestId("virtuoso-container")).toBeInTheDocument()
		})

		// Set hasMore to false in state
		window.postMessage(
			{
				type: "taskMessagesResponse",
				messages: [],
				totalMessages: 51,
				hasMore: false,
			},
			"*",
		)

		// Clear previous calls
		vi.mocked(vscode.postMessage).mockClear()

		// Simulate scrolling to top
		const container = getByTestId("virtuoso-container")
		fireEvent.scroll(container, { target: { scrollTop: 0 } })

		// Should NOT request more messages
		await waitFor(() => {
			expect(vscode.postMessage).not.toHaveBeenCalledWith(
				expect.objectContaining({
					type: "requestTaskMessages",
				}),
			)
		})
	})

	it("prevents duplicate requests while loading", async () => {
		const { getByTestId } = renderChatView()

		// Initial state (1 task + 50 chat)
		const initialMessages = Array.from({ length: 51 }, (_, i) => ({
			type: "say" as const,
			say: "assistant" as const,
			ts: i + 51000,
			text: `Message ${i + 51}`,
			partial: false,
		}))

		mockPostMessage({
			clineMessages: initialMessages,
			totalClineMessages: 101,
		})

		// Wait for initial render
		await waitFor(() => {
			expect(getByTestId("virtuoso-container")).toBeInTheDocument()
		})

		// Clear previous calls
		vi.mocked(vscode.postMessage).mockClear()

		// Simulate multiple rapid scroll events
		const container = getByTestId("virtuoso-container")
		fireEvent.scroll(container, { target: { scrollTop: 0 } })
		fireEvent.scroll(container, { target: { scrollTop: 0 } })
		fireEvent.scroll(container, { target: { scrollTop: 0 } })

		// Should only send one request
		await waitFor(() => {
			expect(vscode.postMessage).toHaveBeenCalledTimes(1)
			expect(vscode.postMessage).toHaveBeenCalledWith({
				type: "requestTaskMessages",
				offset: 51,
				limit: 50,
			})
		})
	})

	it("handles empty message responses gracefully", async () => {
		const { getAllByTestId } = renderChatView()

		// Initial state (1 task + 50 chat)
		const initialMessages = Array.from({ length: 51 }, (_, i) => ({
			type: "say" as const,
			say: "assistant" as const,
			ts: i + 1000,
			text: `Message ${i + 1}`,
			partial: false,
		}))

		mockPostMessage({
			clineMessages: initialMessages,
			totalClineMessages: 51,
		})

		// Wait for initial render
		await waitFor(() => {
			const messages = getAllByTestId(/^message-/)
			expect(messages).toHaveLength(50)
		})

		// Send empty response
		window.postMessage(
			{
				type: "taskMessagesResponse",
				messages: [],
				totalMessages: 51,
				hasMore: false,
			},
			"*",
		)

		// Should still show the same messages
		await waitFor(() => {
			const messages = getAllByTestId(/^message-/)
			expect(messages).toHaveLength(50)
		})
	})

	it("filters out duplicate messages by timestamp", async () => {
		const { getAllByTestId } = renderChatView()

		// Initial state with messages (1 task + 30 chat)
		const initialMessages = Array.from({ length: 31 }, (_, i) => ({
			type: "say" as const,
			say: "assistant" as const,
			ts: (i + 20) * 1000,
			text: `Message ${i + 21}`,
			partial: false,
		}))

		mockPostMessage({
			clineMessages: initialMessages,
			totalClineMessages: 51,
		})

		// Wait for initial render
		await waitFor(() => {
			const messages = getAllByTestId(/^message-/)
			expect(messages).toHaveLength(30)
		})

		// Send response with some new messages and duplicates
		const newMessages = Array.from({ length: 20 }, (_, i) => ({
			type: "say" as const,
			say: "assistant" as const,
			ts: i * 1000,
			text: `Message ${i + 1}`,
			partial: false,
		}))

		// Include some duplicates (messages 21-25 which already exist)
		const duplicateMessages = Array.from({ length: 5 }, (_, i) => ({
			type: "say" as const,
			say: "assistant" as const,
			ts: (i + 20) * 1000,
			text: `Message ${i + 21}`,
			partial: false,
		}))

		window.postMessage(
			{
				type: "taskMessagesResponse",
				messages: [...newMessages, ...duplicateMessages],
				totalMessages: 51,
				hasMore: false,
			},
			"*",
		)

		// Should filter out duplicates and show 50 unique messages
		await waitFor(() => {
			const messages = getAllByTestId(/^message-/)
			expect(messages).toHaveLength(50)
			// We should have 50 unique messages (20 new + 30 existing)
		})
	})
})
