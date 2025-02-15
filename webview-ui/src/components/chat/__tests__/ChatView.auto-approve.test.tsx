import React from "react"
import { render, waitFor } from "@testing-library/react"
import { describe, it, expect, beforeEach } from "vitest"
import ChatView from "../ChatView"
import { ExtensionStateContextProvider } from "../../../context/ExtensionStateContext"
import { vscode } from "../../../utils/vscode"

// Mock vscode API
vi.mock("../../../utils/vscode", () => ({
	vscode: {
		postMessage: vi.fn(),
	},
}))

// Mock all problematic dependencies
vi.mock("rehype-highlight", () => ({
	__esModule: true,
	default: () => () => {},
}))

vi.mock("hast-util-to-text", () => ({
	__esModule: true,
	default: () => "",
}))

// Mock components that use ESM dependencies
vi.mock("../BrowserSessionRow", () => ({
	__esModule: true,
	default: function MockBrowserSessionRow({ messages }: { messages: any[] }) {
		return <div data-testid="browser-session">{JSON.stringify(messages)}</div>
	},
}))

vi.mock("../ChatRow", () => ({
	__esModule: true,
	default: function MockChatRow({ message }: { message: any }) {
		return <div data-testid="chat-row">{JSON.stringify(message)}</div>
	},
}))

vi.mock("../TaskHeader", () => ({
	__esModule: true,
	default: function MockTaskHeader({ task }: { task: any }) {
		return <div data-testid="task-header">{JSON.stringify(task)}</div>
	},
}))

vi.mock("../AutoApproveMenu", () => ({
	__esModule: true,
	default: () => null,
}))

vi.mock("../../common/CodeBlock", () => ({
	__esModule: true,
	default: () => null,
	CODE_BLOCK_BG_COLOR: "rgb(30, 30, 30)",
}))

vi.mock("../../common/CodeAccordian", () => ({
	__esModule: true,
	default: () => null,
}))

vi.mock("../ContextMenu", () => ({
	__esModule: true,
	default: () => null,
}))

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
				autoApprovalEnabled: true,
				...state,
			},
		},
		"*",
	)
}

