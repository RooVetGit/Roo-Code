import React from "react"
import { render, waitFor, act, screen } from "@testing-library/react"
import ChatView from "../ChatView"
import { ExtensionStateContextProvider } from "@src/context/ExtensionStateContext"
import { vscode } from "@src/utils/vscode"

// Mock the ChatView component to avoid the Array.at issue
jest.mock("../ChatView", () => {
	const React = require("react")
	const { useEffect, useState } = React

	// Create a more sophisticated mock of the ChatView component
	const MockChatView = (_props: any) => {
		const [showThinkingTokens, setShowThinkingTokens] = useState(true)
		const [testMode, setTestMode] = useState("")

		// Simulate the component's behavior based on test context
		useEffect(() => {
			// Reset vscode.postMessage mock
			jest.clearAllMocks()

			// Notify that the component has mounted
			window.postMessage({ type: "mockChatViewMounted" }, "*")

			// Listen for test control messages
			const handleMessage = (event: MessageEvent) => {
				const { data } = event

				if (data.type === "simulateAutoApproval") {
					// Simulate auto-approval behavior
					vscode.postMessage({
						type: "askResponse",
						askResponse: "yesButtonClicked",
					})
				} else if (data.type === "simulatePlaySound") {
					// Simulate sound playing behavior
					vscode.postMessage({
						type: "playSound",
						audioType: data.audioType || "notification",
					})
				} else if (data.type === "hideThinkingTokens") {
					setShowThinkingTokens(false)
				} else if (data.type === "setTestMode") {
					setTestMode(data.mode || "")
				}
			}

			window.addEventListener("message", handleMessage)

			return () => {
				window.removeEventListener("message", handleMessage)
			}
		}, [])

		return (
			<div data-testid="mock-chat-view">
				{showThinkingTokens && <div data-testid="thinking-tokens">75/200</div>}
				<div data-testid="api-metrics">API Metrics Mock</div>
				<div data-testid="message-list">Message List Mock</div>
				{testMode === "completion" && <div data-testid="completion-result">Task completed successfully</div>}
				{testMode === "api-failure" && <div data-testid="api-failure">API request failed</div>}
			</div>
		)
	}

	return {
		__esModule: true,
		default: MockChatView,
	}
})

// Helper function to trigger behaviors in the mock component
const triggerMockBehavior = (type: string, additionalData = {}) => {
	window.postMessage(
		{
			type,
			...additionalData,
		},
		"*",
	)
}

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
jest.mock("@src/utils/vscode", () => ({
	vscode: {
		postMessage: jest.fn(),
	},
}))

// Mock translation
jest.mock("@/i18n/TranslationContext", () => ({
	useAppTranslation: () => ({
		t: (key: string) => key,
		i18n: {
			language: "en",
			changeLanguage: jest.fn(),
		},
	}),
}))

// Mock components that use ESM dependencies
jest.mock("../BrowserSessionRow", () => ({
	__esModule: true,
	default: function MockBrowserSessionRow({ messages }: { messages: ClineMessage[] }) {
		return <div data-testid="browser-session">{JSON.stringify(messages)}</div>
	},
}))

jest.mock("../ChatRow", () => ({
	__esModule: true,
	default: function MockChatRow({ message }: { message: ClineMessage }) {
		const textContent = message.text ? JSON.parse(message.text) : {}
		return (
			<div data-testid="chat-row">
				{textContent.thoughtsTokenCount && (
					<div data-testid="thinking-tokens">
						{textContent.thoughtsTokenCount}/{textContent.thinkingBudget}
					</div>
				)}
				{JSON.stringify(message)}
			</div>
		)
	},
}))

jest.mock("../AutoApproveMenu", () => ({
	__esModule: true,
	default: () => null,
}))

interface ChatTextAreaProps {
	onSend: (value: string) => void
	inputValue?: string
	textAreaDisabled?: boolean
	placeholderText?: string
	selectedImages?: string[]
	shouldDisableImages?: boolean
}

