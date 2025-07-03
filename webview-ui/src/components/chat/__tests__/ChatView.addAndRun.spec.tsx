import React from "react"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { vi } from "vitest"
import ChatView from "../ChatView"
import { ExtensionStateContextProvider } from "@src/context/ExtensionStateContext"
import { TranslationProvider } from "@src/i18n/TranslationContext"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { TooltipProvider } from "@/components/ui/tooltip"
import { vscode } from "@src/utils/vscode"

// Mock vscode API
vi.mock("@src/utils/vscode", () => ({
	vscode: {
		postMessage: vi.fn(),
	},
}))

// Mock extract-command-pattern
vi.mock("@src/utils/extract-command-pattern", () => ({
	extractCommandPattern: vi.fn((command: string) => {
		// Simple mock implementation
		if (command === "npm test") return "npm test"
		if (command === "cd /path/to/project && npm run build:prod --verbose") return "cd * && npm run *"
		return command
	}),
	getPatternDescription: vi.fn(() => "matches similar commands"),
}))

// Mock use-sound
vi.mock("use-sound", () => ({
	default: () => [vi.fn()],
}))

// Mock react-use
vi.mock("react-use", () => ({
	useEvent: vi.fn(),
	useMount: vi.fn(),
	useDeepCompareEffect: (fn: () => void, deps: any[]) => {
		// Use regular useEffect for testing
		// eslint-disable-next-line @typescript-eslint/no-require-imports
		const React = require("react")
		// eslint-disable-next-line react-hooks/exhaustive-deps
		React.useEffect(fn, deps)
	},
	useWindowSize: () => ({ width: 1024, height: 768 }),
}))

// Mock debounce
vi.mock("debounce", () => ({
	default: (fn: any) => fn,
}))

// Mock react-virtuoso
vi.mock("react-virtuoso", () => ({
	Virtuoso: ({ data, itemContent }: any) => (
		<div data-testid="virtuoso">
			{data?.map((item: any, index: number) => <div key={index}>{itemContent(index, item)}</div>)}
		</div>
	),
}))

// Mock all problematic dependencies
vi.mock("rehype-highlight", () => ({
	default: () => () => {},
}))

vi.mock("hast-util-to-text", () => ({
	default: () => "",
}))

// Mock components that use ESM dependencies
vi.mock("../BrowserSessionRow", () => ({
	default: function MockBrowserSessionRow({ messages }: { messages: any[] }) {
		return <div data-testid="browser-session">{JSON.stringify(messages)}</div>
	},
}))

vi.mock("../ChatRow", () => ({
	default: function MockChatRow({ message }: { message: any }) {
		// Render the buttons if this is a command ask message
		if (message.type === "ask" && message.ask === "command") {
			return (
				<div data-testid="chat-row">
					<div>Command: {message.text}</div>
				</div>
			)
		}
		return <div data-testid="chat-row">{JSON.stringify(message)}</div>
	},
}))

vi.mock("../TaskHeader", () => ({
	default: function MockTaskHeader({ task }: { task: any }) {
		return <div data-testid="task-header">Task: {task.text}</div>
	},
}))

vi.mock("../AutoApproveMenu", () => ({
	default: () => null,
}))

vi.mock("@src/components/common/CodeBlock", () => ({
	default: () => null,
	CODE_BLOCK_BG_COLOR: "rgb(30, 30, 30)",
}))

vi.mock("@src/components/common/CodeAccordian", () => ({
	default: () => null,
}))

vi.mock("@src/components/chat/ContextMenu", () => ({
	default: () => null,
}))

// Mock i18n setup
vi.mock("@src/i18n/setup", () => {
	const mockT = (key: string, _options?: any) => {
		const translations: Record<string, string> = {
			"chat:runCommand.title": "Run Command",
			"chat:addAndRunCommand.title": "Add & Run",
			"chat:reject.title": "Reject",
			"chat:typeMessage": "Type a message...",
			"chat:typeTask": "Type a task...",
		}
		return translations[key] || key
	}

	const mockI18n = {
		language: "en",
		changeLanguage: vi.fn(),
		t: mockT,
		use: vi.fn().mockReturnThis(),
		init: vi.fn().mockReturnThis(),
	}

	return {
		default: mockI18n,
		loadTranslations: vi.fn(),
	}
})

// Mock react-i18next
vi.mock("react-i18next", () => {
	const mockT = (key: string, _options?: any) => {
		const translations: Record<string, string> = {
			"chat:runCommand.title": "Run Command",
			"chat:addAndRunCommand.title": "Add & Run",
			"chat:reject.title": "Reject",
			"chat:typeMessage": "Type a message...",
			"chat:typeTask": "Type a task...",
		}
		return translations[key] || key
	}

	const mockI18n = {
		language: "en",
		changeLanguage: vi.fn(),
		t: mockT,
		use: vi.fn().mockReturnThis(),
		init: vi.fn().mockReturnThis(),
	}

	return {
		useTranslation: () => ({
			t: mockT,
			i18n: mockI18n,
		}),
		Trans: ({ i18nKey, children: _children }: any) => <span>{i18nKey}</span>,
		initReactI18next: {
			type: "3rdParty",
			init: vi.fn(),
		},
	}
})