describe("ChatView - Auto Approval Tests", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("auto-approves read operations when enabled", async () => {
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
			alwaysAllowReadOnly: true,
			autoApprovalEnabled: true,
			clineMessages: [
				{
					type: "say",
					say: "task",
					ts: Date.now() - 2000,
					text: "Initial task",
				},
			],
		})

		// Then send the read tool ask message
		mockPostMessage({
			alwaysAllowReadOnly: true,
			autoApprovalEnabled: true,
			clineMessages: [
				{
					type: "say",
					say: "task",
					ts: Date.now() - 2000,
					text: "Initial task",
				},
				{
					type: "ask",
					ask: "tool",
					ts: Date.now(),
					text: JSON.stringify({ tool: "readFile", path: "test.txt" }),
					partial: false,
				},
			],
		})

		// Wait for the auto-approval message
		await waitFor(() => {
			expect(vi.mocked(vscode.postMessage)).toHaveBeenCalledWith({
				type: "askResponse",
				askResponse: "yesButtonClicked",
			})
		})
	})

	it("does not auto-approve when autoApprovalEnabled is false", async () => {
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
			alwaysAllowReadOnly: true,
			autoApprovalEnabled: false,
			clineMessages: [
				{
					type: "say",
					say: "task",
					ts: Date.now() - 2000,
					text: "Initial task",
				},
			],
		})

		// Then send the read tool ask message
		mockPostMessage({
			alwaysAllowReadOnly: true,
			autoApprovalEnabled: false,
			clineMessages: [
				{
					type: "say",
					say: "task",
					ts: Date.now() - 2000,
					text: "Initial task",
				},
				{
					type: "ask",
					ask: "tool",
					ts: Date.now(),
					text: JSON.stringify({ tool: "readFile", path: "test.txt" }),
					partial: false,
				},
			],
		})

		// Verify no auto-approval message was sent
		expect(vi.mocked(vscode.postMessage)).not.toHaveBeenCalledWith({
			type: "askResponse",
			askResponse: "yesButtonClicked",
		})
	})

	it("auto-approves write operations when enabled", async () => {
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
			alwaysAllowWrite: true,
			autoApprovalEnabled: true,
			writeDelayMs: 0,
			clineMessages: [
				{
					type: "say",
					say: "task",
					ts: Date.now() - 2000,
					text: "Initial task",
				},
			],
		})

		// Then send the write tool ask message
		mockPostMessage({
			alwaysAllowWrite: true,
			autoApprovalEnabled: true,
			writeDelayMs: 0,
			clineMessages: [
				{
					type: "say",
					say: "task",
					ts: Date.now() - 2000,
					text: "Initial task",
				},
				{
					type: "ask",
					ask: "tool",
					ts: Date.now(),
					text: JSON.stringify({ tool: "editedExistingFile", path: "test.txt" }),
					partial: false,
				},
			],
		})

		// Wait for the auto-approval message
		await waitFor(() => {
			expect(vi.mocked(vscode.postMessage)).toHaveBeenCalledWith({
				type: "askResponse",
				askResponse: "yesButtonClicked",
			})
		})
	})

	it("auto-approves browser actions when enabled", async () => {
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
			alwaysAllowBrowser: true,
			autoApprovalEnabled: true,
			clineMessages: [
				{
					type: "say",
					say: "task",
					ts: Date.now() - 2000,
					text: "Initial task",
				},
			],
		})

		// Then send the browser action ask message
		mockPostMessage({
			alwaysAllowBrowser: true,
			autoApprovalEnabled: true,
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

		// Wait for the auto-approval message
		await waitFor(() => {
			expect(vi.mocked(vscode.postMessage)).toHaveBeenCalledWith({
				type: "askResponse",
				askResponse: "yesButtonClicked",
			})
		})
	})

	it("auto-approves mode switch when enabled", async () => {
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
			alwaysAllowModeSwitch: true,
			autoApprovalEnabled: true,
			clineMessages: [
				{
					type: "say",
					say: "task",
					ts: Date.now() - 2000,
					text: "Initial task",
				},
			],
		})

		// Then send the mode switch ask message
		mockPostMessage({
			alwaysAllowModeSwitch: true,
			autoApprovalEnabled: true,
			clineMessages: [
				{
					type: "say",
					say: "task",
					ts: Date.now() - 2000,
					text: "Initial task",
				},
				{
					type: "ask",
					ask: "tool",
					ts: Date.now(),
					text: JSON.stringify({ tool: "switchMode" }),
					partial: false,
				},
			],
		})

		// Wait for the auto-approval message
		await waitFor(() => {
			expect(vi.mocked(vscode.postMessage)).toHaveBeenCalledWith({
				type: "askResponse",
				askResponse: "yesButtonClicked",
			})
		})
	})

	it("does not auto-approve mode switch when disabled", async () => {
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
			alwaysAllowModeSwitch: false,
			autoApprovalEnabled: true,
			clineMessages: [
				{
					type: "say",
					say: "task",
					ts: Date.now() - 2000,
					text: "Initial task",
				},
			],
		})

		// Then send the mode switch ask message
		mockPostMessage({
			alwaysAllowModeSwitch: false,
			autoApprovalEnabled: true,
			clineMessages: [
				{
					type: "say",
					say: "task",
					ts: Date.now() - 2000,
					text: "Initial task",
				},
				{
					type: "ask",
					ask: "tool",
					ts: Date.now(),
					text: JSON.stringify({ tool: "switchMode" }),
					partial: false,
				},
			],
		})

		// Verify no auto-approval message was sent
		expect(vi.mocked(vscode.postMessage)).not.toHaveBeenCalledWith({
			type: "askResponse",
			askResponse: "yesButtonClicked",
		})
	})

	it("does not auto-approve mode switch when auto-approval is disabled", async () => {
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
			alwaysAllowModeSwitch: true,
			autoApprovalEnabled: false,
			clineMessages: [
				{
					type: "say",
					say: "task",
					ts: Date.now() - 2000,
					text: "Initial task",
				},
			],
		})

		// Then send the mode switch ask message
		mockPostMessage({
			alwaysAllowModeSwitch: true,
			autoApprovalEnabled: false,
			clineMessages: [
				{
					type: "say",
					say: "task",
					ts: Date.now() - 2000,
					text: "Initial task",
				},
				{
					type: "ask",
					ask: "tool",
					ts: Date.now(),
					text: JSON.stringify({ tool: "switchMode" }),
					partial: false,
				},
			],
		})

		// Verify no auto-approval message was sent
		expect(vi.mocked(vscode.postMessage)).not.toHaveBeenCalledWith({
			type: "askResponse",
			askResponse: "yesButtonClicked",
		})
	})
})