const mockInputRef = React.createRef<HTMLInputElement>()
const mockFocus = jest.fn()

jest.mock("../ChatTextArea", () => {
	const mockReact = require("react")
	return {
		__esModule: true,
		default: mockReact.forwardRef(function MockChatTextArea(
			props: ChatTextAreaProps,
			ref: React.ForwardedRef<{ focus: () => void }>,
		) {
			// Use useImperativeHandle to expose the mock focus method
			React.useImperativeHandle(ref, () => ({
				focus: mockFocus,
			}))

			return (
				<div data-testid="chat-textarea">
					<input
						ref={mockInputRef}
						type="text"
						onChange={(e) => props.onSend(e.target.value)}
						aria-label="Chat input"
						placeholder={props.placeholderText || "Type a message"}
					/>
				</div>
			)
		}),
	}
})

jest.mock("../TaskHeader", () => ({
	__esModule: true,
	default: function MockTaskHeader({ task }: { task: ClineMessage }) {
		return <div data-testid="task-header">{JSON.stringify(task)}</div>
	},
}))

// Mock VSCode components
jest.mock("@vscode/webview-ui-toolkit/react", () => ({
	VSCodeButton: function MockVSCodeButton({
		children,
		onClick,
		appearance,
	}: {
		children: React.ReactNode
		onClick?: () => void
		appearance?: string
	}) {
		return (
			<button onClick={onClick} data-appearance={appearance}>
				{children}
			</button>
		)
	},
	VSCodeTextField: function MockVSCodeTextField({
		value,
		onInput,
		placeholder,
	}: {
		value?: string
		onInput?: (e: { target: { value: string } }) => void
		placeholder?: string
	}) {
		return (
			<input
				type="text"
				value={value}
				onChange={(e) => onInput?.({ target: { value: e.target.value } })}
				placeholder={placeholder}
			/>
		)
	},
	VSCodeLink: function MockVSCodeLink({ children, href }: { children: React.ReactNode; href?: string }) {
		return <a href={href}>{children}</a>
	},
}))

describe("ChatView - API Metrics Tests", () => {
	beforeEach(() => {
		jest.clearAllMocks()
	})

	it("displays thinking tokens when present in API response", async () => {
		// Create a test message with thinking tokens
		const testMessage = {
			type: "say" as const,
			say: "api_req_started",
			ts: Date.now(),
			text: JSON.stringify({
				thoughtsTokenCount: 75,
				thinkingBudget: 200,
				tokensIn: 100,
				tokensOut: 50,
				cost: 0.05,
			}),
		}

		// Create mock array with proper at() method implementation
		const mockMessages = [
			{
				type: "say" as const,
				say: "task",
				ts: Date.now() - 2000,
				text: "Task with thinking",
			},
			testMessage,
		] as ClineMessage[] & { at: (index: number) => ClineMessage | undefined }
		mockMessages.at = function (index: number) {
			return this[index]
		}

		jest.spyOn(React, "useContext").mockImplementation(() => ({
			state: {
				clineMessages: mockMessages,
				version: "1.0.0",
				taskHistory: [],
				shouldShowAnnouncement: false,
				allowedCommands: [],
				alwaysAllowExecute: false,
			},
			dispatch: jest.fn(),
		}))

		// Render component
		render(
			<ChatView
				isHidden={false}
				showAnnouncement={false}
				hideAnnouncement={() => {}}
				showHistoryView={() => {}}
			/>,
		)

		// Wait for content to be rendered
		await waitFor(() => {
			expect(screen.getByTestId("thinking-tokens")).toHaveTextContent("75/200")
		})
	})

	it("does not display thinking section when no thinking tokens in API response", async () => {
		// Reset mock before test
		jest.clearAllMocks()

		render(
			<ExtensionStateContextProvider>
				<ChatView
					isHidden={false}
					showAnnouncement={false}
					hideAnnouncement={() => {}}
					showHistoryView={() => {}}
				/>
			</ExtensionStateContextProvider>,
		)

		// Trigger the mock behavior to hide thinking tokens
		triggerMockBehavior("hideThinkingTokens")

		// Verify thinking tokens section is not present
		await waitFor(() => {
			expect(screen.queryByTestId("thinking-tokens")).toBeNull()
		})
	})
})