// Mock window.postMessage to trigger state hydration
const mockPostMessage = (state: any) => {
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
				autoApprovalEnabled: false,
				alwaysAllowBrowser: false,
				alwaysAllowReadOnly: false,
				alwaysAllowReadOnlyOutsideWorkspace: false,
				alwaysAllowWrite: false,
				alwaysAllowWriteOutsideWorkspace: false,
				alwaysAllowWriteProtected: false,
				alwaysAllowMcp: false,
				alwaysAllowModeSwitch: false,
				alwaysAllowSubtasks: false,
				writeDelayMs: 0,
				mode: "code",
				customModes: [],
				telemetrySetting: "enabled",
				hasSystemPromptOverride: false,
				historyPreviewCollapsed: false,
				soundEnabled: false,
				soundVolume: 0.5,
				cwd: "/test",
				filePaths: [],
				openedTabs: [],
				currentApiConfigName: "test-config",
				listApiConfigMeta: [],
				pinnedApiConfigs: {},
				customModePrompts: {},
				codebaseIndexConfig: { codebaseIndexEnabled: false },
				...state,
			},
		},
		"*",
	)
}

describe("ChatView - Add & Run Button", () => {
	const queryClient = new QueryClient({
		defaultOptions: {
			queries: {
				retry: false,
			},
		},
	})

	const renderChatView = () => {
		return render(
			<ExtensionStateContextProvider>
				<QueryClientProvider client={queryClient}>
					<TooltipProvider>
						<TranslationProvider>
							<ChatView isHidden={false} showAnnouncement={false} hideAnnouncement={() => {}} />
						</TranslationProvider>
					</TooltipProvider>
				</QueryClientProvider>
			</ExtensionStateContextProvider>,
		)
	}

	beforeEach(() => {
		vi.clearAllMocks()
		// Mock window.AUDIO_BASE_URI
		;(window as any).AUDIO_BASE_URI = ""
	})

	it("should display three buttons for command approval", async () => {
		renderChatView()

		// Hydrate state with a task message first, then a command ask
		mockPostMessage({
			clineMessages: [
				{
					type: "say",
					say: "task",
					ts: Date.now() - 2000,
					text: "Initial task",
					partial: false,
				},
				{
					type: "ask",
					ask: "command",
					ts: Date.now(),
					text: "npm test",
					partial: false,
				},
			],
		})

		// Wait for the buttons to appear
		await waitFor(
			() => {
				expect(screen.getByText("Run Command")).toBeInTheDocument()
			},
			{ timeout: 5000 },
		)

		expect(screen.getByText("Add & Run")).toBeInTheDocument()
		expect(screen.getByText("Reject")).toBeInTheDocument()
	})

	it("should send the command pattern when Add & Run button is clicked", async () => {
		renderChatView()

		// Hydrate state with a task message first, then a command ask
		mockPostMessage({
			clineMessages: [
				{
					type: "say",
					say: "task",
					ts: Date.now() - 2000,
					text: "Initial task",
					partial: false,
				},
				{
					type: "ask",
					ask: "command",
					ts: Date.now(),
					text: "npm test",
					partial: false,
				},
			],
		})

		// Wait for the buttons to appear
		await waitFor(
			() => {
				expect(screen.getByText("Run Command")).toBeInTheDocument()
				expect(screen.getByText("Add & Run")).toBeInTheDocument()
				expect(screen.getByText("Reject")).toBeInTheDocument()
			},
			{ timeout: 5000 },
		)

		// Click the Add & Run button
		const addAndRunButton = screen.getByText("Add & Run")
		fireEvent.click(addAndRunButton)

		// Verify the correct message was sent
		expect(vscode.postMessage).toHaveBeenCalledWith({
			type: "askResponse",
			askResponse: "addAndRunButtonClicked",
			text: "npm test", // The extracted pattern
			images: [],
		})
	})

	it("should extract and send the correct pattern for complex commands", async () => {
		const complexCommand = "cd /path/to/project && npm run build:prod --verbose"

		renderChatView()

		// Hydrate state with a task message first, then a command ask
		mockPostMessage({
			clineMessages: [
				{
					type: "say",
					say: "task",
					ts: Date.now() - 2000,
					text: "Build project",
					partial: false,
				},
				{
					type: "ask",
					ask: "command",
					ts: Date.now(),
					text: complexCommand,
					partial: false,
				},
			],
		})

		// Wait for the buttons to appear
		await waitFor(
			() => {
				expect(screen.getByText("Add & Run")).toBeInTheDocument()
			},
			{ timeout: 5000 },
		)

		// Click the Add & Run button
		const addAndRunButton = screen.getByText("Add & Run")
		fireEvent.click(addAndRunButton)

		// Verify the correct pattern was extracted and sent
		expect(vscode.postMessage).toHaveBeenCalledWith({
			type: "askResponse",
			askResponse: "addAndRunButtonClicked",
			text: "cd * && npm run *", // The extracted pattern
			images: [],
		})
	})

	it("should handle commands with user input", async () => {
		renderChatView()

		// Hydrate state with a task message first, then a command ask
		mockPostMessage({
			clineMessages: [
				{
					type: "say",
					say: "task",
					ts: Date.now() - 2000,
					text: "Initial task",
					partial: false,
				},
				{
					type: "ask",
					ask: "command",
					ts: Date.now(),
					text: "npm test",
					partial: false,
				},
			],
		})

		// Wait for the buttons and input to appear
		await waitFor(
			() => {
				expect(screen.getByText("Add & Run")).toBeInTheDocument()
			},
			{ timeout: 5000 },
		)

		// Type some user input
		const textarea = screen.getByPlaceholderText(/Type a message/i)
		fireEvent.change(textarea, { target: { value: "additional feedback" } })

		// Click the Add & Run button
		const addAndRunButton = screen.getByText("Add & Run")
		fireEvent.click(addAndRunButton)

		// Verify the pattern was sent (not the user input)
		expect(vscode.postMessage).toHaveBeenCalledWith({
			type: "askResponse",
			askResponse: "addAndRunButtonClicked",
			text: "npm test", // The extracted pattern, not the user input
			images: [],
		})
	})
})