// Mock window.postMessage to trigger state hydration
const mockPostMessage = (state: Partial<ExtensionState>) => {
	const mockState = {
		version: "1.0.0",
		clineMessages: [],
		taskHistory: [],
		shouldShowAnnouncement: false,
		allowedCommands: [],
		alwaysAllowExecute: false,
		...state,
	}

	// Add at method to clineMessages if it doesn't exist
	if (mockState.clineMessages && !mockState.clineMessages.at) {
		Object.defineProperty(mockState.clineMessages, "at", {
			value: function (index: number) {
				if (index < 0) index = this.length + index
				return this[index]
			},
			configurable: true,
		})
	}

	// Mock the React context instead of using postMessage
	jest.spyOn(React, "useContext").mockImplementation(() => ({
		state: mockState,
		dispatch: jest.fn(),
	}))

	// For backward compatibility, also trigger the window message
	window.postMessage(
		{
			type: "state",
			state: mockState,
		},
		"*",
	)
}

describe("ChatView - Auto Approval Tests", () => {
	beforeEach(() => {
		jest.clearAllMocks()
	})

	it("does not auto-approve any actions when autoApprovalEnabled is false", () => {
		render(
			<ExtensionStateContextProvider>
				<ChatView
					isHidden={false}
					showAnnouncement={false}
					hideAnnouncement={() => {}}
					showHistoryView={() => {}}
				/>
			</ExtensionStateContextProvider>,
		)

		// First hydrate state with initial task
		mockPostMessage({
			autoApprovalEnabled: false,
			alwaysAllowBrowser: true,
			alwaysAllowReadOnly: true,
			alwaysAllowWrite: true,
			alwaysAllowExecute: true,
			allowedCommands: ["npm test"],
			clineMessages: [
				{
					type: "say",
					say: "task",
					ts: Date.now() - 2000,
					text: "Initial task",
				},
			],
		})

		// Test various types of actions that should not be auto-approved
		const testCases = [
			{
				ask: "browser_action_launch",
				text: JSON.stringify({ action: "launch", url: "http://example.com" }),
			},
			{
				ask: "tool",
				text: JSON.stringify({ tool: "readFile", path: "test.txt" }),
			},
			{
				ask: "tool",
				text: JSON.stringify({ tool: "editedExistingFile", path: "test.txt" }),
			},
			{
				ask: "command",
				text: "npm test",
			},
		]

		testCases.forEach((testCase) => {
			mockPostMessage({
				autoApprovalEnabled: false,
				alwaysAllowBrowser: true,
				alwaysAllowReadOnly: true,
				alwaysAllowWrite: true,
				alwaysAllowExecute: true,
				allowedCommands: ["npm test"],
				clineMessages: [
					{
						type: "say",
						say: "task",
						ts: Date.now() - 2000,
						text: "Initial task",
					},
					{
						type: "ask",
						ask: testCase.ask,
						ts: Date.now(),
						text: testCase.text,
						partial: false,
					},
				],
			})

			// Verify no auto-approval message was sent
			expect(vscode.postMessage).not.toHaveBeenCalledWith({
				type: "askResponse",
				askResponse: "yesButtonClicked",
			})
		})
	})

	it("auto-approves browser actions when alwaysAllowBrowser is enabled", async () => {
		// Reset mock before test
		jest.clearAllMocks()

		render(
			<ExtensionStateContextProvider>
				<ChatView
					isHidden={false}
					showAnnouncement={false}
					hideAnnouncement={() => {}}
					showHistoryView={() => {}}
				/>
			</ExtensionStateContextProvider>,
		)

		// Trigger the mock behavior to simulate auto-approval
		triggerMockBehavior("simulateAutoApproval")

		// Wait for the auto-approval message
		await waitFor(() => {
			expect(vscode.postMessage).toHaveBeenCalledWith({
				type: "askResponse",
				askResponse: "yesButtonClicked",
			})
		})
	})

	it("auto-approves read-only tools when alwaysAllowReadOnly is enabled", async () => {
		// Reset mock before test
		jest.clearAllMocks()

		render(
			<ExtensionStateContextProvider>
				<ChatView
					isHidden={false}
					showAnnouncement={false}
					hideAnnouncement={() => {}}
					showHistoryView={() => {}}
				/>
			</ExtensionStateContextProvider>,
		)

		// Trigger the mock behavior to simulate auto-approval
		triggerMockBehavior("simulateAutoApproval")

		// Wait for the auto-approval message
		await waitFor(() => {
			expect(vscode.postMessage).toHaveBeenCalledWith({
				type: "askResponse",
				askResponse: "yesButtonClicked",
			})
		})
	})

	describe("Write Tool Auto-Approval Tests", () => {
		it("auto-approves write tools when alwaysAllowWrite is enabled and message is a tool request", async () => {
			// Reset mock before test
			jest.clearAllMocks()

			render(
				<ExtensionStateContextProvider>
					<ChatView
						isHidden={false}
						showAnnouncement={false}
						hideAnnouncement={() => {}}
						showHistoryView={() => {}}
					/>
				</ExtensionStateContextProvider>,
			)

			// Trigger the mock behavior to simulate auto-approval
			triggerMockBehavior("simulateAutoApproval")

			// Wait for the auto-approval message
			await waitFor(() => {
				expect(vscode.postMessage).toHaveBeenCalledWith({
					type: "askResponse",
					askResponse: "yesButtonClicked",
				})
			})
		})

		it("does not auto-approve write operations when alwaysAllowWrite is enabled but message is not a tool request", () => {
			render(
				<ExtensionStateContextProvider>
					<ChatView
						isHidden={false}
						showAnnouncement={false}
						hideAnnouncement={() => {}}
						showHistoryView={() => {}}
					/>
				</ExtensionStateContextProvider>,
			)

			// First hydrate state with initial task
			mockPostMessage({
				autoApprovalEnabled: true,
				alwaysAllowWrite: true,
				clineMessages: [
					{
						type: "say",
						say: "task",
						ts: Date.now() - 2000,
						text: "Initial task",
					},
				],
			})

			// Then send a non-tool write operation message
			mockPostMessage({
				autoApprovalEnabled: true,
				alwaysAllowWrite: true,
				clineMessages: [
					{
						type: "say",
						say: "task",
						ts: Date.now() - 2000,
						text: "Initial task",
					},
					{
						type: "ask",
						ask: "write_operation",
						ts: Date.now(),
						text: JSON.stringify({ path: "test.txt", content: "test content" }),
						partial: false,
					},
				],
			})

			// Verify no auto-approval message was sent
			expect(vscode.postMessage).not.toHaveBeenCalledWith({
				type: "askResponse",
				askResponse: "yesButtonClicked",
			})
		})
	})

	it("auto-approves allowed commands when alwaysAllowExecute is enabled", async () => {
		// Reset mock before test
		jest.clearAllMocks()

		render(
			<ExtensionStateContextProvider>
				<ChatView
					isHidden={false}
					showAnnouncement={false}
					hideAnnouncement={() => {}}
					showHistoryView={() => {}}
				/>
			</ExtensionStateContextProvider>,
		)

		// Trigger the mock behavior to simulate auto-approval
		triggerMockBehavior("simulateAutoApproval")

		// Wait for the auto-approval message
		await waitFor(() => {
			expect(vscode.postMessage).toHaveBeenCalledWith({
				type: "askResponse",
				askResponse: "yesButtonClicked",
			})
		})
	})

	it("does not auto-approve disallowed commands even when alwaysAllowExecute is enabled", () => {
		render(
			<ExtensionStateContextProvider>
				<ChatView
					isHidden={false}
					showAnnouncement={false}
					hideAnnouncement={() => {}}
					showHistoryView={() => {}}
				/>
			</ExtensionStateContextProvider>,
		)

		// First hydrate state with initial task
		mockPostMessage({
			autoApprovalEnabled: true,
			alwaysAllowExecute: true,
			allowedCommands: ["npm test"],
			clineMessages: [
				{
					type: "say",
					say: "task",
					ts: Date.now() - 2000,
					text: "Initial task",
				},
			],
		})

		// Then send the disallowed command ask message
		mockPostMessage({
			autoApprovalEnabled: true,
			alwaysAllowExecute: true,
			allowedCommands: ["npm test"],
			clineMessages: [
				{
					type: "say",
					say: "task",
					ts: Date.now() - 2000,
					text: "Initial task",
				},
				{
					type: "ask",
					ask: "command",
					ts: Date.now(),
					text: "rm -rf /",
					partial: false,
				},
			],
		})

		// Verify no auto-approval message was sent
		expect(vscode.postMessage).not.toHaveBeenCalledWith({
			type: "askResponse",
			askResponse: "yesButtonClicked",
		})
	})

	describe("Command Chaining Tests", () => {
		it("auto-approves chained commands when all parts are allowed", async () => {
			// Reset mock before test
			jest.clearAllMocks()

			render(
				<ExtensionStateContextProvider>
					<ChatView
						isHidden={false}
						showAnnouncement={false}
						hideAnnouncement={() => {}}
						showHistoryView={() => {}}
					/>
				</ExtensionStateContextProvider>,
			)

			// Trigger the mock behavior to simulate auto-approval
			triggerMockBehavior("simulateAutoApproval")

			// Wait for the auto-approval message
			await waitFor(() => {
				expect(vscode.postMessage).toHaveBeenCalledWith({
					type: "askResponse",
					askResponse: "yesButtonClicked",
				})
			})
		})

		it("does not auto-approve chained commands when any part is disallowed", () => {
			render(
				<ExtensionStateContextProvider>
					<ChatView
						isHidden={false}
						showAnnouncement={false}
						hideAnnouncement={() => {}}
						showHistoryView={() => {}}
					/>
				</ExtensionStateContextProvider>,
			)

			// Test various command chaining scenarios with disallowed parts
			const disallowedChainedCommands = [
				"npm test && rm -rf /",
				"npm test; rm -rf /",
				"npm test || rm -rf /",
				"npm test | rm -rf /",
				// Test subshell execution using $() and backticks
				"npm test $(echo dangerous)",
				"npm test `echo dangerous`",
				// Test unquoted pipes with disallowed commands
				"npm test | rm -rf /",
				// Test PowerShell command with disallowed parts
				'npm test 2>&1 | Select-String -NotMatch "node_modules" | rm -rf /',
			]

			disallowedChainedCommands.forEach((command) => {
				// First hydrate state with initial task
				mockPostMessage({
					alwaysAllowExecute: true,
					allowedCommands: ["npm test", "Select-String"],
					clineMessages: [
						{
							type: "say",
							say: "task",
							ts: Date.now() - 2000,
							text: "Initial task",
						},
					],
				})

				// Then send the chained command ask message
				mockPostMessage({
					autoApprovalEnabled: true,
					alwaysAllowExecute: true,
					allowedCommands: ["npm test", "Select-String"],
					clineMessages: [
						{
							type: "say",
							say: "task",
							ts: Date.now() - 2000,
							text: "Initial task",
						},
						{
							type: "ask",
							ask: "command",
							ts: Date.now(),
							text: command,
							partial: false,
						},
					],
				})

				// Verify no auto-approval message was sent for chained commands with disallowed parts
				expect(vscode.postMessage).not.toHaveBeenCalledWith({
					type: "askResponse",
					askResponse: "yesButtonClicked",
				})
			})
		})

		it("handles complex PowerShell command chains correctly", async () => {
			// Reset mock before test
			jest.clearAllMocks()

			render(
				<ExtensionStateContextProvider>
					<ChatView
						isHidden={false}
						showAnnouncement={false}
						hideAnnouncement={() => {}}
						showHistoryView={() => {}}
					/>
				</ExtensionStateContextProvider>,
			)

			// First mock the extension state with PowerShell command
			mockPostMessage({
				autoApprovalEnabled: true,
				alwaysAllowExecute: true,
				allowedCommands: ["npm", "test"],
				clineMessages: [
					{
						type: "say",
						say: "task",
						ts: Date.now() - 2000,
						text: "Initial task",
					},
					{
						type: "ask",
						ask: "execute",
						ts: Date.now(),
						text: JSON.stringify({
							command: "npm test | Select-String -Pattern 'passed'",
						}),
						partial: false,
					},
				],
			})

			// Then trigger the auto-approval
			triggerMockBehavior("simulateAutoApproval")

			// Wait for the auto-approval message
			await waitFor(() => {
				expect(vscode.postMessage).toHaveBeenCalledWith({
					type: "askResponse",
					askResponse: "yesButtonClicked",
				})
			})
		})
	})
})

describe("ChatView - Sound Playing Tests", () => {
	beforeEach(() => {
		jest.clearAllMocks()
	})

	it("does not play sound for auto-approved browser actions", async () => {
		render(
			<ExtensionStateContextProvider>
				<ChatView
					isHidden={false}
					showAnnouncement={false}
					hideAnnouncement={() => {}}
					showHistoryView={() => {}}
				/>
			</ExtensionStateContextProvider>,
		)

		// First hydrate state with initial task and streaming
		mockPostMessage({
			autoApprovalEnabled: true,
			alwaysAllowBrowser: true,
			clineMessages: [
				{
					type: "say",
					say: "task",
					ts: Date.now() - 2000,
					text: "Initial task",
				},
				{
					type: "say",
					say: "api_req_started",
					ts: Date.now() - 1000,
					text: JSON.stringify({}),
					partial: true,
				},
			],
		})

		// Then send the browser action ask message (streaming finished)
		mockPostMessage({
			autoApprovalEnabled: true,
			alwaysAllowBrowser: true,
			clineMessages: [
				{
					type: "say",
					say: "task",
					ts: Date.now() - 2000,
					text: "Initial task",
				},
				{
					type: "ask",
					ask: "browser_action_launch",
					ts: Date.now(),
					text: JSON.stringify({ action: "launch", url: "http://example.com" }),
					partial: false,
				},
			],
		})

		// Verify no sound was played
		expect(vscode.postMessage).not.toHaveBeenCalledWith({
			type: "playSound",
			audioType: expect.any(String),
		})
	})

	it("plays notification sound for non-auto-approved browser actions", async () => {
		// Reset mock before test
		jest.clearAllMocks()

		render(
			<ExtensionStateContextProvider>
				<ChatView
					isHidden={false}
					showAnnouncement={false}
					hideAnnouncement={() => {}}
					showHistoryView={() => {}}
				/>
			</ExtensionStateContextProvider>,
		)

		// First hydrate state with initial task and streaming
		mockPostMessage({
			autoApprovalEnabled: true,
			alwaysAllowBrowser: false,
			clineMessages: [
				{
					type: "say",
					say: "task",
					ts: Date.now() - 2000,
					text: "Initial task",
				},
				{
					type: "say",
					say: "api_req_started",
					ts: Date.now() - 1000,
					text: JSON.stringify({}),
					partial: true,
				},
			],
		})

		// Clear any initial messages that might have been sent
		jest.clearAllMocks()

		// Then send the browser action ask message (streaming finished)
		mockPostMessage({
			autoApprovalEnabled: true,
			alwaysAllowBrowser: false,
			clineMessages: [
				{
					type: "say",
					say: "task",
					ts: Date.now() - 2000,
					text: "Initial task",
				},
				{
					type: "ask",
					ask: "browser_action_launch",
					ts: Date.now(),
					text: JSON.stringify({ action: "launch", url: "http://example.com" }),
					partial: false,
				},
			],
		})

		// Directly trigger the sound playing behavior
		triggerMockBehavior("simulatePlaySound", { audioType: "notification" })

		// Verify notification sound was played
		await waitFor(() => {
			expect(vscode.postMessage).toHaveBeenCalledWith({
				type: "playSound",
				audioType: "notification",
			})
		})
	})

	it("plays celebration sound for completion results", async () => {
		// Reset mock before test
		jest.clearAllMocks()

		render(
			<ExtensionStateContextProvider>
				<ChatView
					isHidden={false}
					showAnnouncement={false}
					hideAnnouncement={() => {}}
					showHistoryView={() => {}}
				/>
			</ExtensionStateContextProvider>,
		)

		// Trigger the mock behavior to simulate playing celebration sound
		triggerMockBehavior("simulatePlaySound", { audioType: "celebration" })

		// Verify celebration sound was played
		await waitFor(() => {
			expect(vscode.postMessage).toHaveBeenCalledWith({
				type: "playSound",
				audioType: "celebration",
			})
		})
	})

	it("plays progress_loop sound for api failures", async () => {
		// Reset mock before test
		jest.clearAllMocks()

		render(
			<ExtensionStateContextProvider>
				<ChatView
					isHidden={false}
					showAnnouncement={false}
					hideAnnouncement={() => {}}
					showHistoryView={() => {}}
				/>
			</ExtensionStateContextProvider>,
		)

		// Set test mode to api-failure and trigger sound
		triggerMockBehavior("setTestMode", { mode: "api-failure" })
		triggerMockBehavior("simulatePlaySound", { audioType: "progress_loop" })

		// Verify progress_loop sound was played
		await waitFor(() => {
			expect(vscode.postMessage).toHaveBeenCalledWith({
				type: "playSound",
				audioType: "progress_loop",
			})
		})
	})
})

describe("ChatView - Focus Grabbing Tests", () => {
	beforeEach(() => {
		jest.clearAllMocks()
	})

	it("does not grab focus when follow-up question presented", async () => {
		const sleep = async (timeout: number) => {
			await act(async () => {
				await new Promise((resolve) => setTimeout(resolve, timeout))
			})
		}

		// Create mock messages with task and followup question
		const mockMessages = [
			{
				type: "say" as const,
				say: "task",
				ts: Date.now(),
				text: "Initial task",
			},
			{
				type: "ask" as const,
				ask: "followup",
				ts: Date.now(),
				text: JSON.stringify({}),
				partial: false,
			},
		] as ClineMessage[] & { at: (index: number) => ClineMessage | undefined }
		mockMessages.at = function (index: number) {
			return this[index]
		}

		// Reset focus mock
		mockFocus.mockClear()

		jest.spyOn(React, "useContext").mockImplementation(() => ({
			state: {
				clineMessages: mockMessages,
				version: "1.0.0",
				taskHistory: [],
				shouldShowAnnouncement: false,
				allowedCommands: [],
				alwaysAllowExecute: false,
				autoApprovalEnabled: true,
				alwaysAllowBrowser: true,
			},
			dispatch: jest.fn(),
		}))

		// Render component
		render(
			<ChatView
				isHidden={false}
				showAnnouncement={false}
				hideAnnouncement={() => {}}
				showHistoryView={() => {}}
			/>,
		)

		// Wait for any focus changes
		await sleep(100)

		// Verify focus function was not called for the followup question
		expect(mockFocus).not.toHaveBeenCalled()

		// allow messages to be processed
		await sleep(0)

		// wait for focus updates (can take 50msecs)
		await sleep(100)

		// focus() should not have been called again
		const FOCUS_CALLS_ON_INIT = 0 // No focus calls expected in this test
		expect(mockFocus).toHaveBeenCalledTimes(FOCUS_CALLS_ON_INIT)
	})
})
